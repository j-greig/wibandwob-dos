# FlowLang

> A motion-native programming language where animations are first-class citizens.

**tl;dr:** FlowLang is a declarative language for creating animations and interactive visuals. Write expressive motion code, transpile to vanilla JavaScript, and run in any modern browser.

## Features

- 🎨 **Motion-First Design** - Time and animation are native language primitives
- ⚡ **Performance** - Transpiles to optimized Web Animations API
- 🎯 **Declarative Syntax** - Describe *what* animates, not *how*
- 🔧 **Zero Dependencies** - Compiles to vanilla JavaScript
- 🌊 **Particle Systems** - Built-in support for particle effects
- 🎭 **Rich Easing** - Spring physics, bounce, elastic, and more

## Quick Start

### Installation

```bash
git clone <repo>
cd flowlang
```

### Hello World

Create `hello.flow`:

```flow
element greeting {
  x: 400
  y: 300
  shape: text
  content: "Hello, FlowLang!"
  fontSize: 48
  color: #ffffff
  opacity: 0
}

flow fadeIn on greeting {
  @0s -> opacity: 0
  @2s -> opacity: 1
  ease: smooth
}

on load {
  start fadeIn
}
```

Compile to HTML:

```bash
node flowlang/compiler/compile.js hello.flow output.html
```

Open `output.html` in your browser!

## Language Overview

### Elements

Visual objects on screen:

```flow
element box {
  x: 100          // X position
  y: 100          // Y position
  width: 50       // Width in pixels
  height: 50      // Height in pixels
  color: #ff0000  // Background color
  shape: circle   // Shape: rect, circle, text
  opacity: 1      // Transparency (0-1)
}
```

### Flows (Animations)

Animate element properties over time:

```flow
flow slideRight on box {
  @0s -> x: 100       // At 0 seconds
  @1s -> x: 400       // At 1 second
  ease: smooth        // Easing function
  repeat: infinite    // Loop forever
}
```

### Time Literals

Time is a first-class type:

```flow
@0s       // 0 seconds
@500ms    // 500 milliseconds
@1.5s     // 1.5 seconds
@2m       // 2 minutes (120 seconds)
```

### Easing Functions

Control animation curves:

- `linear` - Constant speed
- `smooth` - Ease in-out (cubic bezier)
- `bounce` - Bounce effect at end
- `elastic` - Elastic oscillation
- `spring` - Physics-based spring motion

### Triggers

Execute animations on events:

```flow
on load {
  start fadeIn
}

on click {
  toggle bounce
}

on hover {
  start scaleUp
}
```

### Particles

Create particle systems:

```flow
particles stars {
  count: 100
  spawn: {
    x: random(0, 800)
    y: random(0, 600)
    width: 2
    height: 2
    shape: circle
    color: #ffffff
    opacity: random(0.3, 1)
  }
}

on load {
  spawn stars
}
```

### Variables

Reuse values:

```flow
let speed = @2s
let color = #ff00ff

element box {
  color: color
}

flow move on box {
  @0s -> x: 0
  @speed -> x: 400
}
```

## Examples

### Bouncing Ball

```flow
element ball {
  x: 400
  y: 0
  width: 50
  height: 50
  shape: circle
  color: #ff0000
}

flow bounce on ball {
  @0s -> y: 0
  @0.5s -> y: 500
  @1s -> y: 0
  ease: bounce
  repeat: infinite
}

on load {
  start bounce
}
```

### Color Cycle

```flow
element square {
  x: 350
  y: 250
  width: 100
  height: 100
  color: #ff0000
}

flow colorCycle on square {
  @0s -> color: #ff0000
  @1s -> color: #00ff00
  @2s -> color: #0000ff
  @3s -> color: #ff0000
  ease: smooth
  repeat: infinite
}

on load {
  start colorCycle
}
```

### Pulsing Effect

```flow
element circle {
  x: 375
  y: 275
  width: 50
  height: 50
  shape: circle
  color: #00ffff
}

flow pulse on circle {
  @0s -> {
    width: 50
    height: 50
  }
  @1s -> {
    width: 80
    height: 80
  }
  ease: smooth
  repeat: infinite
  yoyo: true  // Reverses direction
}

on load {
  start pulse
}
```

## Compiler Usage

### Command Line

```bash
# Compile FlowLang to HTML
node compiler/compile.js input.flow output.html

# Compile to JavaScript only
node compiler/compile.js input.flow output.js --no-html
```

### Programmatic API

```javascript
const { compile } = require('./compiler/transpiler');
const fs = require('fs');

const source = fs.readFileSync('animation.flow', 'utf8');
const html = compile(source);

fs.writeFileSync('output.html', html);
```

### Options

```javascript
const output = compile(source, {
  standalone: true,   // Include HTML wrapper
  includeRuntime: true  // Include animation runtime
});
```

## Project Structure

```
flowlang/
├── spec/
│   └── language-spec.md          # Complete language specification
├── compiler/
│   ├── lexer.js                  # Tokenizer
│   ├── parser.js                 # AST parser
│   ├── transpiler.js             # Code generator
│   └── tests/                    # Compiler tests
├── runtime/
│   └── (transpiler includes runtime inline)
├── vscode-extension/             # VS Code support (TBD)
├── demo-website/
│   ├── src/
│   │   └── showcase.flow         # Demo source
│   └── dist/
│       └── index.html            # Compiled demo
├── examples/
│   ├── hello-world.flow
│   ├── bouncing-ball.flow
│   ├── particle-system.flow
│   └── morphing-shapes.flow
└── docs/
    ├── quickstart.md
    ├── api-reference.md
    └── tutorial.md
```

## Language Design

FlowLang is built on these principles:

1. **Declarative Motion** - Describe what animates, not how
2. **Time-Aware** - Time is a native type, not a callback parameter
3. **Composable** - Small animations combine into complex choreography
4. **Visual-First** - Optimized for visual expression
5. **Web-Native** - Transpiles to standard web technologies

## Performance

FlowLang generates code using:
- Web Animations API (hardware-accelerated)
- CSS transforms (GPU-optimized)
- Efficient keyframe interpolation
- Minimal runtime overhead (<50KB)

## Browser Support

Requires modern browsers with:
- Web Animations API
- ES6 JavaScript
- CSS3 transforms

Tested on:
- Chrome/Edge 80+
- Firefox 75+
- Safari 13+

## Roadmap

- [x] Lexer and parser
- [x] Transpiler to JavaScript
- [x] Basic animations (position, opacity, color)
- [x] Easing functions
- [x] Particle systems
- [x] Event triggers
- [ ] VS Code extension
- [ ] Live REPL/playground
- [ ] Advanced path animations
- [ ] 3D transforms
- [ ] Sound integration
- [ ] WebGL renderer option

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines.

### Development Setup

```bash
# Run lexer tests
cd compiler/tests
node lexer-test.js

# Run parser tests
node parser-test.js

# Run transpiler tests
node transpiler-test.js
```

### Adding Features

1. Update language spec
2. Add tokens to lexer
3. Add parsing logic to parser
4. Add code generation to transpiler
5. Write tests
6. Update documentation

## License

See [LICENSE](../LICENSE)

## Examples Gallery

Check out the demo website at `demo-website/dist/index.html` to see:
- Fading text animations
- Bouncing physics
- Color morphing
- Pulsing shapes
- Particle effects

## Credits

Created as a demonstration of language design and compiler construction.

Built with:
- JavaScript (Node.js)
- Web Animations API
- Love for motion design

---

**FlowLang** - Where code flows like motion.
