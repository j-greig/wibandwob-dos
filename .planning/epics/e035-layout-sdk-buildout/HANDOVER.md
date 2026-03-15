# E035 Layout SDK Buildout — Handover

**Date:** 2026-03-12  
**Status:** Planning ready. Implementation not started.  
**Companion brief:** `e035-brief.md`

## What E035 is

E035 is the implementation epic that follows the design/alignment work from
E034.

E034 produced:
- the naming and API decisions
- the canon layout guide
- proving-ground demo modules from both Pi and Codex
- human review of those demos

E035 is where the codebase is brought into line with that canon surface.

This is not just "extract a grid helper." It is:
- build the canon SDK surface
- prove it on real modules
- migrate existing and private modules in a sensible order
- remove obsolete inline layout logic where the SDK now covers it

## Canon source of truth

Start here, in this order:

1. `.agents/microapp-dev/.workings/layout-guide-final.md`
2. `e035-brief.md`
3. `.planning/epics/e034-layout-primitives-sdk/HANDOVER.md`
4. `.agents/microapp-dev/.workings/layout-guide-alignment.md` only if a design
   detail is unclear

Do not start from the old E034 brief alone. It predates several important
decisions and does not reflect the full demo findings.

## The settled layout model

### Two primitives only

There are two layout primitives:
- flex
- grid

Canon names:
- `createStack`
- `createRow`
- `createGrid`

Everything else is a pattern or helper built around them.

### Naming canon

- `createStack` = vertical flex
- `createRow` = horizontal flex
- `createGrid` = 2D placement
- `templateRows` / `templateColumns`
- `gap: number | { row?: number; column?: number }`
- `justify` = horizontal
- `align` = vertical
- `LayoutPart` is the composition contract

Use canon names in code, docs, and examples. The final guide is intentionally
canon-only.

### Responsive rule

The single biggest lesson from the demo review was:

**stack and scroll before you crush**

Meaning:
- if a narrow layout would produce useless slivers or unreadable widths,
  change composition
- stack regions vertically
- allow the surface to become taller than the viewport
- provide a real scrollable viewport

Do not optimise for “everything always fits on one screen” if legibility is
lost.

### Scroll viewport status

Scrollable viewport support is real and needed, but it is not a third layout
primitive.

Treat it as a support helper:
- fixed header/footer if needed
- scrollable middle viewport
- inner content box owns overflow height
- conditional scrollbar visibility
- theme-consistent styling
- actual scroll input wiring

This is important enough that it belongs in the E035 implementation plan, not
in some vague post-epic future.

## What the demos taught us

### Strongest findings

- `responsive-panels`: narrow mode must stack and scroll
- `flex-bands`: stacked narrow mode is better than keeping a useless sliver of
  aside visible
- `flex-workbench`: app-like nested flex is good, but document/content panes
  need real scrolling
- `layout-stress-test`: contrib interop and deep nesting are real, not
  theoretical

### Demo winners by lesson

- Flex Wrap Demo: concept proven by both; keep as proving-ground, not canon SDK
- Flex Bands: Codex narrow-stack behavior is the right responsive lesson
- Responsive Panels: Codex behavior proved the correct mobile analogue
- Flex Workbench: Pi structure + Codex real scrollbar is the right hybrid
- Layout Stress Test: Pi version is the stronger proof reference

Do not cargo-cult any single demo wholesale into the SDK. Extract the lessons.

## Known implementation traps

These are not design questions anymore. They are known code issues to handle
during E035.

### 1. `createTextBlock` zero-width crash

`createTextBlock` creates scrollable blessed boxes. Blessed can crash when a
scrollable box reaches zero width during narrow resize.

Practical implication:
- do not use `createTextBlock` as a generic structural region shell
- prefer `createNodePart(blessed.box(...))` for regions that may collapse,
  hide, or be repeatedly relaid out

E035 should fix this properly.

### 2. Resize double-fire / extra relayouts

Current layout internals can relayout from internal resize listeners while the
module also calls `root.layout(...)` from `win.onResize(...)`.

Practical implication:
- `win.onResize(() => root.layout(...))` is still the correct module pattern
- but the implementation should be cleaned up so resize behavior is less noisy

### 3. Contrib interop must remain supported

The stress tests proved both of these matter:
- contrib widgets inside flex/grid compositions
- flex layouts inside contrib-owned surfaces/cells

Do not let the SDK extraction narrow the system so that contrib becomes a
second-class citizen.

## Migration posture

E035 is not "port every module immediately in one sweep."

