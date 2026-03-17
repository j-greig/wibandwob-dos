/**
 * Simple tests for the FlowLang lexer
 */

const { Lexer, TokenType } = require('../lexer');

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    console.error(`  ${error.message}`);
  }
}

function assertEquals(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

// Test 1: Basic tokenization
test('Lexer: Basic keywords', () => {
  const source = 'element flow on let';
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();

  assertEquals(tokens[0].type, TokenType.ELEMENT, 'First token should be ELEMENT');
  assertEquals(tokens[1].type, TokenType.FLOW, 'Second token should be FLOW');
  assertEquals(tokens[2].type, TokenType.ON, 'Third token should be ON');
  assertEquals(tokens[3].type, TokenType.LET, 'Fourth token should be LET');
});

// Test 2: Number literals
test('Lexer: Numbers', () => {
  const source = '42 3.14 0.5';
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();

  assertEquals(tokens[0].value, 42, 'First number');
  assertEquals(tokens[1].value, 3.14, 'Second number');
  assertEquals(tokens[2].value, 0.5, 'Third number');
});

// Test 3: Time literals
test('Lexer: Time literals', () => {
  const source = '@1s @500ms @2.5s';
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();

  assertEquals(tokens[0].type, TokenType.TIME, 'Should be TIME token');
  assertEquals(tokens[0].value, 1000, 'Should convert 1s to 1000ms');
  assertEquals(tokens[1].value, 500, 'Should be 500ms');
  assertEquals(tokens[2].value, 2500, 'Should convert 2.5s to 2500ms');
});

// Test 4: Color literals
test('Lexer: Colors', () => {
  const source = '#fff #ff00ff';
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();

  assertEquals(tokens[0].type, TokenType.COLOR, 'Should be COLOR token');
  assertEquals(tokens[0].value, '#fff', 'First color');
  assertEquals(tokens[1].value, '#ff00ff', 'Second color');
});

// Test 5: String literals
test('Lexer: Strings', () => {
  const source = '"hello" "world"';
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();

  assertEquals(tokens[0].type, TokenType.STRING, 'Should be STRING token');
  assertEquals(tokens[0].value, 'hello', 'First string');
  assertEquals(tokens[1].value, 'world', 'Second string');
});

// Test 6: Operators
test('Lexer: Operators', () => {
  const source = '-> <~> ~> .. == !=';
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();

  assertEquals(tokens[0].type, TokenType.ARROW, 'Arrow operator');
  assertEquals(tokens[1].type, TokenType.BIND, 'Bind operator');
  assertEquals(tokens[2].type, TokenType.ONE_WAY_BIND, 'One-way bind');
  assertEquals(tokens[3].type, TokenType.RANGE, 'Range operator');
  assertEquals(tokens[4].type, TokenType.DOUBLE_EQUAL, 'Equality');
  assertEquals(tokens[5].type, TokenType.NOT_EQUAL, 'Not equal');
});

// Test 7: Comments
test('Lexer: Comments', () => {
  const source = `
    // Single line comment
    element box /* block comment */ {
      x: 100
    }
  `;
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();

  // Should skip comments
  assertEquals(tokens[0].type, TokenType.ELEMENT, 'Should skip single-line comment');
  assertEquals(tokens[1].type, TokenType.IDENTIFIER, 'Should skip block comment');
});

// Test 8: Complete element declaration
test('Lexer: Element declaration', () => {
  const source = `
    element box {
      x: 100
      y: 200
      color: #ff0000
    }
  `;
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();

  assertEquals(tokens[0].type, TokenType.ELEMENT, 'Element keyword');
  assertEquals(tokens[1].type, TokenType.IDENTIFIER, 'Element name');
  assertEquals(tokens[1].value, 'box', 'Element name value');
  assertEquals(tokens[2].type, TokenType.LBRACE, 'Opening brace');
  assertEquals(tokens[3].type, TokenType.IDENTIFIER, 'Property name');
  assertEquals(tokens[4].type, TokenType.COLON, 'Colon');
  assertEquals(tokens[5].type, TokenType.NUMBER, 'Property value');
});

console.log('\n=== Lexer Tests Complete ===\n');
