# E035 Code Review

Self-review of the Layout SDK implementation against the canon guide
(`layout-guide-final.md`) and the brief's acceptance criteria.

---

## Canon guide compliance

### Matches canon

- LayoutPart type matches spec exactly (node, layout, update, restyle, destroy)
- FlexChild and GridChild types match spec
- FlexBasis and TrackSize = `number | \`${number}fr\``
- Gap = `number | { row?, column? }`
- AxisAlign = "start" | "center" | "end"
- Alignment = { justify?, align? } with fixed screen axes
- createStack = vertical flex, createRow = horizontal flex
- createGrid with templateRows/templateColumns
- Object-form grid.set only (no positional args)
- createNodePart as the bridge for raw blessed/contrib nodes
- pickBreakpoint with width-first responsive switching

### Deviations from canon (intentional)

- `FlexChild.basis` accepts `number | string` internally via `parseFractionBasis`
  rather than strictly `FlexBasis`. This is backward-compatible but loosely typed —
  the public type is correct (`FlexBasis`), the runtime is permissive.
- Alignment on grid cells is declared but does not actually adjust position/size
  (comment says "future enhancement"). The canon guide shows alignment as part of
  the API but does not mandate implementation for this pass.

---

## Issues found

### 1. hello-world grid.set uses inline LayoutPart instead of createNodePart

**Severity:** Style / DRY violation

The hello-world proof port creates anonymous LayoutPart objects inline:
```ts
xlGrid.set({ key: "contour", row: 0, column: 0, rowSpan: 2,
  part: { node: contourBox, layout(r) { applyRect(contourBox, r); },
          update() {}, restyle() {}, destroy() {} } });
```

Should use `createNodePart(contourBox)` which does exactly this. The whole
point of `createNodePart` is to avoid this boilerplate.

**Fix:** Replace all three grid.set calls with `createNodePart(box)`.

### 2. createGrid does not handle zero rows or columns

**Severity:** Edge case

If `rows: 0` or `columns: 0` is passed, the gap calculation produces
`Math.max(0, (0 - 1) * gap)` = `Math.max(0, -gap)` which is safe but
semantically wrong. More importantly, no children would ever be visible.

**Fix:** Guard with `if (rows < 1 || columns < 1) return` in layoutChildren.

### 3. createGrid alignment is a no-op

**Severity:** Known gap, documented

The `align` option on GridChild and GridOptions is accepted in the type
but the layout function ignores it — the comment says "future enhancement".
The canon guide shows alignment as part of the API.

**Fix:** Acceptable for this pass. Note in docs that alignment within grid
cells is not yet implemented.

### 4. FlexChild.align is accepted but ignored by createLinearLayout

**Severity:** Same pattern as grid — declared but not implemented

The `FlexChild` type has an `align?: Alignment` field added in E035, but
`createLinearLayout` does not use it. Cross-axis alignment within flex
children is not implemented.

**Fix:** Same as grid — acceptable for this pass, should be noted.

### 5. createScrollViewport conditionalScrollbar option is unused

**Severity:** Dead code

The `conditionalScrollbar` option is accepted but never checked in the
layout function. The scrollbar is always visible.

**Fix:** Either remove the option or implement conditional visibility.

### 6. Heartbeat proof port has unnecessary spacer nodes

**Severity:** Style

The heartbeat port creates explicit spacer boxes between content rows.
A cleaner approach would be to use `basis: 1` spacers without creating
real blessed boxes, or just let the stack's `1fr` fill handle spacing.

**Fix:** Minor — could simplify but functionally correct.

---

## Migration quality

- All 16 module files migrated cleanly with no old names remaining
- 3 internal windows updated
- No backward-compat aliases left (clean break)
- All demo modules now import scrollbar helpers from SDK, not internal paths
- Typecheck clean throughout

**One thing I'd verify:** Modules that use `host.ui.createRow` via the host
object (e.g. poetry-clock) — the MicroappHost interface was updated to include
`createRow` but no longer has `createColumns`. Any third-party modules using
`host.ui.createColumns` will break. Since this is an internal project with no
external consumers, this is fine.

---

## Documentation quality

The sdk-reference.md layout section is good — clear examples for each
primitive, the responsive rule is documented, and the lifecycle pattern is
shown. Could add:
- A note that grid cell alignment is not yet implemented
- A note that FlexChild.align is not yet implemented
- An example of nesting (grid inside flex, flex inside grid)

---

## Decision recommendations

Agree with all four recommendations in DECISIONS-NEEDED.md:
1. Dashboard — leave with contrib.grid (correct)
2. Proving-ground demos — keep 4, delete 6 (sensible)
3. Private modules — needs human input (correct)
4. Parking lot — nothing parked (correct)

---

## Summary

The implementation is solid and matches the canon guide well. The main
gaps are the unimplemented alignment features (grid cell alignment and
flex cross-axis alignment) and a few minor style issues in the proof ports.
These are acceptable for the scope of E035. The critical work — types,
primitives, migration, safety fixes, docs — is done correctly.

**Actionable fixes (do now):**
1. hello-world: replace inline LayoutPart with createNodePart (3 lines)
2. createScrollViewport: remove or implement conditionalScrollbar
3. sdk-reference: note that alignment is declared but not yet implemented

**Deferred (future work):**
- Grid cell alignment implementation
- Flex cross-axis alignment implementation
- Zero rows/columns guard in createGrid
