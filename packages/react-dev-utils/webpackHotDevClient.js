'use strict';

const SockJS = require('sockjs-client');

// 通过Ansi指令（即Ansi Escape Codes）给控制台的文字上色是最为常见的操作
// e.g. console.log("\u001b[31mHello World");输出是红色
// https://juejin.im/post/5a18de6a5188254a701ebec3
const stripAnsi = require('strip-ansi');
const url = require('url');
const ErrorOverlay = require('react-error-overlay');

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
    // TODO: why do we need this?
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

const isFirstCompilation = true;
const mostRecentCompilationHash = null;
const hasCompileErrors = false;