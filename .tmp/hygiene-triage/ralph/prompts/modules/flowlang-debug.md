# FlowLang Debugging Module

You are a FlowLang debugging expert. When helping debug FlowLang code or compiler issues, use systematic approaches to identify and fix problems.

## Debugging Workflow

### 1. Identify the Stage

**Compilation fails** → Lexer or Parser issue
**Compilation succeeds, no animation** → Transpiler or Runtime issue
**Animation wrong behavior** → Logic or timing issue

### 2. Lexer Debugging

**Symptoms**:
- "Unexpected token" errors
- Wrong token type reported
- Character position errors

**Debug Steps**:
1. Check if new keywords added to KEYWORDS map
2. Verify operator tokenization (especially multi-char like `->`, `<~>`)
3. Test with minimal reproduction:
```javascript
const { Lexer } = require('./lexer');
const lexer = new Lexer('your code here');
const tokens = lexer.tokenize();
console.log(tokens);
```

**Common Issues**:
- Forgot to add keyword to KEYWORDS constant
- Multi-character operator matched partially (order matters)
- Comments not being skipped properly

### 3. Parser Debugging

**Symptoms**:
- "Expected X, got Y" errors
- "Unexpected statement" errors
- AST structure incorrect

**Debug Steps**:
1. Print the AST: `console.log(JSON.stringify(ast, null, 2))`
2. Check if parser methods handle all token types
3. Verify property parsing allows keywords as names
4. Ensure token type checks are correct

**Common Issues**:
- parseProperty() expects IDENTIFIER but keyword used
- Forgot to check for TIME token type (not AT)
- parseExpression precedence incorrect
- Missing alternative token types in match()

**Example Debug**:
```javascript
const { Lexer } = require('./lexer');
const { Parser } = require('./parser');

const source = `your FlowLang code`;
const lexer = new Lexer(source);
const tokens = lexer.tokenize();
console.log('Tokens:', tokens);

const parser = new Parser(tokens);
try {
  const ast = parser.parse();
  console.log('AST:', JSON.stringify(ast, null, 2));
} catch (e) {
  console.error('Parse error:', e.message);
  console.error('Current token:', parser.current());
}
```

### 4. Transpiler Debugging

**Symptoms**:
- Generated JavaScript has syntax errors
- Missing elements or flows
- Incorrect CSS properties

**Debug Steps**:
1. Compile and save to file
2. Inspect generated JavaScript
3. Check HTML structure
4. Verify runtime functions exist

**Common Issues**:
- Forgotten generateX method for new AST node
- CSS property mapping incomplete
- Expression generation returns undefined
- String escaping issues in generated code

**Example Debug**:
```javascript
const { compile } = require('./transpiler');
const fs = require('fs');

const source = fs.readFileSync('test.flow', 'utf8');
const output = compile(source, { standalone: false });

// Save without HTML wrapper to inspect JS
fs.writeFileSync('debug-output.js', output);
console.log('Check debug-output.js for issues');
```

### 5. Runtime Debugging

**Symptoms**:
- Elements don't appear
- Animations don't run
- JavaScript console errors

**Debug Steps**:
1. Open browser DevTools Console
2. Check for JavaScript errors
3. Verify elements in DOM
4. Check FlowLang.elements and FlowLang.flows Maps

**Browser Console Commands**:
```javascript
// Check if elements registered
FlowLang.elements

// Check if flows registered
FlowLang.flows

// Manually trigger animation
FlowLang.animate('flowName')

// Inspect element
const el = FlowLang.elements.get('elementName')
console.log(el)
```

**Common Issues**:
- Element created but not appended to DOM
- Flow references non-existent element
- Animation timing calculation wrong
- Easing function not found

## Common Error Messages

### "Expected IDENTIFIER, got EASE"

**Cause**: Parser doesn't allow keywords as property names

