# Code Quality Refactor — src/

Plan produced using `/plan` prompt against the 30 principles in `CODE-STYLE.md`.

---

<phase-1-orient>

## Phase 1 · Orient

**Codebase:** 150 `.ts` files in `src/`, ~45k LOC across 13 subdirectories.
**Reference docs read:** PHILOSOPHY.md, ARCHITECTURE.md, CODE-STYLE.md (new).

**Simplest statement:** Apply CODE-STYLE.md principles to the largest, most friction-heavy files in `src/` — decompose god objects, extract duplicated patterns, flatten nesting, and name things after intent.

### Structural findings

```
src/ breakdown by LOC (non-test):
  core/       ~12,000  (51 files)   ← app-controller.ts alone = 2,525
  services/   ~12,700  (41 files)   ← control-api.ts = 1,230
  windows/    ~7,500   (20 files)   ← file-manager-window.ts = 1,859
  ui/         ~4,400   (10 files)   ← forms.ts = 1,172, containers.ts = 1,094
  sdk/        ~1,500   (4 files)    ← composition-helpers.ts = 1,045
  cli/        ~1,800   (3 files)
  rest        ~5,000
```

### Pain map — which CODE-STYLE principles are most violated

```
PRINCIPLE VIOLATION                         WORST FILES                                    SEVERITY
─────────────────────────────────────────────────────────────────────────────────────────────────────
P1  Composed Method (methods too large)     app-controller:getAppMenuActions (681 LOC)     CRITICAL
                                            control-api:handleRequest (680 LOC)
                                            chrome-browser:navigate (427 LOC)
                                            terrain-render:renderFirstPerson (429 LOC)
                                            file-manager-window (1,800 LOC single fn)

P5  Single Responsibility                   app-controller (37 deps, 47 methods)           CRITICAL
                                            control-api (all routes in one fn)

P6  Say Things Once (duplication)           forms.ts: 8 component factories dup style       HIGH
                                            app-controller: typeof guard ×45
                                            file-manager: ext→color map ×2
                                            overlay-manager: modal creation ×5
                                            snapshot-registry: payload validation ×6
                                            windows: (list as List & {selected}).selected ×10+

P9  Guard Clauses / deep nesting            control-api: 4+ indent levels                  HIGH
                                            file-manager: 5+ indent levels
                                            terrain-render: 4+ indent levels
                                            chrome-browser: 4+ indent levels

P10 Query/Command separation                control-api: queries & mutations mixed          MEDIUM
                                            wibwob-agent-session: initialize() 138 LOC

P19 Named Constants                         terrain-render: magic numbers throughout        MEDIUM
                                            contour-engine: inline thresholds
                                            music-player: animation timing literals

P2  Intention-Revealing Names               control-api: `body` reinterpreted 8× in scope  MEDIUM
                                            wibwob-agent-session: `senderInfo` is vague
                                            terrain-render: `invDepth`, `dNear`
```

</phase-1-orient>

---

<plan-draft>

## Phase 2 · Draft

### Tier 1 — Critical (god objects, massive methods)

**File:** `src/core/app-controller.ts` (2,525 LOC)
- **Change:** Extract `getAppMenuActions()` into a new `src/core/menu-actions.ts` module; split by domain (window-opening, file ops, theme, agent). Extract repeated `typeof args?.prop === "type" ? args.prop : fallback` into a `typedArg<T>(args, key, type): T | undefined` helper in `src/core/arg-helpers.ts`.
- **Why:** P1 Composed Method, P5 Single Responsibility, P6 DRY. The 681-line method is the single biggest readability and maintenance bottleneck.

**File:** `src/services/control-api.ts` (1,230 LOC)
- **Change:** Replace monolithic `handleRequest()` (680 LOC) with a route-handler map: each route becomes a named function. Extract route registration into a lightweight `RouteMap` type. Guard clauses at top of each handler.
- **Why:** P1, P5, P9. Hand-rolled if/else routing is unreadable at this scale.

**File:** `src/windows/file-manager-window.ts` (1,859 LOC)
- **Change:** Convert from single closure function to a class or set of composed functions. Extract: `updatePreview()` into phases, `sortEntries()` / `buildEntries()` into a data module, key handlers into a keymap object. Extract extension→color mapping to a constant.
- **Why:** P1, P15 Method Object. 1,800 lines in a single function is the worst single-function case.

### Tier 2 — High (duplication, nesting)

