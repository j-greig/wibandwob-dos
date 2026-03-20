# Microapp Examples by Tier

> **Note:** "Complexity Level" here refers to example complexity, not the microapp registry tier (`core`/`beta`/`internal`/`disabled`). See `AGENTS.md` for registry tiers.

Pick the example that matches what you're building. Start at the lowest
complexity level that covers your needs.

## Complexity Level 1: Static — `microapps/demo-hello-world/`

A window with a responsive figlet banner. No timers, no state, no persistence.

**Shows:** registerCommand, createWindow, describeState, captureText,
onRestyle, onResize, responsive figlet via `responsiveFiglet()`.

**Start here if:** your microapp displays static or user-triggered content
with no animation or background updates.

**Copy from it:** the responsive figlet pattern, the onResize → rerender flow.

## Complexity Level 2: Animated — `microapps/demo-wibwob-tidepool/`

A cellular automaton tide pool with species simulation, timers, and live
render loop (separate engine.ts + renderer.ts pattern).

**Shows:** createTimer/clearTimers, engine/renderer separation, structured
describeState with semantic state fields, proper onCleanup, keyboard input
wired to simulation state.

**Start here if:** your microapp has animation, polling, or any background
update loop.

**Copy from it:** the timer set pattern, the engine/renderer split, the
structured describeState shape.

## Complexity Level 3: Persistent + AI — `microapps/demo-wibwob-poetry-clock/`

A poetry clock with multiple modes, voices, AI-generated poems, and
workspace persistence via registerSnapshot.

**Shows:** mode switching, external API calls (Anthropic Haiku),
registerSnapshot serialize/restore, contour animation player,
figlet rendering, multi-mode describeState.

**Start here if:** your microapp has state that should survive restart,
or calls external services.

**Copy from it:** the registerSnapshot pattern (see also `persistence.md`),
the mode/voice switching pattern.

## Complexity Level 4: SDK sampler — `microapps/demo-e026-demo/`

A broad feature demo exercising most SDK primitives in one window.

**Shows:** TreeWidget, tabs, timers, tween/motion, pattern generators,
button bar, render monitor, window movement helpers, panel layout.

**Start here if:** you need to see how a specific SDK primitive is used
in real code. This is a reference catalogue, not a starting template.

**Copy from it:** individual primitive usage patterns — grep for the
one you need.

## Complexity Level 4b: Runtime utility — `microapps/command-lab/`

A small operator-first microapp that runs shared runtime commands and
persists its own selected command/log state through workspace restore.

**Shows:** `host.runGlobalCommand(...)`, list-driven command execution,
workspace persistence via `registerSnapshot`, compact utility UI, and
describeState fields that expose command/log semantics to the API.

**Start here if:** your microapp is more about driving host services than
inventing a big bespoke UI, or if you need a concrete example of
snapshot/restore without external APIs.

**Copy from it:** shared-command invocation, minimal snapshot payloads,
utility-first text capture.

## Complexity Level 4c: Runtime inspection — `microapps/runtime-inspector/`

A proof microapp that reads the shared runtime inspection seam and
renders it through tabs and scrollable panes.

**Shows:** `fetchRuntimeInspection()`, `fetchRuntimeCommands()`,
`createTabs`, scrollable panes, and structured `describeState` for a
host-service consumer.

**Start here if:** your microapp is a read-only or inspector-style surface
that should consume host APIs rather than own host behavior.

**Copy from it:** inspection fetch patterns, text-first debugging panes,
tabbed operator UI.

## Other useful references

| Microapp | What it shows |
|--------|--------------|
| `microapps/demo-glitchbox/` | Complex animation, multiple commands, `direct: true` for query commands |
| `microapps/demo-dashboards-v2/` | Tabbed container (`createTabs`), multi-panel layout (Overview/XXL/Creative tabs, blessed-contrib charts) |
| `microapps/wibwob-tr808/` | Audio + persistence, structured state |
| `microapps/zine/` | Panel layout, scrollable canvas, content composition |
