'use strict';

const chalk = require('chalk');
const path = require('path');
const fs = require('fs');
const url = require('url');
const resolve = require('resolve');


const appDirectory = fs.realpathSync(process.cwd());
const resolveApp = relativePath => path.resolve(appDirectory, relativePath);
const appNodeModules = resolveApp('node_modules');

const ts = require(
  resolve.sync('typescript', {
    basedir: appNodeModules
  })
)

console.log(ts.ModuleKind);