'use strict';

const path = require('path');
const fs = require('fs');
const url = require('url');

const appDirectory = fs.realpathSync(process.cwd());
const resolveApp = relativePath => path.resolve(appDirectory, relativePath);

const envPublicUrl = process.env.PUBILC_URL;

/**
 *
 * @param {string} inputPath file path
 * @param {boolean} needsSlash if need slash
 */
function ensureSlash(inputPath, needsSlash) {
  const hasSlash = inputPath.endsWith('/');
  if (hasSlash && !needsSlash) {
    return inputPath.substr(0, inputPath.length - 1);
  } else if (!hasSlash && needsSlash) {
    return `${inputPath}/`;
  }
  return inputPath;
}

// 获取公共路径
const getPublicUrl = appPackageJson =>
  envPublicUrl || require(appPackageJson).homePage;

function getServedPath(appPackageJson) {
  const publicUrl = getPublicUrl(appPackageJson);
  const servedUrl =
    envPublicUrl || (publicUrl ? url.parse(publicUrl).pathname : '/');
  return ensureSlash(servedUrl, true);
}

const moduleFileExtensions = [
  'web.mjs',
  'mjs',
  'web.js',
  'js',
  'web.ts',
  'ts',
  'web.tsx',
  'tsx',
  'json',
  'web.jsx',
  'jsx'
];

// 按照webpack相同的方式去解析文件路径
const resolveModule = (resolveFn, filePath) => {
  const extension = moduleFileExtensions.find(extension =>
    fs.existsSync(resolveFn(`${filePath}.${extension}`))
  );

  if (extension) {
    return resolveFn(`${filePath}.${extension}`);
  }
  resolveFn(`${filePath}.js`);
};


module.exports = {
  appPath: resolveApp('.'),
  dotenv: resolveApp('.env'),
  appTsConfig: resolveApp('tsconfig.json'),
  appSrc: resolveApp('src'),
  appPackageJson: resolveApp('package.json'),
  yarnLockFile: resolveApp('yarn.lock'),
  appNodeModules: resolveApp('node_modules'),
  servedPath: getServedPath(resolveApp('package.json')),
  appIndexJs: resolveModule(resolveApp, 'src/index'),
  appBuild: resolveApp('build'),
  appHtml: resolveApp('public/index.html'),
  publicUrl: getPublicUrl(resolveApp('package.json')),
  appPublic: resolveApp('public'),
} 

module.exports.moduleFileExtensions = moduleFileExtensions;