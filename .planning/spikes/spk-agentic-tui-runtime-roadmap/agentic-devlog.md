---
id: spk-agentic-tui-runtime-roadmap-agentic-devlog
title: Agentic Devlog
status: in-progress
created: 2026-03-08
updated: 2026-03-08
depends_on: [spk-agentic-tui-runtime-roadmap]
---

# Agentic Devlog

Canonical place to record what it feels like to build against the live WibWob-DOS runtime as an agent.

Rules:
- Log friction the first time it is clearly real.
- If the same thing fails three times, record it even if not yet fixed.
- If a fix is found, record both the failure mode and the winning approach.
- Prefer concrete notes tied to scripts, APIs, or runtime surfaces over vague complaints.

## Current Notes

### 2026-03-08 — Patchbay, reload, TouchLab MVP

- `tmux` plus `./scripts/screenshot-window.sh` is the most useful visual verification loop right now.
  Why:
  - screenshot crops are much easier to read than full-pane captures
  - `tmux send-keys` is the only reliable way to prove real keyboard behavior end to end
  Keep:
  - `tmux attach -t wibwob`
  - `tmux send-keys -t wibwob:0 ...`
  - `./scripts/screenshot-window.sh "Window Title"`

- `/state` is essential and high-value.
  Why:
  - it gives a semantic proof path separate from visual proof
  - it made it easy to see selected node, positions, blend mode, and color labels
  Gap:
  - for richer microapps, `/state` should expose more focused app-local state without requiring screen scraping

- `/windows/input` is useful, but it is not sufficient for proving real interactive behavior by itself.
  Why:
  - it injects logical input into a window record
  - it does not prove Blessed key focus, global key routing, or mouse behavior
  Result:
  - agent work still needs `tmux send-keys` to prove actual keyboard UX

- Missing nested mouse automation path.
  Why this matters:
  - nested draggable/resizable panes can be implemented in Blessed
  - but there is no agent-facing API to synthesize mouse down/move/up inside a parent window surface
  Consequence:
  - nested drag/resize can be built, but cannot be robustly smoke-tested by an agent
  Winning approach so far:
  - route nested drag/resize off the generic `screen.on("mouse")` stream and inspect
    `data.action`, matching the top-level window manager path
  Wishlist:
  - `POST /windows/mouse` with `id`, `action`, `x`, `y`, maybe `button`
  - or a higher-level `POST /windows/gesture/drag`

- Runtime reload proof needed text-visible changes, not just color changes.
  Failure mode:
  - color changes are hard to prove in pane captures
  Winning approach:
  - use title/body text plus `/state`
  Outcome:
  - keep color-based proof as secondary, never primary

- Loader stdout scribble was a real TUI failure mode.
  Failure mode:
  - module loader logs printed into the live terminal surface and overwrote the UI
  Fix:
  - move loader lifecycle messages onto file logging instead of stdout
  Principle:
  - any runtime/service logging that can hit the same tty as Blessed should be treated as a UI corruption risk

- Restart is required after runtime wiring changes, but not after pure module edits.
  Friction:
  - easy to forget whether a change is “runtime machinery” or “microapp source”
  Improvement idea:
  - add a script or note that classifies edits into:
    - reload-safe
    - restart-required

- TouchLab exposed a real distinction between:
  - semantic control input
  - actual focused-user input
  Fix:
  - handle screen-level keypress only when the TouchLab window is focused
  Lesson:
  - agent-proofed `/windows/input` should not be mistaken for end-user UX proof

- Multi-character input over `/windows/input` needs explicit app-level handling.
  Failure mode:
  - payloads like `3hello` were interpreted as a sequence of command tokens and text in an awkward way
  Fix:
  - select the input node with the first token, then treat the rest as text payload when appropriate
  Wishlist:
  - an explicit app-control route for structured input would be cleaner than overloading character streams

