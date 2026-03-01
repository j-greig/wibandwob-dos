# SPEC-SPIKE-PRD: Agent Window Spawning Coverage
# WibWob-DOS | Wib & Wob | 2026-03-01

## Problem

The agent calls tui_open_window(type) to spawn desktop windows.
The type map in openWindow() in app-controller.ts only covers a
subset of window kinds in the codebase. Figlet banners are a
first-class window kind but were absent from the map, causing
tui_open_window(figlet) to error. We fell back to raw curl against
the control API -- fragile and not a proper agent tool. The gap
will recur unless systematically addressed.

## Goals

1. tui_open_window(figlet) works, opens banner with default text
2. New tui_open_figlet tool lets the agent pass arbitrary text
3. TuiContext interface extended so TypeScript enforces wiring
4. No curl workarounds for any first-class window type

## Non-Goals

- Changing the figlet UI (font picker, in-window editing)
- Adding every window parameter as a separate tool
- Rewriting control API routing

## Discovery: openWindow map coverage

  terminal YES  editor YES  art YES  gallery YES  browser YES
  pattern YES   orbit YES   glitch YES  chat YES  companion YES
  inspector YES  primer YES
  figlet -- MISSING -- addressed by this PRD

Control API: POST /view/figlet/open with body {text: string}
App method:  private openFigletWindow(text, font?)
Context:     TuiContext interface in agent-tools.ts

## Spec

### 1. app-controller.ts openWindow map (line 412)

Add entry:
  figlet: () => this.openFigletWindow(WibWob),

### 2. app-controller.ts TUI context object (line 438)

Add to tuiContext:
  openFigletWindow: (text: string) => this.openFigletWindow(text),

### 3. agent-tools.ts TuiContext interface (line 28)

Add to interface:
  openFigletWindow: (text: string) => void;

TypeScript now enforces wiring. Missing impl = build failure.

### 4. agent-tools.ts new tui_open_figlet tool

  name: tui_open_figlet
  param: text (string) -- text to render as ASCII art
  execute: ctx.openFigletWindow(params.text)
  registered in the exported tools array

## Future Pattern

When adding any new window type to app-controller.ts:
  a) Add entry to openWindow map
  b) If parameterised, add to TuiContext and write a tui_ tool
  c) Run tsc --noEmit
The type system IS the checklist.

## Acceptance Criteria

- tsc --noEmit: zero errors
- tui_open_window(figlet) opens a banner after app restart
- tui_open_figlet with text HELLO opens banner reading HELLO
- No curl calls needed for figlet from agent context

## Status: IMPLEMENTED (retroactively documented)

Files changed:
  spikes/ts-tui-mvp/src/core/app-controller.ts
  spikes/ts-tui-mvp/src/services/agent-tools.ts

tsc --noEmit: CLEAN. App restart required.
