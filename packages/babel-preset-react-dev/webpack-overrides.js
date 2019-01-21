'use strict';

const crypto = require('crypto');

// 宏正则
const macroCheck = new RegExp('[./]macro');

module.exports = function webpackOverrides() {
  return {
    config(config, { source }) {
      if (macroCheck.test(source)) {
        return Object.assign({}, config.options, {
          caller: Object.assign({}, config.options.caller, {
            craInvalidationToken: crypto.randomBytes(32).toString('hex')
          })
        });
      }
      return config.options;
    }
  };
};
