---
status: in-progress
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

---

## Tier 1 — Critical decompositions

- [x] **#1** Create `src/core/arg-helpers.ts` — `typedArg`, `trimmedArg`, `enumArg`, `clampedArg`
- [x] **#2** Apply `typedArg` across `app-controller.ts` (49 guards → 1 remaining non-arg case), `control-api.ts` (12), `snapshot-registry.ts` (20+)
- [x] **#3** Replace `handleRequest()` 674-line if-chain with typed route table — `handleRequest` now 69 lines, 3 if-branches; `ENDPOINT_CATALOGUE` derived from routes
- [-] **#4** Decompose `file-manager-window.ts` — **parked**, see below

## Tier 2 — Deduplication & flattening

- [-] **#5** `forms.ts` — `createFormBase()` — **parked**, see below
- [x] **#6** `getSelectedIndex()` added to `src/ui/index.ts`
- [-] **#7** `overlay-manager.ts` — `createPromptModal()` — **parked**, see below
- [ ] **#8** `chrome-browser-service.ts` — decompose `navigate()` into extraction strategies
- [x] **#9** `terrain-render.ts` — 18 named constants, biome/surface/cliff glyph maps hoisted to module scope
- [x] **#10** `snapshot-registry.ts` — `typedArg`/`enumArg` applied throughout
- [x] **—** Replace `(list as List & { selected }).selected ?? 0` cast — 40+ instances across 6 files
- [x] **—** `file-manager-window.ts` — `extColor()` dedup (2 copies → 1)
- [x] **—** Strip cargo-cult `§N` comments from all modified files

## Tier 3 — Deferred (follow-up PR)

- [ ] **D1** `wibwob-agent-session.ts` — extract `SessionTranscript` class, split `initialize()`
- [ ] **D2** `command-catalog.ts` — extract IIFE into named fn, partition helper
- [ ] **D3** `music-player-window.ts` — move viz modes to separate module
- [ ] **D4** `composition-helpers.ts` — extract `createScrollbarConfig()`, `applyThemeStyle()`, rename `t`/`t2`

---

## Parked tasks

### #4 — file-manager-window.ts decomposition
**Why parked:** 1860 LOC but already well-structured with section markers (`// ── Icon helpers`, `// ── Frame + layout`, etc.). Extracting preview renderer, keymap, or data helpers would require passing 15+ closure variables or creating a context object. The extColor dedup was done; the rest adds complexity without reducing coupling.
**Resume trigger:** If the file grows past ~2200 LOC or a second contributor needs to work on it concurrently.

### #5 — forms.ts createFormBase()
**Why parked:** Each form component (button, checkbox, toggle, radio, select, filterable-list, slider, text-input) shares only ~10 lines of blessed.box boilerplate. A base function would need so many options/callbacks that it wouldn't simplify. The components are already isolated and self-contained.
**Resume trigger:** If a 9th form component is added and the boilerplate starts drifting between components.

### #7 — overlay-manager.ts createPromptModal()
**Why parked:** The modal patterns (value prompt, path prompt, list picker, browser, file browser) share the modal+input+buttons structure but differ substantially in input handling, preview logic, list management, and button layout. Extracting a common scaffold would create a mini-framework within the overlay manager — complexity without simplicity.
**Resume trigger:** If a new overlay type is added that is close enough to an existing one to justify shared scaffolding.

### #8 — chrome-browser-service.ts navigate() decomposition
**Why parked:** Needs deeper understanding of the extraction strategy pattern and the puppeteer/CDP lifecycle. Not blocked, just not prioritised in this pass.
**Resume trigger:** Next time someone touches the browser service.

---

## Evidence (verified at completion of route table refactor)

| Check | Result |
|-------|--------|
| `bun run typecheck` | zero errors ✅ |
| `bun run check-coat` | zero violations ✅ |
| Integration tests | 47 pass / 16 fail (all failures pre-existing) ✅ |
| `wibwob health` | instance running, screen renders ✅ |
| API smoke tests | /health, /state, /commands/run, /screenshot, /windows/*, /overlay/*, /workspace/* all verified ✅ |

## Related spikes

- [hono-migration-interrogation.md](../spikes/hono-migration-interrogation.md) — conclusion: kill the TODO
- [control-api-refactor-options.md](../spikes/control-api-refactor-options.md) — Option E (typed route table) chosen and implemented
