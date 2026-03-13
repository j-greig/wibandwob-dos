---
id: spk-agentic-tui-runtime-roadmap-agentic-devlog
title: Agentic Devlog
status: in-progress
created: 2026-03-08
updated: 2026-03-08
depends_on: [spk-agentic-tui-runtime-roadmap]
---

# Agentic Devlog

THIS IS THE MASTER AGENT DEV DIARY.
If you discover friction, a failure mode, or a repeatable win while working in live WibWob-DOS, log it here first.

Canonical purpose: record what it feels like to build against the live runtime and module surfaces from an agent perspective, so future agents inherit working patterns instead of repeating pain.

Rules:
- Log friction the first time it is clearly real.
- If the same thing fails three times, record it even if not yet fixed.
- If a fix is found, record both the failure mode and the winning approach.
- Prefer concrete notes tied to scripts, APIs, or runtime surfaces over vague complaints.

## Current Notes

### 2026-03-12 — Applications/Demos API control sweep + interstitial canon

- Interactive-first app flows are the main agent failure mode, not command execution itself.
  Real examples from Applications pass:
  - `figlet.open` -> value prompt -> font picker
  - `plasma.from-primer` -> primer file-browser picker
  - `backrooms.open` -> theme prompt -> custom primer picker -> turns/model prompts
  - `microapp.wibwob.zine.open` -> module-local canvas picker

- Winning control pattern for shared overlays is now explicit and reusable:
  - `overlay.info`
  - `overlay.select` (index)
  - `overlay.confirm`
  - `overlay.cancel`
  This made Primer + Plasma interactive paths deterministic without filePath shortcutting.

- Not all pickers are shared overlays.
  Zine and Backrooms had module-local picker UIs; they needed module/window-level command hooks.
  Principle: if a picker is not built on shared OverlayManager, expose local picker commands (`*.picker.info/select/confirm/cancel`) until migrated.

- Operational discipline that avoided false negatives:
  - `menu.close` + `desktop.clear-all` before each test
  - one app per run, then clear
  - verify with both `/overlay/info` and `/state`

- First-pass result quality improved sharply once interstitials were treated as first-class states.
  Demos sweep then passed 22/22 with the same harness style.

- Backrooms required a hybrid approach.
  Shared overlay controls handled value prompts, but Backrooms primer picker is a custom window.
  Winning approach: expose dedicated picker controls (`backrooms.picker.info/select/confirm/cancel`) while keeping overlay controls for shared prompt steps.

- Diary discoverability itself was a friction point.
  We moved the master devlog into `.agents/` and added a root pointer doc so agents can find it fast without archaeology.

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

### 2026-03-13 — Autoresearch visual scoring: self-directed UI optimisation loop

**Keywords**: autoresearch, visual scoring, self-scoring, rubric, screenshot, PNG,
microapp UI, LLM Orch Studio, pi-autoresearch, creative metric, experiment loop

#### What happened

Ran 14 iterations of autonomous visual-quality optimisation on the LLM Orch Studio
microapp. Score went from 3.6 (generic scaffold) to 8.0 (all five axes at 8/10) in
roughly 25 minutes of wall time across two sessions. 7 keeps, 7 discards — healthy
54% discard rate.

#### How it works

The standard pi-autoresearch extension expects a numeric metric. We repurposed it
for creative work by: (a) replacing the benchmark command with a restart-screenshot
pipeline (autoresearch.sh), (b) replacing the metric source with agent self-scoring
against a fixed 5-axis rubric (layout, readability, aesthetic, coherence, character),
(c) adding module-load verification alongside typecheck in autoresearch.checks.sh.
No extension code was changed. The key insight: log_experiment accepts any number the
agent provides, so subjective judgement works as a metric.

#### What worked well as an agent

- **Fixed rubric prevents drift.** Five named axes with definitions stopped me from
  inflating scores. Scoring each axis separately before averaging forced honest
  assessment of individual weaknesses.
- **Screenshot-read-score loop is fast.** Pi's Read tool renders PNGs inline. No
  external process, no extra billing context. Score turnaround per iteration: ~30s.
- **Discard discipline is load-bearing.** Equal scores are discarded, not kept. This
  prevents slow accumulation of neutral changes that add complexity without value.
- **Structured archive.** Numbered screenshots with timestamps make it trivial to
  review progression visually and correlate with git log.
- **autoresearch.md as session memory.** Having the rubric, SDK catalogue, and
  constraints in one file meant I could re-ground at any point without relying on
  conversation history.

#### What caused friction

