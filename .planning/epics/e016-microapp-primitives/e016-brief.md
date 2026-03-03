---
id: E016
title: Microapp Primitives Library
status: done
issue: ~
pr: ~
depends_on: [E015]
---

# E016 — Microapp Primitives Library

## TL;DR

Build a small primitives library for microapps so authors can compose content
inside a window without hand-wiring `blessed.box` trees with absolute
coordinates. The library introduces a `UiPart` contract, stack and columns
layout containers, and a small set of named parts validated by rewriting the
Poetry Clock with zero manual coordinate mutation.

## Read First

- [AGENTS.md](/Users/james/Repos/wibandwob-dos/AGENTS.md) — architecture invariants and single-owner rules
- [modules/wibwob-poetry-clock/index.ts](/Users/james/Repos/wibandwob-dos/modules/wibwob-poetry-clock/index.ts) — current microapp proving ground
- [src/core/window-chrome.ts](/Users/james/Repos/wibandwob-dos/src/core/window-chrome.ts) — existing chrome sizing seam
- [src/core/theme/safe-set-style.ts](/Users/james/Repos/wibandwob-dos/src/core/theme/safe-set-style.ts) — safe restyle path
- [src/core/theme/index.ts](/Users/james/Repos/wibandwob-dos/src/core/theme/index.ts) — theme token ownership

## Architecture Bucket

Infrastructure — this is the composition seam between microapp content and the
existing window/chrome/theme/runtime systems.

## Objective

Provide a minimal, composable content-layout library for microapps. Authors
should build views from reusable parts and layout containers instead of
manually mutating widget coordinates and re-implementing lifecycle behavior.

## Motivation

The Poetry Clock is the first complex microapp and it exposes the current gap
clearly:

- 9 manually-positioned `blessed.box` widgets
- hardcoded geometry values for divider, status, and cat panel widths
- direct coordinate mutation on mode change (`poemBox.left = 16`)
- custom word-wrap because blessed auto-wrap drops indent on continuation lines
- no lifecycle contract for cleanup, restyle, or layout reflow

A prior review found that WibWob-DOS already has strong seams for chrome math,
theme tokens, and animation, but no seam for composing content inside a window.
This epic fills that gap without adding new blessed widget types or a parallel
UI framework.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Core unit | `UiPart<Props>` | Gives every microapp part one lifecycle contract: layout, update, restyle, destroy |
| Geometry model | `Rect = { top, left, width, height }` | Keeps content layout explicit and independent from chrome math |
| Layout primitives | `createStack()` and `createColumns()` | Covers most microapp composition without inventing a large layout framework |
| Sizing model | fixed numbers + `"Nfr"` fractions | Simple enough for terminal UI, expressive enough to remove hardcoded absolute widths |
| Visibility model | `visible?: () => boolean` on children | Lets parts collapse or reappear without coordinate mutation |
| Widget surface | `blessed.box` only | Preserves the current renderer model and avoids surface-area sprawl |
| Named parts | thin wrappers over `UiPart` | Provides convenience without hiding the underlying lifecycle contract |
| Host exposure | microapps import via `MicroappHost` | Prevents modules from reaching into relative `src/` paths |

## Core Contract

```ts
type Rect = { top: number; left: number; width: number; height: number };

type UiPart<Props = void> = {
  node: blessed.Widgets.BoxElement;
  layout(rect: Rect): void;
  update(props: Props): void;
  restyle(): void;
  destroy(): void;
};
```

## Features

### F01 — UiPart Contract + Layout Engine

Status: not-started

Introduce the base `UiPart` lifecycle plus reusable stack and columns layout
containers. The goal is to move all microapp content geometry into one shared
layout path.

- [ ] Define `Rect` and `UiPart<Props>` contract
- [ ] Add `createStack(parent, children)` vertical layout container
- [ ] Add `createColumns(parent, children)` horizontal layout container
- [ ] Support child basis values: fixed number, `"1fr"`, `"2fr"`, and similar
- [ ] Support `visible?: () => boolean` so hidden children collapse cleanly
- [ ] Wire resize/layout reflow through the root layout container
- [ ] Make root `destroy()` cascade to all child parts
- [ ] Make root `restyle()` cascade to all child parts

AC-1: All content geometry for converted microapps lives in layout containers.
Test: Poetry Clock rewrite contains zero coordinate mutation on mode change and
no hardcoded panel offsets in content wiring.

AC-2: Resize triggers layout reflow automatically.
Test: Resize the Poetry Clock window. Divider, poem width, status width, and
cat panel width recompute without manual coordinate reassignment.

