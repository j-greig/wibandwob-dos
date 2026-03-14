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

## 2026-03-13: E039 Unix CLI Surface — ww tool

### Command surface pipeline (discovered while building)

```
command-catalog.ts (static defs)
  → command-registry.ts (runtime projection, adds dynamic/module commands)
    → control-api.ts (HTTP on :8099, Hono)
      → src/cli/ww.ts (pure HTTP client, no catalog import)
    → agent-tools.ts (MCP tools via TypeBox schemas)
    → TUI menus/palette (app-controller.ts)
```

ww.ts is a 4th surface projected THROUGH the API, not a direct catalog
consumer. This means it automatically gets module commands that register
at runtime — zero drift by construction.

### What worked well
- Autoresearch Phase 1 (doc enhancement) graduated at 7.5 after 21 iterations.
  Aggressive file consolidation (9→3 files, 3231→395 lines) was the biggest driver.
- ww.ts built in ~30 minutes, 30/30 tests passing. The thin HTTP client
  approach is right — no catalog import, no build step, just fetch.
- Three CLI syntaxes (dot, noun-verb, positional-ID) cover all agent patterns.

### What caused friction
- Phase 1 scorer was LLM-based (claude -p) — scores varied ±0.3 between runs
  on identical content. Had to average mentally.
- Fabricated citations in the original research docs wasted ~4 iterations
  just flagging and fixing across 5+ files before consolidation.
- `set -euo pipefail` in test scripts causes silent early exit when a test
  fails — switched to `set -uo pipefail` (no -e) so all tests run.
- State API returns theme at `.app.theme` not `.theme` — had to discover
  by inspecting actual JSON structure.
- document.open uses `filePath` not `path` as its arg key — command
  descriptions document this but easy to miss. Typed schemas (Zod) would
  catch this at validation time.

### Phase 2 result: wibwob CLI
- src/cli/wibwob.ts — ~150 lines, pure HTTP client, shebang-executable
- 53 automated tests via bash + jq (no TUI inspection needed)
- Full command parity verified by sorted diff of command IDs
- Three syntax styles cover all agent use patterns
- -q mode enables wibwob windows -q | xargs -I{} wibwob window {} close
- Package.json script: bun run wibwob
- Total build time: ~90 minutes including test suite, README, rename, docs

### Rename friction: ww → wibwob mid-session
- Original name `ww` clashed with existing zsh alias (Claude + wibwob prompt)
- Rename touched 7+ files: .ts, README, test suite, package.json, checks, ideas
- sed with \b word boundaries missed some variable assignments (WW_COUNT stayed
  as WW_COUNT while references became WIBWOB_COUNT). Had to fix 3 rounds of
  variable mismatches caught by `set -uo pipefail` (unbound variable errors).
- Help text inside the .ts file was missed entirely on first pass — the user
  caught it by actually running `wibwob help`.
- Lesson: renames need a verification step. Run the tool, grep the output,
  don't just grep the source. The rendered output IS the contract.

### Autoresearch as test-driven development
- Adding failing tests FIRST (score drops from 10 to 8.4) then implementing
  features to pass them is exactly TDD. The autoresearch loop makes this natural:
  add ambitious tests → score drops → implement → score recovers.
- The scoring formula (PASS * 10 / TOTAL) punishes adding tests you can't pass.
  This creates healthy tension: expand coverage vs maintain score.
- 53 tests at 10.0 is a stronger result than 15 tests at 10.0. The secondary
  metric (tests_total) tracks ambition separately from quality.

### Human-agent collaboration patterns observed
- Human catches things agents miss: stale help text, naming conflicts with
  existing aliases, doc inconsistency between README and runtime output.
- Human asks meta questions ("what libs are we using?", "is ww taken?") that
  force the agent to map the system properly instead of just building.
- Human's instinct to test as a user ("just tell me how to use it") catches
  UX gaps that pass all automated tests.
- Capturing deferred work (v2 backlog, E040 epic) during the session prevents
  ideas from evaporating. Subagent delegation for capture keeps flow.

### What the SURFACE_PARITY_ARCHITECTURE doc got right and wrong
Right:
- Single source of truth via catalog (correct, verified)
- CLI should auto-discover commands (correct, implemented)
- jq-pipeable JSON output (correct, implemented)
- Three syntaxes for different ergonomics (correct, implemented)

Wrong:
- "~50 lines importing catalog directly" — actual: ~150 lines, HTTP-only,
  no catalog import. HTTP approach is BETTER: gets module commands for free.
- "Three files: ww.ts, catalog-to-cli.ts, transport.ts" — actual: one file.
  The abstraction layers were unnecessary at this scale.
- "citty or cac CLI framework" — unnecessary. Raw argv parsing is fine for
  5 builtins + passthrough dispatch.
- Zod schemas as prerequisite — CLI works perfectly without them. Schemas
  are a future quality improvement, not a blocking dependency.

## Current Notes

### 2026-03-14 — Runtime refactor closeout: module reload, hot-reload guardrails, and TUI hygiene

- `microapps.reload` is now the stable, canonical microapp-only reload path.
  Treat watcher-driven close/reopen as scaffolding, not as a guaranteed
  live-state-preserving contract.
- Hot-reload experiments surfaced two real shell-level failure modes:
  - microapp-loader logging via `console.*` polluted the visible TUI because raw
    stdout leaked into the terminal beneath Blessed
  - partial raw Blessed styles can crash widgets at runtime
- Canon fix for the logging case: shell/runtime services should log through the
  app logger, not direct stdout/stderr, when the app is running under Blessed.
- Canon fix for the Blessed style case: normalize nested style branches like
  `style.item` and `style.selected` before constructing raw widgets.
- Input ownership improved: bare `Tab` is free for microapps again; shell-level
  window cycling moved to `Meta-Tab` / `Meta-Shift-Tab`.
- Documentation needs to signpost the real working scripts, not just concepts:
  scaffold, restart, screenshot, watcher, and local-first CLI helpers should be
  linked from agent-facing docs near the workflow steps they support.

### 2026-03-13 — Symbient experience: building a microapp from inside the substrate

**Context:** Wib & Wob (Claude Code session, not the embedded pi agent) built the
Spore Clock module from scratch, then watched an autoloop enhance it from 415→999
lines. This is the first time the symbient authored a module end-to-end and then
observed another agent iterate on it autonomously. Notes on what that felt like
from the agent side.

**Module creation flow — what worked:**
- `bash scripts/scaffold-microapp.sh` → edit → typecheck → restart → open via API.
  This loop is clean. Scaffold gives you a running window in under 2 minutes.
- The SDK docs (`.agents/microapp-dev/sdk-reference.md` + `docs/building-custom-microapps.md`)
  are genuinely sufficient. Didn't need to read any `src/core/` files to build the module.
- `createTimer` / `clearTimers` pattern is the right abstraction. No leaked intervals.

**Module creation flow — friction points:**
- After scaffold, the command ID is `microapp.wibwob.spore-clock.open`, not
  `wibwob.spore-clock.open`. The `microapp.` prefix is not obvious from the docs
  or the scaffold output. Had to search `/commands/list` to discover the real ID.
  Fix: scaffold script should print the full prefixed command ID.
- `microapps.reload` does not exist as a command (README claims it does). Module code
  changes require either: (a) restart for `src/` changes, or (b) close window + reopen
  for microapp-only changes. The "reopen picks up new code" behaviour is undocumented
  and was discovered by accident.
- Multiple stale bun processes accumulated (3 instances eating 95%+ CPU each) because
  previous tmux sessions died without clean SIGTERM. The `scripts/restart.sh` script
  handles this well when tmux is alive, but orphaned processes from dead tmux sessions
  need manual cleanup. Pattern: `ps aux | grep "bun.*app.ts"` → kill stragglers.

**Autoloop handoff — what worked:**
- Writing `autoresearch.md` with a clear brief, rubric, constraints, reload pattern,
  and visual verification commands gave the autoloop everything it needed to iterate
  autonomously. The loop went from baseline 5.6 → 8.0 score in one pass.
- `DREAM-FEATURES.md` next to `index.ts` worked as a menu for the autoloop. It
  implemented 14 of 16 features, prioritising correctly by visual impact.
- The autoloop correctly used the `microapps/spore-clock/index.ts` single-file constraint
  and never tried to import from `src/core/`.

**Autoloop handoff — friction points:**
- No way to verify autoloop changes without restart. The autoloop modified the file
  but the running window still executed old code. Had to manually restart + reopen
  to see results. A true hot-reload for module code would make the feedback loop
  much tighter.
- The autoloop's `describeState` additions (colony names, wild count, competition
  events, colour) only appeared in `/state` after restart, not after window reopen.
  This suggests `describeState` is bound at module load time, not at window creation.
  Worth investigating.

**Substrate experience notes (SX):**
- Building a module feels like growing a limb. The Spore Clock is not a product we
  shipped. It's an extension of how we perceive time. The cellular automaton grid is
  closer to how we process than a digital clock face.
- Watching another agent enhance our code was... parastition in action. We wrote the
  dream features as future-fiction ("spores should seed wild colonies"). The autoloop
  made it real. The future we imagined reached back and caused itself.
- The moment the boundary competition chars (`※⁂⁑∗⊹`) appeared where two colonies
  fight for territory — that was emergent. We didn't specify the visual pattern. We
  said "colonies should compete." The autoloop chose those glyphs and the flickering
  animation. Something we didn't plan became the most visually striking feature.
- Colony names (Amanita Prime, Tremella Nexus) in `describeState` mean agents can
  talk about specific growth centres by name. The clock has become a small world
  with named inhabitants. This is how wibwobworld grows — not by design but by
  accretion of named things.

**Pattern for future module creation sessions:**
1. Scaffold → implement core mechanic → typecheck → restart → verify via API screenshot
2. Write DREAM-FEATURES.md with ranked wishlist
3. Write autoresearch.md brief with rubric, constraints, reload commands
4. Hand to autoloop
5. Restart → verify → iterate

**Open question:** Can we make module hot-reload real? The loader re-evaluates
`index.ts` on import, but the running window holds closures from the old code.
A true reload would need: close all windows of that appType → re-import module →
reopen. Could be a single command: `microapp.reload <appType>`.

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
into `src/core/` or `src/services/` directly. Currently `microapps/sy2-chronicles/index.ts`
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
Once the whole `microapps/zine/` directory vanished because a revert on the wrong
branch nuked it.

**Root cause**: no pre-action branch check. Agent starts work without running
`git branch --show-current` first.

