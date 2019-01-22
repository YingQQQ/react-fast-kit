'use strict';

// 此Webpack插件确保“npm install<library>”强制重新生成项目。
class WatchMissingNodeModulesPlugin {
  constructor(nodeModulesPath) {
    this.nodeModulesPath = nodeModulesPath;
  }

  apply(compiler) {
    compiler.hooks.emit.tap('WatchMissingNodeModulesPlugin', compilation => {
      var missingDeps = Array.from(compilation.missingDependencies);
      var nodeModulesPath = this.nodeModulesPath;

      if (missingDeps.some(file => file.includes(nodeModulesPath))) {
        compilation.contextDependencies.add(nodeModulesPath);
      }
    });
  }
}

module.exports = WatchMissingNodeModulesPlugin;