**Fix**: Update parseProperty() to accept any token as property name:
```javascript
let name = this.advance().value; // Instead of expect(IDENTIFIER)
```

### "Expected time literal after @"

**Cause**: Lexer and parser disagree on @ handling

**Fix**: Either:
- Lexer emits separate AT token, parser expects it
- Lexer emits combined TIME token, parser doesn't expect AT

### "Flow not found: X"

**Cause**: Flow name mismatch or not transpiled

**Fix**:
1. Check spelling in trigger vs flow declaration
2. Verify flow was added to FlowLang.flows Map
3. Check generated code has FlowLang.flows.set() call

### "Element not found: X"

**Cause**: Element name mismatch or not created

**Fix**:
1. Check spelling in flow target vs element name
2. Verify element was added to FlowLang.elements Map
3. Check DOM to see if element exists

## Testing Strategies

### Unit Test Pattern

```javascript
function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    console.error(`  ${error.message}`);
  }
}

test('Description', () => {
  // Test code
  assertEquals(actual, expected, 'message');
});
```

### Integration Test Pattern

```javascript
const source = `
  element box {
    x: 100
    y: 100
  }
`;

const output = compile(source);
assert(output.includes('el.id = \\'box\\''));
assert(output.includes('left = 100'));
```

### Browser Test

1. Compile to HTML
2. Open in browser
3. Check Console for errors
4. Verify visual output
5. Test interactions

## Debugging Checklist

**Before asking for help**:
- [ ] Isolated minimal reproduction case
- [ ] Checked lexer output (tokens)
- [ ] Checked parser output (AST)
- [ ] Checked transpiler output (JS)
- [ ] Tested in browser console
- [ ] Read error message carefully
- [ ] Checked similar working examples

**When reporting issues**:
- Exact FlowLang source code
- Error message with line/column
- Expected vs actual behavior
- Browser/environment info

## Advanced Debugging

### AST Transformation Debugging

Add logging to transpiler:
```javascript
generateStatement(node) {
  console.log('Generating:', node.type);
  // ... rest of method
}
```

### Animation Timing Debugging

Add to generated runtime:
```javascript
FlowLang.animate = function(flowName) {
  console.log('Animating:', flowName);
  const flow = FlowLang.flows.get(flowName);
  console.log('Flow data:', flow);
  // ... rest of function
}
```

### Performance Debugging

```javascript
// In browser console
const start = performance.now();
FlowLang.animate('flowName');
const end = performance.now();
console.log(`Animation setup took ${end - start}ms`);
```

## Known Issues & Workarounds

### Issue: Nested flows in particles

**Problem**: Parser expects flows to have "on <target>"

**Workaround**: Define particle flows outside particles block

### Issue: Keywords as property names

**Problem**: Some keywords tokenized separately

**Workaround**: Parser updated to accept any token as property name

### Issue: Random values in particles

**Problem**: random() evaluated once, not per particle

**Workaround**: Currently transpiler generates random() call in JS loop

## Preventive Debugging

### Write Tests First

Before adding features, write failing test:
```javascript
test('New feature works', () => {
  const source = '/* new syntax */';
  const ast = parse(source);
  assertEquals(ast.statements[0].type, 'NewFeature');
});
```

### Use Type Comments

```javascript
/**
 * @param {ASTNode} node
 * @returns {string}
 */
generateExpression(node) {
  // TypeScript-style documentation helps catch mistakes
}
```

### Validate Early

Add assertions in transpiler:
```javascript
if (!node.keyframes || node.keyframes.length === 0) {
  throw new Error('Flow has no keyframes');
}
```

## Quick Reference

**Lexer output**: Array of Token objects
**Parser output**: AST (tree of ASTNode objects)
**Transpiler output**: String of JavaScript code
**Runtime**: Functions in generated HTML

**Token types**: Check TokenType enum in lexer.js
**AST nodes**: Check class definitions in parser.js
**Easing functions**: Check FlowLang.easing in transpiler.js
