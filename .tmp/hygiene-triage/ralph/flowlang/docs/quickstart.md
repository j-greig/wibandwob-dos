# FlowLang Quickstart Guide

Get animating in 5 minutes!

## Installation

```bash
# Clone the repository
git clone <repo>
cd flowlang
```

No dependencies required - FlowLang compiles to vanilla JavaScript.

## Your First Animation

### Step 1: Create a FlowLang File

Create `first-animation.flow`:

```flow
// Create a circle
element circle {
  x: 400
  y: 300
  width: 50
  height: 50
  shape: circle
  color: #00ffff
  opacity: 0
}

// Animate it
flow appear on circle {
  @0s -> opacity: 0
  @1s -> opacity: 1
  ease: smooth
}

// Start on page load
on load {
  start appear
}
```

### Step 2: Compile

```bash
node compiler/transpiler.js first-animation.flow output.html
```

Or use the compile helper:

```javascript
// compile.js
const { compile } = require('./compiler/transpiler');
const fs = require('fs');

const source = fs.readFileSync('first-animation.flow', 'utf8');
const html = compile(source);
fs.writeFileSync('output.html', html);
```

Run it:

```bash
node compile.js
```

### Step 3: View

Open `output.html` in your browser - you'll see a cyan circle fade in!

## Core Concepts

### 1. Elements Create Visuals

```flow
element name {
  property: value
}
```

**Common properties**:
- `x`, `y` - Position (pixels from top-left)
- `width`, `height` - Size in pixels
- `color` - Background color (#hex)
- `shape` - `rect`, `circle`, or `text`
- `opacity` - 0 (transparent) to 1 (opaque)
- `fontSize` - Text size (if shape is `text`)
- `content` - Text content (if shape is `text`)

### 2. Flows Create Motion

```flow
flow name on targetElement {
  @time -> property: value
  @time -> property: value
  ease: easingFunction
  repeat: number | infinite
}
```

**Time format**: `@` + number + `s` (seconds) or `ms` (milliseconds)

**Easing options**:
- `linear` - constant speed
- `smooth` - ease in and out
- `bounce` - bouncy ending
- `elastic` - elastic spring
- `spring` - physics spring

### 3. Triggers Start Animations

```flow
on eventName {
  start flowName
  stop flowName
  toggle flowName
}
```

**Event options**:
- `load` - When page loads
- `click` - On any click
- `hover` - On hover (any element)

## Common Patterns

### Fade In Text

```flow
element title {
  x: 400
  y: 200
  shape: text
  content: "Welcome!"
  fontSize: 48
  color: #ffffff
  opacity: 0
}

flow fadeIn on title {
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
  y: 50
  width: 40
  height: 40
  shape: circle
  color: #ff0000
}

flow bounce on ball {
  @0s -> y: 50
  @0.5s -> y: 500
  @1s -> y: 50
  ease: bounce
  repeat: infinite
}

on load {
  start bounce
}
```

### Pulsing Button

```flow
element button {
  x: 350
  y: 250
  width: 100
  height: 50
  color: #4CAF50
}

flow pulse on button {
  @0s -> {
    width: 100
    height: 50
  }
  @0.5s -> {
    width: 110
    height: 55
  }
  ease: smooth
  repeat: infinite
  yoyo: true
}

on load {
  start pulse
}
```

### Moving Across Screen

```flow
element box {
  x: 0
  y: 200
  width: 50
  height: 50
  color: #00ff00
}

flow slide on box {
  @0s -> x: 0
  @2s -> x: 750
  ease: smooth
}

on click {
  start slide
}
```

## Advanced Techniques

### Multiple Properties at Once

```flow
flow complex on element {
  @0s -> {
    x: 0
    y: 0
    opacity: 0
  }
  @1s -> {
    x: 400
    y: 300
    opacity: 1
  }
  ease: smooth
}
```

### Color Cycling

```flow
flow rainbow on shape {
  @0s -> color: #ff0000
  @1s -> color: #00ff00
  @2s -> color: #0000ff
  @3s -> color: #ff0000
  ease: smooth
  repeat: infinite
}
```

### Particle Effects

```flow
particles snowflakes {
  count: 100
  spawn: {
    x: random(0, 800)
    y: random(-50, 0)
    width: 3
    height: 3
    shape: circle
    color: #ffffff
    opacity: random(0.3, 1)
  }
}

on load {
  spawn snowflakes
}
```

### Using Variables

```flow
let primaryColor = #ff00ff
let animDuration = @1.5s

element box {
  color: primaryColor
}

flow animate on box {
  @0s -> opacity: 0
  @animDuration -> opacity: 1
}
```

## Debugging Tips

### Check the Console

Open browser DevTools (F12) and check Console for errors.

### Inspect Elements

```javascript
// In browser console
FlowLang.elements  // See all registered elements
FlowLang.flows     // See all registered flows
```

### Common Mistakes

1. **Flow name doesn't match**
   ```flow
   flow fadeIn on box { }
   on load { start fadeOut }  // ❌ Wrong name
   ```

2. **Element name doesn't match**
   ```flow
   element myBox { }
   flow anim on box { }  // ❌ Should be "myBox"
   ```

3. **Time going backwards**
   ```flow
   flow bad on el {
     @2s -> x: 100
     @1s -> x: 200  // ❌ Time should increase
   }
   ```

4. **Missing properties**
   ```flow
   element incomplete {
     // ❌ No x, y - won't be visible
     color: #ff0000
   }
   ```

## Next Steps

1. **Try the examples**: Check `flowlang/examples/` for more
2. **Read the spec**: See `flowlang/spec/language-spec.md`
3. **Build something**: Create your own animation!
4. **Check the demo**: Open `demo-website/dist/index.html`

## Quick Reference Card

```flow
// Element
element name {
  x: 100
  y: 100
  width: 50
  height: 50
  color: #ff0000
  shape: circle
  opacity: 1
}

// Flow
flow animName on element {
  @0s -> property: value
  @1s -> property: value
  ease: smooth | linear | bounce | elastic | spring
  repeat: 1 | infinite
  yoyo: true | false
}

// Trigger
on load | click | hover {
  start animName
  stop animName
  toggle animName
  spawn particleName
}

// Particles
particles name {
  count: 100
  spawn: { /* element properties */ }
}

// Variable
let name = value

// Time
@1s    // 1 second
@500ms // 500 milliseconds

// Colors
#ff0000 // Hex RGB
#f00    // Short hex

// Functions
random(min, max)
```

Happy animating! 🎨✨
