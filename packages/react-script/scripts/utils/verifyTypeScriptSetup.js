'use strict';

const chalk = require('chalk');
const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const immer = require('immer');
const globby = require('globby').sync;
const paths = require('../../config/paths');
const resolve = require('resolve');

function writeJson(fileName, object) {
  fs.writeFileSync(fileName, JSON.stringify(object, null, 2) + os.EOL);
}

// 检查是不是有TS文件类型
function verifyNoTypeScript() {
  const typescriptFiles = global('**/*.(ts|tsx)', {
    cwd: paths.appSrc
  });

  if (typescriptFiles.length > 0) {
    console.warn(
      chalk.yellow(
        `We detected TypeScript in your project (${chalk.bold(
          `src${path.sep}${typescriptFiles[0]}`
        )}) and created a ${chalk.bold('tsconfig.json')} file for you.`
      )
    );
    console.warn();
    return false;
  }
  return true;
}


function verifyTypeScriptSetup() {
  let fisrtTimeSetup;

  if (!fs.existsSync(paths.appTsConfig)) {
    if (verifyNoTypeScript()) {
      return;
    }
    writeJson(paths.appTsConfig, {})
    fisrtTimeSetup = true;
  }

  const isYarn = fs.existsSync(paths.yarnLockFile);
  
  //确保ts编译工具安装
  let ts;
  try {
    ts = require(
      resolve.sync('typescript', {
        basedir: paths.appNodeModules
      })
    )
  } catch (error) {
    console.error(
      chalk.bold.red(
        `It looks like you're trying to use TypeScript but do not have ${chalk.bold(
          'typescript'
        )} installed.`
      )
    );
    console.error(
      chalk.bold(
        'Please install',
        chalk.cyan.bold('typescript'),
        'by running',
        chalk.cyan.bold(
          isYarn ? 'yarn add typescript' : 'npm install typescript'
        ) + '.'
      )
    );
    console.error(
      chalk.bold(
        'If you are not trying to use TypeScript, please remove the ' +
          chalk.cyan('tsconfig.json') +
          ' file from your package root (and any TypeScript files).'
      )
    );
    console.error();
    process.exit(1);
  }
}