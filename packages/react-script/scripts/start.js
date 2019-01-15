'use strict';
process.env.BABEL_ENV = 'development';
process.env.NODE_ENV = 'development';

process.on('unhandledRejection', err => {
  throw err;
});

require('../config/env');

const verifyPackageTree = require('./utils/verifyPackageTree');

if (process.env.SKIP_PREFLIGHT_CHECK !== 'true') {
  verifyPackageTree();
}

const chalk = require('chalk');
const fs = require('fs');
const webpack = require('webpack');
const WebpackDevServer = require('webpack-dev-server');
const clearConsole = require('../../react-dev-utils/clearConsole');
const openBrowser = require('../../react-dev-utils/openBrowser');
const paths = require('../config/paths');