The correct order is:
1. lock the canon surface
2. make composition real in SDK code
3. prove it on a few real modules
4. then do the broad migration

Why:
- otherwise you will thrash names and APIs mid-migration
- modules will be ported twice
- private-module migration becomes noisy and expensive

## Broad migration rule

E035 includes:
- existing repo modules
- relevant private modules

But be pragmatic:
- not every sketch/demo must become production-grade
- if a module becomes disproportionately painful, move it to the E035 parking
  lot with a reason
- a human can then decide keep/exempt/retire

Do not let low-value pain block the high-value convergence work.

## Files that matter

Primary implementation files:
- `src/core/ui-parts.ts`
- `src/services/microapp-sdk.ts`
- `microapps/hello-world/index.ts`
- `microapps/dashboard/index.ts`
- `microapps/zine/index.ts`

Planning/docs:
- `.planning/epics/e035-layout-sdk-buildout/e035-brief.md`
- `.planning/epics/e034-layout-primitives-sdk/HANDOVER.md`
- `.agents/microapp-dev/.workings/layout-guide-final.md`

## What success looks like

E035 is done when:
- the SDK exports the canon layout surface
- real modules use it
- responsive layouts stack and scroll correctly
- scroll viewport boilerplate is shared instead of bespoke
- docs in `.agents/microapp-dev/` and public docs teach the new surface cleanly
- old inline/proving-ground layout helpers are no longer the primary path

## What not to do

- do not reopen naming debates that were already settled
- do not add a third layout primitive
- do not promote `layoutColumns` into a general SDK primitive
- do not force every sketch module into production-quality refactor if it has
  little value
- do not leave the docs stale while changing the SDK surface

## Visual verification loop

Layout work MUST be visually verified. API responses and typecheck are not
sufficient — rendering bugs, overflow, clipping, and scroll behavior only
show on screen.

### Autonomous verification pattern

After every layout change, run this loop:

1. **Restart the app in tmux** (if not already running):
   ```bash
   bash scripts/restart.sh
   # or: tmux new-session -d -s wibwob -x 230 -y 62 'bun run start'
   ```

2. **Wait for health**:
   ```bash
   curl -s http://127.0.0.1:8099/health
   ```

3. **Open the module under test via API**:
   ```bash
   curl -s http://127.0.0.1:8099/commands/run -X POST \
     -H 'Content-Type: application/json' \
     -d '{"command":"microapp.wibwob.<module-id>.open"}'
   ```

4. **Resize to test breakpoints** — hit lg, md, sm widths:
   ```bash
   for w in 100 70 40; do
     curl -s http://127.0.0.1:8099/windows/resize -X POST \
       -H 'Content-Type: application/json' \
       -d "{\"id\":<win-id>,\"width\":$w,\"height\":30}"
     sleep 0.5
     # Check state for layout metrics
     curl -s http://127.0.0.1:8099/state | python3 -c "
       import sys,json
       for w in json.load(sys.stdin)['windows']:
         if w['id']==<win-id>: print(w.get('details',{}).get('summary','no state'))"
   done
   ```

5. **Take a screenshot for visual proof**:
   ```bash
   ./scripts/screenshot-window.sh "<Window Title>"
   # or full desktop:
   ./scripts/minimap.sh
   ```

6. **Check for overflow / clipping** — look for content south of the
   window boundary, panels overlapping chrome, missing scrollbars.

### What to verify at each size

| Size   | Check                                              |
|--------|----------------------------------------------------|
| lg     | All panels visible, correct proportions             |
| md     | Hidden panels gone, main expands, no dead space     |
| sm     | Stacked layout, scrollbar visible if content overflows, no content clipped outside window bounds |
| narrow | Drag to minimum width — no crash, no blessed error  |
| expand | Drag back wide — layout recovers correctly          |

### Do not skip the narrow→wide round-trip

The E034 demos proved that the crash path is narrow→wide, not just
narrow. Always test: start wide, drag narrow, drag wide again.

### Run this loop autonomously

Do not wait for the human to say "test it." After every layout change:
typecheck → restart → open → resize → screenshot → verify. If something
looks wrong, fix it before moving on. The human should only need to
attach to tmux for final sign-off, not for basic verification.

## First move for the next agent

Read:
1. `.agents/microapp-dev/.workings/layout-guide-final.md`
2. `e035-brief.md`
3. `src/core/ui-parts.ts`
4. `src/services/microapp-sdk.ts`

Then map the current code against the canon API and identify the smallest
implementation slice that gets E035 moving without reopening design.
