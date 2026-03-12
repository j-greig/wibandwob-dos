---
id: e036
title: SDK Design System — Forms, Data Display, Feedback
status: not-started
priority: high
depends: [e035]
---

# E036 — SDK Design System Expansion

## Context

E035 established canon layout primitives (createStack, createRow, createGrid,
pickBreakpoint, createScrollViewport). The layout layer is solid. But module
authors still rebuild form controls, data tables, progress indicators, and
feedback patterns from scratch every time.

gpt53's gap analysis (gap-analysis.md in this directory) benchmarked the SDK
against Textual, Rich, and blessed-contrib. Key finding: layout is solved;
the next high-value lane is design-system completeness.

## Goal

Deliver a coherent component family map with production-quality primitives
for the gaps that cause the most repeated work in modules.

## MVP Cutline

**MUST (first merge train):** F00, F01, F02, F06, F09
**SHOULD (second tranche):** F03, F04, F05, F07, F08

Ship the MUST set first. It covers: contract, basic forms, progress/spinner,
docs. The SHOULD set fills out data display, advanced forms, toast, and
navigation — higher risk, lower urgency.

## SDK Family Map (current + target)

| Family | Current components | Target additions (this epic) |
|--------|-------------------|------------------------------|
| **Layout** | createStack, createRow, createGrid, createNodePart, pickBreakpoint, createScrollViewport, applyRect | — (complete from E035) |
| **Chrome** | createHeaderBar, createStatusBar, createButtonBar, createBorderedPanel, createSidebarPanel, createRule | — (adequate; createButtonBar stays here, distinct from form-level createButton) |
| **Content** | createTextBlock, createFigletDisplay, createMessageHistory, createContentStack, createCollapsibleBlock | — (adequate) |
| **Navigation** | createTabs, createSelectableList, createInlineSearch | createFilterableList (search+select unified) |
| **Forms** | createInputLine (only) | createButton, createCheckbox, createRadioGroup, createSelect, createTextArea, createFormField |
| **Data Display** | (none in SDK) | createDataTable, createKeyValuePanel, createLogView |
| **Feedback** | (none in SDK) | createProgressBar, createSpinner, createToast |
| **Patterns** | patternBlockGradient, patternWave, etc. | — (adequate) |
| **Animation** | createAnimationClock, tween, EASINGS | — (adequate) |
| **Rendering** | grid-canvas, ascii-composition, figlet, markdown | — (adequate) |

## Architecture rules

### All new components return LayoutPart

Every new create* function returns a `LayoutPart` (or an extension of it).
This is non-negotiable — components must compose with createStack/createRow/
createGrid. The LayoutPart contract (node, layout, restyle, destroy) is the
universal composition primitive established in E035.

### File structure: split by family

`src/core/ui-parts.ts` is already 2355 lines with 22 create* functions.
New components go in family-scoped files:

```
src/core/ui-parts-forms.ts      — createButton, createCheckbox, createRadioGroup, etc.
src/core/ui-parts-data.ts       — createDataTable, createKeyValuePanel, createLogView
src/core/ui-parts-feedback.ts   — createProgressBar, createSpinner, createToast
```

Re-export from `ui-parts.ts` and `microapp-sdk.ts` so the SDK surface is unchanged.
Split when the first component in each family lands — don't pre-create empty files.

### Canonical acceptance checks (reuse across all components)

Every new component must pass:
1. **Keyboard contract**: documented keys work, no key swallowing
2. **Focus/blur**: visually distinct focus state
3. **Disabled**: visually muted, non-interactive when disabled
4. **Restyle**: responds to theme change via restyle()
5. **Resize**: survives wide→narrow→wide (120→40→120) without crash or layout break
6. **Cleanup**: destroy() removes all nodes and listeners, no leaked timers
7. **Composition**: works inside createStack, createRow, createGrid cells

## Features

### F00 — Component behaviour contract
Define the standard lifecycle/behaviour contract all SDK components follow.
Document in `.agents/module-dev/component-contract.md`.

- [x] Define contract: focus, keybindings, disabled state, value events, restyle, cleanup
- [x] Define variant model: default / hover / focus / disabled / error / success
- [x] Define design tokens: spacing scale, control heights, density
- [x] Require all components return LayoutPart
- [x] Controlled vs uncontrolled policy: update() is source of truth (controlled); internal state only used when no update() called (uncontrolled). Document which pattern each control uses.
- [x] Event payload contract: standardise onChange shape ({ value, id?, source? }) across all form controls
- [x] Focus/tab-order contract: Tab/Shift-Tab traversal between sibling controls, documented in contract doc
- [x] Restyle safety: new scrollable/list components must use safeSetStyle-compatible patterns
- [x] All new components in this epic follow the contract
- [x] Add SDK category map to sdk-reference.md

### F01 — Forms family: createButton + createCheckbox (MUST)
First form controls. Small, high leverage.

- [x] `createButton({ label, onPress, disabled? })` — focusable, Enter/Space triggers
- [x] `createCheckbox({ label, checked?, onChange })` — toggle with Space
- [x] Both return LayoutPart, follow component contract
- [x] Both work inside createStack/createRow layouts
- [x] Live in `src/core/ui-parts-forms.ts`
- [x] Proof: add to forms-demo module
- [x] AC: open forms-demo, tab between controls, resize 120→40→120, all usable

