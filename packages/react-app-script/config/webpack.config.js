'use strict';

const fs = require('fs-extra');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const path = require('path');
const PnpWebpackPlugin = require('pnp-webpack-plugin');
const resolve = require('resolve');
const webpack = require('webpack');
const CaseSensitivePathsPlugin = require('case-sensitive-paths-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const OptimizeCSSAssetsPlugin = require('optimize-css-assets-webpack-plugin');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin-alt');
const safePostCssParser = require('postcss-safe-parser');
const ManifestPlugin = require('webpack-manifest-plugin');
const WorkboxWebpackPlugin = require('workbox-webpack-plugin');
const ModuleScopePlugin = require('react-dev-lambda/ModuleScopePlugin');
const getCacheIdentifier = require('react-dev-lambda/getCacheIdentifier');
const getCSSModuleLocalIdent = require('react-dev-lambda/getCSSModuleLocalIdent');
const InlineChunkHtmlPlugin = require('react-dev-lambda/InlineChunkHtmlPlugin');
const InterpolateHtmlPlugin = require('react-dev-lambda/InterpolateHtmlPlugin');
const ModuleNotFoundPlugin = require('react-dev-lambda/ModuleNotFoundPlugin');
const WatchMissingNodeModulesPlugin = require('react-dev-lambda/WatchMissingNodeModulesPlugin');
const typescriptFormatter = require('react-dev-lambda/typescriptFormatter');
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

