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

## SDK Family Map (current + target)

| Family | Current components | Target additions (this epic) |
|--------|-------------------|------------------------------|
| **Layout** | createStack, createRow, createGrid, createNodePart, pickBreakpoint, createScrollViewport, applyRect | — (complete from E035) |
| **Chrome** | createHeaderBar, createStatusBar, createButtonBar, createBorderedPanel, createSidebarPanel, createRule | — (adequate) |
| **Content** | createTextBlock, createFigletDisplay, createMessageHistory, createContentStack, createCollapsibleBlock | — (adequate) |
| **Navigation** | createTabs, createSelectableList, createInlineSearch | createFilterableList (search+select unified) |
| **Forms** | createInputLine (only) | createButton, createCheckbox, createRadioGroup, createSelect, createTextArea, createFormField |
| **Data Display** | (none in SDK) | createDataTable, createKeyValuePanel |
| **Feedback** | (none in SDK) | createProgressBar, createSpinner, createToast |
| **Patterns** | patternBlockGradient, patternWave, etc. | — (adequate) |
| **Animation** | createAnimationClock, tween, EASINGS | — (adequate) |
| **Rendering** | grid-canvas, ascii-composition, figlet, markdown | — (adequate) |

## Features

### F00 — Component behaviour contract
Define the standard lifecycle/behaviour contract all SDK components follow.
Document in `.agents/module-dev/component-contract.md`.

- [ ] Define contract: focus, keybindings, disabled state, value events, restyle, cleanup
- [ ] Define variant model: default / hover / focus / disabled / error / success
- [ ] Define design tokens: spacing scale, control heights, density
- [ ] All new components in this epic follow the contract

### F01 — Forms family: createButton + createCheckbox
First form controls. Small, high leverage.

- [ ] `createButton({ label, onPress, disabled? })` — focusable, Enter/Space triggers
- [ ] `createCheckbox({ label, checked?, onChange })` — toggle with Space
- [ ] Both follow component contract (focus ring, disabled, restyle, cleanup)
- [ ] Both work inside createStack/createRow layouts
- [ ] Proof: add to e026-demo or a new forms-demo module

### F02 — Forms family: createRadioGroup + createSelect
Selection controls.

- [ ] `createRadioGroup({ options, selected?, onChange })` — vertical radio buttons
- [ ] `createSelect({ options, selected?, onChange, placeholder? })` — dropdown-style picker
- [ ] Keyboard: arrow keys navigate, Enter/Space selects
- [ ] Both composable in flex/grid layouts

### F03 — Forms family: createTextArea + createFormField
Text editing and field wrapper.

- [ ] `createTextArea({ value?, onChange, rows? })` — multiline text input
- [ ] `createFormField({ label, help?, error?, child })` — wrapper that adds label/help/error chrome around any form control
- [ ] Error state visually distinct (uses variant model)

### F04 — Data display: createDataTable
Canonical sortable table.

- [ ] `createDataTable({ columns, rows, sortable?, onSelect? })`
- [ ] Column headers, row selection, keyboard navigation
- [ ] Fits inside createStack/createGrid cells
- [ ] Handles resize gracefully (column truncation, not crush)

### F05 — Data display: createKeyValuePanel
Simple structured data display.

- [ ] `createKeyValuePanel({ entries: Array<{key, value}>, border? })`
- [ ] Aligned key-value pairs, respects theme tokens
- [ ] Useful for status panels, config displays, state inspectors

### F06 — Feedback: createProgressBar + createSpinner
Progress indication.

- [ ] `createProgressBar({ value, max?, label?, style? })` — horizontal bar
- [ ] `createSpinner({ label? })` — animated spinner with optional label
- [ ] Both update via `.update({ value })` pattern
- [ ] Both restyle-aware

### F07 — Feedback: createToast
Transient notification.

- [ ] `createToast({ message, duration?, severity? })` — auto-dismissing overlay
- [ ] Severity: info / success / warning / error
- [ ] Positions at bottom of parent or screen
- [ ] Non-blocking (does not steal focus)

### F08 — Navigation: createFilterableList
Unified search+select pattern.

- [ ] `createFilterableList({ items, onSelect, placeholder? })`
- [ ] Inline search filters the list as you type
- [ ] Keyboard: type to filter, arrows to navigate, Enter to select
- [ ] Replaces ad-hoc combinations of createInlineSearch + createSelectableList

### F09 — Integration proof + docs
Prove the family works together.

- [ ] Build one "forms playground" demo module using all new components
- [ ] Update sdk-reference.md with full forms/data/feedback sections
- [ ] Update component family map in sdk-reference.md
- [ ] Verify all new components survive resize (wide→narrow→wide)

## Decisions

- Dashboard is exempt from SDK migration (E035 decision, carried forward)
- New components live in `src/core/ui-parts.ts` alongside existing primitives
- All components exported through `microapp-sdk.ts`
- Component contract doc is normative — any component that violates it is a bug

## Out of scope

- blessed-contrib adapter wrappers (Phase 3 from gap analysis — future epic)
- Layout primitive changes (E035 is complete)
- Theme engine changes
- Accessibility beyond keyboard focus
