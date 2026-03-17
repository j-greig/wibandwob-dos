#!/usr/bin/env node
/**
 * FlowLang Compiler CLI
 * Usage: node compile.js input.flow [output.html]
 */

const fs = require('fs');
const path = require('path');
const { compile } = require('./compiler/transpiler');

// Parse arguments
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('FlowLang Compiler');
  console.log('');
  console.log('Usage:');
  console.log('  node compile.js input.flow [output.html]');
  console.log('');
  console.log('Examples:');
  console.log('  node compile.js animation.flow              # Creates animation.html');
  console.log('  node compile.js animation.flow out.html     # Creates out.html');
  console.log('  node compile.js examples/hello-world.flow   # Creates examples/hello-world.html');
  process.exit(0);
}

const inputFile = args[0];
let outputFile = args[1];

// Check input file exists
if (!fs.existsSync(inputFile)) {
  console.error(`Error: Input file not found: ${inputFile}`);
  process.exit(1);
}

// Default output filename
if (!outputFile) {
  const parsed = path.parse(inputFile);
  outputFile = path.join(parsed.dir, parsed.name + '.html');
}

console.log(`Compiling: ${inputFile}`);
console.log(`Output to: ${outputFile}`);
console.log('');

try {
  // Read source
  const source = fs.readFileSync(inputFile, 'utf8');

  // Compile
  const html = compile(source);

  // Write output
  fs.writeFileSync(outputFile, html);

  console.log('✓ Compilation successful!');
  console.log(`✓ Generated ${Buffer.byteLength(html)} bytes`);
  console.log('');
  console.log(`Open ${outputFile} in your browser to view the animation.`);

} catch (error) {
  console.error('✗ Compilation failed:');
  console.error('');
  console.error(error.message);
  if (error.stack) {
    console.error('');
    console.error('Stack trace:');
    console.error(error.stack);
  }
  process.exit(1);
}
