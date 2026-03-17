# E034 Layout Audit: FLEX vs GRID Primitives

## Executive Summary

All 5 modules use **predominantly FLEX (1D)** layouts with varying levels of manual GRID-like positioning. None fully embrace 2D grid systems. Two modules (`patchbay-lab`, `wibwobworld`) layer manual rect-based positioning over FLEX stacks, and one module (`touchlab-mvp`) uses pure absolute positioning with no FLEX/GRID support at all.

**Key finding:** `createStack` + `createColumns` work well for 80% of these cases. Manual layout functions and hardcoded rect positioning suggest demand for **composition helpers** (flex-in-grid cells, sidebar patterns) and **responsive sizing** (intrinsic width/height, breakpoint rules).

---

## Module 1: wibwob-poetry-clock

### Current Layout Approach

- **Root:** `createStack` (vertical, 1D)
  - Date header (1 basis)
  - Figlet time display (5 basis)
  - Divider rule (1 basis, conditional)
  - Body section (1fr basis) — contains `createColumns`
  - Status bar (1 basis)

- **Body section:** `createColumns` (horizontal, 1D)
  - Cat panel (15 basis, conditional on voice=scramble)
  - Cat divider rule (1 basis, conditional)
  - Poem block (1fr basis)
  - Terrain divider rule (1 basis, conditional)
  - Terrain panel (3fr basis, conditional on voice=terrain)

- **Components used:** All microapp SDK abstractions
  - `createHeaderBar`, `createFigletDisplay`, `createRule`, `createAnimatedPanel`, `createTextBlock`, `createStatusBar`
  - No manual rect positioning

### Classification

**FLEX only** ✓

### Compatibility

- `createStack` + `createColumns`: **Already using them** — works perfectly
- Would benefit from: No changes needed; this is the gold standard

### Layout Patterns Not Fitting FLEX/GRID

None. Clean abstraction.

### Composition Needs

None identified.

### Responsive Breakpoints?

**Yes, would benefit:**
- On very small widths (<40 cols), poem + terrain side-by-side doesn't work
- Could use `sm` breakpoint to collapse terrain to below poem (switch from columns to stacked)
- Could use `xs` breakpoint to hide terrain entirely

**Suggested breakpoints:**
```typescript
// sm (width < 50): stack body instead of columns
// xs (width < 30): hide terrain, hide dividers, center poem only
```

---

## Module 2: patchbay-lab

### Current Layout Approach

- **Root:** `createStack` (vertical)
  - Header bar (1 basis)
  - Mode bar button bar (1 basis)
  - Body section (1fr basis) — uses `createColumns`
  - Status bar (1 basis)

- **Body section:** `createColumns` (horizontal)
  - Command deck (29 basis, fixed)
  - Preview section (1fr basis)
  - Inspector (34 basis, fixed)

- **Preview section:** `createStack` (vertical)
  - Primer tab bar (1 basis, conditional)
  - View surface (1fr basis) — **MANUAL LAYOUT FUNCTION**
  - Divider rule (1 basis)
  - Animation panel (8 basis)

- **View surface:** Custom `UiPart` with **explicit rect positioning** inside `layout()`
  - Measures available space
  - Calculates sidebar width, divider, content widths manually
  - Applies rects to individual boxes with `applyRect`
  - Hides/shows components based on view mode
  - Uses `resolveSidebarWidth()` utility for responsive calculation

### Classification

**FLEX + GRID composition** ~70/30

- Uses FLEX (stack/columns) for the primary axes
- Uses manual GRID-like positioning (explicit rect) for secondary panel layout (sidebar + divider + content)

### Compatibility

- `createStack` + `createColumns`: **Already using** ✓
- `createStack` + rect positioning: **Hybrid approach works**, but layering shows friction
- Would `createGrid` help? **Yes** — the view surface internally does 2D positioning that a GRID primitive would handle cleaner

### Layout Patterns Not Fitting FLEX/GRID

1. **Sidebar width resolution** — needs responsive calculation based on available space and min/max constraints
   - Currently done manually with `resolveSidebarWidth()` 
   - A GRID with column templates (`1fr 0.32fr`) would simplify this
   - Or a FLEX `sidebar-auto` primitive that understands percentage-based widths

2. **Conditional visibility + layout** — switching between overview/terrain/chat modes changes which elements render and their layout
   - Currently: manual `.show()` / `.hide()` calls inside rect function
   - A GRID with responsive template switching or a FLEX variant-based system would make this cleaner

### Composition Needs

**Flex inside GRID cell:** The preview section (1fr basis) contains a FLEX stack internally. This works but exposes the abstraction layer — a helper like `flexCell()` or `stackIntoGridCell()` would tidy this.

### Responsive Breakpoints?

**Yes, critical:**
- On `xs` (width < 60): sidebar should hide or collapse to icons
- On `sm` (width < 90): 3-column layout (deck/preview/inspector) should collapse to 2 columns or stack
- On `md+`: current layout

**Current workarounds:**
- `resolveSidebarWidth()` with min/max prevents hard breaks, but is reactive
- No proactive breakpoint system

---

## Module 3: wibwobworld