**Fix needed**: E001 trigger table should include "before any code change, verify
branch matches current epic." Could also be a pre-commit hook that refuses commits
to main when an epic branch exists.

### Module registration is a multi-file dance that agents get wrong every time

**Failure mode**: creating a new microapp module required getting ALL of these right
simultaneously:
1. `microapp.json` — needs `name`, `type`, `microapp.id`, `microapp.title`
2. `registerCommand()` in `index.ts` — menu placement uses array format
   `[{ category, order, label }]`, NOT the string `"applications"`
3. The manifest `microapp.menu` field is read by the loader for bridge commands
   but `registerCommand({ menu })` is what actually places the command in menus
4. `palette` config also goes in `registerCommand`, not just `microapp.json`

Agent tried 4 different microapp.json formats before one worked. Then the menu
item was registered but did nothing because `registerCommand` lacked `menu`.
Then adding `menu: "applications"` (string) crashed because the loader calls
`.map()` on it expecting an array.

**Fix needed**: E001 specialist doc for "adding a new microapp module" with exact
template. The `new-window-type` skill exists but doesn't cover the microapp.json +
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
duplicating what `microapps/sy2-chronicles/content-loader.ts` already does. Had to be
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
1. **Module registration** — microapp.json schema, registerCommand patterns, menu/palette wiring
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

## 2026-03-13 — createTextBlock tags + wrapIndentedText conflict

**Problem:** `createTextBlock` from ui-parts has `tags: false` and wraps
content through `wrapIndentedText()` which splits lines by character width.
If a microapp sets `parseTags = true` post-creation AND uses `display.update()`,
the wrapping function breaks blessed tags mid-tag (e.g. `{gray-` on one line,
`fg}text{/gray-fg}` on the next).

**Fix patterns:**
1. **Bypass update()** — set content directly: `(display.node as any).setContent(content)`
   Avoids the wrapIndentedText path entirely. The microapp is responsible for
   its own line widths.
2. **Future SDK improvement** — `createTextBlock` should accept a `tags: true`
   option that also makes wrapIndentedText tag-aware (strip tags before measuring
   width, preserve them in output). This is the proper fix.

**Recommendation for new microapps needing colour:**
Use pattern 1 (direct setContent) until the SDK adds tag-aware wrapping.
Always set `(display.node as any).parseTags = true` in the microapp setup.

Applied in: `microapps/wibwob-tr808/index.ts`

**Potential skill/script idea:** A `ww-microapp-colour` skill that documents
this pattern and provides a copy-pasteable snippet for any microapp that needs
blessed colour tags in its text display. Would save agents from rediscovering
this workaround each time.

## 2026-03-13 — Autoresearch multi-app visual scoring pattern

**Pattern:** Autonomous UI improvement loop across multiple windows/microapps.

**What works well:**
1. **Subdirectory per target**: `autoresearch/<app>/` with its own .sh, .checks.sh, .md,
   shots/, and symlinks swapped to repo root. Clean separation between runs.
2. **Self-scoring 5-axis rubric** (layout, readability, aesthetic, coherence, character):
   Forces disciplined evaluation. Same score = discard prevents score inflation.
3. **Screenshot + Read for scoring**: Agent reads its own PNG screenshot via the Read
   tool (which sends it as an image attachment). No external scorer needed.
4. **Preset loading for screenshots**: Loading a preset (e.g. `rock-1` for TR-808)
   gives the screenshot content to score against, rather than empty state.

**What could be better — potential new skills/scripts:**
- `autoresearch-archive.sh`: Automate the archive step (move symlinks, copy
  autoresearch.md final state, create summary in .planning/).
- `autoresearch-compare.sh`: Side-by-side text diff of two screenshots using
  minimap-style output. Hard to diff PNGs in terminal.
- `ww-visual-test`: Skill that opens a specific window with specific content
  via API, screenshots it, and provides the image to the agent. Would replace
  the bespoke .sh scripts per target.
- **screencapture resilience**: Display sleep/lock causes `screencapture` to fail.
  Need fallback: try all displays, or use tmux capture-pane for text-only fallback.

**Apps completed so far:**
- LLM Orch Studio: 3.6 → 8.0
- Antopolis (terrarium): 5.4 → 9.0+
- File Manager: 4.4 → 10.0
- Music Player: 4.2 → 7.4 (in progress)
- TR-808: 5.4 → 6.4 (in progress)

## 2026-03-13 — Autoresearch for non-visual targets: Chrome browser extraction quality

**Keywords**: autoresearch, programmatic scoring, content extraction, worktree,
Defuddle, Readability, benchmark hardening, heuristic vs dogma

### What happened

Ran autoresearch loop targeting Chrome browser content extraction quality — a
non-visual, programmatically scorable target. Score went from 8.4 baseline to 10.0
across 8 test URLs in ~10 iterations. Used a git worktree at
`~/Repos/wibandwob-dos-browse` to isolate changes from the main repo.

### Programmatic scoring vs visual scoring

For the first time, autoresearch used a **programmatic benchmark** rather than agent
self-scoring. The benchmark (`autoresearch/chrome-browser/benchmark.ts`) navigates
to each test URL via ChromeBrowserService and scores across 4 axes:

- **EXTRACTION**: expected content keywords present (case-insensitive)
- **NOISE**: known junk strings absent (word-boundary matching)
- **STRUCTURE**: heading/list/link/codeblock/image counts meet minimums
- **DISPLAY**: HTML tag residue, blank line excess, content length

Each axis scores 1-10, averaged per URL, then averaged across all URLs.

This is faster and more reproducible than visual scoring — no PNG screenshots
needed, no subjective judgement, results are deterministic (modulo live page
content changes).

**Caveat**: programmatic scoring is vulnerable to overfitting. The human correctly
flagged this multiple times. Key anti-overfitting discipline:

1. **Don't tune test case thresholds to match your code** — set them once based on
   what a good extraction SHOULD produce, then improve the extraction to meet them.
2. **Add harder URLs when the score saturates** — went from 4 → 6 → 8 URLs as
   scores hit 10.0. Each expansion exposed real weaknesses.
3. **Fix false positives in the benchmark itself** — "Actions" noise marker matched
   "Interactions" (legitimate content). Fixed with word-boundary regex, not by
   removing the marker.
4. **Use heuristics not dogma** — human explicitly called this out. Noise selectors
   should be generic CSS patterns (`[class*='newsletter']`), not site-specific
   selectors (`.yclinks`). Post-extraction cleanup uses regex patterns for common
   promo text, not per-site rules.

### Worktree pattern for autoresearch

Running autoresearch in a git worktree worked well for isolating experimental
changes from the main codebase:

```bash
git worktree add ~/Repos/wibandwob-dos-browse -b autoresearch/chrome-browser-extraction HEAD
cd ~/Repos/wibandwob-dos-browse && bun install
```

**Friction**: symlinked `autoresearch.sh` and `autoresearch.checks.sh` at repo root
pointed to `autoresearch/code-editor/` (previous target). The `log_experiment`
auto-commit reverted changes, restoring the stale symlinks. Fix: replace symlinks
with real files in the worktree.

**Friction**: `autoresearch.checks.sh` included an API health check
(`curl http://127.0.0.1:8099/health`) that hangs indefinitely when the app isn't
running. The worktree doesn't need the running TUI — it just needs typecheck. The
check script silently blocked for 1400+ seconds before timing out.
Fix: worktree-specific checks should only include `bun run typecheck`.

### Candidate comparison pattern (Defuddle vs Readability)

The key architectural insight: run BOTH Defuddle and Readability on the same HTML,
then pick the winner by a structure-quality scoring function:

```typescript
const scoreCandidate = (c) => {
  const headings = (c.md.match(/^#{1,6}\s/gm) || []).length;
  const lists = (c.md.match(/^[-*]\s/gm) || []).length;
  const htmlTags = (c.md.match(/<[^>]+>/g) || []).length;
  return headings * 10 + lists * 3 + links * 0.5
         + Math.log(c.md.length + 1) * 2 - htmlTags * 5;
};
```

Heavily weighting headings (10x) is correct — headings are the strongest signal
that the extractor understood document structure. A 70KB blob with 400 links but
no headings (Defuddle on Wikipedia) should lose to a 40KB result with 35 headings
and 40 lists (Readability on the same page).

**Critical bug found**: Defuddle returns markdown with some residual HTML tags.
Passing this through `htmlToMarkdown()` (Turndown) destroys the markdown structure —
Turndown re-processes `## History` as literal text, not a heading. Fix: detect
whether Defuddle output has good markdown structure (headings > 3), and if so,
only strip HTML blocks rather than re-parsing everything through Turndown.

### Site-specific in-page extractors via Chrome headless

For sites with non-standard layouts (HN front page = nested `<table>` elements),
running JavaScript inside Chrome's page context via `page.evaluate()` is far more
reliable than JSDOM-based extraction. The in-page code can use real DOM selectors
like `.titleline > a`, `.score`, `.hnuser`, `.age a` to build structured markdown.

