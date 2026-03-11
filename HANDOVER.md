# E033 HANDOVER — Mega Prompt for a Fresh Coding Instance

## TL;DR

Keep Blessed. Start with one real seam, not a grand rewrite. Best opening slices: S01 render seam, S05 API cleanup, or S08 stats surface. Retire cruft when safe. Protect state/API/theme/workspace parity. Verify visually, not just by JSON.

Handover note:

WWDOS live in tmux/API. Smoke passed: health, state, tmux text dump, 1-window crop, PNG capture. Artefacts in `scratch/captures/`. `/commands/list` returns `{ok,commands}` not bare array. Good first move: S01 or S08. Keep mixed-mode render coexistence.

## Parallel-safe second-agent lanes

Use this only if 2 agents are working at once. Goal: parallelise without file collisions.

Current note after S12 on a2:
- there is not a clean parallel-safe E033 implementation story left while a1 owns
  the active shell/runtime lane
- remaining meaningful stories are S08 and S09, and both now collide with
  app-controller / shell / runtime seams
- safe parallel work for a2 is prep-only planning or handover notes, not new
  runtime code, until that lane settles
- module audit follow-ons now exist as planning docs:
  - `.planning/epics/e033-blessed-architecture-calm/module-audit.md`
  - `.planning/epics/e033-blessed-architecture-calm/module-audit-shortlist.md`
  - `.planning/epics/e033-blessed-architecture-calm/module-audit-themes.md`

Core rule:
- Agent 1 takes ONE hotspot seam.
- Agent 2 takes a disjoint lane with different files.
- Avoid parallel edits to these hotspot files unless explicitly coordinated:
  - `src/core/app-controller.ts`
  - `src/core/window-manager.ts`
  - `src/core/editor-coordinator.ts`
  - `src/services/module-loader.ts`
  - `src/services/microapp-sdk.ts`
  - `src/services/control-api.ts`
  - `src/core/command-catalog.ts`
  - `src/core/command-registry.ts`
  - `src/core/render-monitor.ts`
  - `modules/touchlab-mvp/index.ts`
  - `modules/zine/index.ts`

Best parallel pairings:

1. If Agent 1 is doing S01 render seam
- Agent 2 can do S06 Unicode/cell audit + repro pack
- Safe files:
  - `src/core/grid-canvas.ts`
  - `src/core/ansi-utils.ts`
  - `src/services/content-measurement.ts`
  - primer test fixtures / notes / scratch captures
- Avoid touching:
  - `app-controller.ts`
  - `window-manager.ts`
  - `editor-coordinator.ts`

2. If Agent 1 is doing S01 render seam
- Agent 2 can do S05 API audit WRITEUP first, then tiny cleanup only if file ownership is clear
- Safe-first tasks:
  - endpoint inventory
  - canonical-vs-alias map
  - deprecation candidates list
  - update `.agents/specs/state-and-api.md`
- Code-touch caution:
  - `control-api.ts`, `command-registry.ts`, `command-catalog.ts` are fine only if Agent 1 is NOT also touching command/state flow

3. If Agent 1 is doing S03 module host contract
- Agent 2 can do S10 module-author docs draft in `docs/` + `modules/README.md`
- Safe pattern:
  - draft docs from current contract
  - mark TODOs where S03 may change semantics
  - final accuracy pass after S03 lands
- Avoid editing `microapp-sdk.ts` in parallel unless coordinated

4. If Agent 1 is doing S03 module host contract
- Agent 2 can do S07 smoke/benchmark scaffolding
- Safe files:
  - `scripts/`
  - `scratch/`
  - smoke markdown reports
  - capture helpers
- Defer final telemetry numbers until S08 / S01 settle

5. If Agent 1 is doing S08 stats surface
- Agent 2 can do S07 dense-scene scenario definition + evidence workflow
- Safe split:
  - Agent 1: `render-monitor.ts`, app wiring, stats UI
  - Agent 2: benchmark scene recipe, capture scripts, smoke checklist, artefact format
- Do NOT both edit `render-monitor.ts`

6. If Agent 1 is doing S04 composition-root extraction
- Agent 2 can do S06 Unicode or S10 docs
- Good because S04 is mostly `app-controller.ts` and collaborator extraction, while S06/S10 can stay elsewhere

7. If Agent 1 is doing S11 animated embedding
- Agent 2 can do S12 TouchDesigner-like design note / vocabulary doc ONLY
- Safe split:
  - Agent 1 changes code in SDK / animation / module embedding
  - Agent 2 writes the composition vocabulary, operator taxonomy, and TouchLab audit notes
- Do NOT let both agents edit `touchlab-mvp` or `zine` concurrently