### Current Layout Approach

- **Root:** `createStack` (vertical)
  - Header bar (1 basis)
  - Body section (1fr basis) — custom `UiPart` with **conditional layout**
  - Mode bar (1 basis)

- **Body section:** Custom layout with **render-mode-dependent 2D positioning**
  - Render mode `firstperson`: Full canvas (fpBox fills rect)
  - Render mode `iso`: Full canvas (isoBox fills rect)
  - Render mode `hybrid`: 2-column layout (mapBox left 50%, isoBox right 50%)
  - Render mode `terrain` or `contours`: Full map + optional sidebar

- **Layout logic:** Manual `applyRect()` calls based on:
  - `renderMode` (branches into 5 different layouts)
  - `sidebarOpen` (affects whether infoBlock is shown/sized)
  - Sidebar width calculated with `resolveSidebarWidth()` utility

### Classification

**FLEX + manual GRID** ~40/60

- Uses FLEX (stack) for vertical sections
- Uses manual explicit positioning (rect) for the render-mode-conditional logic
- Effectively implements 5 different sub-layouts based on render mode

### Compatibility

- `createStack`: **Already using** ✓
- Manual rect positioning: **Required for render-mode switching**, but code is complex

### Layout Patterns Not Fitting FLEX/GRID

1. **Render-mode-driven layout switching** — same container needs to switch between 1-pane, 2-pane, sidebar layouts
   - Currently: giant if/else inside `body.layout()`
   - A GRID with variant templates or a FLEX layout chooser would help, but the abstraction needs to understand **semantic render modes** (not just breakpoints)
   - This is more of a **state-driven layout** problem than a FLEX/GRID primitive problem

2. **Variable sidebar** — sidebar can be on/off and changes visibility of entire panels
   - Uses `applyRect()` with width/height = 0 to collapse instead of `.hide()`
   - Prevents blessed resize event storms (good practice)
   - But the calculation is scattered and hard to maintain

### Composition Needs

**Flex stack + conditional sidebar + conditional 2D render area:**
- Would benefit from a composite primitive that understands `sidebarOpen` + `renderMode` 
- Something like: `createRenderModeSurface({ defaultMode, modes: { hybrid: (rect) => {...}, iso: (rect) => {...} } })`

### Responsive Breakpoints?

**Yes, would help:**
- On `xs`: Hide sidebar, stack render modes vertically (not horizontally)
- On `sm`: Smaller world sizes (reduce contour levels?)
- On `md+`: current 2-pane layout

**Current constraint:** World generation is size-aware but not breakpoint-aware. Might benefit from intrinsic sizing rules.

---

## Module 4: world-chatroom

### Current Layout Approach

- **Root:** No explicit stack; manual positioning
  - Header bar: `layout({ top: 0, ... })` 
  - Body node: hard-positioned `top: 1, left: 0, right: 0, bottom: 2`
  - Status bar: hard-positioned `bottom: 1`
  - Input box: hard-positioned `bottom: 0`

- **Body node:** Uses **`createSidebarPanel()`** (custom microapp SDK utility)
  - Main (transcript): scrollable
  - Sidebar (game log): scrollable, fixed 26-char width
  - Sidebar handled by a custom `UiPart` that manages responsive width

- **Layout:** Minimal abstraction; mostly **absolute box positioning** with some responsive sidebar logic

### Classification

**Custom sidebar pattern + manual positioning** (not cleanly FLEX or GRID)

### Compatibility

- `createStack`: **Not currently used** — would benefit
- `createSidebarPanel()`: **Custom utility**, works but non-standard
- Would `createFlexRow([main: 1fr, sidebar: 26])` work? **Yes** — cleaner than current approach

### Layout Patterns Not Fitting FLEX/GRID

1. **Sidebar panel pattern** — main + fixed-width sidebar is a common layout, but currently implemented as a one-off custom `UiPart`
   - Recommendation: Make `createSidebarPanel()` a standard FLEX wrapper or GRID 2-column template

2. **Input multi-line wrapping** — input box has custom `renderInput()` logic that wraps text and auto-sizes height
   - Not a FLEX/GRID issue, but shows that simple flex doesn't handle text wrapping well
   - May need a specialized input component

### Composition Needs

**Sidebar-main composition:** This module is the **canonical example** of "I have a fixed sidebar + flexible main area". Should extract as:
```typescript
// Proposed primitive
createSidebarLayout(win.body, {
  side: 'right',
  sidebarWidth: 26,
  mainMinWidth: 12,
  main: transcriptBox,
  sidebar: gameLogBox,
})
```

Currently uses custom `createSidebarPanel()` which works but is module-specific.

### Responsive Breakpoints?

**Yes:**
- On `xs` (width < 50): Hide sidebar, full-width transcript
- On `sm` (width < 80): Reduce sidebar to 16 chars
- On `md+`: current 26-char sidebar

**Current behavior:** Sidebar is always on; no responsive hiding.

---

## Module 5: touchlab-mvp

### Current Layout Approach

