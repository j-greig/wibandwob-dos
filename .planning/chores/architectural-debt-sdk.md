---
id: chore-architectural-debt-sdk
title: Architectural debt — SDK & host structural concerns
status: not-started
branch: chore/w13-reflections
---

# Architectural debt — SDK & host structural concerns

**This is a problem ledger, not a design doc.**
Each entry names a structural concern discovered during the March 2026 OpenTUI/WibWob
TUI audit (→ GitHub issue #137). No solutions are prescribed here. Tasks stay at the
"investigate / define AC" level until a concern is promoted to its own epic or spike.

Concerns are ranked by: (frequency of impact × severity × blast radius when it bites).

---

## DUAL_API — Two incompatible component APIs, no migration path

**Rank: 1 — hits every microapp author, silent failure, most GOTCHAS.md entries**

`src/sdk/composition-helpers.ts` exports `createStatusBar`, `createTextViewer`,
`createListPanel`, `createSplitView`, `createCanvas`, `createTabs`, etc., returning
`{ element, update, destroy }`.

`src/ui/` exports the LayoutPart API returning `{ node, layout(), update(), restyle(), destroy() }`.

These two shapes are structurally incompatible. Passing a CompositionHelper handle to
`createStack` produces no type error but renders a blank window. GOTCHAS.md has a dedicated
entry. There is no bridge, no official deprecation timeline, and no migration guide.

**Affected surface:** `src/sdk/composition-helpers.ts` · `src/ui/` · `src/services/microapp-sdk.ts`

**Tasks:**
- [ ] Audit every `createStack`/`createRow`/`createGrid` callsite — count how many mix the two APIs
- [ ] Define the convergence direction: deprecate CompositionHelpers, or add `.asPart()` bridge?
- [ ] Write AC and promote to spike or epic

---

## FOCUS_MODEL — No keyboard focus model

**Rank: 2 — blocks making any multi-component window keyboard-navigable**

There is no tab order, no focus ring, no mechanism to keyboard-navigate between
components. Focus is entirely manual per-window: callers call `.focus()` on specific
blessed nodes. `blessed.textarea` is fully modal (eats all keys). `host.promptValue`
doesn't restore focus on dismiss. Components such as `createButton`, `createCheckbox`,
`createSelect`, `createRadioGroup` exist but there is no way to wire them into a
coherent keyboard-navigable form without writing custom focus routing per-window.

GOTCHAS.md has five separate focus-related entries.

**Affected surface:** `src/core/window-chrome.ts` · `src/core/window-manager.ts` · `src/ui/forms.ts` · `src/sdk/`

**Tasks:**
- [ ] Define minimal tab-order contract: what does "focusable" mean at the SDK level?
- [ ] Identify which components need to participate (buttons, inputs, checkboxes, selects)
- [ ] Write AC and promote to spike or epic

---

## RENDER_DISCIPLINE — Render loop is per-window folklore, not infrastructure

**Rank: 3 — perf ceiling, CPU saturation at scale, silent degradation**

`createAnimationClock` starts immediately and saturates CPU at >8fps (87% CPU observed,
HTTP API stops responding). Raw `screen.render()` is called directly from ~30+ windows,
bypassing `RenderScheduler` entirely. There is no frame budget, no dirty-flag coalescing
at the component level. The scheduler exists in `src/core/render-scheduler.ts` but is
opt-in — most code predates it. The 8fps ceiling and `clock.pause()` workaround are
documented in GOTCHAS.md as folklore rather than enforced by infrastructure.

**Affected surface:** `src/core/render-scheduler.ts` · `src/services/animation-service.ts` · `src/sdk/microapp-host.ts`

**Tasks:**
- [ ] Audit: count raw `screen.render()` calls outside the scheduler
- [ ] Define what "render discipline" means at the SDK level — should hosts gate `screen.render()`?
- [ ] Write AC and promote to spike or epic

---

## ERROR_ISOLATION — No error isolation between microapps

**Rank: 4 — catastrophic when it bites; causes workspace restore boot loops**

If a microapp throws in its tick or render function, it crashes the whole process. There
is no error boundary, no per-microapp try/catch at the host level, no mechanism to show a
broken-state placeholder instead of dying. The workspace restore boot-loop (GOTCHAS.md) is
a direct symptom: a crashing microapp is saved in workspace, every restore re-triggers the
crash, the only fix is deleting `scratch/workspace.json`.

**Affected surface:** `src/core/app-controller.ts` · `src/services/microapp-loader.ts` · `src/sdk/microapp-host.ts`

**Tasks:**
- [ ] Define the isolation boundary: per-microapp try/catch in the host tick, or process isolation?
- [ ] Define the broken-state UX: placeholder window vs silent close vs error toast?
- [ ] Ensure workspace restore skips crashed microapps rather than retrying
- [ ] Write AC and promote to spike or epic

---

## CANVAS_SPLIT — grid-canvas and LayoutPart are two rendering engines with no bridge

**Rank: 5 — limits composability of ZINE/canvas content in layout trees**

The ZINE/canvas system (`src/core/grid-canvas.ts`, `src/core/canvas-types.ts`,
`src/services/canvas-document.ts`) is a pixel-grid renderer that lives entirely outside
the LayoutPart tree. A canvas tile cannot be used as a `LayoutPart` child — it cannot
participate in `createStack`, `createRow`, or `createGrid` layout. The two systems sit
beside each other with no interop layer, constraining any window that wants to mix
standard UI components with canvas-rendered content.

**Affected surface:** `src/core/grid-canvas.ts` · `src/ui/` layout engine · `src/sdk/`

**Tasks:**
- [ ] Define minimum viable bridge: a `createCanvasPart(canvas, opts)` that wraps a canvas
      region as a `LayoutPart` without reimplementing the canvas engine
- [ ] Identify whether the ZineLayout system already has a natural rect boundary to bind to
- [ ] Write AC and promote to spike or epic

---

## See also

- GitHub issue #137 — TUI audit: WibWob-DOS vs OpenTUI (brainfart capture, graduated here)
- `GOTCHAS.md` — runtime failure entries, many tracing back to concerns above
- `src/services/microapp-sdk.ts` — the stability boundary these concerns sit against
