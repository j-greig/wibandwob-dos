# E035 Layout SDK Buildout — Human Briefing

**Branch:** `epic/e035-layout-sdk-buildout` (19 commits)
**Status:** Ready for sign-off. Typecheck clean. Visual verified. Two gpt53 review passes actioned.

## QUICK-FIRE DECISIONS (60 seconds)

1. Dashboard: keep on contrib.grid, exempt from SDK migration? **Y/N**
2. Proving-ground demos: delete 6, keep 4 strongest? **Y/N**
3. Private modules: any exist that need migrating? **paths / none**
4. Parking lot: confirm nothing parked? **Y/N**

Recommended answers: Y, Y, none, Y — then I close the epic.

## What changed

The codebase now has a canon layout SDK matching the E034 design guide:

**New primitives in `src/core/ui-parts.ts`, exported from `microapp-sdk`:**
- `createGrid` — 2D grid with templateRows/templateColumns, gap, object-form set()
- `pickBreakpoint` — width-based responsive mode selection
- `createScrollViewport` — fixed header/footer + scrollable middle
- `createScrollbar` / `scrollableStyle` — now SDK-exported (were internal-only)

**Renames (old names fully removed, no aliases remain):**
- `UiPart` → `LayoutPart`
- `StackChild` → `FlexChild`
- `createColumns` → `createRow`

**New types:** `FlexBasis`, `TrackSize`, `AxisAlign`, `Alignment`, `Gap`, `GridChild`, `GridOptions`, `GridHandle`, `BreakpointName`, `BreakpointEntry`, `ScrollViewportOptions`, `ScrollViewportHandle`

**Safety fixes:**
- `createTextBlock` no longer crashes at zero width
- Internal resize listeners removed from flex layout (no more double-fire)

**Migration:** All 16 module files + 3 internal windows updated. Zero old names remain in `src/` or `microapps/`.

**Docs:** `sdk-reference.md` has a full layout section with examples.

## What's proven

All key modules tested via API: open, wide→narrow→wide resize, extreme narrow (5x5).

| Module | Resize test | Extreme narrow | Rendering |
|--------|------------|----------------|-----------|
| Hello World | XL→L→S→S→S→L→XL | 5x5 survived | figlet + cats correct |
| Heartbeat | 38→20→10→20→38 | 5x5 survived | pulse + BPM correct |
| Poetry Clock | opened OK | 5x5 survived | time + poem correct |
| E026 Demo | 110→60→30→60→110 | 5x5 survived | panels + animation correct |

Evidence: run `tmux attach -t wibwob` to see live app. Run `./scripts/screenshot-window.sh "Title"` for any window.

## Your 4 decisions

Full rationale in `DECISIONS-NEEDED.md`. Quick summary:

**1. Dashboard → createGrid?**
Recommend: NO. Leave it using contrib.grid. Deep rewrite, high risk, low value.

**2. Proving-ground demos — keep which?**
Recommend: Keep 4 strongest, delete 6:
- KEEP: flex-bands-demo-codex, responsive-panels-demo-codex, flex-workbench-demo-pi, layout-stress-test-pi
- DELETE: flex-wrap-demo-pi, flex-wrap-demo-codex, flex-bands-demo-pi, responsive-panels-demo-pi, flex-workbench-demo-codex, layout-stress-test-codex

**3. Private modules?**
Need your guidance on which exist and where. Can migrate once pointed at them.

**4. Parking lot?**
Nothing was parked. All modules migrated cleanly or were already on canon names. Close with "nothing parked."

## Closeout checklist (74/86)

After your 4 decisions, remaining work is:

- [ ] Dashboard decision (mark done or exempt)
- [ ] Delete/archive chosen proving-ground demos
- [ ] Private module audit + migration (if any)
- [ ] Close parking lot
- [ ] Set brief status to `done`
- [ ] `bun run planning:sync`
- [ ] Final commit: `docs(planning): close E035 Layout SDK Buildout`
