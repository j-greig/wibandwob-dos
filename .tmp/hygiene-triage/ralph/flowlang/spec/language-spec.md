# FlowLang Language Specification v0.1

## Philosophy

FlowLang treats **motion** and **time** as first-class citizens. Every visual element has implicit animation capabilities, and time is a native type rather than a callback parameter.

## Syntax Overview

### Basic Structure

```flow
// Comments use double-slash
/* Multi-line comments */

// Elements are declared with visual properties
element box {
  x: 100
  y: 100
  width: 50
  height: 50
  color: #ff0000
}

// Flows define animations over time
flow slideRight on box {
  @0s -> x: 100
  @1s -> x: 400
  ease: smooth
}
```

### Core Concepts

#### 1. Elements (Visual Primitives)

```flow
element <name> {
  // Position
  x: <number>
  y: <number>
  z: <number>  // 3D depth

  // Dimensions
  width: <number>
  height: <number>
  radius: <number>  // For circles

  // Visual properties
  color: <color>
  opacity: <0-1>
  rotation: <degrees>
  scale: <number>

  // Shape type
  shape: rect | circle | path | text

  // For text elements
  content: "<string>"
  fontSize: <number>
}
```

#### 2. Time Literals

Time is a native type with @ prefix:

```flow
@0s          // 0 seconds
@500ms       // 500 milliseconds
@1.5s        // 1.5 seconds
@2m          // 2 minutes (converted to seconds)
```

#### 3. Flow (Animation Definition)

```flow
flow <name> on <element> {
  @<time> -> <property>: <value>
  @<time> -> <property>: <value>

  // Animation properties
  ease: linear | smooth | bounce | elastic | spring
  repeat: <number> | infinite
  yoyo: true | false
  delay: @<time>
}
```

#### 4. Easing Functions

Built-in easing:
- `linear` - Constant rate
- `smooth` - Ease in-out (cubic)
- `bounce` - Bounce effect at end
- `elastic` - Elastic oscillation
- `spring` - Physics-based spring
- `snap` - Instant jump

Custom easing:
```flow
ease: cubic(0.25, 0.1, 0.25, 1.0)  // Cubic bezier
```

#### 5. Triggers & Events

```flow
on <event> {
  start <flow_name>
  stop <flow_name>
  toggle <flow_name>
}

// Events: click, hover, load, scroll, custom
```

#### 6. Sequences & Parallel Flows

```flow
sequence {
  play fadeIn
  wait @1s
  play slideRight
  parallel {
    play scaleUp
    play rotate
  }
}
```

#### 7. Variables & Expressions

```flow
let speed = @2s
let targetX = 400
let color = #00ff00

flow moveBox on box {
  @0s -> x: 0
  @speed -> x: targetX
}

// Expressions
x: targetX + 100
rotation: 360 * 2
opacity: 0.5 + 0.5
```

#### 8. Functions (Reusable Animations)

```flow
fn fadeIn(target, duration) {
  flow {
    @0s -> opacity: 0
    @duration -> opacity: 1
    ease: smooth
  }
}

// Usage
apply fadeIn(box, @1s)
```

#### 9. Reactive Bindings

```flow
element follower {
  x: leader.x + 50  // Follows leader with offset
  y: leader.y
  color: leader.color
}

// Two-way binding with spring physics
follower.x <~> leader.x + 50 with spring(stiffness: 100)
```

#### 10. Paths & Morphing

```flow
path simplePath {
  points: [(0, 0), (100, 100), (200, 50)]
  closed: false
}

flow followPath on box {
  @0s -> path: simplePath, progress: 0
  @3s -> path: simplePath, progress: 1
}

// Morphing between shapes
flow morph on shape {
  @0s -> geometry: circle
  @2s -> geometry: square
  ease: smooth
}
```

#### 11. Particle Systems

```flow
particles stars {
  count: 100
  spawn: {
    x: random(0, 800)
    y: random(0, 600)
    color: #ffffff
    opacity: random(0.3, 1)
  }

  flow drift {
    @0s -> y: initial
    @5s -> y: initial - random(100, 300)
    repeat: infinite
    ease: linear
  }
}
```

#### 12. Modules & Imports

```flow
// animation-library.flow
export fn slideIn(el, dir) { /* ... */ }
export let standardDuration = @1s

// main.flow
import { slideIn, standardDuration } from "./animation-library"

apply slideIn(myBox, "left")
```

## Type System