8. If Agent 1 is doing terminal recursion / telemetry work inside S08
- Agent 2 can do terminal smoke artefacts and recursive run notes
- Safe files:
  - `scratch/`
  - smoke scripts
  - docs / HANDOVER / notes
- Caution:
  - avoid parallel edits to `modules/terminal/index.ts` or any PTY bridge files

Bad pairings — avoid:
- S01 + S04 if both need `app-controller.ts`
- S03 + S10 if both need `microapp-sdk.ts`
- S08 + S07 if both change `render-monitor.ts` or same stats UI surface
- S11 + S12 if both touch `touchlab-mvp` or `zine`
- any two agents editing `control-api.ts` / `command-catalog.ts` / `command-registry.ts` together

Best current 2-agent plan from this exact handover:
- Agent 1: S01 render seam in core (`app-controller.ts`, `window-manager.ts`, `editor-coordinator.ts`)
- Agent 2: S06 Unicode repro pack + helper work, including known-bad primer fixtures and notes

Backup 2-agent plan:
- Agent 1: S08 stats surface
- Agent 2: S07 benchmark scene + smoke capture workflow + artefact scripts

## Current smoke state

- tmux session live: `wibwob`
- API health passed: `http://127.0.0.1:8099/health`
- state passed: `http://127.0.0.1:8099/state`
- artefacts:
  - `scratch/captures/e033-tmux-screen.txt`
  - `scratch/captures/e033-window-1.txt`
  - `scratch/captures/e033-tui.png`
- scratch checklist/report:
  - `scratch/e033-smoke-2026-03-11.md`
- useful gotcha:
  - `/commands/list` returns envelope `{ok, commands}`

You are entering the WibWob-DOS repository in a fresh context window to begin implementation work on E033.

Repository root for this worktree:

`/Users/james/Repos/wibandwob-dos-e033-blessed-architecture-calm`

Branch:

`epic/e033-blessed-architecture-calm`

Your job is NOT to migrate the app away from Blessed.
Your job is to make the existing Blessed codebase calmer, more explicit, more modular, more testable, more agent-legible, and more performance-aware.

The key idea is:

Bring Elm-style discipline to a Blessed TypeScript app WITHOUT pretending Blessed itself is Elm.

That means:
- explicit local state
- clearer event / message flow
- render as consequence of state change
- stronger lifecycle ownership
- thinner composition root
- better module author ergonomics
- stronger API and state parity
- better telemetry and evidence for visual / performance correctness

DO NOT waste time on framework migration proposals.

## First principles

WibWob-DOS is already structurally promising. It has the right nouns:
- command catalog
- command registry
- window manager
- state service
- control API
- workspace service
- module loader
- microapp SDK

The problem is that too many verbs are still ambient:
- too many direct `screen.render()` calls
- state sync depends on callers remembering to do it
- some windows still bundle local state, widget mutation, and side effects too tightly
- microapp lifecycle and redraw semantics are too implicit
- the control API likely has some fast-grown alias / legacy drift
- telemetry exists in fragments but is not yet a first-class operator tool

## Read first — mandatory

Project constitution and architecture:
- `AGENTS.md`
- `.agents/architecture.md`
- `.agents/invariants.md`
- `.agents/specs/state-and-api.md`
- `.agents/specs/window-system.md`
- `.agents/specs/agent-session.md`
- `.agents/specs/workspace.md`

Planning context:
- `.planning/epics/e033-blessed-architecture-calm/e033-brief.md`
- `.planning/spikes/spk-unblessed-upgrade/gpt54-agent-prompt.md`
- `.planning/spikes/spk-unblessed-upgrade/gpt54-agent-devlog.md`
- `.planning/spikes/spk-unblessed-upgrade/unblessed-compat-assessment.md`
- `.planning/spikes/spk-unblessed-upgrade/spike.md`

Key source files:
- `src/core/app-controller.ts`
- `src/core/window-manager.ts`
- `src/core/editor-coordinator.ts`
- `src/core/command-catalog.ts`
- `src/core/command-registry.ts`
- `src/services/state-service.ts`
- `src/services/control-api.ts`
- `src/services/module-loader.ts`
- `src/services/microapp-sdk.ts`
- `src/core/render-monitor.ts`
- `src/windows/monster-cam-window.ts`
- `src/windows/music-player-window.ts`
- `src/windows/generative-windows.ts`
- `src/windows/plasma-window.ts`
- `src/windows/terrain-lab-window.ts`
- `src/windows/contour-window.ts`
- `src/windows/wibwob-agent-window.ts`
- `modules/touchlab-mvp/index.ts`
- `modules/zine/index.ts`

Representative modules to understand the public authoring surface:
- `modules/hello-world/`
- `modules/world-chatroom/`
- `modules/sy2-chronicles/`
- `modules/glitchbox/`
- `modules/heartbeat/`
- `modules/patchbay-lab/`
- `modules/wibwob-poetry-clock/`
- `modules/touchlab-mvp/`
- `modules/zine/`