- Nested app panes should reuse desktop-window concepts, but not clone the whole outer window manager blindly.
  Current useful reuse:
  - title bar
  - border
  - focus styling
  - resize grip
  - move/resize semantics
  Missing canon:
  - a shared nested chrome primitive for microapps
  Recommendation:
  - extract a `panel chrome` / nested-window primitive later instead of hand-rolling every microapp

- Inspector/palette visibility should stay persistent by default.
  Observation:
  - a TouchDesigner-style always-visible parameter area was easier to use than a hidden flyout
  Good compromise:
  - persistent panel with a slim collapsed mode

- Animation should be explicit, local, and pausable.
  Failure mode:
  - global ticking made unrelated values change every second and made the app feel broken
  Fix:
  - restore motion only on the generative layer
  - keep text/input sources stable unless deliberately edited
  - add a pause toggle (`Space`)
  Lesson:
  - motion is important for creative feel, but it must not mutate semantic controls invisibly

## Proposed Follow-ons

- [ ] Add a `nested interaction smoke` script that can at least prove keyboard move/resize/focus for nested panes
- [ ] Add a `POST /windows/mouse` API for click/drag/release automation
- [ ] Add a `reload-safe vs restart-required` helper or docs note for agent workflows
- [ ] Add a shared nested panel/window chrome primitive so microapps stop reimplementing border/title/grip/focus
- [ ] Add structured app-control endpoints or conventions for richer inputs than raw key streams

## 2026-03-09 — E025 blessed mouse/focus/key bug cluster

Three bugs in §y² Chronicles (scrollable canvas with 62 clickable panel children)
all trace back to blessed internals:

1. **Double-input**: `element.key()` registers globally on `program`, not per-element.
   Having `canvas.key + root.key + win.onInput` = 2-3x fire per keystroke.
2. **Wrong edit target**: `fixed:true` children desync blessed's `lpos` hit-testing
   from visual scroll position. Blessed routes clicks to wrong panel.
3. **Scroll jump on refocus**: `screen._focus` auto-scrolls to child `rtop` on any
   click (via `element click` → `el.focus()`). Our `_scrollIntoView` override
   patched the wrong method — blessed uses a different path.

**Fix pattern**: remove `clickable:true` from all panel children, handle ALL mouse
interaction at screen level via existing `handleDragMouse` + `pointerToContent`.
This kills blessed autofocus entirely for panels. Keep `fixed:true` for rendering
(still needed to prevent double childBase subtraction in `_getCoords`).

**Lesson**: blessed's focus/click model assumes elements are either scrollable OR
clickable, not both nested. Any microapp with clickable children inside a scrollable
canvas will hit this. Should be a shared primitive or at minimum a documented pattern
in the microapp SDK.

## AC-15 parked: microapp SDK boundary audit

Modules should import from `src/services/microapp-sdk.ts` only, not reach
into `src/core/` or `src/services/` directly. Currently `modules/sy2-chronicles/index.ts`
has 9 direct imports past the SDK:

```
src/services/contour-engine.js    — renderContour
src/services/figlet-service.js    — renderFiglet
src/services/monster-cam-service.js — MonsterCamService, MonsterCamFrame
src/services/webcam-renderer.js   — renderWebcamFrame, gridToBlessedContent
src/core/panel-layout.js          — layoutPanels, measureViewport, pointerToContent, hitPanel, PanelNode, etc
src/core/grid-canvas.js           — blankGrid, paintText, gridToText, paintLines, bar, waveLine
src/core/ui-primitives.js         — createTimer, clearTimers
src/core/ui-parts.js              — createButtonBar
```

Fix: re-export these from `src/services/microapp-sdk.ts`. The SDK already
re-exports some primitives; these are gaps. See also:
`.planning/refactor-docs/030-microapp-sdk-audit-2026-03.md`

Scope: separate from E025. Could be a standalone chore or folded into a
future SDK hardening epic.

## 2026-03-09 — planning:sync should be automatic

Human had to remind agent to run `bun run planning:sync` after closing E025.
This should never require a prompt.

**Friction**: agents forget. EPIC_STATUS.md drifts from frontmatter truth.

