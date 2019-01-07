#!/usr/bin/env node
const chalk = require('chalk');
const commander = require('commander');
const execSync = require('child_process').execSync;
const fs = require('fs-extra');
const os = require('os');
const dns = require('dns');
const path = require('path');
const semver = require('semver');
const spawn = require('cross-spawn');
const hyperquest = require('hyperquest');
const tmp = require('tmp');
const unpack = require('tar-pack').unpack;
const validateProjectName = require('validate-npm-package-name');

const packageJson = require('./package.json');

let projectName;

const program = new commander.Command(packageJson.name)
  // .command('yarn add [name]', 'install one or more packages')
  .version(packageJson.version)
  .arguments('<project-directory>')
  .usage(`${chalk.green('<project-directory>')} [options]`)
  .action(name => {
    projectName = name;
  })
  .option('--verbose', 'print additional logs')
  .option('--use-npm', 'Use npm to install packages')
  .option('--use-pnp', 'Use yarn to install packages')
  .option('--typescript', 'install typescript dependencies packages')
  .allowUnknownOption()
  .parse(process.argv);

if (typeof projectName === 'undefined') {
  console.error(chalk.red('Please specify the project directory:'));
  console.log(
    `  ${chalk.cyan(program.name())} ${chalk.green('<project-directory>')}`
  );
  console.log();
  console.log('For example:');
  console.log(
    `  ${chalk.cyan(program.name())} ${chalk.green('my-react-component')}`
  );
  console.log();
  console.log(
    `Run ${chalk.cyan(`${program.name()} --help`)} to see all options.`
  );
  process.exit(1);
}

// createComponent(
//   projectName,
//   program.verbose,
//   program.version,
//   program.useNpm,
//   program.usePnp,
//   program.typescript,
//   program.template
// );

function createComponent(
  name,
  verbose,
  version,
  useNpm,
  usePnp,
  useTypescript,
  template
) {
  // 获取文件路径
  const root = path.resolve(name);
  // 获取文件名称
  const appName = path.basename(root);

  // 检查文件名称是否正常
  checkAppName(appName);

  // 如果目录结构不存在，则创建它，如果目录存在，则不进行创建，类似mkdir -p。 这是同步行为
  // fs.ensureDirSync(name);

  if (!isSafeToCreateProjectIn(root, name)) {
    process.exit(1);
  }

  console.log(`Creating a new React app in ${chalk.green(root)}`);
  console.log();

  const packageJson = {
    name: appName,
    version: '0.1.0',
    private: true
  };

  // 本地生成package.json文件
  fs.writeFileSync(
    path.join(root, 'package.json'),
    JSON.stringify(packageJson, null, 2) + os.EOL //Json化对象,自动缩进2格,换行使用当下系统的换行符,通过os.EOL获取
  );

  // 判断是不是选用npm
  const useYarn = useNpm ? false : shouldUseYarn();
  // 获取当前进程的目录
  const originalDirectory = process.cwd();
  // 切换到根目录
  // process.chdir()方法变更Node.js进程的当前工作目录，如果变更目录失败会抛出异常(例如，如果指定的目录不存在)。
  process.chdir(root);

  // 检查在使用npm的时候 是不是在正确的目录下执行安装
  if (!useYarn && !checkThatNpmCanReadCwd()) {
    process.exit(1);
  }

  // satisfies(version, range): Return true if the version satisfies the range.
  if (!semver.satisfies(process.version, '>=6.0.0')) {
    console.log(
      chalk.yellow(
        `You are using Node ${
          process.version
        } so the project will be bootstrapped with an old unsupported version of tools.\n\n` +
          `Please update to Node 6 or higher for a better, fully supported experience.\n`
      )
    );
    version = 'react-scripts@0.9.x';
  }

  if (!useYarn) {
    const { hasMinNpm, npmVersion } = checkNpmVersion();

    if (!hasMinNpm) {
      if (npmVersion) {
        console.log(
          chalk.yellow(
            `You are using npm ${npmVersion} so the project will be bootstrapped with an old unsupported version of tools.\n\n` +
              `Please update to npm 3 or higher for a better, fully supported experience.\n`
          )
        );
      }
      version = 'react-scripts@0.9.x';
    }
  } else if (usePnp) {
    const { hasMinYarnPnp, yarnVersion } = checkYarnVersion();
    if (!hasMinYarnPnp) {
      if (yarnVersion) {
        chalk.yellow(
          `You are using Yarn ${yarnVersion} together with the --use-pnp flag, but Plug'n'Play is only supported starting from the 1.12 release.\n\n` +
            `Please update to Yarn 1.12 or higher for a better, fully supported experience.\n`
        );
      }
      // 1.11 had an issue with webpack-dev-middleware, so better not use PnP with it (never reached stable, but still)
      usePnp = false;
    }
  }

  if (useYarn) {
    fs.copySync(
      require.resolve('../yarn.lock.cached'),
      path.join(root, 'yarn.lock')
    );
  }

  run(
    root,
    appName,
    version,
    verbose,
    originalDirectory,
    template,
    useYarn,
    usePnp,
    useTypescript
  );
}