AC-3: Root lifecycle propagates through the full tree.
Test: Destroy the root layout and verify all child parts are torn down,
including animation players owned by descendants.

AC-4: Restyle uses the shared theme-safe path.
Test: Theme switch calls `restyle()` on the root and the change propagates
through the tree via `safeSetStyle`.

### F02 — Named Parts Library

Status: not-started

Add thin reusable wrappers for the repeating content patterns already visible
in the Poetry Clock and likely future microapps.

- [ ] `createHeaderBar(parent, opts?)` → `UiPart<{ left: string; right?: string }>`
- [ ] `createStatusBar(parent, opts?)` → `UiPart<{ left?: string; right?: string }>`
- [ ] `createTextBlock(parent, opts?)` → `UiPart<{ text: string }>`
- [ ] `createRule(parent, opts)` → `UiPart<{ visible: boolean }>`
- [ ] `createFigletDisplay(parent, opts)` → `UiPart<{ value: string }>`
- [ ] `createAnimatedPanel(parent, opts)` → `UiPart<void>`
- [ ] `createTextBlock()` preserves indent across wrapped continuation lines

AC-1: The named parts cover the Poetry Clock surface without extra ad hoc
widget helpers.
Test: Poetry Clock rewrite uses the shared named parts for header, status,
poem body, divider, figlet value, and animated panel.

AC-2: `createTextBlock()` owns indent-preserving wrap behavior.
Test: Feed multiline indented poem text and verify continuation lines preserve
indent instead of falling back to blessed auto-wrap.

AC-3: No new blessed widget types are introduced.
Test: Implementation remains `blessed.box`-based throughout the primitives
library and the rewritten Poetry Clock.

### F03 — Poetry Clock Rewrite

Status: not-started

Rewrite the Poetry Clock using the new primitives to prove the system is real,
small, and sufficient. This story is the validation pass, not an optional demo.

- [ ] Replace manual `blessed.box` tree wiring with `UiPart` composition
- [ ] Remove hardcoded divider, status, and cat panel geometry from view logic
- [ ] Remove direct coordinate mutation on mode changes
- [ ] Route layout changes through visible predicates and container reflow
- [ ] Keep rendered output visually identical to the current Poetry Clock

AC-1: The rewritten Poetry Clock passes typecheck.
Test: `bun run typecheck`.

AC-2: The rewritten Poetry Clock renders identically to the current version.
Test: Launch the app, open Poetry Clock, and compare the rewritten layout
against the current visual structure in all modes.

AC-3: Mode changes are layout-driven.
Test: Toggle Poetry Clock modes and verify all content shifts via layout
reflow, with zero direct `top`, `left`, `width`, or `height` mutation.

### F04 — MicroappHost Primitives Export

Status: not-started

Expose the primitives from the microapp host so module authors import from the
host contract instead of reaching into relative core paths.

- [ ] Add primitives exports to `MicroappHost`
- [ ] Document the host-facing import path for microapps
- [ ] Update Poetry Clock imports to use the host export path
- [ ] Keep modules insulated from internal `src/` path knowledge

AC-1: Microapps consume primitives through the host contract.
Test: Poetry Clock imports primitives from `MicroappHost` rather than relative
paths into `src/`.

AC-2: Host exposure does not create a second primitives API path.
Test: There is one documented import surface for microapp primitives and no
parallel direct-import recommendation for module authors.

## Dependencies

- E015 Microapp Module System + Poetry Clock — required foundation
- Theme token and safe restyle path — reuse existing theme ownership, do not fork it
- Existing animation/player seam — reused by `createAnimatedPanel()`
- Poetry Clock microapp — validation surface for the first full conversion

## Open Questions

1. Should `createTextBlock()` expose wrapping options beyond indent
   preservation, or should line-wrapping policy stay intentionally narrow for
   the first pass?
2. Do any existing core windows share enough structure to adopt these
   primitives later, or should this epic stay microapp-only until a second
   consumer appears?
3. Should `visible` predicates be pull-based only, or does the root layout need
   an explicit invalidation hook for future dynamic composition?

## Estimated Effort

| Feature | Sessions | Notes |
|---------|----------|-------|
| F01 UiPart + layout engine | 2 | Core contract, fr sizing, visibility, lifecycle |
| F02 Named parts | 1 | Thin wrappers, text wrapping, animation wrapper |
| F03 Poetry Clock rewrite | 1 | Proves zero hardcoded geometry path |
| F04 Host export | 1 | Small API projection and docs |
| **Total** | **~5** | Moderate infrastructure slice with one proving rewrite |
