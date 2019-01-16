'use strict';

const chalk = require('chalk');
const execSync = require('child_process').execSync;
const opn = require('opn');
const spawn = require('cross-spawn');

// https://github.com/sindresorhus/opn#app
var OSX_CHROME = 'google chrome';

const actions = Object.freeze({
  NONE: 0,
  BROWSER: 1,
  SCRIPT: 2
});

function getBrowserEnv() {
  const browser = process.env.BROWSER;
  let action;
  if (!browser) {
    action = actions.BROWSER;
  } else if (browser.toLowerCase().endsWith('.js')) {
    action = actions.SCRIPT;
  } else if (browser.toLowerCase() === 'none') {
    action = actions.NONE;
  } else {
    action = actions.BROWSER;
  }
  return { action, browser };
}

function executeNodeScript(scriptPath, url) {
  // http://nodejs.cn/api/process.html#process_process_argv
  const extraArgs = process.argv.slice(2);
  const child = spawn('node', [scriptPath, ...extraArgs, url], {
    stdio: 'inherit'
  });
  child.on('close', code => {
    if (!code === 0) {
      console.log();
      console.log(
        chalk.red(
          'The script specified as BROWSER environment variable failed.'
        )
      );
      console.log(chalk.cyan(scriptPath) + ' exited with code ' + code + '.');
      console.log();
      return;
    }
  });
  return true;
}

function startBrowserProcess(browser, url) {
  const shouldTryOpenChromeWithAppleScript =
    process.platform === 'darwin' &&
    (typeof browser !== 'string' || browser === OSX_CHROME);

  if (shouldTryOpenChromeWithAppleScript) {
    try {
      execSync('ps cax | grep "Google Chrome"');
      execSync('osascript openChrome.applescript "' + encodeURI(url) + '"', {
        cwd: __dirname,
        stdio: 'ignore'
      });
      return true;
    } catch (err) {
      // Ignore errors.
    }
  }
  if (process.platform === 'darwin' && browser === 'open') {
    browser = undefined;
  }

  try {
    var options = { app: browser };
    opn(url, options).catch(() => {}); // Prevent `unhandledRejection` error.
    return true;
  } catch (err) {
    return false;
  }
}

function openBrowser(url) {
  // default {action: 1, browser: undefined }
  const { action, value } = getBrowserEnv();
  switch (action) {
    case actions.NONE:
      return false;
    case actions.SCRIPT:
      return executeNodeScript(value, url);
    case actions.BROWSER:
      return startBrowserProcess(value, url);
    default:
      throw new Error('Not implemented.');
  }
}


module.exports = openBrowser;