'use strict';

const chalk = require('chalk');
const path = require('path');
const os = require('os');

class ModuleScopePlugin {
  constructor(appSrc, allowedFiles = []) {
    this.appSrc = Array.isArray(appSrc) ? appSrc: [appSrc];
    this.allowedFiles = new Set(allowedFiles)
  }
}