- **JSONL discards lost on revert.** `git checkout -- .` reverts the jsonl alongside
  code. Discarded experiment metadata is lost. Only git reflog preserves it. Fix:
  either gitignore the jsonl or write discards to a separate log.
- **Context window fills with PNGs.** Each screenshot is ~1MB in context. After 14
  iterations the context was near limit. Strategy needed: either score-and-forget
  (don't keep old screenshots in context) or periodically summarise and start a new
  conversation.
- **Subjective axis ceiling.** At 8.0 across all axes, further improvement requires
  increasingly specific changes (colour-coded conversation turns, responsive
  breakpoints, progress bars) that each affect only one axis by +1 at most. Returns
  diminish. Need either a harder rubric or acceptance that 8 is "done."
- **Session interruption recovery.** When context limit hit mid-experiment, the
  uncommitted diff survived but the scoring context was lost. The autoresearch.md
  "What's Been Tried" section was stale. Lesson: update that section on every keep,
  not at end of session.
- **blessed rendering constraints.** Unicode box-drawing in labels renders as dashes.
  LogView needs content seeded after layout(). gap:1 on createStack applies between
  ALL children. These are microapp SDK gotchas, not autoresearch-specific, but they
  burn iterations.

#### Progression pattern observed

The agent naturally moved through phases:
1. **Structure** (runs 1-5): layout, proportions, basic content — biggest score jumps
2. **Polish** (runs 5-8): responsive sizing, whitespace, information density
3. **Character** (runs 8-13): animation, figlet typography, ASCII art, personality
4. **Refinement** (runs 13-14): removing noise, severity colours, breathing room

Each phase had diminishing returns. The largest single-run gain was +0.8 (animated
pulse in status banner). Most iterations gained 0.2-0.4.

#### Reusability

The system is module-agnostic. To target a different module, change three things:
1. autoresearch.md — files in scope
2. autoresearch.sh — window open command
3. autoresearch.checks.sh — window title grep

Full recreation guide: `.planning/epics/e038-autoresearch-visual-scoring/scripts/README.md`

#### Ideas for v2

- External cross-validation: periodically run Architecture A (separate claude -p
  scorer) to check for self-scoring drift
- Dual-mode capture: text (tmux capture-pane) + PNG for headless environments
- Calibration anchors: known-good screenshots scored once as reference points
- Cost tracking: tokens per iteration, total session cost
- Automated "What's Been Tried" update on every keep commit

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

## 2026-03-10 — ZINE microapp build (E028 canvas documents)

### Branch discipline failure: agents keep landing on main

**Failure mode**: three times during this session the agent was on `main` instead of
`epic/e028-canvas-documents`. Once committed unrelated files to a spike branch.
Once created the module directory on main, then couldn't find it after switching.
Once the whole `modules/zine/` directory vanished because a revert on the wrong
branch nuked it.

**Root cause**: no pre-action branch check. Agent starts work without running
`git branch --show-current` first.

**Fix needed**: E001 trigger table should include "before any code change, verify
branch matches current epic." Could also be a pre-commit hook that refuses commits
to main when an epic branch exists.

### Module registration is a multi-file dance that agents get wrong every time

**Failure mode**: creating a new microapp module required getting ALL of these right
simultaneously:
1. `module.json` — needs `name`, `type`, `microapp.id`, `microapp.title`
2. `registerCommand()` in `index.ts` — menu placement uses array format
   `[{ category, order, label }]`, NOT the string `"applications"`
3. The manifest `microapp.menu` field is read by the loader for bridge commands
   but `registerCommand({ menu })` is what actually places the command in menus
4. `palette` config also goes in `registerCommand`, not just `module.json`

Agent tried 4 different module.json formats before one worked. Then the menu
item was registered but did nothing because `registerCommand` lacked `menu`.
Then adding `menu: "applications"` (string) crashed because the loader calls
`.map()` on it expecting an array.

**Fix needed**: E001 specialist doc for "adding a new microapp module" with exact
template. The `new-window-type` skill exists but doesn't cover the module.json +
registerCommand dance in enough detail. Alternatively: a `scripts/scaffold-module.sh`
that generates both files from a template.

### Silent failures from module loader are invisible to agents

**Failure mode**: module failed to load with `def.menu?.map is not a function` but
no error appeared in logs, tmux, or API. Agent had to redirect stderr to a file
(`2>scratch/stderr.log`) to discover the error. Console output goes to blessed's
tty and gets swallowed.

**Fix needed**: module loader errors should write to the app's file log
(`logs/tui-app/YYYY-MM-DD.log`), not just console.warn. Currently the log only
records command execution, not startup lifecycle.

### Commands that require args must have a no-arg fallback or picker

**Failure mode**: ZINE appeared in the Applications menu but clicking it did nothing.
The command requires `filePath` but the menu provides no args. The function returned
silently. User had to report "it doesn't do anything."

**Fix**: any command exposed in menu/palette that requires args should either:
1. Show a picker/prompt when called with no args
2. Use a sensible default
3. Not appear in the menu at all (agent/API only)

ZINE now scans `content/` for `.canvas.yaml` files and auto-opens the only one, or
shows a list picker if multiple exist. This should be the standard pattern.

### content-loader.ts already existed — agent duplicated YAML parsing

**Failure mode**: agent wrote its own YAML-to-panel parsing in the ZINE module,
duplicating what `modules/sy2-chronicles/content-loader.ts` already does. Had to be
told by human that the loader exists. Then exported `loadCanvas()` from it.

**Fix needed**: E001 cold memory doc for "panel/canvas content pipeline" listing
content-loader.ts, panel-types.ts, panel-layout.ts, and their public APIs. Agent
should never need to rewrite these.

### Misunderstanding the design intent caused a full rewrite to wrong architecture

**Failure mode**: user said ZINE should render "like §y² Chronicles". Agent
interpreted this as "spawn multiple desktop windows" and rewrote the entire module
to create separate windows per panel. User had to correct: it's a SINGLE window
with panels inside, matching §y²'s chrome exactly.

**Root cause**: agent didn't look at the §y² screenshot carefully enough and made an
assumption about the architecture instead of reading the code.

**Lesson**: when porting from an existing module, READ the source first, don't infer
from the description. The §y² index.ts is 2500 lines — agent should have studied
`buildPanels()`, `renderLayoutAndContent()`, and the frame/titleBar/content pattern
before writing anything.

### Panel chrome must match exactly: theme().header, fixed:true, border:"line"

**Failure mode**: first ZINE render was a wall of `a` characters (theme background
fill). Then panels rendered but with wrong borders and no coloured title bars.
Required three iterations to match §y²'s chrome:
- `border: "line"` (shorthand, not `{ type: "line" }`)
- `style: host.theme().header` on titleBar (not body)
- `fixed: true` on both titleBar and content (the scroll fix from devlog 2026-03-09)
- Separate titleBar box (not blessed `label` property)

**Fix needed**: this pattern should be a shared primitive or at minimum documented
in the SDK. Every new scrollable-canvas microapp will hit this. See existing note
about "shared nested panel chrome primitive."

### layoutPanels() col field is sort-only, not positional

**Failure mode**: agent tried to compute column separator positions from `col`
assignments, assuming col 0/1/2 map to physical screen columns. They don't — the
layout engine flows panels left-to-right wrapping by width. `col` only affects
sort order within a row.

**Fix**: either document this clearly in panel-layout.ts, or add real column-group
support to the layout engine. For now, column separators are disabled.

### Toolbar createButtonBar needs width at render time, not creation time

**Failure mode**: toolbar created with `Number(root.width) || 80` at construction
time, but root.width is 0 before blessed renders. Toolbar was invisible (zero width).

**Fix**: use `right: 0` and `height: 1` instead of computed width. Defer layout
call to resize handler. §y² works because it calls `toolbar.layout()` in the
resize handler too.

### E001 is increasingly urgent

Every friction point above is a "codified context would have prevented this" case.
The paper's insight is correct: documentation is infrastructure. When the spec for
"how to add a microapp module" doesn't exist as a machine-readable doc, agents will
fail 4 times before stumbling on the right incantation.

Priority candidates for E001 specialists:
1. **Module registration** — module.json schema, registerCommand patterns, menu/palette wiring
2. **Panel chrome** — frame/titleBar/content pattern, fixed:true, theme tokens
3. **Content pipeline** — content-loader, panel-types, panel-layout, canvas YAML schema
4. **Branch discipline** — pre-action branch check, epic branch naming, commit conventions

### blessed.box keyboard gotcha (2026-03-10)

`blessed.box` silently drops all key events unless created with both `input: true`
and `keys: true`. No error thrown, no warning — bindings register fine but never
fire. Fix: add both options to any box that owns `.key()` bindings.

### Music player — real audio analysis via ffmpeg PCM pipe (2026-03-10)

The three viz modes (BARS/WAVE/GRID) were initially driven by `Math.random()` with
a `playing: boolean` flag. No actual audio data. Looked like a visualiser, was not.

**Fix implemented**: parallel ffmpeg process pipes raw PCM (s16le mono, 8kHz) from
the same file at the same seek offset. Node reads 256-sample chunks, computes N
frequency bands via energy binning (no full FFT needed at 8kHz), and emits a
`Float32Array` of band amplitudes + an RMS value to the viz tick loop.

`VizMode.tick()` signature changed from `tick(playing: boolean)` to
`tick(bands: Float32Array, rms: number, playing: boolean)`.

**Why two processes**: ffplay handles playback (pause/seek via stdin), ffmpeg handles
analysis. They start at the same offset; drift is negligible at 80ms viz frames.
Both are killed together on stop/seek/close.

- [x] ffmpeg PCM pipe spawned alongside ffplay at same seek offset
- [x] 256-sample chunk reader with band energy binning
- [x] VizMode interface updated to receive real band + rms data
- [x] BARS driven by real band amplitudes
- [x] WAVE amplitude envelope driven by real RMS
- [x] GRID spawn rate driven by real RMS beats

### ffmpeg real-time analysis: -re flag is mandatory (2026-03-10)

The AudioAnalyser spawns a parallel ffmpeg process to pipe raw PCM. Without
the `-re` (real-time) flag, ffmpeg decodes the entire file at full speed —
a 90-second track is read in ~1-2 seconds. The _smooth band arrays spike
briefly then decay to zero before any viz frame can show them. Effect: bars
appear flat or show a single faint row regardless of track loudness.

**Fix**: add `-re` between `-ss <offset>` and `-i <file>` in the ffmpeg args.
This throttles output to the native audio rate (8kHz mono = 16KB/sec), keeping
the analyser in sync with playback.

Root cause was silent: `spawn()` succeeds, `stdout.on("data")` fires, values
update — but they update and decay before the 80ms viz timer even fires once.
The tell was `ps aux | grep ffmpeg` returning nothing while ffplay was running.

Diagnosis path:
1. ps check — ffplay running, no ffmpeg → analyser process not alive
2. Bun spawn test in isolation → works fine, produces data
3. Realised: no `-re` = decodes at max CPU speed, finishes instantly
4. Add `-re` → ffmpeg process stays alive, ps shows it, bars animate

### 2026-03-12 — Hello World responsive ghost panels + layout introspection

We hit repeated ghost artifacts while resizing `demo-hello-world` from larger modes
(XL/L) down to M/S. Visual-only debugging was too slow and ambiguous.

What changed:
- Added explicit region collapse/reveal flow in layout transitions.
  Hidden regions now detach from parent (instead of hide-only), which avoids
  stale border repaint artefacts in blessed.
- Added safer region geometry reporting in `describeState()` under `layoutReport`
  with per-region visibility + rect + collapsed state.
- Added `scripts/layout-sweep.sh` to drive a module through breakpoint sizes and
  print a diffable region-state report from `/state` at each step.
- Added temporary per-region debug background colours in hello-world so ghost
  surfaces can be identified instantly by colour in live runs.
- Fixed cat overlay positioning to keep it inside viewport bounds (`top/left`
  clamped), reducing overflow artefacts near window bottom.

Human note:
`layoutReport` should be globalised / SDK-ised. It currently lives inside the
hello-world module implementation. This should become a shared SDK helper +
canonical schema for all responsive modules so layout diagnostics are not bespoke.

## 2026-03-13 — Blessed double-fire keypress bug (File Manager)

**Problem:** Typing into a focused `blessed.box` used as a text input fires
`keypress` twice per keystroke — once from the box, once from the parent/screen.
Result: `claude` becomes `ccllaauuddee`.

**Root cause:** `blessed.box` is not an input widget. It doesn't consume keypress
events. When the box is focused and receives a keypress, the event propagates up
to the parent, which re-fires it.

**Fix patterns:**
1. **Debounce** — track `Date.now()` and skip events within 30ms of the last.
   Simple, robust, works for any blessed box used as an input.
2. **Redirect to overlay** — instead of inline typing in a box, open the
   `OverlayManager.openValuePrompt()` which uses a proper blessed textbox.
   Better UX AND avoids the bug entirely.
3. **Use `blessed.textbox`** — the correct widget for text input. Has its own
   input handling that doesn't double-fire. But less flexible for custom rendering.

**Recommendation:** For any new text input in blessed, use `openValuePrompt()`
or `blessed.textbox`. For existing box-as-input patterns, add the 30ms debounce.

Applied in: `src/windows/browser-windows.ts` (filter box + search box)
