'use strict';
/**
 * 如果在事件循环的一次轮询中，一个 Promise 被 rejected，
 * 并且此 Promise 没有绑定错误处理器，'unhandledRejection事件会被触发
 * 当使用 Promise 进行编程时，异常会以 "rejected promises" 的形式封装。
 * Rejection 可以被 promise.catch() 捕获并处理，并且在 Promise 链中传播。
 * 'unhandledRejection 事件在探测和跟踪 promise 被 rejected，并且 rejection
 * 未被处理的场景中是很有用的。
 */
process.on('unhandledRejection', reason => {
  throw reason;
});

const chalk = require('chalk');
const execSync = require('child_process').execSync;
const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const spawn = require('cross-spawn');
const verifyTypeScriptSetup = require('./utils/verifyTypeScriptSetup');

const defaultBrowsers = [
  '>0.2%',
  'not dead',
  'not ie <= 11',
  'not op_mini all'
];

function isReactInstalled(appPackage) {
  const dependencies = appPackage.dependencies || {};

  return (
    typeof dependencies.react !== 'undefined' &&
    typeof dependencies['react-dom'] !== 'undefined'
  );
}

function isInGitRepository() {
  try {
    // 当前工作目录位于存储库的工作树内时，打印“true”，否则为“false”。
    execSync('git rev-parse --is-inside-work-tree', {
      stdio: 'ignore'
    });
    return true;
  } catch (error) {
    return false;
  }
}

function tryGitInit(appPath) {
  let didInit = false;
  try {
    execSync('git --version', {
      stdio: 'ignore'
    });
    if (isInGitRepository()) {
      return false;
    }
  
    execSync('git init', {
      stdio: 'ignore'
    });
    didInit = true;
    execSync('git add -A', {
      stdio: 'ignore'
    })

    execSync('git commit -m "Initial commit from Create React App"', {
      stdio: 'ignore',
    });
    return true;
  } catch (error) {
    if (didInit) {
      // 如果成功初始化但是却无法提交,有可能没有设置用户名
      try {
        fs.removeSync(path.join(appPath, '.git'));
      } catch (removeErr) {
        // Ignore.
      }
    }
    return false;
  }
}

// 浅析 NodeJs 的几种文件路径
// https://github.com/imsobear/blog/issues/48
module.exports = function init(
  appPath,
  appName,
  verbose,
  originalDirectory,
  template
) {
  // 返回 path 的目录名
  // require.resolve此操作只返回解析后的文件名，不会加载该模块
  const ownPath = path.resolve(
    require.resolve(path.join(__dirname, '..', 'package.json'))
  );

  const appPackage = require(path.join(appPath, 'package.json'));
  const useYarn = fs.existsSync(path.join(appPath, 'yarn.lock'));

  // 用于merge的时候不报错
  appPackage.dependencies = appPackage.dependencies || {};

  const useTypeScript = appPackage.dependencies['typescript'] !== undefined;

  // Setup the script rules
  appPackage.scripts = {
    start: 'react-app-script start',
    build: 'react-app-script build',
    test: 'react-app-script test',
  };

  // Setup the eslint config
  appPackage.eslintConfig = {
    extends: 'react-app'
  };

  appPackage.browserslist = defaultBrowsers;

  fs.writeFileSync(
    path.join(appPath, 'package.json'),
    JSON.stringify(appPackage, null, 2) + os.EOL
  );

  const readmeExists = fs.existsSync(path.join(appPath, 'READEME.md'));

  if (readmeExists) {
    fs.renameSync(
      path.join(appPath, 'READEME.md'),
      path.join(appPath, 'READEME.old.md')
    );
  }

  const templatePath = template
    ? path.resolve(originalDirectory, template)
    : path.join(ownPath, useTypeScript ? 'template-typescript' : 'template');

  if (templatePath) {
    fs.copySync(templatePath, appPath);
  } else {
    console.error(
      `Could not locate supplied template: ${chalk.green(templatePath)}`
    );
    return;
  }

  // 在包发布的时候.gitignore会被修改成.npmignore,
  // 因此在生产的时候修改回原本的文件命名
  // https://github.com/npm/npm/issues/1862
  try {
    fs.removeSync(
      path.join(appPath, 'gitignore'),
      path.join(appPath, '.gitignore'),
      []
    );
  } catch (error) {
    if (error.code === 'EEXIST') {
      // 如果本地已经存在gitignore文件, 则先读取存在的文件
      // 然后添加进.gitignore文件,最后删除原本的文件
      const data = fs.readFileSync(path.join(appPath), 'gitignore');
      fs.appendFileSync(path.join(appPath, '.gitignore'), data);
      fs.unlinkSync(path.join(appPath), 'gitignore');
    } else {
      throw error;
    }
  }

  let command;
  let args;

  if (useYarn) {
    command = 'yarnpkg';
    args = ['add'];
  } else {
    command = 'npm';
    args = ['install', '--save', verbose && '--verbose'].filter(e => e);
  }

  args.push('react', 'react-dom');

  const templateDependenciesPath = path.join(
    appPath,
    'template.dependencies.json'
  );

  if (fs.existsSync(templateDependenciesPath)) {
    const templateDependencies = require(templateDependenciesPath).dependencies;
    args = args.concat(
      Object.keys(templateDependencies).map(
        key => `${key}@${templateDependencies[key]}`
      )
    );
    fs.unlinkSync(templateDependenciesPath);
  }

  if (!isReactInstalled(appPackage) || template) {
    console.log(`Installing react and react-dom using ${command}...`);
    console.log();

    const proc = spawn.sync(command, args, {
      stdio: 'inherit'
    });

    // 进程退出码只有是0的时候没有异常
    if (proc.status !== 0) {
      console.error(`${command} ${args.join(' ')} failed`);
      return;
    }
  }

  if (useTypeScript) {
    verifyTypeScriptSetup();
  }

  if (tryGitInit(appPath)) {
    console.log();
    console.log('Initialized a git repository.');
  }

  let cdPath;
  if (originalDirectory && path.join(originalDirectory, appName) === appPath) {
    cdPath = appName;
  } else {
    cdPath = appPath;
  }

  // Change displayed command to yarn instead of yarnpkg
  const displayedCommand = useYarn ? 'yarn' : 'npm';

  console.log();
  console.log(`Success! Created ${appName} at ${appPath}`);
  console.log('Inside that directory, you can run several commands:');
  console.log();
  console.log(chalk.cyan(`  ${displayedCommand} start`));
  console.log('    Starts the development server.');
  console.log();
  console.log(
    chalk.cyan(`  ${displayedCommand} ${useYarn ? '' : 'run '}build`)
  );
  console.log('    Bundles the app into static files for production.');
  console.log();
  console.log(chalk.cyan(`  ${displayedCommand} test`));
  console.log('    Starts the test runner.');
  console.log();
  console.log(
    chalk.cyan(`  ${displayedCommand} ${useYarn ? '' : 'run '}eject`)
  );
  console.log(
    '    Removes this tool and copies build dependencies, configuration files'
  );
  console.log(
    '    and scripts into the app directory. If you do this, you can’t go back!'
  );
  console.log();
  console.log('We suggest that you begin by typing:');
  console.log();
  console.log(chalk.cyan('  cd'), cdPath);
  console.log(`  ${chalk.cyan(`${displayedCommand} start`)}`);
  if (readmeExists) {
    console.log();
    console.log(
      chalk.yellow(
        'You had a `README.md` file, we renamed it to `README.old.md`'
      )
    );
  }
  console.log();
  console.log('Happy hacking!');
};