**File:** `src/ui/forms.ts` (1,172 LOC)
- **Change:** Extract shared form-component scaffold (style resolution, event wiring, error swallowing) into a `createFormBase()` factory. Each component calls the base then adds its specific rendering. Eliminate 8× duplicated `getStyle()` / event-listener patterns.
- **Why:** P6 DRY, P14 Composition. 8 factories with identical skeleton.

**File:** `src/core/overlay-manager.ts` (1,051 LOC)
- **Change:** Extract a `createPromptModal()` helper that encapsulates the modal→input→buttonBar→event pattern used in 5+ prompt methods. Each caller passes only what differs (label, validation, onSubmit).
- **Why:** P6, P16 Execute Around.

**File:** `src/services/chrome-browser-service.ts` (1,019 LOC)
- **Change:** Break `navigate()` (427 LOC) into extraction strategy functions: `extractViaReadability()`, `extractFallbackText()`, `extractRawText()`. Deduplicate noise-selector lists into a constant. Extract `htmlToMarkdown()` rule setup.
- **Why:** P1, P6, P13 Polymorphism (strategy extraction).

**File:** `src/services/terrain-render.ts` (685 LOC)
- **Change:** Break `renderFirstPerson()` (429 LOC) into `castRays()`, `renderSky()`, `renderObjects()`. Replace magic numbers with named constants. Collapse 3× duplicated color maps (COL_NEAR/MID/FAR) into a single `distancePalette` lookup.
- **Why:** P1, P6, P19 Named Constants.

**File:** `src/core/snapshot-registry.ts` (408 LOC)
- **Change:** Extract a generic `typedPayload(details, schema)` helper to replace repetitive `typeof payload.x === "string" ? payload.x : undefined` chains. Reduce 6+ duplicated validation blocks.
- **Why:** P6, P11 Explaining Variables.

### Tier 3 — Medium (naming, query/command, small wins)

**File:** `src/services/wibwob-agent-session.ts` (1,065 LOC)
- **Change:** Extract message/tool state into a `SessionTranscript` class. Split `initialize()` (138 LOC) into `resolveModel()`, `createTools()`, `startSession()`. Rename `senderInfo` → `routingMetadata`.
- **Why:** P5, P2, P15 Method Object.

**File:** `src/core/command-catalog.ts` (1,417 LOC)
- **Change:** Extract 65-line IIFE in `createMenuConfigs()` into a named `buildMenuItems()` function. Simplify favourite/rest filter duplication into a single partition helper.
- **Why:** P1, P6.

**File:** `src/windows/music-player-window.ts` (1,227 LOC)
- **Change:** Move visualization modes (`createRingsViz`, `createGridViz`, `createRainViz`, etc.) into a separate `src/windows/music-player/visualizations.ts` module. Extract magic timing constants.
- **Why:** P1, P19.

**Files:** multiple windows using `(list as List & { selected: number }).selected`
- **Change:** Create `getSelectedIndex(list): number` helper in `src/ui/index.ts`. Replace 10+ casts.
- **Why:** P6, P20 Encapsulate Fields.

### Blast radius

- **Modified files:** ~14
- **New files:** ~5 (menu-actions.ts, arg-helpers.ts, music-player/visualizations.ts, form-base helper, route-handler map)
- **Estimated lines changed:** ~3,000–4,000 (mostly moves/extractions, minimal new logic)
- **Net LOC change:** roughly neutral (extraction, not addition)

### Pre-existing bugs noticed

- `window-manager.ts` documents 4 blessed framework bugs (double-subtraction, double-input, click routing, scroll-jump) as comments — these are workarounds, not code-quality issues to refactor.
- `backrooms-windows.ts` attaches methods to DOM elements via `as unknown as Record<string, unknown>` (lines 266-279) — fragile bridge pattern worth addressing separately.

</plan-draft>

---

<review>

## Phase 3 · Review

| Lens | Assessment |
|------|-----------|
| **SCOPE** | Tier 3 items (wibwob-agent-session, command-catalog, music-player viz extraction) could be deferred to a follow-up without losing the main value. Cut them from Phase 1 execution. |
| **REUSE** | `typedArg()` helper is new but eliminates 45+ repetitions — justified. `createFormBase()` replaces 8 duplicated scaffolds — justified. `getSelectedIndex()` replaces 10+ casts — justified. No existing utility covers these. |
| **DELTA** | Can shrink by deferring Tier 3 (3 files). Core blast radius: ~11 files modified, ~4 new. |
| **NAMES** | `typedArg`, `createFormBase`, `getSelectedIndex`, `createPromptModal`, `castRays`, `renderSky` — all pass the 30-second test. `routeMap` for control-api is clear. |
| **GRAVITY** | `arg-helpers.ts` could attract unrelated utilities — keep it focused with a header comment. `menu-actions.ts` is specific to app-controller decomposition. |
| **SEQUENCE** | Safe order: helpers first (arg-helpers, form-base, getSelectedIndex) → consumers second. No circular deps. |
| **COAT** | All changes are internal refactors. No API surface change. COAT boundary untouched. |
| **COMPOSITION** | Every new module composes from existing patterns. No new SDK surface. No new primitives. |

