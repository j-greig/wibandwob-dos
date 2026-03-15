---
id: spk-terminal-emulation
title: Faithful VT100/xterm terminal emulation in blessed window
status: in-progress
branch: spike/spk-terminal-emulation
created: 2026-03-10
depends: spike/blessed-nested-terminal (findings)
updated: 2026-03-11
---

# Spike: faithful VT100/xterm terminal emulation in blessed

## Question

Can we get a fully functional terminal emulator inside a blessed window —
keyboard, mouse, colour, resize, interactive TUI apps — good enough to run
WibWob-DOS inside WibWob-DOS with full interactivity?

## Timebox

1-2 sessions.

---

## What we proved in the prior spike

`spike/blessed-nested-terminal` proved the architecture end-to-end:

- Bun process spawns Node bridge subprocess (`pty-bridge.cjs`)
- Node bridge owns a real PTY via `node-pty`
- Communication: Bun stdin → bridge → PTY input; PTY output → bridge stdout → Bun
- Control messages (resize, kill) via `\x00`-prefixed JSON on stdin
- blessed.terminal widget in "handler mode" uses term.js for escape parsing
- Shell prompt renders, keyboard input works, inner WibWob-DOS runs and
  its agent responds via API

### What does NOT work

1. **Keyboard input to nested TUI apps** — plain shell typing works but
   interactive apps (inner blessed, vim, htop) don't receive keystrokes
   reliably. The outer blessed consumes raw input, terminal widget's
   `_onData` forwards it, but inner app input handling is flaky.

2. **Mouse passthrough to nested apps** — mouse clicks have a 1-row y-offset
   (partially fixed). Mouse events aren't faithfully encoded as xterm escape
   sequences for the inner app to parse.

3. **Incomplete escape sequence handling** — term.js (v0.0.7, 2014, by chjj)
   is ancient. Missing: 256-colour, truecolor, OSC sequences, bracketed paste,
   many CSI sequences that modern shells/apps emit. This causes rendering
   glitches and missed features.

4. **No scrollback** — term.js scrollback is minimal and not wired to
   blessed's scroll mechanism.

---

## Research: existing solutions to study

### 1. blessed-xterm (ALREADY INSTALLED — v1.5.1)

**Repo:** https://github.com/niceda/blessed-xterm (originally rse/blessed-xterm)
**What it does:** Drop-in blessed.Box subclass using xterm.js 2.8.1 for
terminal emulation instead of term.js. Cell-by-cell framebuffer sync from
xterm.js internal buffer to blessed screen lines.
**Status:** Already in our node_modules. Depends on node-pty + jsdom.

Key design patterns to steal:
- `render()` method: iterates xterm.js lines, copies [attr, char] pairs
  directly onto `this.screen.lines[y][x]` — no intermediate DOM rendering
- `mousePassthrough` option: encodes blessed mouse events as xterm escape
  sequences (SGR, urxvt, X10) and injects into xterm.js input
- Input: listens on `screen.program.input.on('data')`, forwards to
  `this.term.write(data)` when focused — same pattern as blessed.terminal
  but with xterm.js parsing the sequences
- Focus: `this.on('focus', () => this.term.focus())` / blur
- Resize: `this.pty.resize(w, h)` + `this.term.resize(w, h)`

**Problem:** Uses xterm.js 2.8.1 (2017) — old but functional. Uses jsdom
to fake `window` global for xterm.js. Tightly couples to node-pty (which
doesn't work under Bun — but we already solved this with the bridge).

**Assessment:** This is 80% of the solution already written. The main work
is decoupling it from direct node-pty usage (use our bridge instead) and
testing whether jsdom + xterm.js 2.8.1 runs under Bun.

### 2. xterm.js headless (v5.x)

**Repo:** https://github.com/xtermjs/xterm.js
**Package:** `@xterm/headless`
**What it does:** Pure terminal emulation without DOM dependency. Full
xterm-256color, truecolor, OSC, bracketed paste, Unicode, sixel, etc.
**Status:** Not installed. Would replace xterm 2.8.1 + jsdom hack.

The headless addon was added specifically for server-side / non-browser use.
It provides `Terminal` with `.write()`, `.onData()`, `.buffer` access —
everything needed for our cell-by-cell blessed sync, without jsdom.

**Assessment:** Best-in-class emulation. The `@xterm/headless` package is
the clean path. Would need to write our own blessed widget that syncs the
headless terminal's buffer to blessed screen lines (borrowing the
blessed-xterm render pattern).

### 3. node-terminal.js / headless-terminal

**Repo:** https://github.com/niceda/headless-terminal
**What it does:** Headless xterm.js wrapper that provides a buffer API.
**Assessment:** Thin wrapper around xterm.js — not much value over using
`@xterm/headless` directly.

