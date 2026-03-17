# FlowLang: Motion-Native Programming Language

**tl;dr:** Create FlowLang, a declarative language for animation & motion design. Transpiles to JS/WebGL. Build interpreter, compiler, VS Code extension, Ralph modules for development, and demo website with animated visualizations proving concept.

## Context

Current web animation requires mixing JS libraries (GSAP, Three.js, anime.js), CSS, and imperative code. No language treats motion, timing, and visual flow as first-class primitives. This creates a new language where animations are the core abstraction, not an afterthought.

## Objective

Build a complete programming language ecosystem from scratch:
1. **Language design**: Syntax, semantics, type system
2. **Tooling**: Lexer, parser, interpreter, compiler (to JS)
3. **Developer experience**: VS Code extension, Ralph prompt modules
4. **Proof of concept**: Animated website built entirely in FlowLang

## Requirements

### Language Features
• Motion primitives: `flow`, `ease`, `spring`, `morph`, `wave`
• Time as first-class type: `@0s`, `@1.5s`, `duration(2s)`
• Declarative animation sequences with timeline algebra
• Visual state transformations (position, color, scale, rotate)
• Event-driven triggers and reactive bindings
• Module system for reusable animations
• Type safety for animation properties

### Technical Implementation
• Lexer/tokenizer in JavaScript/TypeScript
• Recursive descent parser producing AST
• Interpreter for direct execution
• Transpiler targeting vanilla JS + CSS animations or WebGL
• Runtime library for animation engine
• Source maps for debugging

### Developer Tooling
• VS Code extension: syntax highlighting, IntelliSense, snippets
• Ralph prompt modules: language-specific coding assistance
• Documentation generator from language constructs
• REPL for interactive testing

### Demo Website
• Built 100% in FlowLang
• Multiple animation techniques showcased
• Responsive, performant, visually impressive
• Source code viewable as proof

## Implementation Approach

### Phase 1: Language Design (Foundation)
1. Define syntax grammar (EBNF notation)
2. Design core primitives and keywords
3. Specify type system and scoping rules
4. Create example programs showing language capabilities
5. Write language spec document

**Output**: `flowlang/spec/language-spec.md`, example `.flow` files

### Phase 2: Lexer & Parser
1. Implement tokenizer for FlowLang syntax
2. Build recursive descent parser
3. Generate Abstract Syntax Tree (AST)
4. Add error reporting with line numbers
5. Unit tests for parsing edge cases

**Output**: `flowlang/compiler/lexer.js`, `parser.js`, test suite

### Phase 3: Interpreter & Runtime
1. Create AST walker/interpreter
2. Implement animation runtime engine
3. Build standard library (easing functions, interpolators)
4. Add timeline scheduling system
5. Memory management and GC considerations

**Output**: `flowlang/runtime/interpreter.js`, `engine.js`, stdlib

### Phase 4: Transpiler (FlowLang → JavaScript)
1. AST to JavaScript code generator
2. Optimize output for production
3. Generate source maps
4. Bundle runtime as lightweight library
5. Performance benchmarks

**Output**: `flowlang/compiler/transpiler.js`, minified runtime

### Phase 5: Developer Tooling
1. VS Code extension scaffolding
2. TextMate grammar for syntax highlighting
3. Language server for IntelliSense
4. Code snippets and templates
5. Publish extension (local first)

**Output**: `flowlang/vscode-extension/`, `.vsix` package

### Phase 6: Ralph Prompt Modules
1. Create `prompts/modules/flowlang-dev.md` - language development guide
2. Create `prompts/modules/flowlang-code.md` - FlowLang coding assistant
3. Create `prompts/modules/flowlang-debug.md` - debugging helper
4. Add modules to `.claude/ralph-modules.json`

**Output**: 3 Ralph modules in `prompts/modules/`

### Phase 7: Demo Website
1. Design animation concept (particle system, morphing shapes, interactive)
2. Write website entirely in FlowLang
3. Transpile to production JS/HTML/CSS
4. Host locally with live server
5. Create video/GIF of animations

**Output**: `flowlang/demo-website/`, compiled `dist/` folder

### Phase 8: Documentation & Polish
1. README with quickstart examples
2. API reference documentation
3. Tutorial: "Your First Animation"
4. Language philosophy and design decisions
5. Contribution guidelines

**Output**: `flowlang/docs/` directory, updated README

## Success Criteria

□ FlowLang code compiles without errors and produces valid JS
□ Demo website runs in browser with smooth 60fps animations
□ VS Code extension provides syntax highlighting and autocomplete
□ Ralph modules successfully assist with FlowLang development
□ Complete documentation allows third party to write FlowLang
□ Transpiled output is readable and performant (<50KB runtime)
□ Language demonstrates clear advantages over vanilla JS for animations

## Constraints & Considerations

• **Scope management**: Language is domain-specific (animations), not general-purpose
• **Browser compatibility**: Target modern browsers (ES6+, CSS transforms)
• **Performance**: Animations must be hardware-accelerated where possible
• **Learning curve**: Syntax should be intuitive for web developers
• **Tooling maturity**: Won't match established languages, but must be usable
• **Time investment**: This is a large project, prioritize MVP features first

## Project Structure

```
flowlang/
├── spec/
│   └── language-spec.md
├── compiler/
│   ├── lexer.js
│   ├── parser.js
│   ├── transpiler.js
│   └── tests/
├── runtime/
│   ├── interpreter.js
│   ├── engine.js
│   ├── stdlib.js
│   └── easing.js
├── vscode-extension/
│   ├── syntaxes/
│   ├── snippets/
│   └── package.json
├── demo-website/
│   ├── src/
│   │   └── main.flow
│   └── dist/
├── docs/
│   ├── quickstart.md
│   ├── api-reference.md
│   └── tutorial.md
├── examples/
│   ├── hello-world.flow
│   ├── particle-system.flow
│   └── morph-shapes.flow
└── README.md
```

## Design Philosophy

FlowLang is built on these principles:

1. **Declarative motion**: Describe *what* animates, not *how* to animate it
2. **Time-aware**: Time is a native type, not a parameter
3. **Composable**: Small animations combine into complex choreography
4. **Visual-first**: Optimize for visual expression over computational abstraction
5. **Web-native**: Transpile to web standards, not a proprietary runtime

---

**Next Steps**: Begin Phase 1 with language syntax design and example programs.
