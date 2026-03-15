# Standing Notes

Rolling scratchpad for living observations and follow-on ideas.
Prune items as they land in code or get dropped.
Not weekly — these persist until resolved.

---

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

