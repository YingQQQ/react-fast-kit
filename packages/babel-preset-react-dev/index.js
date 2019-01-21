'use strict';

const create = require('./create');

module.exports = function babelPresets(api, configs) {
  const env = process.env.BEBEL_ENV || process.env.NODE_ENV;
  return create(api, configs, env);
};
