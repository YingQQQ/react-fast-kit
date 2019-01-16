'use strict';

const fs = require('fs-extra');
const htmlWebpackPlugin = require('html-webpack-plugin');
const path = require('path');
const PnpWebpackPlugin = require('pnp-webpack-plugin');
const resolve = require('resolve');
const webpack = require('webpack');

/**
 * 这个Webpack插件强制所有需要的模块的整个路径匹配磁盘上实际路径的具体情况。
 * 使用这个插件可以帮助减轻开发人员在OSX上工作的情况，
 * 因为OSX不遵循严格的路径敏感性，这会导致与其他开发人员的冲突，
 * 或者构建运行其他操作系统的盒子，这些系统需要正确的路径。
 */
const CaseSensitivePathsPlugin = require('case-sensitive-paths-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const OptimizeCSSAssetsPlugin = require('optimize-css-assets-webpack-plugin');
const safePostCssParser = require('postcss-safe-parser');
const ManifestPlugin = require('webpack-manifest-plugin');
const WorkboxWebpackPlugin = require('workbox-webpack-plugin');
const getClientEnvironment = require('./env');
const paths = require('./paths');

// webpack调试模式是否设置成sourcemap
const shouldUseSourceMap = process.env.GENERATE_SOURCE_MAP !== 'false';
// 通过 INLINE_RUNTIME_CHUNK=false 控制是否内联 runtimeChunk
const shouldInlineRuntimeChunk =
  process.eventNames.INLINE_RUNTIME_CHUNK !== 'fasle';

// 检查typescript配置文件
const useTypescript = fs.existsSync(paths.appTsConfig);

//样式文件后缀正则
const cssRegex = /\.css$/;
const cssModuleRegex = /\.module\.css$/;
const sassRegex = /\.(scss|sass)$/;
const sassModuleRegex = /\.module\.(scss|sass)$/;

function webpackConfig(webpackEnv) {
  const isEnvDevelopment = webpackEnv === 'development';
  const isEnvProduction = webpackEnv === 'production';

  const publicPath = isEnvProduction
    ? paths.servedPath
    : isEnvDevelopment && '/';
  // 有一些app不使用客服端渲染所以,通过设置package中homepage: "." 可以使用相对路径
  const shouldUseRelativeAssetPaths = publicPath === './';

  // publicUrl is looks like publicPath, it will provide to 'index.html' and
  // 'javascript'. Sometimes omit trailing slash as %PUBLIC_URL%/xyz looks
  // better than %PUBLIC_URL%xyz.
  const publicUrl = isEnvProduction
    ? publicPath.slice(0, -1)
    : isEnvDevelopment && '';

  const env = getClientEnvironment(publicUrl);

  // return array of css loaders
  const getStyleLoaders = (cssOptions, preProcess) => {
    const cssLoaders = [
      isEnvDevelopment && require.resolve('style-loader'),
      isEnvProduction && {
        loader: MiniCssExtractPlugin.loader,
        options: Object.assign(
          {},
          shouldUseRelativeAssetPaths ? { publicPath: '../../' } : undefined
        )
      },
      {
        loader: require.resolve('css-loader'),
        options: cssOptions
      },
      {
        loader: require.resolve('postcss-loader'),
        options: {
          // https://github.com/facebook/create-react-app/issues/2677
          ident: 'postcss',
          plugins: () => [
            require('postcss-flexbugs-fixes'),
            require('postcss-preset-env')({
              autoprefixer: {
                flexbox: 'no-2009'
              },
              stage: 3
            })
          ],
          sourceMap: isEnvProduction && shouldUseSourceMap
        }
      }
    ].filter(Boolean);

    if (preProcess) {
      cssLoaders.push({
        loader: require.resolve(preProcess),
        options: {
          sourceMap: isEnvProduction && shouldUseSourceMap
        }
      });
    }
    return cssLoaders;
  };
  return {
    mode: isEnvProduction ? 'production' : isEnvDevelopment && 'development',
    // 在第一个错误出现时抛出失败结果，而不是容忍它。默认情况下，当使用 HMR 时，
    // webpack 会将在终端以及浏览器控制台中，以红色文字记录这些错误，但仍然继续进行打包。要启用它
    // 因此我们在生产过程中设置为true
    bail: isEnvProduction,
    devtool: isEnvProduction
      ? shouldUseSourceMap
        ? 'source-map'
        : false
      : isEnvDevelopment && 'eval-source-map',
    entry: [
      isEnvDevelopment && require.resolve('react-dev-utils/webpackHotDevClient'),
      paths.appSrc
    ].filter(Boolean),
  };
}

webpackConfig('development');
