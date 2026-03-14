# E035 — Decisions Needed

74/86 tasks complete. These remaining items need human input.

---

## 1. Dashboard → createGrid

**Status:** Deferred

**Rationale:** The dashboard module (655 lines, 7 tabs) uses `contrib.grid`
(blessed-contrib's built-in grid system) for every tab's layout. Each tab
calls `new contrib.grid({rows: 12, cols: 12, screen: container})` and places
contrib widgets (line charts, bar charts, sparklines, etc.) via positional
`grid.set()`.

Replacing contrib.grid with SDK `createGrid` would mean wrapping every
contrib widget in `createNodePart`, converting all positional args to
object-form, and reworking how contrib widgets get their parent containers.
This is a deep rewrite with high risk of breaking contrib widget rendering.

**Options:**
- A) Leave dashboard using contrib.grid — it works, and the SDK grid is
  proven elsewhere (hello-world uses it)
- B) Rewrite dashboard to use SDK createGrid — significant effort, risk
  of contrib rendering bugs
- C) Build a thin adapter: `contrib.grid` → SDK `createGrid` bridge

**Recommendation:** Option A. The dashboard is a contrib showcase, not a
layout SDK showcase. The grid is proven on hello-world.

---

## 2. Proving-ground demo modules

10 demo modules were created during E034 to prove the layout design.
Now that E035 has built the actual SDK and migrated real modules, these
demos serve a diminished purpose.

| Module | Notes |
|--------|-------|
| `flex-wrap-demo-pi` | Proves flex wrap concept — not yet in SDK |
| `flex-wrap-demo-codex` | Same concept, Codex version |
| `flex-bands-demo-pi` | Proves stacked narrow mode |
| `flex-bands-demo-codex` | Same, Codex version — better narrow behavior |
| `responsive-panels-demo-pi` | Proves responsive breakpoints |
| `responsive-panels-demo-codex` | Same, with real scrollbar proof |
| `flex-workbench-demo-pi` | Proves app-like nested flex |
| `flex-workbench-demo-codex` | Same, with real scrollbar proof |
| `layout-stress-test-pi` | Proves deep nesting + contrib interop |
| `layout-stress-test-codex` | Same, Codex version |

**Options:**
- A) Keep all — they serve as regression tests and reference examples
- B) Keep one per concept pair (pick Pi or Codex winner), delete the other
- C) Archive all to a `microapps/_archive/` directory
- D) Delete all — the real modules are the proof now

**Recommendation:** Option B. Keep the stronger of each pair:
- `flex-bands-demo-codex` (better narrow)
- `responsive-panels-demo-codex` (real scrollbar)
- `flex-workbench-demo-pi` (better structure)
- `layout-stress-test-pi` (stronger interop proof)
- Delete the flex-wrap demos (concept not yet in SDK)

---

## 3. Private modules

The brief calls for auditing and migrating private modules to the canon
surface. This needs human guidance on:
- Which private modules exist and where
- Whether they should be migrated or exempted
- Access to the private module codebase

---

## 4. Parking lot

No modules were blocked or parked during migration. All repo modules
either migrated cleanly or had no old names to change. The parking-lot
review can be closed with "nothing parked."
