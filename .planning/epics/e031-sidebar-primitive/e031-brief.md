---
id: E031
title: Sidebar Primitive
status: not-started
issue: ~
pr: ~
depends_on: []
---

# E031 — Sidebar Primitive

> TL;DR: Six modules hand-roll sidebars with duplicated width maths, divider
> drawing, toggle logic, and no overflow guards. Extract a single
> `createSidebarPanel` primitive into `src/core/ui-parts.ts`, export via SDK,
> migrate each consumer. Fixes two known overflow bugs for free.

---

## Problem

Every module that needs a sidebar builds one from scratch with raw blessed
boxes. The result is:

- Six independent implementations of width calculation
- Four separate divider box constructions
- Three different toggle show/hide patterns
- Zero shared overflow protection (two modules have confirmed bugs)
- Constant values duplicated across files (Tidepool has sidebar width
  hardcoded in both renderer and index — they will drift)

---

## Audit: current sidebar implementations

### 1. Patchbay Lab — primer list sidebar

**Files:** `modules/patchbay-lab/index.ts:459-578`

- Content: scrollable primer list + preview pane, only visible in overview mode
- Width: `clamp(width * 0.32, 24, 36)` — percent with min/max
- Toggle: mode-gated (shown when `view === "overview"`)
- Built with: raw blessed.box + manual `applyRect`
- Issues: none confirmed, but width policy is bespoke

### 2. World Chatroom — participants sidebar

**Files:** `modules/world-chatroom/index.ts:143-218`

- Content: right-side gameLog with players + system events
- Width: fixed `26`, never changes
- Toggle: none, always visible
- Built with: raw blessed + manual rects
- BUG: can overflow on narrow windows (`transcriptWidth` goes to 12, but
  `12 + 26` may exceed `innerW`)

### 3. WibWobWorld — terrain info sidebar

**Files:** `modules/wibwobworld/index.ts:154-735`

- Content: right info panel for terrain/contour modes, hidden in iso/hybrid/firstperson
- Width: `max(14, floor(rect.width / 6))` — proportional with floor
- Toggle: `i` key toggles `sidebarOpen` boolean
- Built with: SDK `createTextBlock` for content + manual rect layout
- BUG: sidebar width can exceed available width on very small windows

### 4. WibWob Tidepool — ecology stats sidebar

**Files:** `modules/wibwob-tidepool/renderer.ts:126-215`, `modules/wibwob-tidepool/index.ts:140-146`

- Content: text-only inline sidebar (species, biodiversity, tide, ecology)
- Width: fixed `26`, hardcoded in BOTH renderer.ts AND index.ts
- Toggle: none, always visible
- Built with: pure text rendering, no separate blessed node
- BUG (latent): width constant duplicated across two files — will drift on edit

### 5. ZINE — file browser sidebar

**Files:** `modules/zine/index.ts:143-271`

- Content: list of .canvas.yaml files with selection highlight
- Width: fixed `SIDEBAR_WIDTH` (26) + 1 char divider
- Toggle: `[` key toggles, moves canvas.left
- Built with: raw blessed.box + blessed.list + divider box
- Issues: toggle changes canvas geometry directly, tight coupling

### 6. Scene Layout — VJ timeline tokens

**Files:** `src/services/scene-layout.ts:83-87`

- Content: `sidebar-right` and `sidebar-left` as layout presets (30% width)
- Toggle: N/A (geometry resolver only, no UI)
- Built with: pure rect maths
- Shared primitive fit: indirect — useful as geometry policy source

---

## What is duplicated (patterns repeated 3+ times)

| Pattern | Occurrences | Notes |
|---------|-------------|-------|
| Width calculation | 6 | fixed, percent, clamp — all different |
| Divider box creation | 4 | patchbay, zine, tidepool, world-chatroom |
| Toggle show/hide state | 3 | wibwobworld, zine, patchbay (mode-gated) |
| Sidebar resize on window resize | 5 | all except scene-layout |
| Overflow guard (mainWidth >= minWidth) | 0 | NONE — two confirmed overflow bugs |

---

## Design: `createSidebarPanel`

New primitive in `src/core/ui-parts.ts`, exported via `src/services/microapp-sdk.ts`.

### Shape

```typescript
interface SidebarPanelOptions {
  parent: blessed.Widgets.BoxElement;
  side: "left" | "right";
  width: SidebarWidth;
  divider?: boolean;          // default true, single char column
  open?: boolean;             // default true
  mainMinWidth?: number;      // default 12, overflow guard
  style?: {
    sidebar?: blessed.Widgets.Types.TStyle;
    main?: blessed.Widgets.Types.TStyle;
    divider?: blessed.Widgets.Types.TStyle;
  };
}

type SidebarWidth =
  | { fixed: number }                          // e.g. { fixed: 26 }
  | { percent: number; min?: number; max?: number }  // e.g. { percent: 0.32, min: 24, max: 36 }

interface SidebarPanel {
  /** The outer container — append to window body. */
  container: blessed.Widgets.BoxElement;
  /** The main content pane (larger side). */
  main: blessed.Widgets.BoxElement;
  /** The sidebar pane. */
  sidebar: blessed.Widgets.BoxElement;
  /** The divider element (if enabled). */
  divider?: blessed.Widgets.BoxElement;

  /** Toggle sidebar open/closed. Preserves focus. */
  toggle(): void;
  /** Set sidebar open state explicitly. */
  setOpen(open: boolean): void;
  /** Current open state. */
  isOpen(): boolean;

  /** Recalculate layout after container resize. Call from onResize. */
  layout(): void;

  /** Resolved sidebar width in current layout. */
  sidebarWidth(): number;
  /** Resolved main width in current layout. */
  mainWidth(): number;
}
```

