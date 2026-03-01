# Framework Direction And Today Plan

Status: draft
Scope: terminal-native TS spike

## Purpose

Capture the current framework direction so we do not keep reopening the same
question loosely while the spike grows more complex.

This document answers:

- what the shell should stay on for now
- where `terminal-kit` fits
- how to use `Terminal.Gui` correctly as a design teacher
- what order we should work in today

## Current recommendation

Do **not** try to pick one grand framework for the whole rebuild today.

Use a split strategy:

1. keep the current `blessed` spike as the desktop shell
2. stabilize the window manager and native agent window on that shell
3. run a contained `terminal-kit` `ScreenBuffer` spike for animation/compositing
4. use `Terminal.Gui` as an architecture teacher only

That gives us one working shell, one controlled subsystem experiment, and one
strong design reference without forcing a renderer rewrite.

## Why this is the right split

The shell already exists and has the right broad shape:

- menu bar
- status line
- floating windows
- state API
- control API
- workspace model

The main blocker is not "wrong framework." It is "window-manager behavior is
still not reliable enough."

So the highest-value work is to make the shell trustworthy first.

At the same time, there is one area where an external library looks genuinely
stronger than the current ad hoc approach:

- animation/compositing of ASCII frames, figlet, subtitles, and overlays

That is exactly where `terminal-kit`'s `ScreenBuffer` looks worth a targeted
spike.

## Runtime direction

### Keep `blessed` as the shell for now

Why:

- it already owns the current spike
- it already integrates with our menus, state, control API, and windows
- replacing it now would multiply risk before the window-manager substrate is
  even stable

What this means:

- repair the `WindowManager`
- keep using native blessed windows for chat, viewers, editors, and shell UI
- do not replatform the desktop yet

Relevant local docs:

- [/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/docs/015-window-manager-reference-and-repair-plan.md](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/docs/015-window-manager-reference-and-repair-plan.md)
- [/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/docs/overview.md](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/docs/overview.md)

### Use `terminal-kit` as a contained subsystem experiment

Primary use:

- animation/compositing research
- `ScreenBuffer` proof of value

Why:

- it has the one feature family the shell currently lacks: a serious buffer
  composition model for ASCII motion and overlays

Relevant doc:

- [/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/docs/016-terminal-kit-screenbuffer-animation-spike.md](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/docs/016-terminal-kit-screenbuffer-animation-spike.md)

### Use `Terminal.Gui` as a design teacher

Role:

- architecture reference
- interaction model reference
- layout/focus/bounds reference

Useful ideas to borrow:

- clear view hierarchy
- authoritative bounds ownership
- content-vs-chrome separation
- predictable focus and z-order semantics
- resize behavior as a real contract

Important:

- this is a design reference, not a runtime path for this Bun/TS spike

## What to avoid right now

- do not write a whole new terminal framework from scratch
- do not pivot the spike to a new renderer before the current shell is stable
- do not deepen feature count while the window manager is still destroying
  windows on drag-release
- do not let terminal emulation work distract from shell correctness

## Where the native agent window fits

The new native agent work is the right direction.

Local files:

- [/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/src/services/wibwob-agent-session.ts](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/src/services/wibwob-agent-session.ts)
- [/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/src/windows/wibwob-agent-window.ts](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/src/windows/wibwob-agent-window.ts)
- [/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/docs/spk-agent-window-enhancement.md](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/docs/spk-agent-window-enhancement.md)

Why it matters:

- it confirms the right embedded-agent path is `pi-agent-core` plus our own
  native window
- it reduces dependence on nested PTY/terminal UI hacks
- it aligns with the existing state/control architecture of the spike

But:

- it should not outrun the window-manager repair work
- agent windows still depend on reliable move/focus/resize/restore behavior

## Today plan

### Tier 1 — Stabilize the shell

Primary doc:

- [/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/docs/015-window-manager-reference-and-repair-plan.md](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/docs/015-window-manager-reference-and-repair-plan.md)

Goal:

- make the desktop shell trustworthy

Tasks:

- fix drag-release disappearance bug
- make z-order deterministic on click/drag/resize/API focus
- keep tile/cascade origins correct
- add temporary window-manager trace logging if the bug persists
- verify via state/capture loop

Why first:

- if windows vanish during drag, every other feature sits on sand

### Tier 2 — Stabilize the native agent window

Primary doc:

- [/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/docs/spk-agent-window-enhancement.md](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/docs/spk-agent-window-enhancement.md)

Goal:

- make the embedded agent window a clean native surface

Tasks:

- keep `pi-agent-core` as the engine
- keep the window rendering native
- finish tool/context wiring only after shell stability
- expose status/history/control via the existing API surfaces

Why second:

- the agent window is strategically important
- but it depends on shell correctness more than shell correctness depends on it

### Tier 3 — Run the `ScreenBuffer` animation spike

Primary doc:

- [/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/docs/016-terminal-kit-screenbuffer-animation-spike.md](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/docs/016-terminal-kit-screenbuffer-animation-spike.md)

Goal:

- learn whether `terminal-kit` should power a dedicated animation/compositing
  subsystem

Tasks:

- standalone primer frame playback
- figlet overlay
- subtitle timeline
- measure redraw quality and runtime fit

Why third:

- useful and promising
- but optional today compared with shell reliability

## Decision summary

For now:

- shell = current `blessed` spike
- agent surface = native `pi-agent-core` window
- animation/compositing experiment = isolated `terminal-kit` spike
- architecture teacher = `Terminal.Gui`

This keeps the codebase moving forward without pretending we already know the
final renderer answer.