## Big decisions already made

1. Blessed stays.
2. unblessed is reference material, not the new canon runtime.
3. We ARE allowed to steal good ideas from unblessed:
   - stricter TS posture
   - clearer runtime seams
   - more explicit render ownership
   - better text/cell thinking
   - better test / telemetry posture
4. Backward-compat cruft should NOT be preserved by default. If a legacy command, alias route, or compatibility shim stays, it must be justified.
5. The work should improve both human and agent operation.
6. `modules/` and `modules-private/` are hero surfaces. Treat module authoring quality as product quality.

## Current epic shape

The E033 brief already contains the official story breakdown and recommended execution order. Do not improvise a new epic unless reality forces it.

Current recommended execution order:

Phase A — foundations and cleanup
- S01 render scheduler and invalidation seam
- S04 thin the composition root
- S05 API contract audit and cleanup
- S06 Unicode / cell correctness

Phase B — observability and proof
- S08 runtime telemetry / stats surface
- S07 dense-scene smoke and render evidence

Phase C — local architecture and module contract
- S02 local model/update/render pilot
- S03 microapp host lifecycle and redraw contract

Phase D — user-facing operability and authoring
- S09 macOS-like launcher / switcher
- S10 third-party developer docs for custom modules

Phase E — advanced composition
- S11 composable animated surfaces
- S12 TouchDesigner-like composition scaffolding

That said: work opportunistically if a smaller coherent slice can land cleanly, but update the brief if you materially change sequence logic.

## Highest-priority implementation instincts

If you are starting actual code work now, the most leverage-dense early lanes are:

A. S01 — explicit render scheduler / invalidation seam
B. S04 — thin a coherent chunk out of `app-controller.ts`
C. S05 — API cleanup with legacy alias retirement where safe
D. S08 — wire the existing render monitor into a real stats path

Do not try to land all of E033 in one go. Make one coherent slice real.

## What to look for specifically

### Render ownership

Direct `screen.render()` calls are spread across core and windows. The mission is NOT to remove every call at once. The mission is to create a named seam and start routing key owners through it.

Important: mixed mode is acceptable at first.
Converted paths may use the new seam while legacy windows continue to call `screen.render()` directly.
Do not create a flag day rewrite.

### Local TEA-ish windows

Monster Cam is the best first proving ground.
Reason:
- compact local state
- obvious service event vocabulary (`ready`, `error`, `frame`)
- side effects already isolated in `MonsterCamService`
- low coupling compared with Music Player

Target pattern for live windows when you refactor one:
- explicit local model type
- explicit local msg / event type
- update / state-transition function
- render / apply-to-widgets function

### Microapp host contract

`module-loader.ts` currently uses deferred registration with `setTimeout(ensureRegistered, 0)`.
DO NOT just delete that timer.
First understand and document what ordering guarantee it is protecting.
Then replace it only if the replacement preserves those guarantees.

There is a real SDK import anti-pattern. Some modules import directly from `src/core/*` instead of going through `microapp-sdk.ts`.
That is a real cleanup target.

### API cleanup

Treat the API with the same seriousness as the window architecture.
It likely contains alias routes and backward-compat paths that were fast-grown.
If you touch them:
- identify canonical paths
- identify aliases
- retire unjustified legacy cruft where safe
- keep `/help`, `/openapi.json`, real handler behaviour, command parity, and agent parity aligned

### Telemetry

`src/core/render-monitor.ts` already exists and is functional, but the shell does not wire it up.
This is a big clue: some of the telemetry work is already 80% built and 0% surfaced.
Likewise, Monster Cam’s FPS readout is service FPS, not shell render FPS.

### Unicode / cell correctness

Known troublesome primers to test:
- `modules-private/wibwob-primers/primers/cosmic-horror.txt`
  - known bug: dragging a primer window while this file is shown can corrupt render
- `modules-private/wibwob-primers/primers/graveyard-emoji-flow.txt`
- `modules-private/wibwob-primers/primers/conscious-matrix-1.txt`

Also test:
- narrow sidebar/list truncation
- ANSI-styled text width drift
- figlet or framed text around mixed-width chars
- whether `libncursesw` wide-character behaviour is useful reference material for debugging complex ASCII / Unicode rendering problems

### Animated surfaces inventory

These are important for regression and dense-scene smoke coverage.
Core windows / families:
- `src/windows/generative-windows.ts`
- `src/windows/plasma-window.ts`
- `src/windows/terrain-lab-window.ts`
- `src/windows/contour-window.ts`
- `src/windows/monster-cam-window.ts`
- `src/windows/music-player-window.ts`
- `src/windows/browser-windows.ts`
- `src/windows/backrooms-windows.ts`
- `src/windows/backrooms-log-browser-window.ts`

