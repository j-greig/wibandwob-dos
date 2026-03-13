# Autoresearch — Antopolis UI Quality

## Objective

Improve the visual quality of the Antopolis microapp window (modules/terrarium/index.ts).
Score screenshots against a 5-axis rubric. Higher is better. Target: beat baseline convincingly.

## Files in Scope

ONLY `modules/terrarium/index.ts` may be modified. No other source files.

## Rubric — Five Axes (each 1-10)

### LAYOUT (L)
Use of space, balance between districts and log, no dead zones.
Good: districts fill proportionally, log has enough room for events, status bar clear.
Bad: districts cramped or huge void below log, wasted columns.

### READABILITY (R)
Text legibility, information hierarchy, scannable content.
Good: district labels clear, resource bar scannable, log entries have severity hierarchy.
Bad: dense walls of dots with no visual anchors, status bar unreadable.

### AESTHETIC (A)
Colour harmony via theme tokens, visual interest, animation quality.
Good: particles feel alive, theme-consistent borders, district backgrounds distinct.
Bad: monochrome monotony, no visual variety, jarring colour clashes.

### COHERENCE (Co)
Feels like one designed thing, not random widgets bolted together.
Good: unified chrome, consistent spacing, header/status/log feel connected.
Bad: districts look disconnected, log feels tacked on, status bar orphaned.

### CHARACTER (Ch)
Personality, charm, ant-colony-ness. Does it feel like a living ant city?
Good: whimsical building art, expressive event log, ants feel alive, WibWob-esque.
Bad: generic simulation, no personality, could be any grid of dots.

## Primary Metric

ui_score = (L + R + A + Co + Ch) / 5

## Scoring Discipline

- Score EACH axis independently before averaging
- Compare against baseline screenshot, not memory
- Same score = discard (no neutral keeps)
- Animation/particle state varies per frame — score the structure, not the moment

## SDK Components Available

From microapp-sdk.js (already imported or importable):
- createStack, createGrid, createRow — layout containers
- createNodePart — wrap blessed nodes for layout
- createHeaderBar — styled header with configurable height
- createStatusBar — bottom status with left/right sections
- createLogView — scrollable log with severity levels (info/success/warning/error)
- createKeyValuePanel — aligned key-value display
- createRule — horizontal separator
- createButtonBar — row of clickable buttons
- renderFiglet — ASCII art text headers
- createTimer, clearTimers — animation lifecycle
- pickBreakpoint — responsive breakpoints
- clamp — numeric utility

## Terminal Design Principles

- Use theme tokens (host.theme()) everywhere — never hardcode colours
- Whitespace is structure — deliberate gaps between sections
- Information hierarchy via severity, size, position
- Animation adds life but must not distract from content
- ASCII art and figlet add character cheaply
- Labels should be concise — every character earns its place

## Constraints

- No new npm dependencies
- All SDK imports from ../../src/services/microapp-sdk.js
- Must pass bun run typecheck
- Module must load and appear in /state
- Unicode box-drawing in blessed labels may render as dashes — test visually
- Seed content AFTER layout() call for blessed to have dimensions
- gap on createStack applies between ALL children

## Current Module Structure

- 4 district grid (2x2) with ASCII-rendered ants, buildings, particles
- Header bar with title
- Resource bar (food, crystals, energy, science, happiness, tech, pop)
- Status bar (time of day, speed, controls help)
- Scrollable event log with severity prefixes
- Keyboard controls: p=pause, +/-=speed, 1-5=spawn, e=explode, b=build
- 120ms tick timer for simulation + render

## What's Been Tried

- Baseline (5.4): small window, monochrome dots, tiny single-char ants, sparse log
- #2 keep (6.8): responsive sizing, figlet header, theme tokens, accent borders, Colony Log border
- #3 keep (7.0): census by caste in resource bar, day icon in status
- #4 keep (7.4): per-district border colours (yellow/green/cyan/magenta), 8 seed events
- #5 discard (7.4): subtitle row — informative but no score improvement
- #6 keep (8.2): visual overhaul — 2-char ant glyphs, 4-row buildings, distinct terrain per district, subtitle row
