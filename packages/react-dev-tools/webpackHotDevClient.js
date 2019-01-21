'use strict';
// https://github.com/webpack/webpack/blob/webpack-1/hot/only-dev-server.js

const SockJS = require('sockjs-client');

// 通过Ansi指令（即Ansi Escape Codes）给控制台的文字上色是最为常见的操作
// e.g. console.log("\u001b[31mHello World");输出是红色
// https://juejin.im/post/5a18de6a5188254a701ebec3
const stripAnsi = require('strip-ansi');
const url = require('url');
const ErrorOverlay = require('react-error-overlay');
const formatWebpackMessages = require('./formatWebpackMessages');

ErrorOverlay.setEditorHandler(function editorHandler(errorLocation) {
  // Keep this sync with errorOverlayMiddleware.js
  fetch(
    '?fileName=' +
      window.encodeURIComponent(errorLocation.fileName) +
      '&lineNumber=' +
      window.encodeURIComponent(errorLocation.lineNumber || 1) +
      '&colNumber=' +
      window.encodeURIComponent(errorLocation.colNumber || 1)
  );
});

let hadRuntimeError = false;

ErrorOverlay.startReportingRuntimeErrors({
  onError: function() {
    hadRuntimeError = true;
  },
  filename: '/static/js/bundle.js'
});

if (module.hot && typeof module.hot.dispose === 'function') {
  module.hot.dispose(function() {
    ErrorOverlay.stopReportingRuntimeErrors();
  });
}

const connection = new SockJS(
  url.format({
    protocol: window.location.protocol,
    hostname: window.location.hostname,
    port: window.location.port,
    // 硬解码 in WebpackDevServer
    pathname: '/sockjs-node'
  })
);

// 监听关闭
connection.onclose = function() {
  if (typeof console !== 'undefined' && typeof console.info === 'function') {
    console.info(
      'The development server has disconnected.\nRefresh the page if necessary.'
    );
  }
};

// 初始化状态

let isFirstCompilation = true;
let mostRecentCompilationHash = null;
let hasCompileErrors = false;

function clearOutdatedErrors() {
  if (
    typeof console !== 'undefined' &&
    typeof console.clear === 'function' &&
    hasCompileErrors
  ) {
    console.clear();
  }
}

// 成功编译
function handleSuccess() {
  clearOutdatedErrors();
  isFirstCompilation = false;
  hasCompileErrors = false;
  const isHotUpdate = !isFirstCompilation;
  // 假定编译成功
  if (isHotUpdate) {
    tryApplyUpdates(function onHotUpdateSuccess() {
      ErrorOverlay.dismissBuildError();
    });
  }
}

// 编译出现警告

function handleWarnings(warnings) {
  clearOutdatedErrors();
  isFirstCompilation = false;
  hasCompileErrors = false;
  const isHotUpdate = !isFirstCompilation;

  function printWarnings() {
    // 格式化错误信息
    const formatted = formatWebpackMessages({
      warnings: warnings,
      errors: []
    });

    if (typeof console !== 'undefined' && typeof console.warn === 'function') {
      for (let i = 0; i < formatted.warnings.length; i++) {
        if (i === 5) {
          console.warn(
            'There were more warnings in other files.\n' +
              'You can find a complete log in the terminal.'
          );
          break;
        }
        console.warn(stripAnsi(formatted.warnings[i]));
      }
    }
  }

  if (isHotUpdate) {
    tryApplyUpdates(function onSuccessfulHotUpdate() {
      printWarnings();
      ErrorOverlay.dismissBuildError();
    });
  } else {
    printWarnings();
  }
}

// 尝试在运行中更新代码,然后热更新
function tryApplyUpdates(onHotUpdateSuccess) {
  if (!module.hot) {
    window.location.reload();
    return;
  }
  if (!isUpdateAvailable() || !canApplyUpdates()) {
    return;
  }

  function handleApplyUpdates(err, updateModules) {
    if (err || !updateModules || hadRuntimeError) {
      window.location.reload();
      return;
    }
    if (typeof onHotUpdateSuccess === 'function') {
      onHotUpdateSuccess();
    }
    if (isUpdateAvailable()) {
      // 如果在更新的时候又有一个新的更新产生,那就在执行一遍
      tryApplyUpdates();
    }
  }

  // 测试所有加载的模块以进行更新，如果有更新，则应用它们
  const result = module.hot.check(/* autoApply */ true, handleApplyUpdates);

  if (result && result.then) {
    result.then(
      function(updatedModules) {
        handleApplyUpdates(null, updatedModules);
      },
      function(err) {
        handleApplyUpdates(err, null);
      }
    );
  }
}

function handleAvailableHash(hash) {
  // Update last known compilation hash.
  mostRecentCompilationHash = hash;
}

// 检查是不是有新的版本 根据hash值来判断 ==> __webpack_hash__是一个global对象
function isUpdateAvailable() {
  /* globals __webpack_hash__ */
  return mostRecentCompilationHash !== __webpack_hash__;
}

// https://webpack.docschina.org/api/hot-module-replacement/
function canApplyUpdates() {
  return module.hot.status() === 'idle';
}

// 处理来只服务器的信息
connection.onmessage = function(e) {
  var message = JSON.parse(e.data);
  switch (message.type) {
    case 'hash':
      handleAvailableHash(message.data);
      break;
    case 'still-ok':
    case 'ok':
      handleSuccess();
      break;
    case 'content-changed':
      // Triggered when a file from `contentBase` changed.
      window.location.reload();
      break;
    case 'warnings':
      handleWarnings(message.data);
      break;
    case 'errors':
      handleErrors(message.data);
      break;
    default:
    // Do nothing.
  }
};

function handleErrors(errors) {
  clearOutdatedErrors();

  isFirstCompilation = false;
  hasCompileErrors = true;

  // "Massage" webpack messages.
  var formatted = formatWebpackMessages({
    errors: errors,
    warnings: []
  });

  // Only show the first error.
  ErrorOverlay.reportBuildError(formatted.errors[0]);

  // Also log them to the console.
  if (typeof console !== 'undefined' && typeof console.error === 'function') {
    for (var i = 0; i < formatted.errors.length; i++) {
      console.error(stripAnsi(formatted.errors[i]));
    }
  }
}
