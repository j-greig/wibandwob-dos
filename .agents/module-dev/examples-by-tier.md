# Module Examples by Tier

Pick the example that matches what you're building. Start at the lowest
tier that covers your needs.

## Tier 1: Static — `modules/demo-hello-world/`

A window with a responsive figlet banner. No timers, no state, no persistence.

**Shows:** registerCommand, createWindow, describeState, captureText,
onRestyle, onResize, responsive figlet via `responsiveFiglet()`.

**Start here if:** your module displays static or user-triggered content
with no animation or background updates.

**Copy from it:** the responsive figlet pattern, the onResize → rerender flow.

## Tier 2: Animated — `modules/demo-heartbeat/`

An ASCII heartbeat monitor with two timers (fast waveform + slow BPM counter).

**Shows:** createTimer/clearTimers, multiple blessed boxes, structured
describeState with semantic fields (bpm, uptime, frame, beat), proper
onCleanup that clears all timers.

**Start here if:** your module has animation, polling, or any background
update loop.

**Copy from it:** the timer set pattern, the structured describeState shape.

## Tier 3: Persistent + AI — `modules/demo-wibwob-poetry-clock/`

A poetry clock with multiple modes, voices, AI-generated poems, and
workspace persistence via registerSnapshot.

**Shows:** mode switching, external API calls (Anthropic Haiku),
registerSnapshot serialize/restore, contour animation player,
figlet rendering, multi-mode describeState.

**Start here if:** your module has state that should survive restart,
or calls external services.

**Copy from it:** the registerSnapshot pattern (see also `persistence.md`),
the mode/voice switching pattern.

## Tier 4: SDK sampler — `modules/demo-e026-demo/`

A broad feature demo exercising most SDK primitives in one window.

**Shows:** TreeWidget, tabs, timers, tween/motion, pattern generators,
button bar, render monitor, window movement helpers, panel layout.

**Start here if:** you need to see how a specific SDK primitive is used
in real code. This is a reference catalogue, not a starting template.

**Copy from it:** individual primitive usage patterns — grep for the
one you need.

## Other useful references

| Module | What it shows |
|--------|--------------|
| `modules/demo-glitchbox/` | Complex animation, multiple commands, `direct: true` for query commands |
| `modules/dashboard/` | Tabbed container (`createTabs`), multi-panel layout |
| `modules/wibwob-tr808/` | Audio + persistence, structured state |
| `modules/zine/` | Panel layout, scrollable canvas, content composition |
