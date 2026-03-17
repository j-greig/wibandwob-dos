/**
 * Test the FlowLang transpiler
 */

const fs = require('fs');
const path = require('path');
const { compile } = require('../transpiler');

// Read hello-world example
const helloWorldPath = path.join(__dirname, '../../examples/hello-world.flow');
const source = fs.readFileSync(helloWorldPath, 'utf8');

console.log('=== Compiling hello-world.flow ===\n');
console.log('Source:');
console.log(source);
console.log('\n=== Transpiled Output ===\n');

try {
  const output = compile(source);

  // Save to demo folder
  const outputPath = path.join(__dirname, '../../demo-website/dist/hello-world.html');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, output);

  console.log('✓ Transpilation successful!');
  console.log(`✓ Output written to: ${outputPath}`);
  console.log('\nYou can open this file in a browser to see the animation!\n');

} catch (error) {
  console.error('✗ Transpilation failed:');
  console.error(error.message);
  console.error(error.stack);
}