function run(
  root,
  appName,
  version,
  verbose,
  originalDirectory,
  template,
  useYarn,
  usePnp,
  useTypescript
) {
  // 安装依赖包
  const packageToInstall = getInstallPackage(version, originalDirectory);

  // 添加开发依赖
  const allDependencies = ['react', 'react-dom', packageToInstall];

  // 如果使用typescript 则在依赖中加入相应的TS开发依赖
  if (useTypescript) {
    allDependencies.push(
      '@types/node',
      '@types/react',
      '@types/react-dom',
      '@types/jest',
      'typescript'
    );
  }

  console.log(
    chalk.green('Installing packages. This might take a couple of minutes.')
  );

  getPackageName(packageToInstall)
    .then(packageName =>
      checkIfOnline(useYarn).then(isOnline => ({
        isOnline,
        packageName
      }))
    )
    .then(({ isOnline, packageName }) => {
      console.log(
        `Installing ${chalk.cyan('react')}, ${chalk.cyan(
          'react-dom'
        )}, and ${chalk.cyan(packageName)}...`
      );
      console.log();

      return install(
        root,
        useYarn,
        usePnp,
        allDependencies,
        verbose,
        isOnline
      ).then(() => packageName);
    })
    .then(async packageName => {
      checkNodeVersion(packageName);
      setCaretRangeForRuntimeDeps(packageName);

      const pnpPath = path.resolve(process.cwd(), '.pnp.js');

      const nodeArgs = fs.existsSync(pnpPath) ? ['--require', pnpPath] : [];

      await executeNodeScript(
        {
          cwd: process.cwd(),
          args: nodeArgs
        },
        [root, appName, verbose, originalDirectory, template],
        `
        var init = require('${packageName}/scripts/init.js');
        init.apply(null, JSON.parse(process.argv[1]));
        `
      );
      if (version === 'react-scripts@0.9.x') {
        console.log(
          chalk.yellow(
            `\nNote: the project was bootstrapped with an old unsupported version of tools.\n` +
              `Please update to Node >=6 and npm >=3 to get supported tools in new projects.\n`
          )
        );
      }
    })
    .catch(reason => {
      console.log();
      console.log('Aborting installation.');
      if (reason.command) {
        console.log(`  ${chalk.cyan(reason.command)} has failed.`);
      } else {
        console.log(chalk.red('Unexpected error. Please report it as a bug:'));
        console.log(reason);
      }
      console.log();

      // On 'exit' we will delete these files from target directory.
      const knownGeneratedFiles = ['package.json', 'yarn.lock', 'node_modules'];
      const currentFiles = fs.readdirSync(path.join(root));
      currentFiles.forEach(file => {
        knownGeneratedFiles.forEach(fileToMatch => {
          // This remove all of knownGeneratedFiles.
          if (file === fileToMatch) {
            console.log(`Deleting generated file... ${chalk.cyan(file)}`);
            fs.removeSync(path.join(root, file));
          }
        });
      });
      const remainingFiles = fs.readdirSync(path.join(root));
      if (!remainingFiles.length) {
        // Delete target folder if empty
        console.log(
          `Deleting ${chalk.cyan(`${appName}/`)} from ${chalk.cyan(
            path.resolve(root, '..')
          )}`
        );
        process.chdir(path.resolve(root, '..'));
        fs.removeSync(path.join(root));
      }
      console.log('Done.');
      process.exit(1);
    });
}

function install(root, useYarn, usePnp, dependencies, verbose, isOnline) {}

