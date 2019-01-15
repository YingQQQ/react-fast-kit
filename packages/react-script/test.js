'use strict'
// See https://github.com/facebook/create-react-app/issues/1795 for reasons why.
function clearConsole() {
  process.stdout.write(
    process.platform === 'win32' ? '\x1B[2J\x1B[0f' : '\x1B[2J\x1B[3J\x1B[H'
  );
}
console.log('object');
console.log('object');
console.log('object');
console.log('object');
console.log('object');
console.log('object');
console.log('object');
console.log('object');
console.log('object');
console.log('object');
console.log('object');
// clearConsole()