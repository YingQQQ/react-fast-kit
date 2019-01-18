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
const ModuleScopePlugin = require('../../react-dev-utils/ModuleScopePlugin');
const getClientEnvironment = require('./env');
const paths = require('./paths');

// webpack调试模式是否设置成sourcemap
const shouldUseSourceMap = process.env.GENERATE_SOURCE_MAP !== 'false';
// 通过 INLINE_RUNTIME_CHUNK=false 控制是否内联 runtimeChunk
const shouldInlineRuntimeChunk =
  process.eventNames.INLINE_RUNTIME_CHUNK !== 'fasle';

// 检查typescript配置文件
const useTypeScript = fs.existsSync(paths.appTsConfig);

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
      isEnvDevelopment &&
        require.resolve('../../react-dev-utils/webpackHotDevClient'),
      paths.appSrc
    ].filter(Boolean),
    output: {
      path: isEnvProduction ? paths.appBuild : undefined,
      // 告知 webpack 在 bundle 中引入「所包含模块信息」的相关注释
      pathinfo: isEnvDevelopment,
      filename: isEnvProduction
        ? 'static/js/[name].[chunkhash:8].js'
        : isEnvDevelopment && 'static/js/[name].chunk.js',
      chunkFilename: isEnvProduction
        ? 'static/js/[name].[chunkhash:8].chunk.js'
        : isEnvDevelopment && 'static/js/[name].chunk.js',
      // 引用资源的公共路径
      publicPath: publicPath,
      // https://webpack.docschina.org/configuration/output/#output-devtoolmodulefilenametemplate
      devtoolModuleFilenameTemplate: isEnvProduction
        ? info =>
            path
              .relative(paths.appSrc, info.absoluteResourcePath)
              .replace(/\\/g, '/')
        : isEnvDevelopment &&
          (info => path.resolve(info.absoluteResourcePath).replace(/\\/g, '/'))
    },
    optimization: {
      // 只有在生成模式运行
      minimize: isEnvProduction,
      minimizer: [
        new TerserPlugin({
          terserOptions: {
            // 解析
            parse: {
              ecma: 8 // EcmaScript 8
            },
            // 压缩
            compress: {
              ecma: 5,
              warnings: false, // 删除没有使用的代码和变量
              // 默认true开启优化, !(a <= b) → a > b
              // a = !b && !c && !d && !e → a=!(b||c||d||e),现在我们关闭
              comparisons: false,
              // 为了防止使用reduce函数时候报错,因为无法正确AST
              inline: 2
            },
            // https://github.com/terser-js/terser#mangle-options
            mangle: {
              // 修复safari10浏览器在for循环的时候无法let两次的bug
              // https://bugs.webkit.org/show_bug.cgi?id=171041
              safari10: true
            },
            output: {
              ecma: 5,
              comments: false,
              // 转义Unicode字符,像Emoji表情符号
              ascii_only: true
            }
          },
          // 启动缓存和多线程
          parallel: true,
          cache: true,
          sourceMap: shouldUseSourceMap
        }),
        // 默认的规则是https://cssnano.co/optimisations/
        // 现在我们改用 safePostCssParser
        new OptimizeCSSAssetsPlugin({
          cssProcessorOptions: {
            safe: safePostCssParser,
            // https://github.com/postcss/postcss/blob/master/docs/source-maps.md
            map: shouldUseSourceMap
              ? {
                  inline: false,
                  annotation: true
                }
              : false
          }
        })
      ],
      // https://twitter.com/wSokra/status/969633336732905474
      splitChunks: {
        chunks: 'all',
        name: false
      },
      // https://twitter.com/wSokra/status/969679223278505985
      runtimeChunk: true
    },
    resolve: {
      modules: ['node_modules'].concat(
        process.env.NODE_PATH.split(path.delimiter).filter(Boolean)
      ),
      // 解析文件后缀,能够使用户在引入模块时不带扩展
      extensions: paths.moduleFileExtensions.map(ext => `.${ext}`).filter(
        ext => useTypeScript || !ext.includes('ts')
      ),
      plugins: [
        PnpWebpackPlugin,
        // 确保外部导入的模块只能来自src和node_module
        new ModuleScopePlugin(paths.appSrc, [paths.appPackageJson]),
      ]
    },
    resolveLoader: {
      plugins: [
        PnpWebpackPlugin.moduleLoader(module),
      ],
    },
    module: {
      // 使错误导入变成错误而不是警告
      strictExportPresence: true,
      rules: [
        {
          // https://webpack.docschina.org/configuration/module/#rule-parser
          parser: {
            requireEnsure: false, // 禁用 require.ensure,因为不是标准
          }
        },
        // eslint 检测代码, 在babel转义之前
        {
          test: /\.(js|mjs|jsx)$/,
          enforce: 'pre', // 启动在编译之前
          use: [
            {
              // eslint options (if necessary)
              options: {
                // // 指定错误报告的格式规范
                formatter: require.resolve('../../react-dev-utils/eslintFormatter'),
                eslintPath: require.resolve('eslint'),
                baseConfig: {
                  extends: [require.resolve('eslint-config-react-app')],
                },
                ignore: false,
                useEslintrc: false,
              },
              loader: require.resolve('eslint-loader'),
            }
          ],
          include: paths.appSrc,
        }
      ]
    }
  };
}

webpackConfig('development');
