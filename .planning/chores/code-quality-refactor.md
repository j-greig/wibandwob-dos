---
status: done
branch: claude/plan-refactor-code-quality-uLyOn
started: 2026-03-25
---

# Code Quality Refactor — src/

Systematic application of CODE-STYLE.md principles across the TypeScript source.
Branch: `claude/plan-refactor-code-quality-uLyOn`

## Commits

- `5de26fa0` — `typedArg`/`getSelectedIndex` helpers, 75+ typeof guards eliminated
- `3f62ae3d` — named constants extracted from terrain first-person renderer
- `a4433441` — `getSelectedIndex` applied to overlay-manager (9 casts)
- `db330195` — `extColor()` helper in file-manager, dedup ext→color map
- `53361aeb` — spike: adversarial interrogation of Hono migration TODO
- `323c3694` — spike: five refactor options for control-api dispatch
- `bade99f0` — route table replaces 674-line if-chain in control-api
- `2bafecd4` — strip cargo-cult section-number comments
- `8a856bb2` — expand CODE-STYLE.md with WibWob-DOS tuning
- `2f5dad21` — remove superseded scratch plan
- `a029738f` — SDK: extract scrollbarConfig(), rename t2 → current
- `c8f540ad` — chrome-browser-service: decompose navigate() into pipeline stages
- `f41ad9e2` — wire focus/close/maximize through command registry
- `2c50fb73` — extract viz modes from music-player to separate module
- `74328267` — extract IIFE in command-catalog into named menu builders
- `b3e5930e` — split wibwob-agent-session initialize() into named phases

---

## Tier 1 — Critical decompositions

- [x] **#1** Create `src/core/arg-helpers.ts` — `typedArg`, `trimmedArg`, `enumArg`, `clampedArg`
- [x] **#2** Apply `typedArg` across `app-controller.ts` (49 guards → 1), `control-api.ts` (12), `snapshot-registry.ts` (20+)
- [x] **#3** Replace `handleRequest()` 674-line if-chain with typed route table — `handleRequest` now 69 lines, 3 if-branches; `ENDPOINT_CATALOGUE` derived from routes
- [-] **#4** Decompose `file-manager-window.ts` — **parked**, see below

## Tier 2 — Deduplication & flattening

- [-] **#5** `forms.ts` — `createFormBase()` — **parked**, see below
- [x] **#6** `getSelectedIndex()` added to `src/ui/index.ts`
- [-] **#7** `overlay-manager.ts` — `createPromptModal()` — **parked**, see below
- [x] **#8** `chrome-browser-service.ts` — decompose `navigate()` into 5 named pipeline stages (441 → 296 lines)
- [x] **#9** `terrain-render.ts` — 18 named constants, biome/surface/cliff glyph maps hoisted to module scope
- [x] **#10** `snapshot-registry.ts` — `typedArg`/`enumArg` applied throughout
- [x] **—** Replace `(list as List & { selected }).selected ?? 0` cast — 40+ instances across 6 files
- [x] **—** `file-manager-window.ts` — `extColor()` dedup (2 copies → 1)
- [x] **—** Strip cargo-cult `§N` comments from all modified files

## Tier 3 — Deferred (follow-up PR)

- [x] **D1** `wibwob-agent-session.ts` — split `initialize()` into `assembleTools()` + `startSessionControlServer()`
- [x] **D2** `command-catalog.ts` — extract IIFE into `buildStandardMenuItems()` + `buildApplicationsMenuItems()`
- [x] **D3** `music-player-window.ts` — viz modes extracted to `music-player-viz.ts` (1227 → 848 LOC)
- [x] **D4** `composition-helpers.ts` — `scrollbarConfig()` extracted (4× dedup), `t2` → `current` (10 renames)

## COAT alignment — command registry expansion

- [x] **C1** `window.focus` — action now returns `{ ok: false }` on missing window; route wired through `commandId`
- [x] **C2** `window.close` — same
- [x] **C3** `window.toggle_maximize` — action accepts `id` arg; route wired through `commandId`
- [-] **C4** `/windows/editor/write` — kept as direct deps call; `writeEditorText` (set content) ≠ `editor.write` (type text)
- [-] **C5** `/windows/input`, `/windows/agent-message` — no matching command with equivalent semantics
- [-] **C6** `/workspace/save`, `/workspace/load` — command actions return void; deps service returns result object; shape mismatch
- [-] **C7** GET inspection routes (`/state`, `/skin`, `/scramble/*`, etc.) — read-only queries, fine as direct deps

---

## Parked tasks

### #4 — file-manager-window.ts decomposition
**Why parked:** 1860 LOC but well-structured with section markers. Extracting phases needs 15+ closure vars.
**Resume trigger:** File grows past ~2200 LOC or gets concurrent contributors.

### #5 — forms.ts createFormBase()
**Why parked:** ~10 lines of shared boilerplate per component. Abstraction would be as complex as the pattern.
**Resume trigger:** 9th form component added and boilerplate starts drifting.

### #7 — overlay-manager.ts createPromptModal()
**Why parked:** Modals differ substantially in input handling, preview logic, button layout.
**Resume trigger:** New overlay type close enough to justify shared scaffolding.

### C4/C5/C6 — remaining direct deps routes
**Why parked:** Semantic mismatches between the API endpoint contract and the command action contract. Forcing them through `commandId` would either change the API response shape (breaking callers) or require new commands that duplicate existing action logic. Better to fix when the commands themselves are redesigned to return typed results.
**Resume trigger:** Command registry redesign to support typed return values.

---

## Evidence (final verification)

| Check | Result |
|-------|--------|
| `bun run typecheck` | zero errors ✅ |
| `bun run check-coat` | zero violations ✅ |
| Integration tests | 45 pass / 18 fail (all failures pre-existing) ✅ |
| `wibwob health` | instance running, screen renders ✅ |
| API smoke: /windows/focus existing | `{ ok: true }` ✅ |
| API smoke: /windows/focus missing | `{ ok: false, error: "Window 999 not found" }` ✅ |
| API smoke: /windows/close | ✅ |
| API smoke: /windows/maximize | ✅ |
| API smoke: /windows/editor/write | ✅ (set content, not append) |
| API smoke: /commands/run, /screenshot, /overlay/* | ✅ |

## Related spikes

- [hono-migration-interrogation.md](../spikes/hono-migration-interrogation.md) — conclusion: [DONE!] kill the TODO
- [control-api-refactor-options.md](../spikes/control-api-refactor-options.md) — Option E (typed route table) chosen and implemented
