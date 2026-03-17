/**
 * Simple tests for the FlowLang parser
 */

const { Lexer } = require('../lexer');
const { Parser } = require('../parser');

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

// Test 1: Parse element declaration
test('Parser: Element declaration', () => {
  const source = `
    element box {
      x: 100
      y: 200
    }
  `;

  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();

  assertEquals(ast.type, 'Program', 'Should be a Program');
  assertEquals(ast.statements.length, 1, 'Should have 1 statement');
  assertEquals(ast.statements[0].type, 'ElementDeclaration', 'Should be ElementDeclaration');
  assertEquals(ast.statements[0].name, 'box', 'Element name');
  assertEquals(ast.statements[0].properties.length, 2, 'Should have 2 properties');
});

// Test 2: Parse variable declaration
test('Parser: Variable declaration', () => {
  const source = 'let x = 100';

  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();

  assertEquals(ast.statements[0].type, 'VariableDeclaration', 'Should be VariableDeclaration');
  assertEquals(ast.statements[0].name, 'x', 'Variable name');
  assertEquals(ast.statements[0].value.value, 100, 'Variable value');
});

// Test 3: Parse flow declaration
test('Parser: Flow declaration', () => {
  const source = `
    flow fadeIn on box {
      @0s -> opacity: 0
      @1s -> opacity: 1
      ease: smooth
    }
  `;

  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();

  const flow = ast.statements[0];
  assertEquals(flow.type, 'FlowDeclaration', 'Should be FlowDeclaration');
  assertEquals(flow.name, 'fadeIn', 'Flow name');
  assertEquals(flow.target, 'box', 'Flow target');
  assertEquals(flow.keyframes.length, 2, 'Should have 2 keyframes');
  assertEquals(flow.animProperties.length, 1, 'Should have 1 anim property');
});

// Test 4: Parse binary expressions
test('Parser: Binary expressions', () => {
  const source = 'let result = 10 + 20 * 30';

  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();

  const varDecl = ast.statements[0];
  assertEquals(varDecl.value.type, 'BinaryExpression', 'Should be BinaryExpression');
  assertEquals(varDecl.value.operator, '+', 'Operator should be +');
});

// Test 5: Parse trigger statement
test('Parser: Trigger statement', () => {
  const source = `
    on load {
      start fadeIn
    }
  `;

  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();

  const trigger = ast.statements[0];
  assertEquals(trigger.type, 'TriggerStatement', 'Should be TriggerStatement');
  assertEquals(trigger.event, 'load', 'Event name');
  assertEquals(trigger.actions.length, 1, 'Should have 1 action');
  assertEquals(trigger.actions[0].action, 'start', 'Action type');
});

// Test 6: Parse complete hello-world program
test('Parser: Complete hello-world program', () => {
  const source = `
    element greeting {
      x: 400
      y: 300
      color: #ffffff
    }

    flow fadeIn on greeting {
      @0s -> opacity: 0
      @2s -> opacity: 1
      ease: smooth
    }

    on load {
      start fadeIn
    }
  `;

  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();

  assertEquals(ast.statements.length, 3, 'Should have 3 statements');
  assertEquals(ast.statements[0].type, 'ElementDeclaration', 'First is element');
  assertEquals(ast.statements[1].type, 'FlowDeclaration', 'Second is flow');
  assertEquals(ast.statements[2].type, 'TriggerStatement', 'Third is trigger');
});

console.log('\n=== Parser Tests Complete ===\n');