### Adaptive lenses

- **Refactor → behavioral proof:** `bun run typecheck` must pass after each file. Integration tests (`src/tests/integration/`) must stay green. Visual verification via `wibwob health` after full pass.
- **3+ files touched → coupling:** Essential coupling — the helpers are consumed by the files being decomposed. No accidental coupling introduced.

### Adversarial self-review

- *What assumption might be wrong?* That `getAppMenuActions()` can be cleanly separated — the 37 private props it closes over may resist extraction. Mitigation: pass an explicit context object.
- *What does this plan not say?* It doesn't address the blessed type-safety issues (`as unknown as`) beyond `getSelectedIndex`. Those are framework friction, not code-quality debt.
- *Hidden cost?* Import graph changes in ~14 files create merge conflict risk with concurrent work. Mitigation: atomic PRs per tier.
- *If this fails in production?* Most likely cause: extraction changes a closure binding. Mitigation: typecheck + integration tests catch this.
- *Symptom or root cause?* Root cause — the files are too large because extraction was deferred. This plan pays that debt.
- *Skeptic says:* "Don't refactor everything at once — pick the 3 worst files." Fair — that's why tiers exist.

**Killed: 0 files · 0 abstractions · 0 LOC** (review found scope to defer, but nothing to kill from Tier 1-2)

### Auto-checks

| Trigger | Command | Status |
|---------|---------|--------|
| `.ts` files in scope | `bun run typecheck` | Run after each tier |
| `src/` files in scope | `bun run check-coat` | Run after each tier |
| Blast radius > 3 | Applied simplicity lens above | Done |

</review>

---

<review-delta>

## Review delta

- **Deferred to follow-up:** Tier 3 items (wibwob-agent-session, command-catalog, music-player visualizations) — reduces immediate blast radius from ~14 to ~11 files.
- **Added:** Explicit merge-conflict mitigation (atomic PRs per tier).
- **Renamed:** Nothing.
- Plan otherwise unchanged.

</review-delta>

---

<plan-final>

## Final Plan

### Tier 1 — Critical decompositions

| # | File | Change | Why (Principle) |
|---|------|--------|-----------------|
| 1 | `src/core/arg-helpers.ts` *(new)* | Create `typedArg<T>(args, key, type): T \| undefined` helper | P6 DRY — eliminates 45+ typeof guards |
| 2 | `src/core/app-controller.ts` | Extract `getAppMenuActions()` → `src/core/menu-actions.ts`; use `typedArg` throughout; pass explicit context object for closed-over deps | P1, P5, P15 |
| 3 | `src/services/control-api.ts` | Replace `handleRequest()` with route-handler map; each route = named function with guard clauses | P1, P5, P9 |
| 4 | `src/windows/file-manager-window.ts` | Split into class or composed fns; extract `updatePreview` phases, data helpers, keymap; extract ext→color constant | P1, P15, P6 |

### Tier 2 — Deduplication & flattening

| # | File | Change | Why (Principle) |
|---|------|--------|-----------------|
| 5 | `src/ui/forms.ts` | Extract `createFormBase()` scaffold; 8 factories compose on top | P6, P14 |
| 6 | `src/ui/index.ts` | Add `getSelectedIndex(list): number` helper | P6, P20 |
| 7 | `src/core/overlay-manager.ts` | Extract `createPromptModal()` for shared modal→input→buttons pattern | P6, P16 |
| 8 | `src/services/chrome-browser-service.ts` | Break `navigate()` into extraction strategies; deduplicate noise selectors | P1, P6, P13 |
| 9 | `src/services/terrain-render.ts` | Decompose `renderFirstPerson()` into `castRays()`, `renderSky()`, `renderObjects()`; named constants for magic numbers; collapse color map duplication | P1, P6, P19 |
| 10 | `src/core/snapshot-registry.ts` | Generic `typedPayload()` helper for payload validation | P6, P11 |

