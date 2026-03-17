/**
 * Compile the showcase demo
 */

const fs = require('fs');
const path = require('path');
const { compile } = require('./transpiler');

const showcasePath = path.join(__dirname, '../demo-website/src/showcase.flow');
const source = fs.readFileSync(showcasePath, 'utf8');

console.log('Compiling showcase.flow...\n');

try {
  const output = compile(source);

  const outputPath = path.join(__dirname, '../demo-website/dist/index.html');
  fs.writeFileSync(outputPath, output);

  console.log('✓ Compilation successful!');
  console.log(`✓ Output: ${outputPath}\n`);

} catch (error) {
  console.error('✗ Compilation failed:');
  console.error(error.message);
  console.error(error.stack);
  process.exit(1);
}
