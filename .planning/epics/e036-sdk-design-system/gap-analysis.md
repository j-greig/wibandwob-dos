# E035 Follow-on: SDK Design System Gap Analysis

Date: 2026-03-12
Scope: Compare current WibWob module SDK surface with design-system-oriented capabilities in:
- `vendor/textual`
- `vendor/rich`
- `vendor/blessed-contrib`

Focus: reusable UI components, layout/system primitives, form controls, widget modularisation.

## 1) What we already have (strong baseline)

Current SDK/component baseline is good for layout composition and custom module authoring:
- Layout primitives: `createStack`, `createRow`, `createGrid`, `createScrollViewport`
- Composition contract: `LayoutPart`, `createNodePart`
- Responsive helper: `pickBreakpoint`
- Core chrome/components: `createHeaderBar`, `createStatusBar`, `createButtonBar`, `createBorderedPanel`, `createSidebarPanel`
- Content helpers: `createTextBlock`, `createMessageHistory`, `createContentStack`, `createCollapsibleBlock`, `createSelectableList`, `createInlineSearch`, `createTabs`
- Styling primitives: `createScrollbar`, `scrollableStyle`, `safeSetStyle` (internal)

This is already enough to build rich custom modules, but it is still a "composition toolkit" more than a full design system.

## 2) Gap matrix (design-system perspective)

| Area | WibWob SDK status | Textual / Rich / blessed-contrib reference | Gap level | Why it matters |
|---|---|---|---|---|
| Form controls | Minimal (`createInputLine` only) | Textual: button, checkbox, radio, select, switch, masked input, text area; Rich: prompt primitives | High | Module authors rebuild controls repeatedly; inconsistent UX + key handling |
| Form model / validation | No shared field-state or validation layer | Textual has stronger widget semantics; Rich prompts offer typed input patterns | High | Repeated ad-hoc validation/error UX in modules |
| Data table primitive | No canonical table widget in SDK surface | Textual `DataTable`; Rich `Table`; blessed-contrib `table` | High | Frequent need for sortable/filterable tabular views |
| Progress + status widgets | No canonical progress bar/spinner/status components | Rich: progress/status/spinner; Textual: `ProgressBar`, `LoadingIndicator` | Medium-High | Long-running tasks currently require bespoke rendering |
| Notification patterns | No toast/banner/alert/dialog primitives | Textual has `toast`, modal/dialog-style patterns in ecosystem | Medium | Event feedback and transient notifications are inconsistent |
| Command/quick action UI | App-level command palette exists, no module-level reusable command palette widget | Textual built-in command palette UX pattern | Medium | Modules with many actions lack standard discoverable action UI |
| List/select patterns | `createSelectableList` exists but limited ergonomics/state API | Textual `ListView`, `OptionList`, `SelectionList` | Medium | Multi-select/filter/search list workflows still custom-built |
| Rich text rendering primitives | Markdown + figlet available, no high-level panel/table/columns renderables | Rich has panel/table/columns/tree/rule ecosystem | Medium | Harder to quickly produce polished information UIs from structured data |
| Layout container variants | Core flex/grid good, but no first-class centering/flow container family | Textual has `Container`, `Vertical`, `Horizontal`, scroll variants, center/right/middle helpers | Medium | Repetitive boilerplate for common align/flow wrappers |
| Component state variants | Limited shared variant model (`default/hover/focus/disabled/error/success`) | Textual CSS/state model richer; Rich themes + styles more expressive | Medium | Inconsistent visual semantics across modules |
| Design tokens / scale | Theme tokens exist, but no published spacing/sizing/type rhythm scale in SDK docs | Textual has CSS-style layout semantics and theming conventions | Medium | UI rhythm/consistency varies module-to-module |
| Data-viz wrappers | No canonical SDK wrappers around contrib charts | blessed-contrib has line/bar/sparkline/gauge/donut/map/log widgets | Medium | Repeated low-level contrib wiring, inconsistent lifecycle/restyle handling |
| Widget modularisation contracts | No explicit component package boundaries (core, forms, data, feedback) | Textual widget gallery model encourages clear categories | Medium | Discoverability and maintenance costs rise as SDK grows |
| Accessibility/focus ergonomics | Focus exists, but no SDK-wide focus ring/disabled semantics contract | Textual has stronger keyboard/focus semantics across widgets | Medium | Keyboard UX quality differs per module |
| Testing harness for components | No canonical component contract tests per widget family | Textual has mature testing guidance/tooling | Medium | Regressions in component behaviour are easy to miss |

