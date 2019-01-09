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

const defaultBrowsers = [
  '>0.2%',
  'not dead',
  'not ie <= 11',
  'not op_mini all'
];

console.log(
  chalk.green(require.resolve(path.join(__dirname, '..', 'package.json')))
);

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
    start: 'react-scripts start',
    build: 'react-scripts build',
    test: 'react-scripts test',
    eject: 'react-scripts eject'
  };

  // Setup the eslint config
  appPackage.eslintConfig = {
    extends: 'react-app'
  };

  appPackage.browserslist = defaultBrowsers;

  fs.writeFileSync(
    path.join(appPath, 'package.json'),
    JSON.parse(appPackage, null, 2) + os.EOL
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
    fs.copyFileSync(templatePath, appPath);
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

    const proc = spawn.sync(
      command,
      args,
      {
        stdio: 'inherit'
      }
    )
    
    // 进程退出码只有是0的时候没有异常
    if (proc.status !== 0) {
      console.error(`${command} ${args.join(' ')} failed`)
      return
    }
  }

  if (useTypeScript) {
    verifyTypeScriptSetup();
  }

  if (tryGitInit(appPath)) {
    console.log();
    console.log('Initialized a git repository.');
  }
};