function getPackageName(installPackage) {
  if (installPackage.match(/^.+\.(tgz|tar\.gz)$/)) {
    return getTemporaryDirectory()
      .then(obj => {
        let stream;
        if (/^http/.test(installPackage)) {
          stream = hyperquest(installPackage);
        } else {
          stream = fs.createReadStream(installPackage);
        }
        // 提取出数据流
        return extractStream(stream, obj.tmpdir).then(() => obj);
      })
      .then(obj => {
        const packageName = require(path.join(obj.tmpdir, 'package.json')).name;
        obj.cleanUp();
        return packageName;
      })
      .catch(err => {
        console.log(
          `Could not extract the package name from the archive: ${err.message}`
        );

        // 描述正常包的名称
        const assumedProjectName = installPackage.match(
          /^.+\/(.+?)(?:-\d+.+)?\.(tgz|tar\.gz)$/
        )[1];
        console.log(
          `Based on the filename, assuming it is "${chalk.cyan(
            assumedProjectName
          )}"`
        );
        return Promise.resolve(assumedProjectName);
      });
  } else if (installPackage.indexOf('git+') === 0) {
    // 如果是git上面拉取的包
    // git+https://github.com/mycompany/react-scripts.git
    // git+ssh://github.com/mycompany/react-scripts.git#v1.2.3
    return Promise.resolve(installPackage.match(/([^/]+)\.git(#.*)?$/)[1]);
  } else if (installPackage.match(/.+@/)) {
    // 如果匹配@,则剔除@符号
    return Promise.resolve(
      installPackage.charAt(0) + installPackage.substr(1).split('@')[0]
    );
  } else if (installPackage.match(/^file:/)) {
    const installPackagePath = installPackage.match(/^file:(.*)?$/)[1];
    const installPackageJson = require(path.join(
      installPackagePath,
      'package.json'
    ));
    return Promise.resolve(installPackageJson.name);
  }
  return Promise.resolve(installPackage);
}

// 生成临时文件
function getTemporaryDirectory() {
  return new Promise((resolve, reject) => {
    // Async创建目录, unsafeCleanup确保每次进入目录都会删除残余文件
    tmp.dir({ unsafeCleanup: true }, (err, tmpdir, callback) => {
      if (err) {
        reject(err);
      } else {
        resolve({
          tmpdir,
          cleanUp: () => {
            try {
              // 手动删除
              callback();
            } catch (error) {
              // ingnore
            }
          }
        });
      }
    });
  });
}

function extractStream(stream, path) {
  return new Promise((resolve, reject) => {
    stream.pipe(
      unpack(path, err => {
        if (err) {
          reject(err);
        } else {
          resolve(path);
        }
      })
    );
  });
}

function checkIfOnline(useYarn) {
  if (!useYarn) {
    return Promise.resolve(true);
  }
  return new Promise(resolve => {
    dns.lookup('registry.yarnpkg.com', err => {
      // 检查是否使用代理
      let proxy = getProxy();
      if (err !== null && proxy) {
        dns.lookup(url.parse(proxy).hostname, proxyErr => {
          resolve(proxyErr == null);
        });
      } else {
        resolve(err == null);
      }
    });
  });
}

function getProxy() {
  if (process.env.https_proxy) {
    return process.env.https_proxy;
  } else {
    // 检查.npmrc有没有设置代理
    const httpsProxy = execSync('npm config get https-proxy')
      .toString()
      .trim();
    return httpsProxy || undefined;
  }
}

function getInstallPackage(version, originalDirectory) {
  let packageToInstall = 'react-srcipt';

  const validSemver = semver.valid(version);

  if (validSemver) {
    packageToInstall = `@${validSemver}`;
  } else if (version) {
    if (version[0] === '@' && version.indexOf('/') === -1) {
      packageToInstall += version;
    } else if (version.match(/^file:/)) {
      packageToInstall = `file:${path.resolve(
        originalDirectory,
        version.match(/^file:(.*)?$/)[1] // 尽可能多的去匹配, 返回一个数组
      )}`;
    }
  } else {
    // for tar.gz or alternative paths
    packageToInstall = version;
  }
  return packageToInstall;
}

// 检查文件名称是否正常
function checkAppName(appName) {
  const validationResult = validateProjectName(appName);

  if (!validationResult.validForNewPackages) {
    console.error(
      `Could not create a project called ${chalk.red(
        `"${appName}"`
      )} because of npm naming restrictions:`
    );
  }
  printValidationResults(validationResult.errors);
  printValidationResults(validationResult.warnings);
}

function printValidationResults(results) {
  if (typeof results !== 'undefined') {
    results.forEach(error => {
      console.error(chalk.red(`  *  ${error}`));
    });
  }
}

const errorLogFilePatterns = [
  'npm-debug.log',
  'yarn-error.log',
  'yarn-debug.log'
];

function isSafeToCreateProjectIn(root, name) {
  const validFiles = [
    '.DS_Store',
    'Thumbs.db',
    '.git',
    '.gitignore',
    '.idea',
    'README.md',
    'LICENSE',
    '.hg',
    '.hgignore',
    '.hgcheck',
    '.npmignore',
    'mkdocs.yml',
    'docs',
    '.travis.yml',
    '.gitlab-ci.yml',
    '.gitattributes'
  ];
  // 检查文件是不是有冲突 返回一个数组
  // 1.排除validFiles的文件
  // 2.排除后缀是msl的文件
  // 3.排除 log-error的文件
  const conflicts = fs
    .readdirSync(root)
    .filter(file => !validFiles.includes(file))
    .filter(file => !/\.iml$/.test(file))
    .filter(file =>
      errorLogFilePatterns.some(pattern => file.indexOf(pattern) === 0)
    );

  // 如果有冲突文件
  if (conflicts.length > 0) {
    console.log(
      `The directory ${chalk.green(name)} contains files that could conflict:`
    );

    // 循环打印出文件名称
    for (const file of conflicts) {
      console.log(chalk.greenBright(`  ${file}`));
    }

    console.log();
    console.log(
      'Either try using a new directory name, or remove the files listed above.'
    );

    return false;
  }

  // 如果没有冲突文件则删除之前安装的残余文件,确保第一次安装终止的残余文件不会覆盖第二次安装的文件
  const currentFiles = fs.readdirSync(path.join(root));

  // 删除errorLogFilePatterns中匹配的文件
  currentFiles.forEach(file => {
    errorLogFilePatterns.forEach(errorLogFilePattern => {
      if (file.indexOf(errorLogFilePattern) === 0) {
        fs.removeSync(path.join(root, file));
      }
    });
  });

  return true;
}

function shouldUseYarn() {
  // 通过同步子进程去查询yarn版本 查看本地有没有安装
  try {
    execSync('yarnpkg --version', { stdio: 'ignore' });
    return true;
  } catch (e) {
    return false;
  }
}

function checkThatNpmCanReadCwd() {
  const cwd = process.cwd();
  let childOutput = null;

  try {
    // 子进程检查是否安装了npm
    childOutput = spawn.sync('npm', ['config', 'list']).output.join('');
  } catch (error) {
    return true;
  }

  if (typeof childOutput !== 'string') {
    return true;
  }
  const lines = childOutput.split('\n');
  console.log(lines);

  const prefix = '; cwd = ';

  // 找到npm list里面的cwd ==> '; cwd = D:\\Development\\react-dev-cli',
  const line = lines.find(line => line.indexOf(prefix) === 0);

  if (typeof line !== 'string') {
    return true;
  }

  const npmCwd = line.substring(prefix.length);

  if (npmCwd === cwd) {
    return true;
  }
  console.error(
    chalk.red(
      `Could not start an npm process in the right directory.\n\n` +
        `The current directory is: ${chalk.bold(cwd)}\n` +
        `However, a newly started npm process runs in: ${chalk.bold(
          npmCWD
        )}\n\n` +
        `This is probably caused by a misconfigured system terminal shell.`
    )
  );

  if (process.platform === 'win32') {
    console.error(
      chalk.red(`On Windows, this can usually be fixed by running:\n\n`) +
        `  ${chalk.cyan(
          'reg'
        )} delete "HKCU\\Software\\Microsoft\\Command Processor" /v AutoRun /f\n` +
        `  ${chalk.cyan(
          'reg'
        )} delete "HKLM\\Software\\Microsoft\\Command Processor" /v AutoRun /f\n\n` +
        chalk.red(`Try to run the above two lines in the terminal.\n`) +
        chalk.red(
          `To learn more about this problem, read: https://blogs.msdn.microsoft.com/oldnewthing/20071121-00/?p=24433/`
        )
    );
  }
  return false;
}

function checkNpmVersion() {
  let hasMinNpm = false;
  let npmVersion = null;

  try {
    npmVersion = execSync('npm --version')
      .toString()
      .trim();
    // gte(v1, v2): v1 >= v2
    hasMinNpm = semver.gte(npmVersion, '3.0.0');
  } catch (error) {
    // ignore
  }
  return {
    npmVersion,
    hasMinNpm
  };
}

function checkYarnVersion() {
  let hasMinYarnPnp = false;
  let yarnVersion = null;

  try {
    yarnVersion = execSync('yarnpkg --version')
      .toString()
      .trim();
    let trimmedYarnVersion = /^(.+?)[-+].+$/.exec(yarnVersion);
    if (trimmedYarnVersion) {
      trimmedYarnVersion = trimmedYarnVersion.pop();
    }
    // gte(v1, v2): v1 >= v2
    hasMinYarnPnp = semver.gte(trimmedYarnVersion || yarnVersion, '1.12.0');
  } catch (error) {
    // ignore
  }
  return {
    hasMinYarnPnp,
    yarnVersion
  };
}

console.log(checkYarnVersion());

console.log(chalk.yellow('end'));
