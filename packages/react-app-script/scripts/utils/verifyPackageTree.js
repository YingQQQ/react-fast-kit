'use strict';

const chalk = require('chalk');
const fs = require('fs');
const path = require('path');

function verifyPackageTree() {
  const depsToCheck = [
    'babel-eslint',
    'babel-jest',
    'babel-loader',
    'eslint',
    'jest',
    'webpack',
    'webpack-dev-server'
  ];
  const semverRegex = /\bv?(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[\da-z-]+(?:\.[\da-z-]+)*)?(?:\+[\da-z-]+(?:\.[\da-z-]+)*)?\b/gi;
  const ownPackageJson = require('../../package.json');
  const expectedVersionsByDep = {};
  depsToCheck.forEach(dep => {
    const expectedVersion = ownPackageJson.dependencies[dep];
    if (!expectedVersion) {
      throw new Error('This dependency list is outdated, fix it.');
    }
    if (!semverRegex.test(expectedVersion)) {
      throw new Error(
        `The ${dep} package should be pinned, instead got version ${expectedVersion}.`
      );
    }
    expectedVersionsByDep[dep] = expectedVersion;
  });
  // 验证是不是有其他版本被安装
  let currentDir = __dirname;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const previousDir = currentDir;
    currentDir = path.resolve(currentDir, '..');
    if (currentDir === previousDir) {
      // 已经到达根目录
      break;
    }
    const maybeNodeModules = path.resolve(currentDir, 'node_modules');
    if (!fs.existsSync(maybeNodeModules)) {
      continue;
    }
    depsToCheck.forEach(dep => {
      const maybeDep = path.resolve(maybeNodeModules, dep);
      if (!fs.existsSync(maybeDep)) {
        return;
      }
      const maybeDepPackageJson = path.resolve(currentDir, 'package.json');
      if (!fs.existsSync(maybeDepPackageJson)) {
        return;
      }
      const depPackageJson = fs.readFileSync(maybeDepPackageJson, 'utf-8');
      const expectedVersion = expectedVersionsByDep[dep];
      if (depPackageJson.version !== expectedVersion) {
        console.error(
          chalk.bgWhite(
            `\nThere might be a problem with the project dependency tree.\n` +
              `It is likely ${chalk.bold(
                'not'
              )} a bug in Create React App, but something you need to fix locally.\n\n`
          ) +
            `The ${chalk.bold(ownPackageJson.name)}` +
            `The ${chalk.green(
              `Don't try to install it manually: your package manager does it automatically.`
            )}`
        );
      }
    });
  }
}

module.exports = verifyPackageTree;