### Primitive Types
- `number` - Integers and floats
- `time` - Time duration (@1s, @500ms)
- `color` - Hex, RGB, HSL (#ff0000, rgb(255,0,0))
- `string` - Text content
- `boolean` - true/false
- `path` - Bezier path definition
- `element` - Reference to visual element

### Composite Types
- `point` - (x, y) or (x, y, z)
- `array` - [1, 2, 3, 4]
- `object` - { key: value }

### Type Inference

FlowLang infers types from context:

```flow
let x = 100        // number
let duration = @2s // time
let name = "box"   // string
```

## Operators

### Arithmetic
`+`, `-`, `*`, `/`, `%`, `^` (power)

### Comparison
`==`, `!=`, `>`, `<`, `>=`, `<=`

### Logical
`and`, `or`, `not`

### Animation-specific
- `->` Timeline keyframe
- `<~>` Reactive binding with physics
- `~>` One-way reactive binding
- `..` Range (0..100)

## Grammar (EBNF)

```ebnf
Program         ::= Statement*

Statement       ::= ElementDecl | FlowDecl | FunctionDecl |
                    VariableDecl | Import | Export |
                    Apply | Sequence | Trigger

ElementDecl     ::= "element" Identifier "{" Property* "}"

FlowDecl        ::= "flow" Identifier "on" Identifier "{"
                    Keyframe* AnimProperty* "}"

Keyframe        ::= "@" Time "->" Property ":" Expression

FunctionDecl    ::= "fn" Identifier "(" Params? ")" "{" Statement* "}"

VariableDecl    ::= "let" Identifier "=" Expression

Property        ::= Identifier ":" Expression

Expression      ::= Literal | Identifier | BinaryOp |
                    FunctionCall | Path | Binding

Literal         ::= Number | Time | Color | String | Boolean

Time            ::= "@" Number ("s" | "ms" | "m")

Color           ::= "#" HexDigits | "rgb" "(" Number "," Number "," Number ")"

BinaryOp        ::= Expression Operator Expression

Operator        ::= "+" | "-" | "*" | "/" | "==" | "!=" |
                    ">" | "<" | "and" | "or"

Identifier      ::= [a-zA-Z_][a-zA-Z0-9_]*

Number          ::= [0-9]+ ("." [0-9]+)?

String          ::= '"' [^"]* '"'
```

## Standard Library

### Easing Functions
- `ease.linear(t)`
- `ease.smooth(t)` - cubic ease in-out
- `ease.bounce(t)`
- `ease.elastic(t, amplitude, period)`
- `ease.spring(t, stiffness, damping)`

### Math Functions
- `sin(angle)`, `cos(angle)`, `tan(angle)`
- `random(min, max)`
- `clamp(value, min, max)`
- `lerp(a, b, t)` - Linear interpolation
- `map(value, inMin, inMax, outMin, outMax)`

### Color Functions
- `rgb(r, g, b)`
- `hsl(h, s, l)`
- `mix(color1, color2, amount)`

### Animation Helpers
- `stagger(flows, delay)` - Stagger multiple animations
- `timeline(flows)` - Compose flows into timeline

## Example Programs

### Hello World

```flow
// Hello World in FlowLang
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

### Interactive Button

```flow
element button {
  x: 350
  y: 250
  width: 100
  height: 50
  shape: rect
  color: #4CAF50
  radius: 8
  scale: 1
}

flow scaleUp on button {
  @0s -> scale: 1
  @0.2s -> scale: 1.1
  ease: spring
}

flow scaleDown on button {
  @0s -> scale: 1.1
  @0.2s -> scale: 1
  ease: spring
}

on hover {
  start scaleUp
}

on hoverEnd {
  start scaleDown
}
```

### Particle System

```flow
particles fireflies {
  count: 50
  spawn: {
    x: random(0, 800)
    y: random(0, 600)
    width: 3
    height: 3
    shape: circle
    color: #ffff00
    opacity: random(0.5, 1)
  }

  flow float {
    @0s -> {
      x: initial
      y: initial
    }
    @random(3s, 6s) -> {
      x: initial + random(-100, 100)
      y: initial + random(-100, 100)
    }
    ease: smooth
    repeat: infinite
    yoyo: true
  }

  flow glow {
    @0s -> opacity: 0.3
    @1s -> opacity: 1
    @2s -> opacity: 0.3
    ease: smooth
    repeat: infinite
  }
}

on load {
  spawn fireflies
}
```

## Compilation Targets

FlowLang transpiles to:

1. **Vanilla JS + CSS Animations** (default, lightweight)
2. **GSAP** (for complex sequencing)
3. **Three.js** (for 3D)
4. **Canvas/WebGL** (for particles and effects)

Compiler chooses target based on features used.

## Reserved Keywords

```
element, flow, on, let, fn, if, else, for, while,
return, import, export, from, apply, start, stop,
toggle, play, wait, parallel, sequence, spawn,
ease, repeat, yoyo, delay, with, and, or, not,
true, false, infinite, shape, path, particles
```

## File Extension

`.flow`

---

**Status**: v0.1 Draft - Subject to change during implementation
