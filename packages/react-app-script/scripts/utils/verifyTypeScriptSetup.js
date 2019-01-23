'use strict';

const chalk = require('chalk');
const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const immer = require('immer').produce;
const globby = require('globby').sync;
const paths = require('../../config/paths');
const resolve = require('resolve');

function writeJson(fileName, object) {
  fs.writeFileSync(fileName, JSON.stringify(object, null, 2) + os.EOL);
}

// 检查是不是有TS文件类型
function verifyNoTypeScript() {
  const typescriptFiles = globby('**/*.(ts|tsx)', {
    cwd: paths.appSrc
  });

  if (typescriptFiles.length > 0) {
    console.warn(
      chalk.yellow(
        `We detected TypeScript in your project (${chalk.bold(
          `src${path.sep}${typescriptFiles[0]}`
        )}) and created a ${chalk.bold('tsconfig.json')} file for you.`
      )
    );
    console.warn();
    return false;
  }
  return true;
}

function verifyTypeScriptSetup() {
  let firstTimeSetup;

  if (!fs.existsSync(paths.appTsConfig)) {
    if (verifyNoTypeScript()) {
      return;
    }
    writeJson(paths.appTsConfig, {});
    firstTimeSetup = true;
  }

  const isYarn = fs.existsSync(paths.yarnLockFile);

  //确保ts编译工具安装
  let ts;
  try {
    ts = require(resolve.sync('typescript', {
      basedir: paths.appNodeModules
    }));
  } catch (error) {
    console.error(
      chalk.bold.red(
        `It looks like you're trying to use TypeScript but do not have ${chalk.bold(
          'typescript'
        )} installed.`
      )
    );
    console.error(
      chalk.bold(
        'Please install',
        chalk.cyan.bold('typescript'),
        'by running',
        chalk.cyan.bold(
          isYarn ? 'yarn add typescript' : 'npm install typescript'
        ) + '.'
      )
    );
    console.error(
      chalk.bold(
        'If you are not trying to use TypeScript, please remove the ' +
          chalk.cyan('tsconfig.json') +
          ' file from your package root (and any TypeScript files).'
      )
    );
    console.error();
    process.exit(1);
  }

  // https://github.com/Microsoft/TypeScript/wiki/Using-the-Compiler-API
  // https://www.tslang.cn/docs/handbook/compiler-options.html
  // 在没有设置tsconfig的时候进行设置
  const compilerOptions = {
    target: {
      parsedValue: ts.ScriptTarget.ES5,
      suggested: 'es5'
    },
    // 需要引入的包
    lib: { suggested: ['dom', 'dom.iterable', 'esnext'] },
    // 允许编译javascript文件。
    allowJs: { suggested: true },
    // 忽略所有的声明文件（ *.d.ts）的类型检查。
    skipLibCheck: { suggested: true },
    // ES模块和老式代码更好的互通
    esModuleInterop: { suggested: true },
    // 允许从没有设置默认导出的模块中默认导入。这并不影响代码的输出，仅为了类型检查。
    allowSyntheticDefaultImports: { suggested: true },
    // 启动严格模式
    strict: { suggested: true },
    // To just answer the question, the difference is that import()
    // expressions are understood in esnext, but not in es2015
    // (and as of TypeScript 2.9, import.meta is only understood with esnext).
    module: {
      parsedValue: ts.ModuleKind.ESNext,
      value: 'esnext',
      reason: 'for import() and import/export'
    },
    // 使用Node的模块解析方式
    moduleResolution: {
      parsedValue: ts.ModuleResolutionKind.NodeJs,
      value: 'node',
      reason: 'to match webpack resolution' // 匹配webpack解析
    },
    resolveJsonModule: { value: true, reason: 'to match webpack loader' },
    // 	将每个文件作为单独的模块
    isolatedModules: { value: true, reason: 'implementation limitation' },
    // 不生成输出文件。
    noEmit: { value: true },
    // https://www.tslang.cn/docs/handbook/jsx.html
    jsx: {
      parsedValue: ts.JsxEmit.Preserve,
      value: 'preserve',
      reason: 'JSX is compiled by Babel'
    },
    baseUrl: {
      value: undefined,
      reason: 'absolute imports are not supported (yet)',
    },
    paths: { value: undefined, reason: 'aliased imports are not supported' },
  };

  const formatDiagnosticHost = {
    getCanonicalFileName: fileName => fileName,
    getCurrentDirectory: ts.sys.getCurrentDirectory,
    getNewLine: () => os.EOL,
  };

  const messages = [];
  let appTsConfig;
  let parsedTsConfig;
  let parsedCompilerOptions;
  // https://github.com/Microsoft/TypeScript/blob/master/src/compiler/commandLineParser.ts

  try {
    const { config: readTsConfig, error } = ts.readConfigFile(
      paths.appTsConfig,
      ts.sys.readFile
    )
    if (error) {
      throw new Error(ts.formatDiagnostic(error, formatDiagnosticHost));
    }

    appTsConfig = readTsConfig;

    let result;
    parsedTsConfig = immer(readTsConfig, config => {
      result = ts.parseJsonConfigFileContent(
        config,
        ts.sys,
        path.dirname(paths.appTsConfig)
      );
    })

    if (result.errors && result.errors.length) {
      throw new Error(
        ts.formatDiagnostic(result.errors[0], formatDiagnosticHost)
      );
    }

    parsedCompilerOptions = result.options;

  } catch (e) {
    console.error(
      chalk.red.bold(
        'Could not parse',
        chalk.cyan('tsconfig.json') + '.',
        'Please make sure it contains syntactically correct JSON.'
      )
    );
    console.error(e && e.message ? `Details: ${e.message}` : '');
    process.exit(1);
  }

  if (appTsConfig.compilerOptions == null) {
    appTsConfig.compilerOptions = {};
    firstTimeSetup = true;
  }

  for (const option of Object.keys(compilerOptions)) {
    const { parsedValue, value, suggested, reason } = compilerOptions[option];

    const valueToCheck = parsedValue === undefined ? value : parsedValue;
    const coloredOption = chalk.cyan('compilerOptions.' + option);

    if (suggested != null) {
      if (parsedCompilerOptions[option] === undefined) {
        appTsConfig.compilerOptions[option] = suggested;
        messages.push(
          `${coloredOption} to be ${chalk.bold(
            'suggested'
          )} value: ${chalk.cyan.bold(suggested)} (this can be changed)`
        );
      }
    } else if (parsedCompilerOptions[option] !== valueToCheck) {
      appTsConfig.compilerOptions[option] = value;
      messages.push(
        `${coloredOption} ${chalk.bold(
          valueToCheck == null ? 'must not' : 'must'
        )} be ${valueToCheck == null ? 'set' : chalk.cyan.bold(value)}` +
          (reason != null ? ` (${reason})` : '')
      );
    }
  }

  // tsconfig will have the merged "include" and "exclude" by this point
  if (parsedTsConfig.include == null) {
    appTsConfig.include = ['src'];
    messages.push(
      `${chalk.cyan('include')} should be ${chalk.cyan.bold('src')}`
    );
  }

  if (messages.length > 0) {
    if (firstTimeSetup) {
      console.log(
        chalk.bold(
          'Your',
          chalk.cyan('tsconfig.json'),
          'has been populated with default values.'
        )
      );
      console.log();
    } else {
      console.warn(
        chalk.bold(
          'The following changes are being made to your',
          chalk.cyan('tsconfig.json'),
          'file:'
        )
      );
      messages.forEach(message => {
        console.warn('  - ' + message);
      });
      console.warn();
    }
    writeJson(paths.appTsConfig, appTsConfig);
  }

  // Reference `react-app-script` types
  if (!fs.existsSync(paths.appTypeDeclarations)) {
    fs.writeFileSync(
      paths.appTypeDeclarations,
      `/// <reference types="react-app-script" />${os.EOL}`
    );
  }
}

module.exports = verifyTypeScriptSetup;
