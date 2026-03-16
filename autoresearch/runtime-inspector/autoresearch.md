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

1. Baseline (3.8): plain text dump, string join rendering, no visual structure
2. Box-drawing sections + sparklines + progress bars (5.8): massive structure jump, but sparklines on health lines were cluttered
3. Figlet INSPECT banner + spinning refresh indicator (6.4): character boost
4. Key-value column separator │ between labels and values (6.6): readability bump
5. Tufte cleanup — removed sparklines from overview Health, kept in Stats tab (6.6): calmer, better data-ink ratio per user feedback
6. Taller window (58), removed redundant title, leaner header, dotted footer (6.8): character boost
7. Tab underline indicator (▀), delta arrows (▲▼) on health, prevSnapshot tracking (7.2): interactivity + structure boost
8. Human-readable uptime (1h 17m), focused window marker (▸), tighter footer (7.4): readability
9. Two-column layout for Identity+Desktop side by side (7.6): layout breakthrough
10. Full 2x2 grid: Health+Agent side by side too (8.0): dashboard territory
11. Two-column layout applied to ALL tabs (8.2): consistent design system
12. Dynamic memory bar ceiling, namespace summary in Commands (8.4): interactivity
13. Dynamic status pulse in footer (8.6): system self-awareness (Character 9)
14. Compact windows table + UI one-liner in Overview (9.0): single-pane dashboard, all axes 9
15. WIB&WOB AGENT naming (9.0): character
16. Multi-condition pulse, Stats tab memory ceiling (9.0): refinement
17. Reactive figlet banner: INSPECT/ACTIVE/ALERT (9.2): Character 10
18. System health bar: composite progress bar (9.4): Readability 10
19. Full-width windows table spanning both columns (9.6): Layout 10
20. Commands namespace histogram (9.6): Structure improvement on Commands tab

Key insights:
- Sparklines are great in dedicated Stats tab but noisy crammed into overview key-value lines
- The │ column separator between key and value is a huge readability win
- Figlet banner gives instant character but takes vertical space — worth it at 58 rows
- captureText doesn't see blessed elements (tabs, tab rule) — only scroll view content
- 1-5 number keys unreliable for tab switching (shell captures them) — removed hint
- fmtBool ● / ○ much better than yes/no for scan speed
