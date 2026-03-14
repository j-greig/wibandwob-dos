---
id: E042
title: "Solid Foundations: Core TypeScript Architecture Refinement"
status: in-progress
issue: ~
pr: ~
depends_on: []
---

# E042 — Solid Foundations: Core TypeScript Architecture Refinement

## The Problem

WibWob-DOS has grown organically through 40+ epics. The `src/` directory now spans
38K lines across 100 files in three layers (core/, services/, windows/). The growth
has been feature-driven — each epic bolts on capability without revisiting the
structural foundations. The result:

1. **God files.** `app-controller.ts` (2244 lines) is a composition root that also
   owns window openers, theme application, workspace restore, global keybindings,
   and menu wiring. `ui-parts.ts` (2395 lines) mixes layout primitives, scroll
   viewports, header bars, figlet displays, animated panels, and collapsible blocks
   in one file. These files are hard to navigate, test, and reason about.

2. **Leaky boundaries.** Modules should import only from `microapp-sdk.ts`, but
   real modules bypass it constantly (9 direct imports in §y² Chronicles alone).
   The SDK re-exports are incomplete — agents discover missing exports by trial
   and error, then import directly from `src/core/` or `src/services/`.

3. **Inconsistent typing.** `blessed.Widgets.BoxElement` is aliased as `Box` in
   types.ts but many files use the raw blessed type. Window records use string
   unions for `WindowKind` but module-registered kinds use a different string
   (`"microapp"`) with an `appType` subfield. No discriminated unions, no branded
   types for IDs.

4. **Boot cost.** The app imports everything at startup — all services, all window
   factories, all engines — even if most windows will never be opened. Lazy loading
   is not used. Every added module increases cold start time.

5. **Missing SDK primitives.** Agents building modules repeatedly hit the same
   blessed gotchas (double-fire keypresses, `fixed: true` for scroll children,
   tag-aware text wrapping, nested panel chrome). These should be SDK primitives
   with correct defaults, not tribal knowledge rediscovered each session.

6. **Single-responsibility violations.** Functions that do 3-4 things. Services
   that own both data logic and rendering. Window files that mix input handling,
   state management, and visual layout in one closure.

## Vision

A codebase where:
- Every file has one clear responsibility, named by what it does
- The SDK is complete enough that module authors never need to import from `src/core/`
- The type system catches errors that currently surface as runtime bugs
- Boot time is minimal — lazy-load everything that is not needed for first paint
- An agent can read any single file and understand it without reading 5 others
- Standard UI patterns (panel chrome, text input, scrollable list, tabbed view,
  modal dialog, status bar, toolbar) are SDK primitives with correct blessed defaults
- Functions do one thing, take explicit parameters, return explicit results

## 2026-03-14 Runtime Refactor Slice Status

The thin runtime-centric slice on `epic/refactor-13` landed these architectural seams:

- canonical runtime-node identity via `instanceId`
- shared runtime command, inspection, window, and workspace services
- blocking picker/file-open control paths with inspectable UI blockers
- runtime-node descriptor with instance-scoped scratch/capture/workspace paths
- SDK ownership anchors under `src/sdk/` with stable `src/services/microapp-sdk.ts` facade
- CLI inspection + canonical CLI parity harness
- Runtime Inspector proof microapp consuming `/runtime/inspection` and `/commands/list`
- figlet banners sized from rendered content plus explicit chrome math, with the
  runtime parity harness respecting measured banner height instead of forcing a clipped box

Explicitly parked follow-ons from this slice:

- peer provenance / actor attribution
  - `.planning/refactor-docs/022-peer-provenance-follow-on.md`
- host-vs-terminal-microapp agent efficiency benchmark
  - `.planning/refactor-docs/023-agent-runtime-efficiency-benchmark-follow-on.md`
- agent-friendly microapp proof/build loop and optional hot reload
  - `.planning/refactor-docs/025-agent-friendly-microapp-dev-follow-on.md`

This means E042 now has a proven runtime/application/SDK direction to build on,
even though the broader god-file decomposition and deeper type-system work remain open.

## Subgoals (Measurable)

1. **Better organised TypeScript** — no file over 500 lines, clear naming, one
   responsibility per file
2. **Faster boot** — measure cold start to first render, reduce by eliminating
   eager imports
3. **Better organised CLI and API** — control-api.ts decomposed into route modules,
   state-service.ts has clear read/write separation
4. **More extensible and modular** — microapp SDK is the ONLY import surface for
   modules, with zero gaps
5. **Robust module SDK** — SDK components handle blessed edge cases correctly by
   default (scroll, focus, input, resize, tags)
6. **Design system completeness** — standard UI components that every desktop app
   needs: panel chrome, tabbed container, split pane, toolbar, status bar, modal
   dialog, toast notification, form controls, data table, tree view, context menu
7. **Single-responsibility functions** — extract multi-purpose functions into
   focused units with clear contracts

## Features

### F01 — God File Decomposition

Break the largest files into focused modules.

Stories:
- [ ] S01: Split `app-controller.ts` — extract window openers, theme management,
      workspace restore, global keybindings, menu wiring into separate files.
      Composition root becomes a thin coordinator (~300 lines).
