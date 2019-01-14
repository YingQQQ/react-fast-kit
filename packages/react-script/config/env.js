'use strict';

const paths = require('./paths');
const path = require('path');
const fs = require('fs-extra');

// 先删除paths模块,确保在env之后再引入,但是有后遗症会导致paths模块被引入多次
// http://nodejs.cn/api/modules.html#modules_require
// https://stackoverflow.com/questions/9210542/node-js-require-cache-possible-to-invalidate
delete require.cache[path.resolve('./paths.js')];

const NODE_ENV = process.env.NODE_ENV;

if (!NODE_ENV) {
  throw new Error(
    'The NODE_ENV environment variable is required but was not specified.'
  );
}

const dotenvFiles = [
  `${paths.dotenv}.${NODE_ENV}.local`,
  `${paths.dotenv}.${NODE_ENV}`,
  NODE_ENV !== 'test' && `${paths.dotenv}.local`,
  paths.dotenv
].filter(Boolean);

// https://github.com/motdotla/dotenv
// https://github.com/motdotla/dotenv-expand
dotenvFiles.forEach(dotenvFile => {
  if (fs.existsSync(dotenvFile)) {
    require('dotenv-expand')(
      require('dotenv').config({
        path: dotenvFile,
      })
    );
  }
})