### Tier 3 — Deferred (follow-up PR)

| # | File | Change | Why |
|---|------|--------|-----|
| D1 | `src/services/wibwob-agent-session.ts` | Extract `SessionTranscript` class; split `initialize()` | P5, P15 |
| D2 | `src/core/command-catalog.ts` | Extract IIFE into named fn; partition helper | P1, P6 |
| D3 | `src/windows/music-player-window.ts` | Move viz modes to separate module | P1, P19 |
| D4 | `src/sdk/composition-helpers.ts` | Extract `createScrollbarConfig()`, `applyThemeStyle()` helpers; rename `t`/`t2` → `currentTheme`/`updatedTheme` | P6, P12 |

### Evidence

| Check | Command / Observation |
|-------|----------------------|
| Type safety | `bun run typecheck` — zero errors |
| COAT boundary | `bun run check-coat` — zero violations |
| Integration tests | `bun test src/tests/integration/` — all green |
| Visual sanity | `wibwob health` — instance running, screen renders |
| No behavior change | Each extracted function produces identical output for same inputs (structural refactor only) |

## Steps

### Phase A — Helpers (no existing code changes)
- [ ] Create `src/core/arg-helpers.ts` with `typedArg()` helper
- [ ] Add `getSelectedIndex()` to `src/ui/index.ts`
- [ ] Run `bun run typecheck`

### Phase B — Tier 1 decompositions (one file at a time)
- [ ] Extract `getAppMenuActions()` → `src/core/menu-actions.ts`; wire context object; apply `typedArg`
- [ ] Run `bun run typecheck` + `bun test src/tests/integration/command-registry.test.ts`
- [ ] Refactor `control-api.ts` `handleRequest()` into route-handler map
- [ ] Run `bun run typecheck` + integration tests
- [ ] Decompose `file-manager-window.ts` into class/composed fns
- [ ] Run `bun run typecheck` + `bun test src/tests/integration/`
- [ ] Visual verification: `wibwob health`, open file manager, switch theme

### Phase C — Tier 2 deduplication
- [ ] Extract `createFormBase()` in `src/ui/forms.ts`
- [ ] Extract `createPromptModal()` in overlay-manager
- [ ] Decompose `chrome-browser-service.ts` `navigate()`
- [ ] Decompose `terrain-render.ts` `renderFirstPerson()`
- [ ] Extract `typedPayload()` in snapshot-registry
- [ ] Replace `(list as List & { selected }).selected` casts with `getSelectedIndex()` across windows
- [ ] Run `bun run typecheck` + `bun run check-coat` + full integration suite
- [ ] Visual verification: theme switch, file manager, terrain render

</plan-final>

---

## Phase 4 · One level up

**[Phase 4 — optional]**

The single addition that would elevate this: a **lint rule or pre-commit check for max function length** (e.g., 100 LOC). Without it, the refactored files will re-accumulate debt. A simple `grep -c` in a pre-commit hook counting lines between function boundaries would be cheap and prevent regression. This doesn't need to be part of the refactor itself — it's a follow-up after the dust settles.

---

## Appendix — SDK, Domain, Application Assessment

Explored after the main plan was written. These areas are in **good shape** and don't need Tier 1/2 attention.

### `src/sdk/composition-helpers.ts` (1,045 LOC) — Tier 3 candidate

| Issue | Principle | Detail |
|-------|-----------|--------|
| Scrollbar config duplicated 4× | P6 DRY | Lines 198–202, 247–251, 372–376, 699–703 — extract `createScrollbarConfig()` |
| Theme-switching pattern repeated 22× | P6 DRY | `const t2 = theme(); el.style.fg = t2.body.fg; ...` — extract `applyThemeStyle(el, tokens)` |
| Unclear variable names `t` / `t2` | P12 Role-Suggesting Names | Rename to `currentTheme` / `updatedTheme` |

### `src/application/` (580 LOC total) — Clean, minor items

- `runtime-workspace-service.ts`: error message pattern duplicated 3×; double-negation defaults (`!== false`).
- `runtime-window-service.ts`: `OPEN_COMMANDS` map has silent fallback on unknown types; no arg validation per command.
- `rate-limit-service.ts`, `runtime-command-service.ts`: well-designed, no action needed.
- `runtime-inspection-service.ts`: 18-line passthrough; consider inlining.

### `src/domain/` (182 LOC) — Clean

- `runtime-inspection.ts`: string-based `status` field could be an enum (minor).
- No structural issues.

### `src/adapters/` — Empty directory (README only)