### Width resolution logic

```
resolvedWidth = policy is fixed   → policy.fixed
              | policy is percent → clamp(floor(total * percent), min, max)

if resolvedWidth + divider + mainMinWidth > totalWidth:
  resolvedWidth = max(0, totalWidth - divider - mainMinWidth)
```

This overflow guard is the single biggest win — it prevents the bugs in
world-chatroom and wibwobworld.

### Divider

Single character column (`│`) between sidebar and main. Styled separately.
Shown/hidden with sidebar.

### Toggle behaviour

- `toggle()` flips open state
- When closed: sidebar and divider get `width: 0; hidden: true`
- Main expands to fill container
- Focus preserved: if sidebar had focus, moves to main on close

---

## Build order

### F01 — Primitive

#### S01 — Create `createSidebarPanel` in `ui-parts.ts`
- Implement the interface above
- Width resolution with overflow guard
- Divider rendering
- Toggle with focus preservation
- Export via `microapp-sdk.ts`
- AC: typecheck clean, unit test for width resolution edge cases

#### S02 — Unit tests for width resolution
- Fixed width at various container sizes
- Percent width with min/max clamping
- Overflow: sidebar + mainMin > total → sidebar shrinks
- Zero-width edge case
- AC: `bun test` passes

### F02 — Migration (highest payoff first)

#### S03 — Migrate world-chatroom
- Replace manual sidebar layout with `createSidebarPanel`
- Fixed width 26, right side, no toggle
- AC: smoke test, overflow bug fixed at narrow widths

#### S04 — Migrate ZINE
- Replace sidebarBox + sidebarList + sidebarDivider with primitive
- Fixed width 26, left side, `[` toggle
- AC: toggle works, canvas geometry updates, file switching works

#### S05 — Migrate WibWobWorld
- Replace manual info sidebar with primitive
- Percent width `1/6` with min 14, right side, `i` toggle
- Mode-aware: setOpen(false) in iso/hybrid/firstperson
- AC: toggle works, overflow bug fixed, mode switching correct

#### S06 — Migrate Patchbay Lab
- Replace primerSidebarBox with primitive
- Percent width 32% with clamp 24-36, left side, mode-gated
- AC: overview mode shows sidebar, other modes hide it

#### S07 — Tidepool: shared sizing constant
- Extract sidebar width to shared constant or use primitive's sidebarWidth()
- Tidepool renderer is text-only so full primitive may not apply
- At minimum: single constant imported by both renderer.ts and index.ts
- AC: width constant defined once, both files import it

### F03 — Cleanup

#### S08 — Remove dead sidebar code
- Delete all replaced manual sidebar implementations
- Verify no regressions via smoke test across all migrated modules
- AC: grep for manual sidebar patterns returns only the primitive

---

## Acceptance criteria

- [x] AC-1: Audit complete, all sidebar implementations catalogued (this doc)
- [ ] AC-2: `createSidebarPanel` primitive in ui-parts.ts, exported via SDK
- [ ] AC-3: Width resolution handles fixed, percent, and overflow cases
- [ ] AC-4: world-chatroom migrated, narrow-window overflow fixed
- [ ] AC-5: ZINE migrated, toggle and file switching preserved
- [ ] AC-6: WibWobWorld migrated, toggle and mode-awareness preserved
- [ ] AC-7: Patchbay Lab migrated, mode-gated visibility preserved
- [ ] AC-8: Tidepool sidebar width defined once, no duplication
- [ ] AC-9: `bun run typecheck` clean throughout
- [ ] AC-10: All five sidebar modules smoke-tested after migration

---

## Analysis source

Codex analyst report (full details, per-file line references):
`.codex-logs/2026-03-10/codex-analyse-all-sidebar-implementa-2026-03-10T14-52-55.log`

---

## Open questions

- Should the primitive support nested scrollable content in both panes, or
  leave that to the consumer? (Recommendation: leave it — the panes are
  plain blessed boxes, consumers append scrollable children as needed.)
- Should Tidepool migrate fully or just share the width constant?
  (Recommendation: constant first, full migration only if text rendering
  moves to blessed nodes later.)
- Should scene-layout sidebar presets (`sidebar-left`, `sidebar-right`) use
  the same width resolution function? (Recommendation: yes, extract the
  pure math into a shared `resolveSidebarWidth` function that both the
  primitive and scene-layout use.)