**Fix options (ranked)**:
1. Git pre-commit hook: if any `.planning/epics/*/e*-brief.md` is staged,
   run `bun run planning:sync` and auto-stage `EPIC_STATUS.md`. Add to
   `.claude/hooks/pre-commit-main-guard.sh`. Low risk, catches all paths.
2. Make `planning:sync` idempotent and run it in CI on every push to main.
3. Add a `postcommit` lint that warns if EPIC_STATUS.md is stale.

**Recommendation**: option 1. The hook already exists and runs on every commit.
File: `.claude/hooks/pre-commit-main-guard.sh`

## 2026-03-09 (evening) — scroll rendering diagnosis, inspect tooling, worktree ops

### blessed fixed:true is the canonical scroll fix

Root cause confirmed for empty panels below initial viewport in scrollable canvas:
blessed `_getCoords()` walks up to find the scrollable ancestor and subtracts
`childBase` (scroll offset). For frame (direct child of canvas) this is correct.
For content (grandchild — child of frame, which is child of canvas), it subtracts
`childBase` AGAIN via `frame.lpos.yi` which already had it subtracted. Double
subtraction → yi goes negative → `_getCoords` returns undefined → content never
drawn. Borders render (frame is direct child, single subtraction) but content is
blank.

**Fix**: `fixed: true` on all grandchildren (titleBar, content, editor, resize grip).
`fixed: true` makes `_getCoords` skip past one scrollable ancestor, avoiding the
double subtraction.

**This should be in the microapp SDK docs as a mandatory pattern** for any microapp
that puts child elements inside child elements of a scrollable box:
```
frame (parent: scrollable canvas)  → no fixed needed
  titleBar (parent: frame)         → fixed: true
  content (parent: frame)          → fixed: true
```

### Agent can't verify scroll rendering without programmatic panel inspection

**Friction**: tmux `capture-pane` only returns the physical viewport. Panels below
the scroll position are invisible to the agent. Screenshots via `macOS screencapture`
work for the human but are opaque to the agent. Result: agent committed a "fix"
(renderLayoutAndContent on scroll) without verifying it actually worked, and it
didn't — the real fix was `fixed: true`.

**Fix delivered**: `sy2.panel.inspect` command. Returns `contentLines`,
`nonEmptyLines`, `lpos` coords, `fixed` flag, first/last line per panel. Verified
62/62 panels have content. All panel control commands also got `direct: true` —
without it, `focusOrCreate` wrapper swallows the return value.

**Skill/script need**: a generic "inspect microapp subwindow content" pattern.
Currently bespoke per module (`sy2.panel.inspect`). Should be a convention:
any microapp with sub-panels registers a `.inspect` command returning content
metadata. Or better: `describeState()` should include content summaries for
all child elements, not just IDs and positions.

**Proposed follow-on**: extend `describeState()` contract to include optional
`contentPreview` per child element. This would eliminate the need for per-module
inspect commands.

### focusOrCreate swallows return values from direct-query commands

**Friction**: `host.registerCommand()` wraps action in `focusOrCreate()` by default.
This is correct for "open the app" commands but wrong for query/control commands
on already-open windows. Without `direct: true`, the action fires inside
focusOrCreate's callback and the return value is discarded — API caller gets
`{ok: true}` with no data.

**Fix**: all query/control commands must use `direct: true`. This is not documented
anywhere. Should be in `.agents/microapp-sdk.md`.

### Worktree management is manual and fragile

**Friction**: worktree at `wibwobdos-e027` needed to be moved to `wibwob-glitchbox`
per studio handover. Local branch was 40+ commits behind `origin/epic/e027-glitchbox-tui`.
Required `git worktree move` + `git reset --hard origin/...` + `bun install` + tmux
session setup. All manual, no script.

**Wishlist**: `scripts/setup-worktree.sh <epic-branch> <dir-name> [port]` that:
1. Creates or moves worktree to target dir
2. Resets to origin HEAD
3. Runs bun install
4. Starts tmux session on specified port
5. Waits for /health
