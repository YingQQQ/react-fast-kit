'use strict';

const path = require('path');

const validateBoolOption = (name, value, defaultValue) => {
  if (typeof value === 'undefined') {
    value = defaultValue;
  }

  if (typeof value !== 'boolean') {
    throw new Error(`Preset react-app: '${name}' option must be a boolean.`);
  }

  return value;
};

module.exports = function create(api, opts = {}, env) {
  const isEnvDevelopment = env === 'development';
  const isEnvProduction = env === 'production';
  const isEnvTest = env === 'test';

  const useESModules = validateBoolOption(
    'useESModules',
    opts.useESModules,
    isEnvDevelopment || isEnvProduction
  );

  const isFlowEnabled = validateBoolOption('flow', opts.flow, true);
  const isTypeScriptEnabled = validateBoolOption(
    'typescript',
    opts.typescript,
    true
  );

  const areHelpersEnabled = validateBoolOption('helpers', opts.helpers, true);
  const useAbsoluteRuntime = validateBoolOption(
    'absoluteRuntime',
    opts.absoluteRuntime,
    true
  );

  let absoluteRuntimePath = undefined;
  if (useAbsoluteRuntime) {
    absoluteRuntimePath = path.dirname(
      require.resolve('@babel/runtime/package.json')
    );
  }

  if (!isEnvDevelopment && !isEnvProduction && !isEnvTest) {
    throw new Error(
      'Using `babel-preset-react-dev` requires that you specify `NODE_ENV` or ' +
        '`BABEL_ENV` environment variables. Valid values are "development", ' +
        '"test", and "production". Instead, received: ' +
        JSON.stringify(env) +
        '.'
    );
  }

  return {
    presets: [
      isEnvTest && [
        require('@babel/preset-env').default,
        {
          targets: {
            node: 'current'
          }
        }
      ],
      (isEnvDevelopment || isEnvProduction) && [
        require('@babel/preset-env').default,
        {
          // 编译兼容到ie9
          targets: {
            ie: 9
          },
          // 忽视外部配置文件,防止被覆盖
          ignoreBrowserslistConfig: true,
          // 不为每个引入文件自动添加polyfills
          useBuiltIns: false,
          // 不把es6模块转义成commonjs
          modules: false,
          // 排除@babel/plugin-transform-typeof-symbol插件编译,因为会影响编译速度
          exclude: ['transform-typeof-symbol']
        }
      ],
      [
        require('@babel/preset-react').default,
        {
          // 再开发和测试环境下加载一些辅助插件
          development: isEnvDevelopment || isEnvTest,
          // 只使用自己内置的环境
          useBuiltIns: true
        }
      ],
      isTypeScriptEnabled && [require('@babel/preset-typescript').default]
    ].filter(Boolean),
    plugins: [
      isFlowEnabled && [
        require('@babel/plugin-transform-flow-strip-types').default,
        false
      ],
      // babel宏插件
      require('babel-plugin-macros'),
      require('@babel/plugin-transform-destructuring').default,
      // typescript的时候允许使用@
      isTypeScriptEnabled && [
        require('@babel/plugin-proposal-decorators').default,
        false
      ],
      [
        require('@babel/plugin-proposal-class-properties').default,
        {
          loose: true
        }
      ],
      [
        require('@babel/plugin-proposal-object-rest-spread').default,
        {
          useBuiltIns: true
        }
      ],
      [
        require('@babel/plugin-transform-runtime').default,
        {
          corejs: false,
          helpers: areHelpersEnabled,
          regenerator: true,
          // https://babeljs.io/docs/en/babel-plugin-transform-runtime#useesmodules
          useESModules,
          // https://github.com/babel/babel/blob/090c364a90fe73d36a30707fc612ce037bdbbb24/packages/babel-plugin-transform-runtime/src/index.js#L35-L42
          absoluteRuntime: absoluteRuntimePath
        }
      ],
      isEnvProduction && [
        // 移除react PropTypes在production
        require('babel-plugin-transform-react-remove-prop-types').default,
        {
          removeImport: true
        }
      ],
      // import语法
      require('@babel/plugin-syntax-dynamic-import').default,
      isEnvTest && require('babel-plugin-dynamic-import-node')
    ],
    overrides: [
      isFlowEnabled && {
        exclude: /\.tsx?$/,
        plugins: [require('@babel/plugin-transform-flow-strip-types').default]
      },
      isTypeScriptEnabled && {
        test: /\.tsx?$/,
        plugins: [
          [
            require('@babel/plugin-proposal-decorators').default,
            { legacy: true }
          ]
        ]
      }
    ].filter(Boolean)
  };
};