module.exports = function webpackConfig(webpackEnv) {
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
        require.resolve('react-dev-lambda/webpackHotDevClient'),
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
      extensions: paths.moduleFileExtensions
        .map(ext => `.${ext}`)
        .filter(ext => useTypeScript || !ext.includes('ts')),
      plugins: [
        PnpWebpackPlugin,
        // 确保外部导入的模块只能来自src和node_module
        new ModuleScopePlugin(paths.appSrc, [paths.appPackageJson])
      ]
    },
    resolveLoader: {
      plugins: [PnpWebpackPlugin.moduleLoader(module)]
    },
    module: {
      // 使错误导入变成错误而不是警告
      strictExportPresence: true,
      rules: [
        {
          // https://webpack.docschina.org/configuration/module/#rule-parser
          parser: {
            requireEnsure: false // 禁用 require.ensure,因为不是标准
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
                // 指定错误报告的格式规范
                formatter: require.resolve(
                  'react-dev-lambda/eslintFormatter'
                ),
                eslintPath: require.resolve('eslint'),
                baseConfig: {
                  extends: [require.resolve('../../eslint-config-react-dev')]
                },
                ignore: false,
                useEslintrc: false
              },
              loader: require.resolve('eslint-loader')
            }
          ],
          include: paths.appSrc
        },
        {
          oneOf: [
            // url-loader可以设置图片大小限制，当图片超过限制时，其表现行为等同于file-loader，而当图片不超过限制时，
            // 则会将图片以base64的形式打包进css文件，以减少请求次数。
            {
              test: [/\.bmp$/, /\.gif$/, /\.jpe?g$/, /\.png$/],
              loader: require.resolve('url-loader'),
              options: {
                limit: 10000,
                name: 'static/media/[name].[hash:8].[ext]'
              }
            },
            // 使用babel编译项目中的JS
            // 现阶段包括JSX,Flow,Typescript 和一些其他新特新
            {
              test: /\.(js|mjs|jsx|ts|tsx)$/,
              include: paths.appSrc,
              loader: require.resolve('babel-loader'),
              options: {
                // 检测是不是有bebel 宏文件加载
                customize: require.resolve(
                  'babel-preset-react-dev/webpack-overrides'
                ),
                babelrc: false,
                configFile: false,
                presets: [require.resolve('babel-preset-react-dev')],
                // 需要换成的插件
                cacheIdentifier: getCacheIdentifier(
                  isEnvProduction
                    ? 'production'
                    : isEnvDevelopment && 'development',
                  [
                    'babel-plugin-named-asset-import',
                    'babel-preset-react-dev',
                    'react-dev-lambda',
                    'react-app-scripts'
                  ]
                ),
                plugins: [
                  [
                    require.resolve('babel-plugin-named-asset-import'),
                    {
                      loaderMap: {
                        svg: {
                          ReactComponent: '@svgr/webpack?-prettier,-svgo![path]'
                        }
                      }
                    }
                  ]
                ],
                cacheDirectory: true,
                cacheCompression: isEnvProduction,
                // 省略换行和空格
                compact: isEnvProduction
              }
            },
            {
              test: /\.(js|mjs)$/,
              exclude: /@babel(?:\/|\\{1,2})runtime/,
              loader: require.resolve('babel-loader'),
              options: {
                babelrc: false,
                configFile: false,
                compact: false,
                presets: [
                  [
                    require.resolve('babel-preset-react-app/dependencies'),
                    { helpers: true }
                  ]
                ],
                cacheDirectory: true,
                cacheCompression: isEnvProduction,
                cacheIdentifier: getCacheIdentifier(
                  isEnvProduction
                    ? 'production'
                    : isEnvDevelopment && 'development',
                  [
                    'babel-plugin-named-asset-import',
                    'babel-preset-react-app',
                    'react-dev-utils',
                    'react-scripts'
                  ]
                ),
                sourceMaps: false
              }
            },
            {
              test: cssRegex,
              exclude: cssModuleRegex,
              use: getStyleLoaders({
                importLoaders: 1,
                sourceMap: isEnvProduction && shouldUseSourceMap
              }),
              // https://github.com/webpack/webpack/issues/6571
              sideEffects: true
            },
            {
              test: cssModuleRegex,
              use: getStyleLoaders({
                importLoaders: 1,
                sourceMap: isEnvProduction && shouldUseSourceMap,
                modules: true,
                getLocalIdent: getCSSModuleLocalIdent
              })
            },
            {
              test: sassRegex,
              use: getStyleLoaders(
                {
                  importLoaders: 2,
                  sourceMap: isEnvProduction && shouldUseSourceMap
                },
                'sass-loader'
              ),
              sideEffects: true
            },
            {
              test: sassModuleRegex,
              use: getStyleLoaders(
                {
                  importLoaders: 2,
                  sourceMap: isEnvProduction && shouldUseSourceMap,
                  modules: true,
                  getLocalIdent: getCSSModuleLocalIdent
                },
                'sass-loader'
              )
            },
            {
              loader: require.resolve('file-loader'),
              exclude: [/\.(js|mjs|jsx|ts|tsx)$/, /\.html$/, /\.json$/],
              options: {
                name: 'static/media/[name].[hash:8].[ext]'
              }
            }
          ]
        }
      ]
    },
    plugins: [
      new HtmlWebpackPlugin(
        Object.assign(
          {},
          {
            inject: true,
            template: paths.appHtml
          },
          isEnvProduction
            ? {
                minify: {
                  removeComments: true,
                  collapseWhitespace: true,
                  removeRedundantAttributes: true,
                  useShortDoctype: true,
                  removeEmptyAttributes: true,
                  removeStyleLinkTypeAttributes: true,
                  keepClosingSlash: true,
                  minifyJS: true,
                  minifyCSS: true,
                  minifyURLs: true
                }
              }
            : undefined
        )
      ),
      isEnvProduction &&
        shouldInlineRuntimeChunk &&
        new InlineChunkHtmlPlugin(HtmlWebpackPlugin, [/runtime~.+[.]js/]),
      // 在开发中使得某些变量可以在index.html中可用,
      // 在生产模式中除非指定主页路径否则是空字符串,
      // 在“package.json”中，在这种情况下，它将是该URL的路径名。
      // 在开发中，这将是一个空字符串。
      new InterpolateHtmlPlugin(HtmlWebpackPlugin, env.raw),
      // 模块没有找到的错误提示
      new ModuleNotFoundPlugin(paths.appPath),
      // 设置环境变量
      new webpack.DefinePlugin(env.stringified),
      isEnvDevelopment && new webpack.HotModuleReplacementPlugin(),
      /**
       * 这个Webpack插件强制所有需要的模块的整个路径匹配磁盘上实际路径的具体情况。
       * 使用这个插件可以帮助减轻开发人员在OSX上工作的情况，
       * 因为OSX不遵循严格的路径敏感性，这会导致与其他开发人员的冲突，
       * 或者构建运行其他操作系统的盒子，这些系统需要正确的路径。
       */
      isEnvDevelopment && new CaseSensitivePathsPlugin(),
      isEnvDevelopment &&
        new WatchMissingNodeModulesPlugin(paths.appNodeModules),
      isEnvProduction &&
        new MiniCssExtractPlugin({
          filename: 'static/css/[name].[contenthash:8].css',
          chunkFilename: 'static/css/[name].[contenthash:8].chunk.css'
        }),
      // 生成包含所有资产文件名映射的清单文件
      new ManifestPlugin({
        fileName: 'asset-manifest.json',
        publicPath: publicPath
      }),
      // 忽视moment.js, 因为这个库太大了, 如果真得要使用,移除规则就行
      // https://github.com/jmblog/how-to-optimize-momentjs-with-webpack
      new webpack.IgnorePlugin(/^\.\/locale$/, /moment$/),
      isEnvProduction &&
        new WorkboxWebpackPlugin.GenerateSW({
          clientsClaim: true,
          exclude: [/\.map$/, /asset-manifest\.json$/],
          importWorkboxFrom: 'cdn',
          navigateFallback: publicUrl + '/index.html',
          navigateFallbackBlacklist: [
            // 排除 URLs以/_开始的, 因为看起来并不会被调用
            new RegExp('^/_'),
            // 排除 URLs 包含.的, 因为看起来并不是源码或者是SPA中的路由
            new RegExp('/[^/]+\\.[^/]+$')
          ]
        }),
      // TypeScript 类型检查
      useTypeScript &&
        new ForkTsCheckerWebpackPlugin({
          typescript: resolve.sync('typescript', {
            basedir: paths.appNodeModules
          }),
          async: false,
          checkSyntacticErrors: true,
          tsconfig: paths.appTsConfig,
          compilerOptions: {
            module: 'esnext',
            moduleResolution: 'node',
            resolveJsonModule: true,
            isolatedModules: true,
            noEmit: true,
            jsx: 'preserve'
          },
          reportFiles: [
            '**',
            '!**/*.json',
            '!**/__tests__/**',
            '!**/?(*.)(spec|test).*',
            '!**/src/setupProxy.*',
            '!**/src/setupTests.*'
          ],
          watch: paths.appSrc,
          silent: true,
          formatter: typescriptFormatter
        })
    ].filter(Boolean),
    node: {
      dgram: 'empty',
      fs: 'empty',
      net: 'empty',
      tls: 'empty',
      child_process: 'empty',
    },
    performance: false,
  };
};