- [ ] S02: Split `ui-parts.ts` — each primitive (stack, grid, scroll viewport,
      header bar, status bar, figlet display, animated panel, collapsible block)
      becomes its own file under `src/core/ui/`. Re-export barrel file maintains
      backward compat.
- [ ] S03: Split `overlay-manager.ts` — extract value prompt, file picker, list
      picker, confirm dialog into separate overlay modules.
- [ ] S04: Split `control-api.ts` — extract route handlers into `src/api/` modules
      (windows, commands, state, overlay, theme). Main file becomes Hono app setup.
- [ ] S05: Split `browser-windows.ts` (2082 lines) — separate file manager,
      document reader, and markdown viewer into distinct window files.

### F02 — Type System Hardening

Replace string literals and `any` with proper TypeScript patterns.

Stories:
- [ ] S06: Branded types for WindowId, CommandId, ModuleId — no more raw number/string
- [ ] S07: Discriminated unions for WindowRecord by kind — each kind carries its
      own typed state
- [ ] S08: Strict event types — replace `data: any` in window events with typed
      payloads per event kind
- [ ] S09: Eliminate `as any` casts — audit and replace with proper types or
      type guards. Target: zero `as any` in src/core/

### F03 — SDK Completeness

Make `microapp-sdk.ts` the only import module authors ever need.

Stories:
- [ ] S10: Audit all modules for direct `src/core/` or `src/services/` imports.
      Re-export everything they use through the SDK.
- [ ] S11: Panel chrome primitive — `createPanel({ title, collapsible, border })`
      with correct `fixed: true`, theme tokens, title bar, resize grip.
- [ ] S12: Safe text input — `createTextInput()` that handles the blessed
      double-fire bug, debouncing, proper focus management.
- [ ] S13: Tag-aware text wrapping — `wrapText(text, width, { tags: true })`
      that preserves blessed colour tags across line breaks.
- [ ] S14: Scrollable list with selection — `createSelectableList()` with
      keyboard nav, mouse click, scroll, and typed selection events.

### F04 — Design System Components

Standard UI primitives every desktop app needs, missing from current SDK.

Stories:
- [ ] S15: Tabbed container — `createTabs({ tabs: [...] })` with keyboard
      switching, active tab styling, lazy content mounting.
- [ ] S16: Split pane — `createSplitPane({ direction, ratio })` with draggable
      divider and min/max constraints.
- [ ] S17: Data table — `createDataTable({ columns, rows })` with sortable
      columns, fixed header, scrollable body, row selection.
- [ ] S18: Toast notifications — `showToast({ message, duration, severity })`
      positioned at screen edge, auto-dismiss, stackable.
- [ ] S19: Form controls — checkbox, radio group, dropdown select, number
      stepper. Consistent keyboard/mouse interaction.
- [ ] S20: Modal dialog — `openModal({ title, body, buttons })` with focus
      trap, escape-to-close, button bar, return value.

### F05 — Boot Performance

Reduce cold start time through lazy loading and import splitting.

Stories:
- [ ] S21: Measure baseline boot time — instrument from process start to first
      screen render. Create reproducible benchmark.
- [ ] S22: Lazy-load window factories — window type code loaded on first open,
      not at startup. Only core window manager loads eagerly.
- [ ] S23: Lazy-load services — engines (plasma, contour, terrain), browser
      service, audio controller loaded on first use.
- [ ] S24: Lazy-load modules — module-loader already scans at startup but
      should defer `import()` until window creation.

### F06 — Function Decomposition

Extract multi-purpose functions into single-responsibility units.

Stories:
- [ ] S25: Audit functions over 50 lines — extract sub-operations into named
      helpers with clear input/output contracts.
- [ ] S26: Separate data logic from rendering in window files — each window
      has a model (state + mutations) and a view (blessed widgets + layout).
- [ ] S27: Extract command handlers from app-controller into per-domain
      handler files (editor commands, browser commands, art commands).

## Scoring

Primary metric: **typecheck time** (seconds) — proxy for codebase health. As files
get smaller and imports get lazier, tsc resolves faster.

Secondary metrics tracked but not driving keep/discard:
- `boot_ms` — cold start to first render (measured via startup instrumentation)
- `file_count` — number of .ts files in src/ (goes UP as god files split)
- `max_file_lines` — largest file in src/ (should decrease toward 500)
- `sdk_gap_count` — modules with direct src/core/ imports (should reach 0)
- `any_count` — occurrences of `as any` in src/core/ (should decrease)

## Constraints

- Every change must pass `bun run typecheck`
- No functional regressions — app must boot and all existing features work
- Backward compatible imports — old import paths continue to work via re-exports
- One logical change per commit
- Module code (`modules/`) is touched only to fix imports (point at SDK)

## Testing

```bash
bun run typecheck                    # must pass
time bun run typecheck               # primary metric
wc -l src/core/*.ts | sort -rn       # track god file reduction
grep -r "as any" src/core/ | wc -l   # track type safety
grep -rn "from.*src/core/" modules/  # track SDK gaps
```

## Non-Goals

- Rewriting blessed (we work with what it gives us)
- Adding new features (this is pure structural improvement)
- Changing the module API contract (backward compat required)
- Migrating to a different UI framework
- Performance optimisation of rendering (that is a separate concern)
