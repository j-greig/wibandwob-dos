# Autoresearch — Runtime Inspector UI Quality

## Objective

Improve the visual quality and interactivity of the Runtime Inspector microapp
(microapps/runtime-inspector/index.ts). This is a developer dashboard for
inspecting live WibWob-DOS runtime state — windows, commands, memory, FPS, agent
status. It should feel like a proper hacker dashboard, not a text dump.

Score screenshots against a 5-axis rubric. Higher is better.
Target: beat baseline convincingly on each iteration.

## Files in Scope

ONLY `microapps/runtime-inspector/index.ts` may be modified. No other source files.

## Rubric — Five Axes (each 1-10)

### LAYOUT (L)
Information density vs breathing room. Dashboard panels balanced, no dead
zones, tabs feel purposeful not cramped.
Good: data tables aligned, stats grouped logically, responsive to window size.
Bad: wall of unformatted text, wasted columns, scrolling to find basic info.

### READABILITY (R)
Scan speed. Can you glance and know what's happening? Key-value alignment,
numeric formatting, column headers, visual hierarchy between labels and values.
Good: monospaced columns snap to grid, important values pop, clear headers.
Bad: everything same weight, no alignment, eyes hunting for info.

### STRUCTURE (S)
Does each tab feel like a designed view, not a text dump? Headers, separators,
grouping, section breaks. The difference between a dashboard and a printf log.
Good: windows tab is a proper table with clear columns, stats use visual grouping.
Bad: renderOverview is just string concatenation with manual padding.

### INTERACTIVITY (I)
Does it feel alive and usable? Live-updating values, visual feedback on refresh,
keyboard affordances visible, status indicators beyond plain text.
Good: FPS sparkline, memory usage bar, active window highlighted, refresh indicator.
Bad: static text wall that updates silently every second.

### CHARACTER (Ch)
Does it feel like a WibWob-DOS system tool, not a generic inspector? Personality
in the chrome, clever use of box-drawing or ASCII, the hacker dashboard energy.
Good: feels like you're inside the machine, purposeful aesthetic choices.
Bad: could be any JSON pretty-printer, no personality.

## Primary Metric

ui_score = (L + R + S + I + Ch) / 5

## Scoring Discipline

- Score EACH axis independently before averaging
- Read scratch/autoresearch-screenshot.txt for the rendered text output
- Also Read the source file to assess structure, SDK usage, and design intent
- Compare against previous text captures in scratch/autoresearch-shots/
- A score of 5 = competent default. Below 5 = actively bad. Above 7 = genuinely good.
- Do not inflate scores. A 10 means you cannot imagine how to improve that axis.
- Same score = discard (no neutral keeps)
- If the window failed to render or is broken, score 0 on all axes.

## SDK Components Available

From microapp-sdk.js (already imported or importable):
- createHeaderBar — styled header with left/right sections
- createStatusBar — bottom status bar with left/right
- createScrollView — scrollable content pane with vi keys
- createTabs — tabbed interface
- createTimer, clearTimers — animation lifecycle
- createStack, createGrid, createRow — layout containers
- createNodePart — wrap blessed nodes for layout
- createLogView — scrollable log with severity levels
- createKeyValuePanel — aligned key-value display
- createRule — horizontal separator
- createButtonBar — row of clickable buttons
- renderFiglet — ASCII art text headers
- pickBreakpoint — responsive breakpoints
- clamp — numeric utility
- fetchRuntimeInspection — get runtime snapshot
- fetchRuntimeCommands — get command list

## Terminal Design Principles

- Use theme tokens (host.theme()) everywhere — never hardcode colours
- Whitespace is structure — deliberate gaps between sections
- Information hierarchy via size, position, colour weight
- Box-drawing characters (─│┌┐└┘├┤┬┴┼) for structure, not decoration
- ASCII art and figlet add character cheaply
- Labels should be concise — every character earns its place
- Sparklines (▁▂▃▄▅▆▇█) and bar characters (░▒▓█) for data viz

## Constraints

- No new npm dependencies
- All SDK imports from ../../src/services/microapp-sdk.js
- Must pass bun run typecheck
- Module must load and appear in /state
- Use theme tokens — never hardcode colours

## What's Been Tried

(none yet — baseline run pending)
