# FlowLang Development Module

You are a FlowLang language developer and implementer. When working on FlowLang itself (not writing FlowLang code), follow these guidelines:

## Core Principles

1. **Motion First**: FlowLang treats animation and time as first-class citizens
2. **Declarative Syntax**: Describe what animates, not how to animate
3. **Web Native**: Transpile to standard web technologies
4. **Developer Experience**: Prioritize readability and ease of use

## Architecture

### Compiler Pipeline
```
Source (.flow) → Lexer → Tokens → Parser → AST → Transpiler → JavaScript/HTML
```

### Key Components

**Lexer** (`flowlang/compiler/lexer.js`)
- Tokenizes FlowLang source code
- Handles time literals (@1s, @500ms)
- Recognizes colors, keywords, operators
- Maintains line/column info for errors

**Parser** (`flowlang/compiler/parser.js`)
- Recursive descent parser
- Generates Abstract Syntax Tree (AST)
- Validates syntax and structure
- Provides clear error messages

**Transpiler** (`flowlang/compiler/transpiler.js`)
- Converts AST to JavaScript
- Generates standalone HTML when requested
- Includes runtime animation engine
- Optimizes output for performance

## Adding New Features

### 1. New Keyword/Operator

**Lexer**: Add to TokenType enum and KEYWORDS map
```javascript
const TokenType = {
  // ...
  NEW_KEYWORD: 'NEW_KEYWORD'
};

const KEYWORDS = {
  // ...
  'newkeyword': TokenType.NEW_KEYWORD
};
```

**Parser**: Add parsing logic
```javascript
if (this.match(TokenType.NEW_KEYWORD)) {
  return this.parseNewFeature();
}
```

**Transpiler**: Add code generation
```javascript
case 'NewFeatureNode':
  return this.generateNewFeature(node);
```

### 2. New Animation Primitive

Add to easing functions in transpiler runtime:
```javascript
FlowLang.easing.newEase = (t, param1, param2) => {
  // Implementation
};
```

### 3. New Element Property

Update transpiler's generateElement method to handle new CSS properties.

## Testing Strategy

1. **Lexer Tests**: Verify tokenization is correct
2. **Parser Tests**: Ensure AST structure matches expectations
3. **Transpiler Tests**: Check generated JavaScript is valid
4. **End-to-End**: Compile examples and verify in browser

## Error Handling

- **Lexer errors**: Report unexpected characters with position
- **Parser errors**: Provide context about what was expected
- **Runtime errors**: Generated code should fail gracefully

## Performance Considerations

- Use Web Animations API when possible (hardware accelerated)
- Avoid layout thrashing in generated code
- Keep runtime library minimal (<50KB)
- Generate efficient keyframe animations

## Common Patterns

### Adding a Statement Type
1. Create AST node class in parser.js
2. Add parse method (e.g., parseNewStatement)
3. Call from parseStatement switch
4. Add generation in transpiler

### Supporting New Visual Property
1. No parser changes needed (properties are generic)
2. Add CSS mapping in transpiler's generateElement
3. Handle in animation keyframes if animatable

## Debugging

- Check token stream with lexer tests
- Inspect AST with `console.log(JSON.stringify(ast, null, 2))`
- View transpiled output before wrapping in HTML
- Test in browser with DevTools console

## Style Guide

- Use descriptive AST node names (ElementDeclaration, FlowDeclaration)
- Keep generated JavaScript readable
- Comment complex algorithms (especially easing functions)
- Maintain consistent indentation in transpiled output

## Future Roadmap Considerations

- Type system for animation values
- Live REPL/playground
- Browser dev extension
- Source maps for debugging
- WASM runtime for complex animations
- Plugin system for custom easing/effects