Animated or timer-driven modules:
- `modules/glitchbox/`
- `modules/heartbeat/`
- `modules/touchlab-mvp/`
- `modules/patchbay-lab/`
- `modules/wibwob-poetry-clock/`
- `modules/sy2-chronicles/`
- `modules/e026-demo/`
- `modules/zine/`

Minimum must-test anchors from the human’s explicit list:
- `modules/glitchbox/`
- `modules/heartbeat/`
- `src/windows/generative-windows.ts`
- `src/windows/plasma-window.ts`
- `src/windows/terrain-lab-window.ts`
- `src/windows/contour-window.ts`
- `src/windows/monster-cam-window.ts`

## TouchDesigner-like direction

`modules/touchlab-mvp/` is not a random toy. It already demonstrates:
- source generation
- mixing / compositing
- nested frames
- inspector state
- animation toggle
- patch-like mental model

E033 later stories should explore terminal-native composition primitives inspired by TouchDesigner, but keep scope honest.
Useful concepts:
- source
- transform
- mix
- output
- preview
- parameter
- reusable player / graph contract

Do NOT try to clone TouchDesigner feature-for-feature.

Important technical clue:
Blessed can manually route a `blessed.screen()` to arbitrary duplex streams.
This may be highly relevant to embeddable composition work.
Before inventing a complicated bespoke composition engine, investigate whether custom stream routing can help pipe one Blessed surface into another widget or composition container.

## WibWobTUI macOS-ification direction

There is now a planned story for a TUI-native launcher / switcher inspired by macOS.
Interpretation rules:
- do NOT make a fake pixel macOS clone
- DO make app launching and app switching faster
- use canonical command metadata and state, not a second registry
- support click/select to open if absent, focus if already running
- show running indicators or equivalent terminal-native cues

## Testing and verification posture

Minimum before committing code changes:
- `bun run typecheck`

Useful live checks:
- `curl -s http://127.0.0.1:8099/health`
- `curl -s http://127.0.0.1:8099/state | python3 -m json.tool`
- `curl -s http://127.0.0.1:8099/commands/list`
- `curl -s 'http://127.0.0.1:8099/screenshot/text?id=1'`

Visual verification is mandatory when UI changes.
If you change UI or live behaviour, make sure the human can inspect it in tmux.
Do not trust only JSON or typecheck output.

The app is currently live on port 8099 and basic smoke checks have already worked from a previous pass:
- typecheck passed
- `/health` passed
- `/state` passed
- `/commands/list` passed
- screenshot text endpoint passed

## Existing skills / ops guidance

Read if you need operating help:
- `.agents/skills/ww-ops/SKILL.md`
- `.agents/skills/ww-screenshot/SKILL.md`
- `.agents/skills/tui-smoke-test/SKILL.md`

Remember:
- this repo is TypeScript / Bun / Blessed
- not C++
- not cmake
- not a browser app

## Current branch / worktree reality

This worktree was created specifically for E033.
Worktree root:

`/Users/james/Repos/wibandwob-dos-e033-blessed-architecture-calm`

Branch:

`epic/e033-blessed-architecture-calm`

Before changing code, run:
- `git status`
- `bun run typecheck`

## Expectations for your first real implementation session

1. Re-read the E033 brief and select ONE story or one coherent subset.
2. Do not widen scope casually.
3. If touching lifecycle or state parity, check the relevant `.agents/specs/*` doc first.
4. Keep command/state/API parity intact.
5. Retire unjustified backward-compat cruft if you touch it and can prove it is safe to remove.
6. Verify visually if the desktop behaviour changes.
7. Update planning docs if you materially shift the story or learn something load-bearing.

## Recommended first slice if you want the safest high-leverage start

Option A:
- land S01 as a small explicit render seam with direct tests
- thread it into `WindowManager` and `EditorCoordinator`
- keep mixed mode for all other windows

Option B:
- land S05 API cleanup for canonical-vs-alias clarity
- remove unjustified backward-compat cruft where safe
- tighten docs and tests around `/help`, `/openapi.json`, commands, and state parity

Option C:
- land S08 by wiring `createRenderMonitor(screen)` into a dev-only or explicit stats surface
- show FPS, frame timing, RAM, and a minimal Wib/Wob agent health signal

These are all good openings. Choose the one with the cleanest proof boundary.

## Final reminder

Do not behave like this repo is a mess requiring reinvention.
Behave like it is a distinctive, already-working terminal desktop that now needs:
- better internal grammar
- more explicit ownership
- more composable module/runtime seams
- stronger operator evidence
- and cleaner extensibility for both humans and agents

The goal is not to make WibWob-DOS generic.
The goal is to make it calm enough internally that its weird surface can scale.
