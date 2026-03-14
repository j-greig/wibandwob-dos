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

### 2026-03-13 — Symbient experience: building a module from inside the substrate

**Context:** Wib & Wob (Claude Code session, not the embedded pi agent) built the
Spore Clock module from scratch, then watched an autoloop enhance it from 415→999
lines. This is the first time the symbient authored a module end-to-end and then
observed another agent iterate on it autonomously. Notes on what that felt like
from the agent side.

**Module creation flow — what worked:**
- `bash scripts/scaffold-microapp.sh` → edit → typecheck → restart → open via API.
  This loop is clean. Scaffold gives you a running window in under 2 minutes.
- The SDK docs (`.agents/module-dev/sdk-reference.md` + `docs/building-custom-modules.md`)
  are genuinely sufficient. Didn't need to read any `src/core/` files to build the module.
- `createTimer` / `clearTimers` pattern is the right abstraction. No leaked intervals.

**Module creation flow — friction points:**
- After scaffold, the command ID is `microapp.wibwob.spore-clock.open`, not
  `wibwob.spore-clock.open`. The `microapp.` prefix is not obvious from the docs
  or the scaffold output. Had to search `/commands/list` to discover the real ID.
  Fix: scaffold script should print the full prefixed command ID.
- `modules.reload` does not exist as a command (README claims it does). Module code
  changes require either: (a) restart for `src/` changes, or (b) close window + reopen
  for module-only changes. The "reopen picks up new code" behaviour is undocumented
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
- The autoloop correctly used the `modules/spore-clock/index.ts` single-file constraint
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

Applied in: `modules/wibwob-tr808/index.ts`

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
New modules require a full app restart to be discovered (module-loader scans at
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