### F02 — Forms family: createRadioGroup + createSelect (MUST)
Selection controls.

- [x] `createRadioGroup({ options, selected?, onChange })` — vertical radio buttons
- [x] `createSelect({ options, selected?, onChange, placeholder? })` — inline picker (not overlay dropdown — blessed constraint)
- [x] Keyboard: arrow keys navigate, Enter/Space selects
- [x] Both composable in flex/grid layouts
- [x] AC: open forms-demo, arrow-key through radio options, select picks, resize survives

### F03 — Forms family: createTextArea + createFormField (SHOULD)
Text editing and field wrapper.

- [x] `createTextArea({ value?, onChange, rows? })` — multiline text input
- [x] `createFormField({ label, help?, error?, child })` — wrapper that adds label/help/error chrome around any form control
- [x] Error state visually distinct (uses variant model)

### F04 — Data display: createDataTable (SHOULD)
Canonical sortable table.

- [x] `createDataTable({ columns, rows, sortable?, onSelect? })`
- [x] Column headers, row selection, keyboard navigation
- [x] Sorting is client-side only
- [x] Column widths: flex by default (proportional to content), fixed override option
- [x] Fits inside createStack/createGrid cells
- [x] Handles resize gracefully (column truncation, not crush)

### F05 — Data display: createKeyValuePanel + createLogView (SHOULD)
Structured data display.

- [x] `createKeyValuePanel({ entries: Array<{key, value}>, border? })`
- [x] Aligned key-value pairs, respects theme tokens
- [x] `createLogView({ maxEntries?, autoscroll?, severity? })` — rolling event log
- [x] Log: capped history, auto-scroll to bottom, optional severity prefixes
- [x] Both Antopolis and Terrarium Life built this pattern ad-hoc — SDK-ise it

### F06 — Feedback: createProgressBar + createSpinner (MUST)
Progress indication.

- [x] `createProgressBar({ value, max?, label?, style? })` — horizontal bar
- [x] `createSpinner({ label? })` — animated spinner with optional label
- [x] Both update via `.update({ value })` pattern
- [x] Both restyle-aware, both return LayoutPart
- [x] AC: open forms-demo, progress bar fills, spinner animates, resize survives

### F07 — Feedback: createToast (SHOULD)
Transient notification.

- [x] `createToast({ message, duration?, severity? })` — auto-dismissing notification
- [x] Severity: info / success / warning / error
- [x] Per-window, positions at bottom of parent (not screen-level singleton)
- [x] Non-blocking (does not steal focus)
- [x] Auto-cleanup after duration

### F08 — Navigation: createFilterableList (SHOULD)
Unified search+select pattern.

- [x] `createFilterableList({ items, onSelect, placeholder? })`
- [x] Inline search filters the list as you type
- [x] Keyboard: type to filter, arrows to navigate, Enter to select
- [x] Replaces ad-hoc combinations of createInlineSearch + createSelectableList

### F09 — Integration proof, migration, docs (MUST)
Prove the family works together and lands in real modules.

- [x] Build one `demo-forms-playground` module using all MUST components
- [x] Migrate 2 existing modules to use new SDK components:
  - terrarium/terrarium-life: replace ad-hoc log with createLogView (if F05 lands)
  - At least one module adopts createButton or createProgressBar
- [x] Update sdk-reference.md with full forms/data/feedback sections
- [x] Update component family map in sdk-reference.md
- [x] Update examples-by-tier.md if forms-playground becomes canonical
- [x] Update AGENTS.md if tier table changes
- [x] Verify all new components survive resize (wide→narrow→wide)

## Migration policy

E036 does NOT do a broad repo-wide migration pass.
Migration scope is limited to:
- The forms-playground demo module (comprehensive proof)
- 2 existing modules as proof consumers (terrarium family, one other)
- No forced migration of dashboard, slap-editor, or other complex modules

Broader adoption happens organically as modules are touched for other reasons.

## Decisions

- Dashboard is exempt from SDK migration (E035 decision, carried forward)
- createButtonBar stays in Chrome family (toolbar pattern, distinct from form-level createButton)
- New components split into family-scoped files, re-exported through existing surface
- All components return LayoutPart (composition contract)
- Component contract doc is normative — any component that violates it is a bug
- createSelect is inline picker, not overlay dropdown (blessed terminal constraint)
- createToast is per-window, not screen-level singleton

## Emergent patterns noted (explicit defer)

From Antopolis/Terrarium Life builds, these reusable patterns emerged:
- Simulation clock helper (pause/speed/tick loop)
- Seeded RNG utility
- ASCII particle system

These are domain-specific, not design-system primitives. Defer to a future
"simulation toolkit" epic if demand recurs.

## Out of scope

- blessed-contrib adapter wrappers (Phase 3 from gap analysis — future epic)
- Layout primitive changes (E035 is complete)
- Theme engine changes
- Accessibility beyond keyboard focus
- Simulation/game-specific helpers