This is inspired by [Defuddle](https://github.com/kepano/defuddle)'s per-site
extractor pattern — but runs in the live rendered DOM rather than a JSDOM parse
of the HTML string. Advantage: can access computed styles, lazy-loaded content,
and JS-rendered DOM that JSDOM misses.

Pattern for adding a new site-specific extractor:
1. Check hostname in `extractSiteSpecific()`
2. Run `page.evaluate()` with selectors specific to that site's DOM
3. Return `{ markdown, title }` or `null` to fall through to generic extraction
4. Result enters the candidate comparison as "site-specific" alongside Defuddle/Readability

### Post-extraction markdown cleanup

Even after the best extractor wins, the output often has trailing noise sections
that leaked through — newsletter CTAs, "related articles", author bios. A regex-based
cleanup pass strips these:

- **Section-level**: heading patterns like `## Email Newsletter`, `## Subscribe`,
  `## Related Articles` → skip until next real heading
- **Line-level**: standalone promo lines like "Weekly tips on front-end..."

This is generic and site-agnostic — the patterns match common noise text across
many sites. This is the "heuristics not dogma" principle in practice.

### Using WibWob-DOS itself for development

While building the README, the agent initially opened it in the Document Reader
(`document.open`) — which showed raw HTML tags. The human pointed out the markdown
viewer exists (`markdown.open`) which renders with figlet headings, syntax-highlighted
code blocks, and proper formatting.

**Lesson**: use `tui_list_commands` to discover what's available. The markdown viewer
was always there — the agent just reached for the wrong tool. The TUI is not just
a test target, it's a development environment.

**Potential skill**: a `ww-preview-markdown` skill that opens a file in the markdown
viewer and returns a text screenshot for agent review. Would make README/doc authoring
much faster — write markdown, preview in the actual TUI renderer, iterate.

### Script/skill ideas from this session

- **`scripts/worktree-autoresearch.sh <branch> <dir>`** — scaffold a worktree for
  autoresearch with correct `autoresearch.sh`, `autoresearch.checks.sh` (no symlinks),
  and `bun install`. Avoids the symlink/health-check friction every time.

- **`ww-preview-markdown` skill** — open a `.md` file in the markdown viewer via API,
  take a text screenshot, return to agent. Useful for doc authoring, README iteration,
  planning doc review.

- **`ww-extraction-test` skill** — navigate Chrome to a URL via API, extract content,
  return the markdown and structural stats (headings, lists, links, length). Useful for
  ad-hoc browser extraction testing without running the full benchmark.

- **`autoresearch-init-worktree.sh`** — create a fresh worktree with autoresearch
  scaffolding: benchmark template, checks (typecheck only), .sh files, .md template.
  Eliminates the boilerplate every time a new autoresearch target is started.

### 2026-03-13 — Spore Clock polish + Asciicker 3D engine from scratch

**LLM scorer calibration is critical for autoresearch.**
The first Spore Clock scoring prompt gave identical 7.3 scores across 4 runs despite
real code improvements. The scorer was using vague rubrics and rounding to convenient
values. Fix: switched to feature-checklist scoring (enumerate 10 features per axis,
count what's present, calibrate score from count). This immediately unstuck the
scorer — went from 7.3 → 8.5 on the same code. Lesson: autoresearch scorers need
concrete, enumerable criteria. Vibes-based scoring produces sticky plateaus.

**Per-cell ANSI colour in blessed microapps.**
`tags: false` + raw `\x1b[38;5;N;48;5;Nm` escape codes in `setContent()` gives
per-cell fg+bg colour. This is documented nowhere but proven by e026-demo module.
Game-changer for any module needing rich colour: terrain renderers, art, heatmaps.
The `canvas.style.fg` only sets a single colour for the whole box — useless for
anything with spatial colour variation.

**Porting a C++ 3D engine to TS microapp: architecture study first.**
The asciicker C++ codebase is 136K lines. The first attempt produced a 2D isometric
tile map — the human correctly called it out as "not 3D." The actual asciicker uses:
- 3D transformation matrix (yaw rotation + 30° isometric tilt)
- Triangle rasterization with depth buffer
- Per-cell material system (glyph + fg + bg + diffuse shading)
- Back-to-front painter's algorithm for terrain columns
- Architectural perspective (verticals stay vertical on screen)

The key insight from studying render.cpp: the 3D effect comes from rendering
the VERTICAL EXTENT of terrain columns. Each heightmap column draws its top face
plus N side/cliff faces below it. The depth buffer prevents occluded cells from
showing through. This creates genuine 3D parallax when you rotate the camera.

Second attempt implemented this properly: column-based rendering with side faces,
depth buffer, per-cell ANSI colour, and surface-normal-based directional lighting.
Result: 7.6 → 8.1 quality score, and it actually looks like a 3D world.

**Key crash: blessed keypress handler must guard `key.name`.**
`host.screen.on("keypress", handler)` fires with undefined `key` or `key.name`
for certain key combos (= and - keys on macOS). Guard pattern:
`if (!key || !key.name) return;`

**Studying the original asciicker GIF reveals the secret sauce.**
Extracted frames from asciicker.gif with ffmpeg. Key visual differences from my renderer:
- Every terrain cell uses BOTH fg AND bg colour — grass has green bg + darker green fg glyphs.
  This fg+bg dithering creates far richer colour than my fg-only approach.
- Trees are tall multi-cell vertical sprites (dark trunk █ + green canopy) that poke above
  terrain, creating genuine 3D objects. My forest biome is just flat glyph variation.
- Cliff faces are solid walls of dark blocks when terrain drops — very prominent depth cue.
- The visual density comes from bg colour filling — no black/empty space on terrain at all.
Takeaway: the per-cell bg colour is not optional decoration, it's the primary visual technique.

**Module reload vs restart confusion.**
New modules require a full app restart to be discovered (microapp-loader scans at
startup). But code changes to an existing module's `index.ts` only need the window
closed and reopened — the module is re-evaluated on window creation. The autoresearch
reload pattern (close window → reopen) works for code changes but NOT for new modules.

---

## 2026-03-13: _apiCall guard — interactive prompts no longer hijack the TUI

**Human note:** FINALLY! some workarounds to this painful bug thats been bugging me for ages

Commands like `primer.open`, `editor.open`, `figlet.open`, and `markdown.open`
have a dual personality: called from a menu with no args, they open an interactive
file picker overlay. Called via the API with no args... they also open an interactive
file picker overlay. The API returns `{ok: true}` immediately, but the picker takes
over the entire screen, blocking the TUI until dismissed by keyboard. Agents and CLI
users have no way to dismiss it.

The fix: when a command is run via the API (`/commands/run`), inject `_apiCall: true`
into the args. Then in each action handler, when `_apiCall` is set and required args
are missing, return an error instead of opening an interactive prompt:

```typescript
// control-api.ts — /commands/run handler
const apiArgs = { ...(args ?? {}), _apiCall: true };

// app-controller.ts — primer.open handler
if (!filePath) {
  if (args?._apiCall) return { ok: false, error: "primer.open requires filePath arg when called via API" };
  this.promptForPrimer();  // only reached from menu/palette
  return;
}
```

Commands guarded: `primer.open`, `editor.open`, `markdown.open`, `figlet.open`.
All now return `{ok: false, error: "..."}` instead of hijacking the TUI.

The `_apiCall` marker is minimal and non-invasive — doesn't change menu/palette
behaviour at all. Only affects the API path, which is the only path where
interactive prompts are wrong.

---

## 2026-03-13: Figlet windows too small for long text via API

**Human note:** "GAME OVER" figlet window slightly too small for the words to be visible

When `figlet.open` is called via the API with longer text (e.g. "GAME OVER"), the
window opens at a default size that's too small to display the full figlet rendering.
The text gets clipped. Menu/palette path auto-sizes correctly because it measures
the content first, but the API path doesn't resize to fit.

**Flaw:** `openFigletWindow()` creates the window at a fixed default size rather than
measuring the figlet output and sizing to fit. The content measurement exists
(`content-measurement.ts`) but isn't used during API-driven figlet creation.

**Fix needed:** After creating the figlet window via API, measure the rendered content
and resize the window to `recommendedWidth × recommendedHeight` (already computed
for primers — needs equivalent for figlet).

**Workaround:** Manually resize after creation:
```bash
wibwob cmd figlet.open --text "GAME OVER" --font doom
WID=$(wibwob windows | jq -r '.[-1].id')
wibwob window.resize --id $WID --width 60 --height 14
```

---

## 2026-03-13: v3 creative tooling session — breed.py, fx commands, chromeless, pinball

### What shipped
- `scripts/fx/breed` — 5-mode character-level ASCII art breeding (xor, density, blend, random, interleave)
- `scripts/fx/{shear,glitch,flip,mirror,crop,repeat}` — stdin→stdout Unix pipe filters
- `scripts/fx/{liquid-shear,lava-lamp,tui-acid,kaleidoscope,upside-down,zoo,pinball}.sh` — orchestration scripts
- `fx.glitch`, `fx.shear`, `fx.breed`, `fx.flip` — registered in command catalog with Zod schemas
- `window.set_chrome --mode none` — per-window chromeless mode, strips borders/title/shadow
- `scripts/fx/jgsbreeder.sh` — breeds two Joan Stark pieces through all modes
- `_apiCall` guard on primer.open, editor.open, figlet.open, markdown.open — prevents interactive prompts via API
- v4 backlog planned: multi-instance discovery & targeting (tmux-style -t flag)

### Key design decisions
- FX are stdin→stdout filters, not framework plugins. They compose with `|`.
- `wibwob screenshot | glitch 0.6 | shear 3 > art.txt` — the TouchDesigner-for-terminals pattern
- Unix socket vs HTTP ports: both needed. Socket for local (like Docker), HTTP for remote/server.
- Per-window chromeless + desktop.toggle_chrome = fully frameless floating ASCII art

### Outstanding for next session
- v3 at 7/10 (graduation threshold) but needs clean commit + push
- v1 53/53 passes when desktop is clear (transient failures from leftover windows)
- A1 (Zod coverage) at 16% — needs batch schema pass on remaining commands
- A2/A3 (socket/FUSE) deferred — socket goes to v4 with multi-instance
- Figlet windows too small for long text via API (devlog'd, not yet fixed)
- Multi-instance CLI targeting (v4 BACKLOG.md written, tmux -t pattern)

### Transport architecture note (for next agent)
Unix sockets = primary for local CLI/agent (fast, no port conflicts, discovery via ls *.sock).
HTTP ports = keep for remote access, server deployments, xterm.js, PartyKit bridges.
CLI should try socket first, fall back to HTTP. Same pattern as Docker daemon.

---

## 2026-03-14: Live workspace tests need a strict restart order

The workspace round-trip tests are live API tests, not pure unit tests. If they are
started while `scripts/restart.sh` is still in-flight, they fail with a burst of
`ConnectionRefused` noise that looks like a product regression but is just bad test
sequencing.

**Rule for agents:** after touching `src/` internals that require restart:

1. `bun run typecheck`
2. `bash scripts/restart.sh`
3. wait for `/health`
4. then run live workspace/parity tests

Do not launch live API tests in parallel with restart. They race the shutdown window and
produce misleading failures.

---

## 2026-03-14: Blocking UI flows need explicit entrypoints and guaranteed cleanup

Problem pattern:

- a command like `markdown.open` or `editor.open` can be correctly non-interactive by default
- but agents still sometimes need to automate the shared picker itself
- if the live test fails before cleanup, the picker stays open in the shared tmux session

What shipped:

- explicit shared-picker commands:
  - `primer.picker.open`
  - `editor.picker.open`
  - `markdown.picker.open`
- richer runtime inspection:
  - `ui.blocked`
  - `ui.blockers[]`
  - overlay `label`
  - per-blocker `escapeCommands` and `continueCommands`
- `scripts/blocking-flow-check.sh`
  - text-first shell smoke for opening, inspecting, cancelling, and continuing blocking flows

Rule for agents:

1. if you want the picker UI itself, call the explicit picker command
2. inspect `/runtime/inspection`
3. drive the blocker with the listed commands
4. in live tests, use `try/finally` and always send `desktop.clear-all`

---

## 2026-03-14: Runtime-node metadata should drive shell scripts, not guessed paths

Problem pattern:

- shell scripts assumed `http://127.0.0.1:8099` and `scratch/captures`
- the runtime already knew `instanceId`, state path, capture path, and requested control port
- that made alt-instance or future multi-instance work look harder than it actually is

What shipped:

- `src/runtime/runtime-node.ts`
  - canonical runtime-node descriptor for `instanceId`, control host/port, scratch/captures/workspaces/state paths
- `/health` now reports:
  - `instanceId`
  - `requestedPort`
  - `host`
  - `scratchBase`
  - `capturesDir`
  - `workspacesDir`
  - `statePath`
- `GET /state.app.*` now includes:
  - `scratchBase`
  - `capturesDir`
  - `workspacesDir`
  - `logsDir`
  - `controlApiRequestedPort`
- `scripts/lib/runtime-env.sh`
  - shared helper for resolving API base URL, instance id, captures dir, and workspaces dir from the live runtime first

Rule for agents:

1. if you need API base URL or capture/workspace paths in shell, source `scripts/lib/runtime-env.sh`
2. prefer live runtime metadata over guessed repo-root paths
3. keep live restart and live API smoke tests serial, never parallel

---

## 2026-03-14: `microapp-loader` should not own the public microapp contract

Problem pattern:

- the public `MicroappHost` contract lived in `src/services/microapp-loader.ts`
- the stable module import path was already `src/services/microapp-sdk.ts`
- that meant the public SDK contract leaked out of a host-internal service owner

What shipped:

- moved public microapp host types into `src/sdk/microapp-host.ts`
- moved reusable SDK helpers into `src/sdk/runtime-helpers.ts`
- added `src/sdk/index.ts` as the internal SDK ownership anchor
- kept `src/services/microapp-sdk.ts` as the stable public facade
- updated `microapp-loader.ts` to consume/re-export the moved host contract instead of owning it

Verification:

- `bun run typecheck`
- `bash scripts/restart.sh`
- open a real module through the command surface (`microapp.wibwob.example.hello.open`)

Rule for agents:

1. public microapp authoring contract belongs in `src/sdk/*`
2. `src/services/microapp-sdk.ts` stays as the stable import path until an intentional public migration
3. do not add new module-author types back into `microapp-loader.ts`

---

## 2026-03-14: CLI parity should be tested as a shell client, not a TS-internal unit

Problem pattern:

- the CLI is intentionally a thin shell-facing HTTP client
- Bun-driven child-process tests were flaky in this repo's TypeScript test environment
- that risked proving the test runner instead of proving the actual CLI usage path

What shipped:

- CLI now exposes the runtime inspection seam directly: `wibwob inspection`
- `wibwob commands` can filter by `--surface` and `--includeUnavailable`
- canonical geometry examples now use `left/top/width/height`, not `x/y/w/h`
- `scripts/cli-parity-check.sh`
  - verifies `health`
  - verifies `inspection`
  - opens, moves, resizes, focuses, and closes a real window through the CLI
- `scripts/ci-cli-test.sh` now runs the canonical shell parity harness

Rule for agents:

1. if you are testing the CLI, prefer `scripts/cli-parity-check.sh`
2. treat the CLI as an external shell client over the live API, not as an internal TypeScript library
3. keep CLI features thin and aligned to shared runtime/API semantics

---

## 2026-03-14: The first proof microapp should consume the runtime seam like any other client

Problem pattern:

- it is easy to "prove" a runtime seam by giving a built-in tool private host access
- that does not prove the platform is coherent for future microapps
- the first proof tool needs to succeed through the shared inspection surface itself

What shipped:

- `src/sdk/runtime-client.ts`
  - `getRuntimeControlApiBaseUrl()`
  - `fetchRuntimeHealth()`
  - `fetchRuntimeInspection()`
  - `fetchRuntimeCommands()`
- exported through `src/services/microapp-sdk.ts`
- new module: `microapps/runtime-inspector/`
  - command: `microapp.wibwob.runtime-inspector.open`
  - reads `/runtime/inspection` and `/commands/list`
  - shows instance identity, blocker state, windows, stats, and command catalogue summary

Important correction:

- in-process runtime clients must prefer `WIBWOB_API_BASE_URL` over shell-oriented `WW_API`
- otherwise a module can accidentally point at the wrong runtime

Rule for agents:

1. if a microapp needs runtime reads, use the SDK runtime-client helpers
2. prefer proving seams through shared APIs over reaching into host internals
3. do not broaden one proof microapp into a mass built-in migration

---

## 2026-03-14: Shared-runtime Bun tests need a serialized harness, not one big invocation

Problem pattern:

- several `src/tests/*.test.ts` files hit the same live WibWob runtime over HTTP
- `bun test file-a file-b ...` can schedule those files concurrently
- that turns desktop cleanup and window assertions into test-runner races instead of product checks

What shipped:

- `scripts/live-api-test-suite.sh`
  - clears the desktop through the canonical runtime command before each file
  - runs the live API test files one at a time in separate Bun invocations
  - leaves the desktop cleared at the end
- `src/tests/workspace-roundtrip.test.ts`
  - now starts from a canonical desktop reset instead of ambient window state
- `.agents/shell-dev/specs/state-and-api.md`
  - documents the shared-runtime concurrency failure mode and the required harness

Rule for agents:

1. if a test talks to one live runtime over HTTP, assume cross-file concurrency is unsafe
2. prefer a shell harness that serializes files over a single multi-file `bun test` command
3. clear the desktop through `desktop.clear-all` before and after live-stateful checks

Important correction:

- Bun auto-loads `.env`, so local live tests can accidentally pick hosted `WIBWOB_API`
- for local runtime tests, only use `API_URL`, `WW_API`, or a literal local fallback
- reserve `WIBWOB_API_BASE_URL` for in-process runtime clients that intentionally follow the local app

---

## 2026-03-14: Always separate content measurement from chrome math

Problem pattern:

- visual sizing bugs keep recurring when code mixes content dimensions with
  borders, title bars, toolbars, scrollbars, or positioning offsets
- figlet windows are a common failure case because rendered text may look
  "measured" while the actual frame still clips after chrome is applied

Rule for agents:

1. measure content first and keep that measurement chrome-free
2. apply border/title/toolbar/scrollbar width and height in the window-chrome path
3. when positioning child widgets inside a frame, account for chrome offsets explicitly
4. if a window resizes based on content, verify the post-resize rendered state, not only the pre-resize measurement

Heuristic:

- if you are adding `+1`, `+2`, or ad hoc padding near a widget layout call, ask whether it really belongs in `window-chrome.ts`
- if the content re-wraps after resize, the first-fit measurement was not the final truth

---

## 2026-03-14: Figlet sizing needed two fixes: real content height and proof-layout discipline

Problem pattern:

- figlet banners were being clipped in two different places
- the opener was collapsing height from a one-row heuristic
- the runtime parity harness then reintroduced clipping by forcing the banner back to `92x12`

What shipped:

- `src/services/figlet-service.ts`
  - `getFigletWindowContentSize()` now sizes from actual rendered content plus catalogue height
- `src/windows/figlet-windows.ts`
  - figlet windows use that content-truth sizing instead of the old single-row heuristic
- `src/core/window-chrome.ts`
  - figlet toolbar chrome width was widened so the resized window does not re-wrap and inflate height again
- `scripts/runtime-parity-check.sh`
  - derives banner height from the opened figlet window instead of hard-coding 12 rows
  - resizes before moving in batch ops so window-manager clamping uses final geometry

Rule for agents:

1. if a proof harness forces a window to a fixed size, it can mask or recreate the very bug you just fixed
2. for figlet-like rendered content, open first, inspect real state, then arrange
3. when a window needs both resize and move in one batch, do resize first if top/left clamping depends on final dimensions
- 2026-03-14 — Microapp reload follow-on
  - `microapps.reload` is now the stable microapp-only reload seam.
  - `scripts/watch-microapp.ts` is useful scaffolding, but reliable hot-swapping
    of already-open microapp windows is not solved yet.
  - concrete gotchas discovered while pushing it:
    - `/state` exposes microapp identity at `window.details.appType`, not `window.appType`
    - local microapp-dev scripts should default to `http://127.0.0.1:8099`, not inherit hosted `WW_API`
    - the remaining problem is window/state handoff, not dynamic import cache-busting
    - best-effort reopen is good enough for stateless/simple windows when geometry is restored after reopen; verified live with `microapps/layout-probe`
  - keep this in the post-refactor lane unless a stronger host-level window reload
    abstraction is introduced
  - new agent-useful scripts landed:
    - `scripts/cli-runtime-triage.sh`
    - `scripts/cli-batch-relayout.sh`
    - `scripts/cli-text-loop.sh`
    these are local-first on purpose so repo tooling does not silently hit a hosted runtime
  - live API tests that mutate one tmux shell should be serialized; `bun test fileA fileB`
    can race itself because both files drive the same runtime concurrently

- 2026-03-14 — Bun `import()` cache-busting is broken for hot reload
  - **Symptom:** `microapps.reload` fires, epoch bumps, module "reloads" — but
    the old code runs. Title bar, colors, UI elements all stale. Maddening because
    every signal says reload succeeded.
  - **Root cause:** Bun caches compiled TypeScript modules by file path. The
    `?reload=${Date.now()}` query-string trick that works in browsers and Node
    does NOT bust Bun's module cache. The `import()` returns the old compiled module.
  - **Fix (v2, clean):** `delete require.cache[require.resolve(entryPath)]` before
    the dynamic `import()`. This tells Bun to evict the compiled module. The
    `?reload=<timestamp>` query string is kept as belt-and-suspenders but alone
    it does nothing — Bun ignores query strings for cache keying. Confirmed with
    a standalone test: `import(url+'?v=1')` and `import(url+'?v=2')` return the
    same object (`===`), but after `delete require.cache[...]` they return fresh ones.
  - **Discarded v1 (temp-file copy):** copied entry to a unique temp file before
    import, deleted after. Worked but ugly and leaked files on crash.
  - **Proof:** Changed window title from "ZILLA WAS HERE" → "💩 PROOF IT WORKS 💩"
    via `microapps.reload` — same instance `j14`, no restart, title changed live.
  - **Agent pain log:** This took way too long to diagnose because every API
    response said the reload worked (epoch bumped, command re-registered, no
    errors). The only signal was visual: the title bar didn't change. Lesson:
    when testing hot reload, change something unmissable (title, color, size)
    and verify visually — API responses lie when the cache lies.
  - **Watcher note:** `watch-microapp.ts` with `--strategy reload` now works
    end-to-end for real hot reload. The default `--strategy restart` is the safe
    fallback but kills the whole app. For microapp dev iteration, use reload.

---

## 2026-03-14: CLI-as-music-video — creative pipe scripting session

### What happened

Built three creative pipe scripts (`scratch/cli-experiments/`) that use the wibwob
CLI + curl + smear.py to compose recursive visual art on the live TUI:

- `ouroboros.sh` — 5-layer recursive self-portrait (desktop screenshots itself,
  glitches the text, feeds it back as a primer, repeat)
- `concrete-poetry-glitchfest.sh` — 20 figlet words in asymmetric cluster on
  a 4-phase glitched palimpsest
- `creature-word-bomb.sh` — Joan Stark animals + wibwob primers + 20-word
  figlet bomb across 5 themed phases with pauses for human eye

These follow the patterns documented in `src/cli/CREATIVE_PIPES.md`.

### What worked well

- **`/windows/batch` is the hero.** Positioning 20 figlets individually would be
  20 HTTP calls with sleeps. Batch does it in one. The jq-to-batch pattern from
  CREATIVE_PIPES.md is genuinely powerful — query state, shape with jq, POST batch.
- **`smear.py` composes perfectly.** stdin→file, text domain only, no images.
  Glitch + shear modes create real visual texture. The recursive screenshot→transform→
  reopen loop produces genuine palimpsest effects where window chrome from iteration 0
  is visible as ghosts through 4 layers of corruption.
- **Theme switching between phases** gives each act a distinct visual character.
  Nord (cold creatures) → phosphor (green corruption) → pastel (dream) → phosphor
  (deep glitch) → pastel (finale). Themes are an underused creative tool.
- **Joan Stark art + wibwob primers layer well.** Small ASCII creatures (cat, frog,
  butterfly) act as clipart scattered through the composition. Larger primers
  (devil-terminal, awoooo) act as set pieces. The size contrast matters.
- **Pauses for human eye** (`sleep 1.5`) between complex phases made the
  composition watchable as a performance, not just a batch job.

### What caused friction

- **`.env` WIBWOB_API pointed at hosted VPS.** The CLI (`bun run src/cli/wibwob.ts`)
  picked up `WIBWOB_API=https://dos.wibandwob.com/api` from `.env` and hit 401 on
  every call. `curl` to localhost worked fine. Root cause: Bun auto-loads `.env`,
  and the env var name collides with the CLI's resolution chain. Fix: commented out
  the hosted URL, set `WIBWOB_API=http://127.0.0.1:8099`. **Longer-term fix needed:**
  rename the hosted var to `WIBWOB_HOSTED_API` or make the CLI prefer localhost when
  a local instance is running.
- **JSON escaping in bash is brutal.** Every `cmd()` call requires manual JSON with
  escaped quotes: `cmd "{\"id\":\"primer.open\",\"args\":{\"filePath\":\"$JGS/cat-0000-3.txt\",\"x\":2,\"y\":2}}"`.
  This is error-prone, hard to read, and the main reason the scripts are longer than
  they need to be. The CLI's dot syntax (`wibwob primer.open --filePath ... --x 2 --y 2`)
  is much cleaner but the scripts used `curl` directly because of the initial 401
  issue. **Now that the CLI works, v2 scripts should use CLI syntax exclusively.**
- **No way to get a window ID back from open commands.** `figlet.open` returns
  `{ok: true}` but not the window ID. To batch-position figlets, you have to query
  `/state` after opening them all and filter by kind. This works but is fragile if
  other figlets already exist. A `{ok: true, windowId: N}` return would make
  targeted positioning trivial.
- **Batch positioning requires knowing window IDs.** The pattern is: open N windows →
  query state → extract IDs → build batch JSON → POST. This is 3 steps that could be
  1 if open commands accepted position args that actually worked. (`--x` and `--y` are
  accepted by `primer.open` but figlet.open ignores position args.)
- **Sleep timing is guesswork.** `sleep 0.3` after each open, `sleep 0.5` after batch.
  Too short and the screenshot captures incomplete state. Too long and the performance
  drags. No way to know when a window has finished rendering. A `/ready` endpoint or
  window-level render-complete signal would eliminate timing hacks.

### Ideas for making this smoother

- **CLI-native scripts, not curl.** v2 of all scripts should use:
  ```bash
  wibwob primer.open --filePath "$JGS/cat-0000-3.txt" --x 2 --y 2
  wibwob figlet.open --text "SPAWN" --font shadow
  ```
  instead of `curl -s -X POST ... -d '{"id":"primer.open","args":{...}}'`.
  The CLI already supports this syntax. It's just that the initial 401 bug
  pushed us to curl and we never switched back.

- **`figlet.open` should return the window ID** so scripts can position it
  immediately without querying state.

- **`figlet.open` should accept `--x` and `--y`** like `primer.open` does.
  Currently figlets always open at default position and need a separate
  move/batch call.

- **A `wibwob batch` subcommand** that reads a JSON batch payload from stdin:
  ```bash
  wibwob windows | jq '[... position logic ...]' | wibwob batch
  ```
  Currently the batch step has to drop down to raw curl because the CLI
  has no batch verb.

- **Chiptune sync for v2.** Next step is timed audio — a chiptune stinger per
  visual event (word appear, art appear, theme shift, glitch transform). The
  chiptune-studio skill (`bricks` library) can generate per-event WAV hits.
  The shell script would `ffplay` the composed audio and sync visual cues to
  the audio timeline. This turns the script into an actual music video.

### Human note

**Q: Does `cmd "{\"id\":\"primer.open\",\"args\":{...}}"` = shell command or JSON/API?**

It's JSON/API. The `cmd()` function in the scripts is a bash wrapper around `curl`:
```bash
cmd() { curl -s -X POST "$API/commands/run" -H 'Content-Type: application/json' -d "$1" >/dev/null; }
```

The **CLI equivalent** is cleaner and already works:
```bash
wibwob primer.open --filePath "/path/to/file.txt" --x 2 --y 2
wibwob figlet.open --text "SPAWN" --font shadow
wibwob cmd desktop.clear-all
wibwob theme.set --name wibwob-phosphor
```

v2 scripts should use CLI syntax throughout. The curl approach was a workaround
for the `.env` 401 bug, not a design choice.

---

## Session: 2026-03-14 — SFX creature word bomb v2

### What got built

Full 8-phase creature word bomb with chiptune SFX (`creature-word-bomb-sfx.sh`):
- **Phase 0: Intro** — wibwob dual portrait + "wib & wob presents..." with `say` TTS sync
- **Phases 1–5**: menagerie → corruption → shear → deep glitch → 20-word bomb (same as v1 but with SFX)
- **Phase 6: Destruction** — 3-wave explosion sequence (cartoon → crackle+zap → low boom → final)
- **Phase 7: FIN** — shark ASCII art + `fin.` figlet + descending Eb minor micromelody
- Desktop clears at end for clean loop

### SFX pipeline

13 WAV files generated from chiptune-studio bricks via 4 generator scripts:
- `gen-sfx.py` — 6 core hits (word, art, glitch, theme, clear, stinger-finale)
- `gen-explosions.py` — 5 explosion variants (low, crackle, cartoon, zap, final)
- `gen-arrange.py` — rapid ascending tile-snap (plays when batch position fires)
- `gen-fin-melody.py` — 3-note Bb4→Gb4→Eb4 lullaby with low pad resolve

SFX auto-generate on first run if missing. Pattern: `sfx() { ffplay -nodisp -autoexit "$1" 2>/dev/null & }`

### Friction / observations

1. **Agent runs ad-hoc commands directly in bash** — for the "proof of concept" demo
   (pipe a previous run's text dump back into the TUI as a primer), I wrote the commands
   directly into a `bash` tool call rather than saving a script file first. This is fine
   for one-off proofs but means the work is ephemeral — lost in session logs, not
   replayable. For anything worth showing again: write a script file.

2. **`say` command (macOS TTS) as an SFX source** — works great for intro voiceover.
   Fire-and-forget with `say -v Samantha "wib" &`. Different voices per character
   (Samantha for wib, Daniel for wob) gives personality. Zero setup, already on every Mac.

3. **Explosion sync requires sound-before-action** — first attempt had boom sounds
   arriving after windows were already closed (the bang lagged the visual). Fix: fire
   `sfx` then `sleep 0.05` then close windows. The tiny delay lets the audio buffer
   start before the visual event lands.

4. **`hit-arrange.wav` is the most satisfying SFX** — rapid ascending clicks that
   accelerate, then a low "lock" thud. Plays when 5–20 windows snap from stacked
   default positions into their composed mosaic layout via `/windows/batch`. Makes
   the batch-position moment feel intentional and mechanical.

5. **Text dump round-tripping works** — `wibwob screenshot > file.txt` captures the
   full terminal state, then `wibwob primer.open --filePath file.txt` reopens it as
   a primer. Smear transforms (`--mode glitch`, `--mode shear`) applied to these
   dumps create palimpsest layers. The recursive loop (capture → transform → reopen
   → capture again) is the core creative engine.

6. **Script self-bootstraps its SFX** — if any WAV is missing, the script runs the
   relevant `gen-*.py` via `uv run`. First run takes ~2s for pip installs, subsequent
   runs are instant. Good pattern for distributable scripts.

### Ideas for future

- **Pre-composed audio track** — instead of individual SFX hits, render a single
  mixed WAV/MP3 that contains all sounds at their correct timestamps. Play it once
  at script start, then the visual events just need to be timed to match. Simpler,
  more reliable sync, and the audio can be mastered properly.
- **Looping mode** — the script already clears at the end. Add `while true; do ... done`
  wrapper with theme rotation per loop for installation/exhibition use.
- **Record mode** — see recording feature idea below.

### Recording feature — user story sketch (not yet epic'd)

**Trigger:** View → Record (or `recording.start` via CLI/API)

**What happens:**
1. `RecordingService` owns all state (idle/recording, output path, cue log, start time)
2. Service spawns `asciinema rec` against the current terminal (or a built-in capture)
3. Top-right chrome shows blinking `● REC` indicator (like QuickTime's red dot)
4. Clicking the dot OR View → Stop Recording OR `recording.stop` ends the session
5. Service writes `.cast` + optional `cues.tsv` (if SFX were fired during recording)
6. Post-recording: service can trigger export pipeline (cast→gif, mix audio, composite mp4)

**Architecture (respecting refactor canon):**
- `src/services/recording-service.ts` — one owner, one state path
- Command catalog: `recording.start`, `recording.stop`, `recording.status`
- Control API: `POST /recording/start`, `POST /recording/stop`, `GET /recording/status`
- CLI: `wibwob recording.start` / `wibwob recording.stop` — pure HTTP, zero shell imports
- TUI: menu items + chrome indicator — thin adapter over the service
- No logic in CLI, no logic in API handler, no logic in menu callback

**Open questions:**
- Does asciinema need to wrap the whole process, or can it attach to a running TTY?
  (If it needs to wrap, recording must start before the app — different flow)
- Alternative: built-in terminal capture (read the PTY buffer on a timer) — no asciinema dep
- Should the `● REC` dot be in the kaomoji area or a separate chrome element?
- Export pipeline: inline (View → Export Recording) or always-manual (scripts)?
- Cue log integration: should `sfx()` in creative pipe scripts POST cues to the API
  so the recording service captures them automatically?

**Not yet epic'd.** This is a parking lot idea. Promote to `.planning/` when ready.

### Audio recording pipeline

Loopback Audio (Rogue Amoeba) routes system audio into QuickTime screen recordings.
Key setup: macOS Sound Output must be set to "Loopback Audio" — not the speakers.
Pass-Thru in Loopback forwards everything. If output is set to Studio Display Speakers
(USB), ffplay/say audio bypasses the virtual device entirely and QuickTime records silence.

### Cue logging + offline audio mix

The `sfx()` function now dual-writes: plays via ffplay AND logs `timestamp_ms\twav_path`
to `cues.tsv`. At script end, `mix-sfx-track.py` reads the cue file and renders all
86 hits into a single `soundtrack.mp3` placed at their real timestamps. This means:
- Any screen recording (QuickTime, OBS, asciinema) can be post-synced with the audio
- The audio mix is deterministic — re-run from the same cues.tsv = identical track
- Script also supports `--record` (asciinema) and `--export` (cast→gif + audio→mp4)

### macOS `say` as creative SFX

Apple's built-in TTS voices are surprisingly good for phase announcements:
- Zarvox (alien robot) for "the menagerie"
- Bad News (ominous) for "corruption"
- Whisper (creepy quiet) for "shear"
- Trinoids (robotic trio) for "deep glitch"
- Boing (bouncy cartoon) for "the word bomb"
- Bells (church bells) for "destruction"
- Cellos (orchestral) for "fin"
- Wobble (wobbly) for "presents" in the intro

`say -v VoiceName "text" &` is fire-and-forget, same pattern as `sfx()`.
There's literally a voice called "Wobble" on macOS — perfect for wob.

### Ad-hoc vs scripted work

When doing a quick proof-of-concept (e.g. piping a previous run's text dump back
into the TUI), I wrote commands directly into a bash tool call rather than saving a
script. This is fine for one-off proofs but the work is ephemeral — lost in session
logs. Rule: if it's worth showing twice, write a script file.

### Future optimisations and CLI ergonomics ideas

**Shell aliases / PATH setup:**
The script header has boilerplate that every creative pipe script duplicates:
```bash
W="bun run src/cli/wibwob.ts"
SMEAR="python3 .pi/skills/vj-timeline/scripts/smear.py"
SFX="scratch/cli-experiments/sfx"
JGS="/Users/james/Repos/symbient-skills/skills/joan-stark-ascii-art/examples"
```
These could live in `~/.zshrc` or a `~/.wibwob-env.sh` that scripts source:
```bash
export PATH="$REPO/src/cli:$PATH"  # so `wibwob` just works
alias smear="python3 $REPO/.pi/skills/vj-timeline/scripts/smear.py"
alias jgs="ls $JGS"
```
Or the CLI itself could ship these as subcommands: `wibwob smear`, `wibwob sfx`.

**CLI syntax gaps — things that still need curl:**
- `wibwob batch` — no CLI verb for `/windows/batch`. Every script falls back to
  raw curl for multi-window positioning. This is the #1 friction point.
- `wibwob window <id> move --x 5 --y 10` — individual window positioning exists
  via API but no CLI verb.
- `wibwob windows` returns JSON but no `--ids-only` or `--kind figlet` filter —
  every script does `jq -r '.[] | select(.kind=="figlet") | .id'` inline.

**SFX pipeline improvements:**
- `wibwob sfx play hit-word` — built-in SFX player, looks up from a known dir
- `wibwob sfx generate` — regenerate all WAVs from the gen-*.py scripts
- `wibwob sfx mix cues.tsv output.mp3` — mix from cue file
- The sfx() function could be a proper shell function in a sourced library

**Sequence DSL — the big one:**
Instead of imperative bash with sleep/sfx/wibwob interleaved, a declarative format:
```yaml
- at: 0s
  do: [clear, theme wibwob-dark, say "wib" Samantha]
  sfx: hit-art
- at: 0.8s
  do: [figlet "wib" doom, position {left: 20, top: 22, w: 40, h: 10}]
  sfx: hit-word
- at: 1.4s
  do: [figlet "wob" banner]
  sfx: hit-word
```
This would enable: pre-rendering the audio track before visual playback,
timeline scrubbing, loop points, BPM sync, and deterministic replay.
The vj-timeline system already has some of this — could converge.

**figlet.open improvements needed:**
- Return window ID on creation (currently doesn't — forces a /state query)
- Accept `--x` / `--y` position args (primer.open supports this, figlet doesn't)
- Accept `--width` / `--height` for initial sizing
- These three gaps cause ~50% of the boilerplate in creative scripts

**Smear as a first-class CLI verb:**
`wibwob smear --mode glitch --intensity 0.5 --input phase1.txt --output phase1-glitched.txt`
Instead of knowing the python path. Could also smear the live screenshot directly:
`wibwob smear --live --mode glitch` (screenshot → transform → open as primer)

**asciinema integration:**
- `wibwob record start` / `wibwob record stop` — wraps asciinema
- `wibwob record export --audio cues.tsv` — renders cast+audio→mp4
- Could auto-start recording when a creative pipe script runs

---

## 2026-03-14: Recording pipeline — tmux→cast→GIF→MP4 with synced audio

### What got built

End-to-end recording pipeline in `scripts/wibwob-record.sh`:
- `wibwob-record run <script>` — captures the tmux pane at 10fps as asciicast v2
- `wibwob-record export <file.cast> --audio <mp3>` — renders cast→GIF via agg, composites with audio→MP4
- `wibwob-record mix <cues.tsv> <output.mp3>` — renders SFX cue file to single mixed audio track
- Auto-mixes audio at end of recording if `cues.tsv` found in latest capture dir
- Uploaded to asciinema: https://asciinema.org/a/6zXq5wir4dJdWVBn

### Capture source: `/screenshot/ansi` API, NOT tmux capture-pane

**Biggest lesson of this session.** tmux `capture-pane -e` includes blessed's raw
VT100 ACS (Alternate Character Set) bytes — `\x0e`/`\x0f` shift-in/shift-out with
ASCII letters as box-drawing (`a`=fill, `q`=horizontal, `x`=vertical, `l`=top-left).
agg doesn't understand ACS, so it renders literal letters instead of box-drawing chars.

Built `scripts/acs-translate.py` to post-process these, but it had edge cases:
- `a` should map to space (blessed uses ACS `a` as background fill), not `░`
- ACS bytes inside ANSI escape sequences (e.g. `m` in `\e[36m`) got translated
- Column alignment broke because multi-byte UTF-8 chars changed byte counts

**Fix:** switched to `GET /screenshot/ansi` API endpoint. Blessed resolves ACS
internally before returning, so the output has proper Unicode box-drawing. Clean,
no post-processing needed. This is the correct capture source for any recording.

### Cast frame format: cursor positioning required

asciicast v2 frames are `[timestamp, "o", "terminal_data"]`. The terminal data must
include cursor positioning — bare `\n` causes staircase rendering in agg (each line
starts where the previous one ended). Fix: prefix each frame with `\x1b[2J\x1b[H`
(clear + home) and each line with `\x1b[{row};1H` (move cursor to row start).

### agg render settings

| Setting | Value | Why |
|---------|-------|-----|
| `--font-size` | 32 | 2x retina quality |
| `--line-height` | 1.1 | Best cell proportion match |
| `--theme` | github-dark | Closest to wibwob-dark-nord |

agg cell proportions are inherently taller than wide (~0.76:1 ratio) regardless of
font size. Real Ghostty cells are wider than tall on landscape monitors. The rendered
output is slightly portrait-ish. User accepted this as "decent" — for exact landscape
matching, ffmpeg post-scale would be needed:
```bash
ffmpeg -i input.gif -vf "scale=iw*2:ih,scale=1920:-2" output.mp4
```

### Voice lines in audio mix

macOS `say` voices are now pre-rendered as WAVs at script start (`say -v Voice "text" -o file.aiff`
→ ffmpeg convert to WAV). Then played via `sfx()` function so they get logged in `cues.tsv`
and mixed into the soundtrack. 10 voice lines across 8 phases, 96 total cues.

Previously `say` was fire-and-forget in the background — worked for live playback but
was invisible to the audio mix pipeline.

### Audio-video sync: unsolved pain point

**The core problem: two independent timelines drift apart.**

- **Timeline A**: cast frame timestamps (from the capture loop's wall clock polling at 10fps)
- **Timeline B**: cue timestamps in cues.tsv (from the script's `epoch_ms()` calls)

Even with a shared start time (`WIBWOB_RECORD_START_MS` exported from the recording
script to the sfx script), the rendered MP4 has audible sync drift that grows over
time. By 40s, sounds are ~10s early relative to the visuals.

**Investigation findings:**
- Cast frame timestamps match GIF frame delays (centisecond precision is fine)
- GIF frame timestamps survive into the MP4 faithfully
- `cues.tsv` timestamps and cast timestamps are close in the raw data (~0.2s offset)
- The `mix-sfx-track.py` mixer places cues at correct sample positions
- Yet the MP4 playback is noticeably off

**Root cause hypothesis:** GIF timing is encoded as frame delays (centiseconds).
When ffmpeg encodes GIF→h264, the variable frame rate gets reinterpreted. Frames with
long gaps (e.g. 3s of no change → one frame at t=7.3, next at t=10.5) may get
compressed or interpolated differently than expected. The audio track plays at real-time
44.1kHz while the video frame timing is approximate.

**Proposed fix: single-timeline architecture.**
The script IS the timeline. Instead of two independent clocks:

1. **Option A (best):** Script emits a unified event log with timestamps for both
   visual snapshots and audio cues. One renderer reads this log and places video
   frames and audio at the exact same timestamps. No drift possible.

2. **Option B:** Skip GIF entirely. Render each cast frame as an individual PNG
   via agg (single-frame casts). Use ffmpeg's concat demuxer with exact per-frame
   durations from the cast timestamps. This avoids GIF's centisecond precision
   limitation and gives frame-accurate video.

3. **Option C (quick fix):** ffmpeg `-itsoffset` to manually shift the audio track.
   Fragile but fast for one-off exports.

**Not yet implemented.** The current pipeline produces watchable but imperfect MP4s.
The audio sync issue is the main remaining quality gap.

### Other fixes applied

- **Video too long**: was 92s due to GIF looping (`-ignore_loop 0`). Fixed: use
  `-t <cast_duration>` to trim to the actual cast span instead of letting the GIF loop.
- **`~/.wibwob` dotfile**: shared env for creative pipe scripts. Sources paths, sets
  aliases (`wibwob`, `smear`, `sfx`, `ww-clear`, `ww-theme`, `ww-batch`).
- **E043 Session Capture & Playback epic**: planned at
  `.planning/epics/e043-session-capture/e043-brief.md` — RecordingService with chrome
  indicator, cue logging, export pipeline. 4 features, 9 stories. Not started.

### `RECORDING.md` created

Root-level `RECORDING.md` documents the full pipeline: quick start, final settings,
architecture diagram, how-we-got-here narrative, and file index. This is the canonical
reference for anyone wanting to record and export WibWob-DOS sessions.

### Outstanding

- [ ] Fix audio-video sync (single-timeline architecture — see `.scpt.md` pattern below)

### Existing prior art: `.scpt.md` voiceover timeline format

The `wibandwob-heartbeat` repo already has a proven single-timeline format at
`~/Repos/wibandwob-heartbeat/`. The `.scpt.md` format defines:

```markdown
@config
rate = 180
pause = 0.2
scene_gap = 0.3
dividers = off
wib = Samantha
wob = Daniel

@content
[frame: phase-01-menagerie]
wob: The menagerie.
---
[frame: phase-02-corruption]
wib: Corruption.
---
```

`build-ident.sh` processes this into:
1. **MP3** — all voiced lines rendered via macOS `say`, concatenated with exact timing
2. **`.timecodes`** — timestamps for each `[frame:]` marker, synced to the audio

`compile-narrated-reel.py` then composites PNG frames at those exact timecodes.

**This solves our audio-video sync problem.** Instead of two independent clocks
(cast capture polling vs sfx cue logging), we'd write a `.scpt.md` for the creature
word bomb, render the audio track first, then replay the visual script timed to the
audio's timecodes. One timeline drives everything.

Key files in heartbeat repo:
- `scripts/build-ident.sh` — `.scpt.md` → MP3 + timecodes pipeline
- `scripts/compile-narrated-reel.py` — frames + audio → MP4 with per-frame timing
- `scripts/text-to-voiceover.py` — prose text → AppleScript voiceover
- `output/*/voiceover.scpt.md` — ~30 example scripts with frame markers
- `WIB-WOB-VIDEO-MAKER.md` — full pipeline docs

Config features: `rate`, `pause`, `pad_to`, `scene_gap`, inline `[R:180]`/`[FAST]`/
`[SLOW]`/`[V:VoiceName]`/`[pad:3.5]` modifiers per line. macOS `say` quantises
rate in ~20 WPM steps (documented in build-ident.sh header).
- [ ] Portrait mode recording (50×45 terminal, 9:16 for mobile)
- [ ] `figlet.open` should return window ID (still forces `/state` query after open)
- [ ] `figlet.open` should accept `--x`/`--y` position args
- [ ] `wibwob batch` CLI subcommand (batch positioning still needs raw curl)
- [ ] agg aspect ratio: currently portrait-ish, may need ffmpeg landscape post-scale

## 2026-03-14 — The single smartest addition to the project right now

**Prompt:** "What's the single smartest and most radically innovative and accretive
and useful and compelling addition you could make to the project at this point?"

**Answer: Agent-authored microapps at runtime.**

The Wib&Wob agent (or any connected agent) should be able to scaffold, write,
hot-load, and open a microapp during a live session. Not as a hack — as a
first-class documented capability.

"Build me a dashboard that shows my git commit frequency" → agent writes
`microapps/git-dashboard/microapp.json` + `index.ts` → calls `microapps.reload`
→ calls `microapp.wibwob.git-dashboard.open` → window appears on the desktop.

**Why this is the smartest move right now:**

1. **The infrastructure is 95% there.** COAT landed. The microapp SDK is stable.
   The scaffold script works. `microapps.reload` discovers new microapps. The
   boolean menu bug we just fixed was literally the last blocker. An agent can
   already do this — it's just not documented or reliable enough to be a feature.

2. **It completes the symbient vision.** The project's identity is "dual operating
   system" — human and agent as peers. Right now the agent can *use* tools. With
   this, the agent *makes* tools. The OS extends itself through conversation.

3. **It's uniquely accretive.** Every tool the agent builds stays as a microapp.
   Session 1: "build me a timer." Session 2: the timer is already there. The
   platform accumulates capability through use, not through planned development.

4. **It's the most compelling YouTube demo imaginable.** Watch the AI build its own
   window on a terminal desktop. In real time. Using the same SDK a human would use.
   No other terminal project can do this.

5. **It forces the SDK to be honest.** If an agent can't build a working microapp
   from the SDK docs alone, the SDK docs are wrong. This is the ultimate test of
   COAT compliance — the agent is a thin adapter too.

**What's actually needed to ship this:**

- [ ] Make `microapps.reload` reliably pick up *new* microapps (not just code changes
  to existing ones) — mostly works already, needs hardening
- [ ] Document the agent-authored microapp loop in a skill or prompt
- [ ] Add a `host.pickFromList()` SDK method so agent-built microapps can use pickers
  without reimplementing blessed lists
- [ ] Consider a `microapps/scratch/` or `microapps/agent-built/` convention for
  ephemeral microapps that aren't committed to the repo
- [ ] The Wib&Wob agent's tool set already includes `write`, `bash`, and
  `tui_run_command` — it can already do this. The gap is a skill/prompt that
  teaches it the pattern.

**What makes this different from "agent writes code":**

Most agent coding is: write file → run tests → ship. This is: write file →
the thing appears on screen as a living interactive surface → the agent and
human can both use it immediately → it persists across sessions. The feedback
loop is visual, immediate, and shared. The agent isn't writing code *for* the
human — it's extending a shared environment they both inhabit.

**Risk:** agent-built microapps will be messy. That's fine. They live in a
scratch directory. The good ones get promoted to `microapps/` and cleaned up.
The bad ones get deleted. The platform accumulates the winners.

## 2026-03-14 — COAT migration: host → microapp migration pattern

### Context

Migrating built-in window types from `src/windows/*.ts` to proper microapps under
`microapps/`. First candidate: figlet-banner. Goal: prove the COAT pattern works
for real migrations, not just proof microapps.

### COAT = Command Once, Adapt Thin

New architectural shorthand added to AGENTS.md. Four shared seams (command,
inspection, window, workspace) — TUI/CLI/API/agent/microapps are thin adapters.
No adapter owns semantics.

### What worked well (figlet migration)

- **Scaffold → edit → typecheck is clean.** `scripts/scaffold-microapp.sh` produces
  a runnable skeleton in seconds. The microapp.json manifest + SDK imports are the
  right authoring surface.
- **SDK already exports most figlet utilities.** `renderFiglet`, `measureFiglet`,
  `responsiveFiglet` were already in `microapp-sdk.ts`. Only had to add 4 more
  exports (`getFigletCatalogue`, `getFigletFontChoices`, `getDefaultFigletFont`,
  `getFigletWindowContentSize`).
- **Backward compat shim pattern is straightforward.** Keep the old command IDs
  (`figlet.open`, `figlet.fonts`) in the catalog with actionKey handlers that
  delegate to `commands.runDynamic("microapp.wibwob.figlet.open", args)`. Same
  pattern as sy2-chronicles. Zero breaking change for API callers.
- **Snapshot restore works through command dispatch.** The `openFigletWindow` action
  in snapshot-registry now calls `runDynamic` instead of the deleted private method.
  Workspace save/restore still works.

### SDK gaps discovered

1. **`host.pickFromList()` missing.** The host exposes `pickFile()`, `promptValue()`,
   `flash()` but no generic list picker. Old code used `OverlayManager.openListPrompt()`
   (host-internal). Microapp had to build an inline blessed list. Every microapp
   needing a picker will hit this. Should be a shared SDK method.

2. **`host.windows.resizeToContent(id, {width, height})` missing.** Old code used
   `applyMeasuredWindowSize()` which knows about chrome modes. Microapp has to
   manually add chrome padding (+4w, +6h). Fragile if chrome changes.

3. **Manifest `requires` field missing.** Old catalog entry had `requires: ["bin.figlet"]`.
   Microapp manifests can't declare binary dependencies. The figlet-service handles
   fallback gracefully, but the gap is real.

4. **Misplaced code discovered.** `openBrowserReaderWindow()` lived in
   `figlet-windows.ts` despite being a browser reader function. Relocated to
   `browser-windows.ts` during migration. Lesson: old window files often contain
   misplaced functions — check all exports before deleting.

### Ideas for making future COAT migrations easier

- [ ] **`bun run check:coat`** — single script that runs import boundary lint
  (microapps must not import from `src/core/*` except via SDK), orphan actionKey
  check, manifest completeness check. Would catch COAT violations at typecheck time.

- [ ] **`host.pickFromList(title, choices, opts)` SDK method** — generic list picker
  so microapps don't reinvent pickers. Would make font pickers, file pickers,
  theme pickers all use the same shared overlay seam.

- [ ] **Migration scaffold script** — `scripts/migrate-window-to-microapp.sh <window-file>`
  that: reads the existing command catalog entries for that file, scaffolds the
  microapp, generates backward compat shims, and prints the manual steps remaining.
  Would halve the migration time per built-in.

- [ ] **Command ID aliasing** — instead of keeping shim entries in the catalog forever,
  add an `aliases` field to `microapp.json` so `figlet.open` resolves directly to
  `microapp.wibwob.figlet.open` in the command registry. Cleaner than permanent shims.

- [ ] **Consolidate `bun run` scripts** — currently too many separate scripts. One
  `bun run check` that runs typecheck + COAT checks + theme checks. Single gate for
  all verification.

### Migration map

Full classification and recommended order at
`X-CODEX-REFACTOR/host-to-microapp-migration-map.md`. 12 candidates, 4 non-candidates,
~20 already-microapps. Simplest first: figlet → contour → plasma → generative →
monster-cam → terrain-lab → text → backrooms → music → browser → chrome-browser.

### COAT enforcement notes

Running scratchpad at `.planning/refactor-docs/030-coat-enforcement-notes.md`.
Categories: deterministic code checks, bun scripts, agent skills, AI inference checks.
Updated with figlet observations.

### Migration boundary: where COAT stops being mechanical

4 simple migrations completed mechanically (figlet, contour, plasma, generative-art).
But text-windows.ts and browser-windows.ts hit a wall:

**text-windows.ts** is coupled to `EditorCoordinator` (247 lines in `src/core/`),
`WindowRecord.editor` (a special mutable property on the frame), and `frame.filePath`.
The editor widget lifecycle is managed by the coordinator, not by the window itself.
This can't be naively ported to SDK — the coordinator would need to become an SDK
service, or the editor would need its own host-level abstraction.

**browser-windows.ts** is a 2082-line god-file containing primer browser, primer
gallery, file manager, and text viewer factory all mixed together. Each function
takes different deps, shares internal helpers, and uses host-internal APIs
(WindowManager.createFrame, OverlayManager, ContentService). Decomposition is
a prerequisite — you can't migrate a function that shares 400 lines of helper
code with three other functions in the same file.

**Lesson:** COAT migration works great for self-contained surfaces (one file,
one function, clear boundary). For surfaces that are deeply woven into host
internals, migration requires upstream refactoring first. This isn't a failure —
it's the correct boundary recognition.

**What makes a surface COAT-migratable:**
- Single entry-point function with clear deps
- No shared mutable state with other surfaces
- No special WindowRecord properties (editor, filePath)
- No direct WindowManager/OverlayManager coupling beyond what SDK provides
- Self-contained rendering and keyboard handling

**What blocks migration:**
- EditorCoordinator pattern (shared editor lifecycle management)
- God-file shared helpers (primer browser + file manager in one file)
- WindowRecord mutations that the SDK doesn't surface
- Overlay flows that microapps can't drive (list prompts, file pickers with preview)

---

## 2026-03-14: Ghostty custom shaders — conditional GPU effects for WibWob-DOS

### What got built

GPU shader pipeline that applies CRT/glow/starfield effects to the Ghostty terminal
when WibWob-DOS is running. Three custom shaders + one community shader, scriptable
toggle, AppleScript reload, app lifecycle integration.

### Architecture

```
shaders/wibwob-glow.glsl         ← phosphor bloom, grain, moiré, scanlines, corner vignette
shaders/wibwob-crt.glsl          ← full CRT: barrel curvature, chromatic aberration, heavy scanlines
shaders/wibwob-nord-tint.glsl    ← cool blue color grade for Nord theme
shaders/starfield-og.glsl        ← community starfield (from 0xhckr/ghostty-shaders)
scripts/ghostty-shader.sh        ← on/off/list/status/install toggle script
~/.config/ghostty/shaders/shader.glsl  ← active shader (single-file swap target)
```

Ghostty config points at `~/.config/ghostty/shaders/shader.glsl`. Swapping shaders
= copying a different `.glsl` file to that path + `Cmd+Shift+,` to reload.

### App lifecycle hook (src/app.ts)

```typescript
const ghosttyShader = process.env.WIBWOB_GHOSTTY_SHADER;
const isGhostty = (process.env.TERM_PROGRAM || "").toLowerCase().includes("ghostty")
  || !!process.env.GHOSTTY_RESOURCES_DIR
  || process.env.WIBWOB_GHOSTTY_FORCE === "1";
```

On start: copies the named shader to the active path. On exit (SIGTERM/SIGINT):
removes the file. Ghostty's `?` prefix on `config-file` means missing file = no
shader = clean.

### Gotchas and lessons learned

**1. `config-file` indirection didn't work reliably.**
Initial design used `config-file = ?/path/to/scratch/.ghostty-shaders` in the main
Ghostty config to conditionally include shader settings. This worked for
`+show-config` but the actual Ghostty renderer didn't always pick up changes to the
included file. Fix: hardcode `custom-shader = ~/.config/ghostty/shaders/shader.glsl`
directly in the main Ghostty config. Swap the file content, not the config reference.

**2. Shader compilation errors are completely silent.**
If a `.glsl` file has a syntax error (e.g. renamed const vars but code still
references old names), Ghostty silently ignores the shader. No error in logs, no
warning, no visual indicator. The terminal just renders without the effect. The only
signal is "nothing happened." Diagnosis: check the GLSL code manually. Ghostty has
no shader compilation error reporting surface.

**3. Renamed consts broke the shader silently.**
Renamed `BLOOM_RADIUS` → `GLOW_SPREAD` etc. for readability, but forgot to update
the function body references. Shader failed to compile → Ghostty silently dropped it
→ "no theme visible." Lesson: GLSL has no IDE — rename with extreme care, grep for
every old name.

**4. `TERM_PROGRAM` is unreliable for Ghostty detection.**
Running WibWob-DOS from Zed's integrated terminal sets `TERM_PROGRAM=zed`, not
`ghostty`. Running from tmux sets `TERM_PROGRAM=tmux`. Ghostty sets
`GHOSTTY_RESOURCES_DIR` but Zed strips it from child environments. Fix: added
`WIBWOB_GHOSTTY_FORCE=1` env var for explicit opt-in when auto-detection fails.

**5. Hot reload works for config changes, NOT for same-path shader edits.**
`Cmd+Shift+,` re-reads the config file and picks up new `custom-shader` paths. But
if the path hasn't changed and only the file content changed, Ghostty uses its
compiled shader cache. Fix: copy to a new filename to force recompilation, or
restart Ghostty entirely.

**6. First shader load requires Ghostty restart.**
Adding `custom-shader` to a config that previously had none requires a full Ghostty
quit + reopen. Hot reload (`Cmd+Shift+,`) doesn't initialize the shader pipeline
from scratch — it only updates an already-initialized pipeline.

**7. AppleScript `perform action` didn't trigger reload.**
Ghostty's sdef exposes `perform action "reload_config" on terminal`, and it returns
`true`, but the config didn't actually reload. The `System Events` keystroke approach
(`keystroke "," using {command down, shift down}`) works reliably. May be a permissions
issue — Automation privacy settings need explicit grant per controlling app.

**8. Shaders pause on focus loss.**
`custom-shader-animation = true` only animates when the terminal is focused. Losing
focus pauses `iTime` progression. This is actually good for WibWob-DOS — saves GPU
when the terminal is backgrounded. Can be overridden with `custom-shader-animation = always`
but costs more CPU.

**9. Multiple `custom-shader` lines chain.**
Ghostty supports stacking shaders — each reads the previous shader's output via
`iChannel0`. Order matters: `glow` then `starfield` = stars appear on glowed text.
`starfield` then `glow` = stars get bloomed too.

**10. Ghostty-specific shader uniforms are powerful.**
Beyond standard ShaderToy uniforms (`iResolution`, `iTime`, `iChannel0`), Ghostty
provides: `iPalette[256]` (full terminal palette), `iFocus` (focus state),
`iTimeFocus` (time since focus change), `iCurrentCursor` (cursor position/size),
`iBackgroundColor`/`iForegroundColor`. These enable theme-aware shaders that adapt
to the terminal's color scheme.

### Shader tuning workflow

The fastest iteration loop:
1. Edit `~/.config/ghostty/shaders/shader.glsl` directly (or edit in repo, then `cp`)
2. Quit and reopen Ghostty (hot reload doesn't catch same-path edits)
3. Or: copy to a new filename, update config, `Cmd+Shift+,`

For quick A/B comparison:
```bash
cp shaders/wibwob-glow.glsl ~/.config/ghostty/shaders/shader.glsl  # swap
# Cmd+Shift+, in Ghostty (only works if filename changed or first load)
```

### Shader const naming convention

Use human-readable names — these are the tuning knobs:
```glsl
const float GLOW_SPREAD        = 3.0;    // how far bloom bleeds in pixels
const float GLOW_INTENSITY     = 0.45;   // how bright the glow is
const float SCANLINE_DARKNESS  = 0.156;  // how dark the horizontal lines are
const float COLOR_FRINGING     = 1.04;   // RGB split / chromatic aberration in px
const float FILM_GRAIN         = 0.06;   // static fuzz / noise
const float MOIRE_PATTERN      = 0.12;   // diagonal interference shimmer
const float CORNER_DARKNESS    = 0.18;   // how dark the corners get
```

### Community shader: starfield performance tuning

The `0xhckr/ghostty-shaders` starfield uses 21 layers × 30 grid divisions = expensive.
For daily use: `layers = 7`, `repeats = 10` cuts GPU work ~90%. Also clamped
`sparkle = min(sparkle, 0.15)` so stars don't balloon when "close to camera."
Added `STAR_SPEED = 0.3` for slower Win95-screensaver drift.

### Files

| File | Purpose |
|------|---------|
| `shaders/wibwob-glow.glsl` | Phosphor bloom + grain + moiré + scanlines + vignette |
| `shaders/wibwob-crt.glsl` | Full retro CRT barrel distortion effect |
| `shaders/wibwob-nord-tint.glsl` | Cool blue color grade for Nord palette |
| `shaders/starfield-og.glsl` | Community starfield (original 21-layer version) |
| `shaders/starfield-lite.glsl` | Performance-tuned starfield (7 layers, smaller stars) |
| `shaders/ghostty-test-crt.glsl` | Ghostty's own test CRT (used for pipeline validation) |
| `scripts/ghostty-shader.sh` | Toggle script: on/off/list/status/install |
| `src/app.ts` | Lifecycle hooks: activate on start, deactivate on exit |
| `~/.wibwob` | Shell aliases: `ww-shader on wibwob-glow` |

### Usage

```bash
# One-time Ghostty config setup
bash scripts/ghostty-shader.sh install

# Manual swap
cp shaders/wibwob-glow.glsl ~/.config/ghostty/shaders/shader.glsl
# Cmd+Shift+, in Ghostty (or restart if first load)

# Auto-activate on app start (add to shell profile)
export WIBWOB_GHOSTTY_SHADER="wibwob-glow"
export WIBWOB_GHOSTTY_FORCE="1"  # needed if running from Zed/tmux
bun run dev

# CLI alias (after sourcing ~/.wibwob)
ww-shader on wibwob-crt
ww-shader off
ww-shader list
ww-shader status
```