- **Root:** Manual `blessed.box` with `top: 0, left: 0, right: 0, bottom: 0`
- **Child elements:** All **absolute positioning with hardcoded coordinates**
  - Inspector: `top: 0, right: 0, width: 26, height: "100%"`
  - Canvas: `top: 0, left: 0, right: 26, bottom: 0`
  - Nested nodes: `left: x, top: y, width: w, height: h` (stored as state, rendered manually)
  - Palette boxes: `top: 24, left: 5 + index * 2, width: 2, height: 1`

- **Nested window management:** Custom drag/resize handling via mouse events
  - Calculates canvas pointer → node coordinates
  - Updates node state (x, y, w, h) on drag/resize
  - Calls `renderNodes()` to reapply all rects

### Classification

**OTHER — Pure absolute positioning, no FLEX/GRID**

This module fundamentally requires **absolute positioning** because:
1. Nested windows can be freely dragged and resized
2. Overlapping is intentional (z-order tracking)
3. Position/size is application state, not layout constraints

### Compatibility

- `createStack` / `createColumns`: **Incompatible**
  - Nested windows must track arbitrary x/y/w/h positions
  - FLEX/GRID assumes alignment and auto-sizing, not absolute freedom

- Would a GRID primitive help? **No**
  - This is a **free-form canvas** problem, not a structured layout problem
  - Similar to sketch apps, game dev engines, figma-style interfaces

### Layout Patterns Not Fitting FLEX/GRID

**All of it.** The entire module is:
- Absolute positioning (x, y, w, h state)
- Drag + resize interactions
- Z-order management
- Custom rendering (calling `renderNodes()` manually)

This is correct for the use case (interactive nested windows) but incompatible with FLEX/GRID paradigms.

### Composition Needs

**None related to FLEX/GRID.** Instead:
- `createDraggableBox()` / `createResizableBox()` primitives would help
- Z-order helpers for managing nested window layers
- Canvas coordinate utilities (pointerToCanvas, bounds checking)

### Responsive Breakpoints?

**No.** The entire layout is user-driven (drag/resize). Breakpoints don't apply.

---

## Summary Table

| Module | Classification | Uses Stack? | Uses Columns? | Manual Rects? | Responsive? | Notes |
|--------|-----------------|-------------|---------------|---------------|------------|-------|
| poetry-clock | FLEX only | ✓ Yes | ✓ Yes | ✗ No | Candidate | Gold standard; responsive breakpoints would help |
| patchbay-lab | FLEX + GRID | ✓ Yes | ✓ Yes | ✓ Yes (sidebar layout) | Needs | Complex preview section; manual sidebar width |
| wibwobworld | FLEX + manual GRID | ✓ Yes | ✗ No | ✓ Yes (render modes) | Needs | 5-way render mode branching in layout |
| world-chatroom | Custom sidebar + manual | ✗ No | ✗ No | ✓ Yes (mostly) | Candidate | Should use `createStack`; sidebar is canonical use case |
| touchlab-mvp | OTHER (absolute) | ✗ No | ✗ No | ✓ Yes (all) | N/A | Correctly uses absolute positioning for nested windows |

---

## Recommendations

### Immediate (MVP for FLEX/GRID)

1. **Confirm `createStack` + `createColumns` work in all non-absolute modules**
   - All 4 standard modules are already using them or should be
   - No major refactoring needed; current code is sound

2. **Standardize sidebar pattern** → Extract `createSidebarLayout()` or formalize `createSidebarPanel()` as a FLEX 2-column wrapper
   - Currently ad-hoc in `world-chatroom` and `patchbay-lab`
   - Make it a reusable primitive

3. **Provide responsive sizing helpers**
   - `responsiveWidth(fullWidth, { xs: ..., sm: ..., md: ... })`
   - `responsiveHeight(fullHeight, { xs: ..., sm: ..., md: ... })`
   - Use in `wibwobworld`, `patchbay-lab`

### Follow-up (GRID & composition)

4. **Add GRID primitive for 2D layouts**
   - Template-based column/row definitions
   - Example: `createGrid(parent, { template: '1fr 26 1fr', rows: [...] })`
   - Would simplify `patchbay-lab` view surface and `wibwobworld` render mode layouts

5. **Composition helpers**
   - `flexCell()` — wrap a flex stack to fit into grid cell
   - `gridCell()` — wrap a grid to fit into flex item
   - `renderModeLayout()` — helper for state-driven layout switching (wibwobworld pattern)

6. **Responsive layout builders**
   - `createResponsiveLayout()` with breakpoint-aware templating
   - Use in modules that branch on viewport size

### Optional (polish)

7. **Refactor `touchlab-mvp` with canvas/drag/resize primitives**
   - Not a FLEX/GRID issue, but would improve DX
   - Keep absolute positioning; add helper abstractions

---

## Files to Update After Primitives Land

1. **poetry-clock:** Add responsive breakpoints (low priority — already good)
2. **patchbay-lab:** Consider GRID for view surface or at least standardize sidebar
3. **wibwobworld:** Extract render-mode-switching into a composite layout helper
4. **world-chatroom:** Swap manual positioning for FLEX stack + sidebar
5. **touchlab-mvp:** No changes needed (correct paradigm for use case)
