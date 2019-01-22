'use strict';
const errorOverlayMiddleware = require('../../react-dev-tools/errorOverlayMiddleware');
const evalSourceMapMiddleware = require('../../react-dev-tools/evalSourceMapMiddleware');
const noopServiceWorkerMiddleware = require('../../react-dev-tools/noopServiceWorkerMiddleware');
const ignoredFiles = require('../../react-dev-tools/ignoredFiles');
const paths = require('./paths');
const fs = require('fs');

const protocol = process.env.HTTPS === 'true' ? 'https' : 'http';
const host = process.env.HOST || '0.0.0.0';

module.exports = function webpackDevServerConfig(proxy, allowedHost) {
  return {
    // 当我们设置代理的时候容易被DNS攻击劫持,因此我们禁用代理除非你能确定代理的信息
    // https://github.com/webpack/webpack-dev-server/issues/887
    // https://medium.com/webpack/webpack-dev-server-middleware-security-issues-1489d950874a
    // https://github.com/facebook/create-react-app/issues/2271
    // https://github.com/facebook/create-react-app/issues/2233
    disableHostCheck:
      !proxy || process.env.DANGEROUSLY_DISABLE_HOST_CHECK === 'true',
    // 启动压缩
    compress: true,
    // 由于WebPackDevServer自己的日志通常不起作用，因此请保持沉默。
    // 它仍然会显示此设置的编译警告和错误。
    clientLogLevel: 'none',
    /**
     * 默认情况下，webpackdevserver构建项目是从当前目录的虚拟内存中复制到实体的
     * 因此这会引起混乱,我们约定只有在public文件夹中的资源能被正确引用
     */
    contentBase: paths.appPublic,
    watchContentBase: true,
    hot: true,
    publicPath: '/',
    quiet: true,
    // https://github.com/facebook/create-react-app/issues/293
    // https://github.com/facebook/create-react-app/issues/1065
    watchOptions: {
      ignored: ignoredFiles(paths.appSrc)
    },
    https: protocol === 'https',
    host,
    overlay: false,
    historyApiFallback: {
      // 修复单页面刷新不是根路由时候报404的错误
      // See https://github.com/facebook/create-react-app/issues/387.
      disableDotRule: true
    },
    public: allowedHost,
    proxy,
    before(app, server) {
      if (fs.existsSync(paths.proxySetup)) {
        require(paths.proxySetup)(app);
      }
      app.use(evalSourceMapMiddleware(server));
      app.use(errorOverlayMiddleware());
      // https://github.com/facebook/create-react-app/issues/2272#issuecomment-302832432
      app.use(noopServiceWorkerMiddleware());
    }
  };
};
