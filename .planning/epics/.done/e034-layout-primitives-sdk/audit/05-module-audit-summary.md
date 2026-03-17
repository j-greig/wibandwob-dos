# E034 Module Layout Audit — Summary

Date: 2026-03-12
Method: three parallel agents audited all 20 modules + Codex architecture review

## Two-primitive model: CONFIRMED

Every module's layout fits flex (1D), grid (2D), or deliberate custom canvas.
No module needs a third layout primitive. layoutColumns is a domain-specific
pattern, not a primitive.

## Classification by module

### FLEX only (no changes needed)

| Module | Layout | Notes |
|--------|--------|-------|
| wibwob-poetry-clock | createStack + createColumns | Gold standard flex usage |
| wibwob-tr808 | createStack | Pure vertical stack |
| wibwob-tidepool | createStack | Pure vertical stack |
| world-chatroom | sidebar + manual | Should use createSidebarPanel |
| heartbeat | single box | No layout engine needed |
| ansi-lab | single box | No layout engine needed |
| e026-demo | flex | Basic flex layout |
| wibwob-figlet-fonts | — | Content module, no layout |
| example-primers | — | Content module, no layout |

### FLEX + GRID composition

| Module | Current approach | Grid opportunity |
|--------|-----------------|-----------------|
| hello-world | inlined createGrid + flex | Proven. Extract grid to SDK. |
| dashboard | blessed-contrib 12x12 grid | Main grid candidate. ~150-200 lines replaceable. |
| patchbay-lab | flex + manual sidebar rects | Sidebar (flex-row) with content area |
| wibwobworld | flex + conditional mode switching | Complex multi-mode, flex composition |

### GRID only

| Module | Notes |
|--------|-------|
| dashboard-xxl | Custom virtual canvas. Intentionally non-standard. Leave alone. |

### CANVAS / CUSTOM (deliberate, don't convert)

| Module | Layout | Reason |
|--------|--------|--------|
| zine | scroll + absolute + drag | Domain-specific panel placement (layoutColumns) |
| sy2-chronicles | scroll + absolute + drag | Same as zine |
| slap-editor | custom text rendering | Editor, not a layout problem |
| glitchbox | single animated box | Custom rendering |
| touchlab-mvp | free-form draggable windows | Absolute positioning correct |
| terminal | PTY bridge | Not a layout problem |

## Key findings

1. FLEX covers ~60% of modules as-is. No changes needed.
2. GRID would improve ~15% of modules (dashboard, hello-world extraction).
3. ~25% are deliberate custom layouts that should NOT be converted.
4. layoutColumns (Zine) is a PATTERN built for one subsystem, not a primitive.
   Codex confirms: it consumes PanelDef[], bakes in zine semantics, and is not
   a reusable composition surface.
5. Sidebar pattern appears 3x (patchbay, chatroom, wibwobworld) — already has
   createSidebarPanel, which is a flex pattern. Working fine.
6. Composition needs are real but limited: patchbay wants sidebar containing
   content; hello-world has flex > grid > flex nesting; wibwobworld has
   mode-switched layouts.

## Codex architecture review highlights

- Two primitives (flex + grid), patterns on top. Agreed.
- LayoutPart (not UiPart) as composition interface: node, layout(rect),
  update(props), restyle(), destroy(). Optional getMinSize?() for future.
- Grid must accept LayoutPart children from day one (not raw blessed nodes).
- justify/align object form, not compass enum.
- Reserve "auto" in TrackSize now, implement later.
- layoutColumns stays subsystem-local or becomes a pattern helper, not SDK primitive.
- Demo vocabulary (compass) must not become SDK vocabulary.

## Recommendation

Proceed with E034 using two-primitive model. Rewrite brief accordingly.
F00 = naming decisions + composition contract. F01 = extract flex/grid to SDK
with LayoutPart composition. F02 = port dashboard only. Everything else stays.