## 3) Comparative notes by reference

### Textual (vendor/textual)
Strongest differentiators vs current SDK:
- Broad widget taxonomy (forms, data, navigation, feedback)
- Scrollable container model with built-in key bindings and axis-specific variants
- Better component-state semantics and CSS-driven composition

Opportunity for WibWob:
- Keep our smaller API, but add a "first 10" canonical widgets with strict behaviour contracts

### Rich (vendor/rich)
Strongest differentiators vs current SDK:
- High-quality information rendering primitives (table, panel, columns, tree, markdown, progress, status, spinner)
- Excellent default typography/formatting for CLI output

Opportunity for WibWob:
- Add lightweight renderable-style helpers for data-rich panes (table/panel/progress/status)

### blessed-contrib (vendor/blessed-contrib)
Strongest differentiators vs current SDK:
- Dashboard widgets and charting primitives out of the box
- Familiar grid-based dashboard ergonomics and data widgets

Opportunity for WibWob:
- Provide canonical SDK wrappers/adapters around blessed-contrib widgets so module authors don’t hand-roll setup/restyle/resize glue repeatedly

## 4) Missing "design system" layers in WibWob SDK

### A) Component families are incomplete
Current SDK has layout/chrome pieces but lacks a formal forms family and a formal data-display family.

### B) No canonical behavioural contracts per widget class
Example: keyboard bindings, focus semantics, disabled state, value change events, validation errors are not standardised across controls.

### C) No explicit SDK package map
The SDK export file is rich but flat. A design system benefits from clear families:
- layout
- forms
- data-display
- feedback
- navigation
- overlays

### D) No tokenised design language docs beyond theme colours
Need documented scales for spacing, borders, component heights, density, text treatment.

## 5) Proposed follow-on roadmap (pragmatic)

### Phase 1: Foundation contracts (small + high leverage)
1. Publish component behaviour contract doc:
   - focus, keybindings, disabled, events, restyle, cleanup
2. Add SDK category map in docs (layout/forms/data/feedback/navigation)
3. Define minimal design tokens (spacing + density + control heights)

### Phase 2: Core missing components
1. `createButton` (single action control)
2. `createCheckbox`, `createRadioGroup`, `createSelect`
3. `createTextArea` (multiline editing)
4. `createFormField` wrapper (label/help/error/validation surface)
5. `createProgressBar` + `createLoadingIndicator`

### Phase 3: Data-display and dashboard bridge
1. Canonical `createDataTable`
2. `createLogView` / rolling log helper
3. blessed-contrib adapter layer:
   - line/bar/sparkline/gauge/donut/map wrappers
   - standard lifecycle hooks (`layout`, `restyle`, `destroy`)

### Phase 4: Feedback/overlay polish
1. toast/notice/banner primitives
2. confirm dialog / action sheet pattern
3. module-local command palette helper

## 6) Immediate low-risk wins

If we want impact without major SDK expansion:
1. Add `createButton` + `createCheckbox` + `createSelect` first
2. Add one canonical `createProgressBar`
3. Add one canonical `createDataTable`
4. Add contrib chart adapters for line + bar as pilot

These four changes would close a large portion of practical design-system gaps quickly.

## 7) Recommendation

E035 successfully established layout canon and migration discipline.
Next epic should target design-system completeness, not new layout primitives.

Suggested theme for follow-on epic:
"E0XX SDK Design System Buildout: forms, data-display, feedback, and contrib adapters"

This preserves the E035 layout model while making module UX much more consistent and reusable.