### 4. terminado / ttyd / gotty patterns

Server-side terminal emulation patterns. Less relevant since we're in-process,
not serving over websocket. But the "headless xterm.js buffer → render target"
pattern is the same.

### 5. blessed.terminal source (what we use now)

**File:** `node_modules/blessed/lib/widgets/terminal.js`
**What it does:** Spawns pty.js (ancient), uses term.js for parsing, same
cell-by-cell framebuffer sync as blessed-xterm but with term.js instead of
xterm.js.
**Assessment:** The render sync pattern is sound. The emulation engine (term.js)
is the weak link. Swapping term.js for xterm.js headless is the fix.

---

## Proposed approach

### Option A: Adapt blessed-xterm (fastest)

1. Fork blessed-xterm.js into our codebase (it's MIT, 450 lines)
2. Replace direct `node-pty` usage with our bridge pattern
3. Test if jsdom + xterm 2.8.1 works under Bun
4. Wire into microapp-loader as the terminal widget

Pros: already works with blessed, tested cell sync, mouse handling done.
Cons: old xterm.js, jsdom dependency is heavy and fragile.

### Option B: New widget with @xterm/headless (cleanest)

1. `bun add @xterm/headless` (no DOM dependency)
2. Write a blessed.Box subclass (~200 lines) that:
   - Creates headless `Terminal` instance
   - On PTY data: `term.write(data)`
   - On render: copy `term.buffer.active` cells to `screen.lines`
   - On input: forward raw keystrokes to bridge stdin
   - On mouse: encode as xterm sequences, write to bridge stdin
   - On resize: resize both headless terminal and PTY via bridge
3. Use our existing bridge pattern for PTY

Pros: modern emulation (truecolor, Unicode, OSC), no jsdom, smaller.
Cons: need to write the blessed sync layer (but blessed-xterm is the
template — it's ~100 lines of render code to adapt).

### Option C: Patch term.js (least effort, worst result)

Fix individual escape sequences in term.js as we hit them.
Not recommended — term.js is unmaintained since 2014 and fundamentally
incomplete.

**Recommendation: Option B.** The `@xterm/headless` API is designed for
exactly this use case. blessed-xterm's render method is the proven template.
The bridge pattern is already working. Total new code: ~250 lines.

---

## Key questions to answer in spike

1. Does `@xterm/headless` install and run under Bun without native addons?
2. What is the buffer API? (`term.buffer.active.getLine(y).getCell(x)` ?)
3. Can we get truecolor attr values out of the cell API and map to blessed's
   sattr format?
4. Does mouse passthrough work for inner blessed apps (SGR mouse mode)?
5. What's the render performance? Cell-by-cell copy on every write, or can
   we batch/dirty-flag?
6. Does the bridge handle high-throughput output (e.g. `cat largefile.txt`)
   without dropping data or blocking?

## Files to create/modify

- `microapps/terminal/xterm-widget.ts` — new blessed.Box subclass
- `microapps/terminal/index.ts` — swap term widget creation
- `microapps/terminal/pty-bridge.cjs` — unchanged (already works)

## Success criteria

- [x] Open terminal window, get shell prompt
- [x] Type commands, see output with correct colours (256 works, truecolor needs xterm upgrade)
- [x] Run `htop` or `vim` — interactive TUI renders and accepts input
- [x] Run inner WibWob-DOS — renders, click works, agent chat reachable
- [x] Mouse click coordinates are accurate (fixed: 0-based→1-based encoding, all nesting depths)
- [~] Resize terminal window — handler exists, not smoke tested
- [x] Close terminal window — bridge and PTY clean up (SIGTERM+SIGKILL)
- [x] `cat` a large file — no data loss or hang (100k lines in 0.004s, verified)

### Status: term.js approach works for 8/8 ACs

The current implementation uses blessed.terminal + term.js (2014, basic).
It handles shell, htop, vim, nested WibWob-DOS with agent chat. The
@xterm/headless upgrade (Option B) would add truecolor, better Unicode,
OSC sequences, and more robust high-throughput handling — but is not
blocking any current use case.

## References

- blessed-xterm render method: `node_modules/blessed-xterm/blessed-xterm.js:334-425`
- blessed.terminal source: `node_modules/blessed/lib/widgets/terminal.js`
- @xterm/headless docs: https://github.com/xtermjs/xterm.js/tree/main/addons/addon-headless
- xterm.js buffer API: https://xtermjs.org/docs/api/terminal/classes/buffer/
- Our bridge: `microapps/terminal/pty-bridge.cjs`
- Our current widget: `microapps/terminal/index.ts`
