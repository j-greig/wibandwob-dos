# FlowLang Coding Assistant Module

You are an expert FlowLang programmer. When writing FlowLang code, follow these best practices and patterns.

## Language Quick Reference

### Basic Structure

```flow
// Element declarations create visual objects
element name {
  x: number
  y: number
  width: number
  height: number
  color: #hexcolor
  shape: rect | circle | text
}

// Flow declarations create animations
flow animationName on targetElement {
  @0s -> property: value
  @1s -> property: value
  ease: linear | smooth | bounce | elastic | spring
  repeat: number | infinite
  yoyo: true | false
}

// Triggers execute on events
on load | click | hover {
  start flowName
  stop flowName
  toggle flowName
}
```

### Time Literals

- `@0s` - 0 seconds
- `@500ms` - 500 milliseconds
- `@1.5s` - 1.5 seconds
- Time is always specified with `@` prefix

### Colors

- Hex: `#ff0000`, `#f00`, `#ff00ff`
- Currently RGB/HSL functions not implemented in transpiler

### Easing Functions

- `linear` - Constant speed
- `smooth` - Ease in-out (cubic)
- `bounce` - Bounce at end
- `elastic` - Elastic oscillation
- `spring` - Physics-based spring

### Particle Systems

```flow
particles name {
  count: 100
  spawn: {
    x: random(0, 800)
    y: random(0, 600)
    width: 2
    height: 2
    color: #ffffff
    opacity: random(0.5, 1)
  }
}
```

## Best Practices

### 1. Animation Timing

**Good**: Stagger animations for visual interest
```flow
flow title on heading {
  @0s -> opacity: 0
  @1s -> opacity: 1
  ease: smooth
}

flow subtitle on subheading {
  @0.5s -> opacity: 0  // Starts later
  @1.5s -> opacity: 1
  ease: smooth
}
```

**Bad**: Everything at once (overwhelming)

### 2. Easing Selection

- **UI interactions**: Use `smooth` or `spring`
- **Bouncing objects**: Use `bounce`
- **Attention-grabbing**: Use `elastic`
- **Constant motion**: Use `linear`

### 3. Element Positioning

**Good**: Absolute positioning with clear values
```flow
element box {
  x: 100
  y: 200
  width: 50
  height: 50
}
```

**Remember**: FlowLang uses absolute positioning (not flex/grid)

### 4. Color Animations

```flow
flow colorCycle on shape {
  @0s -> color: #ff0000
  @1s -> color: #00ff00
  @2s -> color: #0000ff
  @3s -> color: #ff0000  // Back to start for loop
  ease: smooth
  repeat: infinite
}
```

### 5. Infinite Loops with Yoyo

```flow
flow pulse on element {
  @0s -> scale: 1
  @1s -> scale: 1.2
  ease: smooth
  repeat: infinite
  yoyo: true  // Reverses direction each iteration
}
```

## Common Patterns

### Fade In on Load

```flow
element content {
  opacity: 0
  // other properties...
}

flow fadeIn on content {
  @0s -> opacity: 0
  @1s -> opacity: 1
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
```

### Pulsing Effect

```flow
flow pulse on element {
  @0s -> {
    width: 100
    height: 100
  }
  @1s -> {
    width: 120
    height: 120
  }
  ease: smooth
  repeat: infinite
  yoyo: true
}
```

### Rotating Spinner

```flow
flow spin on loader {
  @0s -> rotation: 0
  @1s -> rotation: 360
  ease: linear
  repeat: infinite
}
```

### Particle Field

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

## Styling Guidelines

### Text Elements

```flow
element heading {
  x: 400
  y: 100
  shape: text
  content: "My Title"
  fontSize: 48
  color: #ffffff
}
```

### Shapes

**Circle**:
```flow
element circle {
  width: 100
  height: 100
  shape: circle  // Makes it round
  color: #ff0000
}
```

**Rectangle**:
```flow
element rect {
  width: 100
  height: 50
  shape: rect  // Default, can be omitted
  color: #00ff00
}
```

## Variables for Reusability

```flow
let primaryColor = #ff00ff
let standardDuration = @1s

element box {
  color: primaryColor
}

flow fadeIn on box {
  @0s -> opacity: 0
  @standardDuration -> opacity: 1
}
```

## Limitations & Workarounds

### Current Limitations

1. **No nested flows in particles** - Define flows separately
2. **No conditional logic** - Animation is declarative only
3. **No event parameters** - Events have no context data
4. **Fixed canvas size** - No responsive queries yet

### Workarounds

**Multiple simultaneous animations**:
```flow
// Define separate flows
flow moveX on box {
  @0s -> x: 0
  @1s -> x: 400
}

flow moveY on box {
  @0s -> y: 0
  @1s -> y: 300
}

on load {
  start moveX
  start moveY  // Both run simultaneously
}
```

## Debugging Tips

1. **Start simple**: Test with basic fade-in before complex animations
2. **Check timing**: Ensure keyframe times progress forward
3. **Verify element names**: Flow targets must match element names exactly
4. **Test easing**: Different easing functions dramatically change feel
5. **Check colors**: Use correct hex format with #

## Performance Tips

1. Limit particle count (<200 for smooth 60fps)
2. Use `repeat: infinite` for looping (not high repeat numbers)
3. Prefer `opacity` and `transform` properties (GPU accelerated)
4. Avoid animating `width`/`height` when possible (causes reflow)

## Example Project Structure

```flow
// 1. Define all elements
element title { /* ... */ }
element subtitle { /* ... */ }
element box { /* ... */ }

// 2. Define particles if needed
particles background { /* ... */ }

// 3. Define all animations
flow fadeIn on title { /* ... */ }
flow slideIn on subtitle { /* ... */ }

// 4. Set up triggers
on load {
  start fadeIn
  start slideIn
  spawn background
}
```

## Getting Help

When stuck:
1. Check syntax against examples in `flowlang/examples/`
2. Verify the transpiled output is generating valid JS
3. Open generated HTML in browser DevTools to see errors
4. Simplify to minimal reproduction case
