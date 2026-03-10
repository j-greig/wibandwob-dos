---
id: E029
title: Context-Aware Menus
status: done
issue: ~
pr: ~
depends_on: []
spike: spk-context-file-menu
---

# E029 — Context-Aware Menus

Make the File menu reflect the focused window (like macOS), add visual
separators between menu groups, and give the Applications menu a pinned
Favourites bucket above an A-Z sorted main list.

## Problem

1. File menu is a static flat list built once at startup. Every window
   sees the same nine items regardless of what is focused.
2. All menus are flat — no visual grouping between thematic sets of commands.
3. Applications menu is ordered by hand via `order` numbers — no A-Z sort,
   no concept of a pinned-favourites section.
4. Context menus already filter by `windowKinds` — menu bar does not.

## Outcome

- File menu items = items appropriate to the focused window's appType.
  No focus → safe global fallback (current behaviour preserved).
- All menus support separator items (non-selectable horizontal rules)
  that skip cleanly during keyboard navigation.
- Applications menu: Favourites bucket (Wib&Wob Agent + Scramble) pinned
  at top, separator, then remaining items A-Z sorted.

---

## Stories

- [x] S01 — Context-aware File menu (`appTypes` filter on `MenuPlacement`)
- [x] S02 — Menu separators (non-selectable dividers, keyboard-skip)
- [x] S03 — Applications Favourites + A-Z sort

---

## S01 — Context-aware File menu

### What needs doing

`MenuPlacement` (command-catalog.ts:112) needs an optional `appTypes?: AppType[]` field.

`createMenuConfigs` (command-catalog.ts:998) is called once at startup and
returns a static list. It needs to become focus-aware — either:

**Option A (simpler):** `createMenuConfigs` stays static but `buildMenus` in
command-registry.ts becomes a `buildMenusForFocus(focusedAppType?: AppType)` method
that filters `menuPlacements` by appType, and app-controller rebuilds menus on focus
change via `this.commands.buildMenusForFocus(...)` + `this.menus.splice(...)`.

**Option B:** keep `buildMenus()` static, but `openMenu` in menu-overlay-manager.ts
filters items at render time using the currently focused window's appType.
Simpler because menus array doesn't mutate — just filter on open.

Recommended: Option B. No mutation, minimal change, single place.

### Data model change

In `command-catalog.ts`:
```ts
export interface MenuPlacement {
  category: AppCommandCategory;
  order: number;
  label?: string;
  appTypes?: AppType[];   // NEW — if set, item only shows when focused appType matches
  favourite?: boolean;    // NEW — used by S03 for Applications pinning
}
```

Items with no `appTypes` are always shown (global fallback preserved).

### Wiring

`openMenu` in `menu-overlay-manager.ts` receives a `getFocusedAppType: () => AppType | undefined`
callback injected at construction from `app-controller.ts` (which already calls
`this.windowManager.getFocusedWindow()`).

Filter items: `item.appTypes === undefined || item.appTypes.includes(focusedAppType)`.

### File menu per appType (initial, expand over time)

| Shown for | Items |
|-----------|-------|
| global (no focus) | New Editor, Open File, Open Primer Browser, Open Markdown, Reload Agent Prompt, Quit |
| text-editor | New Editor, Open Text File, Save, Export, Close, Quit |
| primer-viewer | Open Primer Browser, Close, Quit |
| reader-viewer | Open File, Close, Quit |
| markdown-viewer | Open Markdown File, Close, Quit |
| farjs-file-manager | (no file actions needed — it IS the file browser) Close, Quit |
| generative-art | Export Canvas, Close, Quit |
| wibwob-agent | Reload Agent Prompt, Close, Quit |

### ACs

- [x] `appTypes?: AppType[]` in `MenuPlacement`, typechecks clean
- [x] File menu items filtered by focused window's appType on open
- [x] No focus → global fallback (all items without appTypes restriction)
- [x] `bun run typecheck` clean
- [x] Manual smoke: open text editor, open File menu → editor items only

---

## S02 — Menu separators

Blessed `list` items are plain strings. Separator = a special label string
(`──────────`) whose action is a no-op AND whose index is skipped on j/k/Up/Down.

### Implementation

Add `separator?: true` to `MenuItem` in `types.ts`:
```ts
export interface MenuItem {
  label: string;
  action: () => void;
  separator?: true;
}
```

Separator items render as `──────────` (or padded `─` repeated to menu width).
In `openMenu`/`openPopupMenu` in `menu-overlay-manager.ts`, after the list fires
`select`, check `menu.items[index].separator` — if true, move selection to next
non-separator item (cycle forward).

Keyboard skip: hook `keypress` on the list, intercept j/k/down/up — if the
destination index is a separator, step again.

### Adding separators to menus

In `createMenuConfigs` (command-catalog.ts), separators are injected between
items whose `group` changes. OR add an explicit `separatorBefore?: true` to
`MenuPlacement` — simpler and explicit.

Applications menu uses `separatorBefore` after the last favourite (S03).

### ACs

- [x] `separator?: true` on `MenuItem`
- [x] Separator items render as a horizontal rule (full menu width)
- [x] j/k navigation skips separators cleanly
- [x] Click on separator does nothing (no close, no action)
- [x] `bun run typecheck` clean

---

## S03 — Applications Favourites + A-Z sort

### Favourites

Add `favourite?: true` to `MenuPlacement`. Items with `favourite: true` in
the `applications` category are pinned at the top of the Applications menu,
above a separator.

Initial favourites (update `command-catalog.ts`):
- `microapp.wibwob.agent.open` → `favourite: true` (Wib&Wob Agent)
- `companion.open` → `favourite: true` (Scramble floating)

### A-Z sort

Non-favourite applications menu items sort alphabetically by label, ignoring
case and any leading `Open ` prefix (so "Open Text Editor" sorts as "Text Editor").

### Rendering order

1. Favourites (in their original `order` sequence — manual control)
2. Separator (injected automatically)
3. Remaining items A-Z by label

### ACs

- [x] `favourite?: true` on `MenuPlacement`
- [x] Wib&Wob Agent and Scramble (floating) appear at top of Applications menu
- [x] Separator between favourites and rest
- [x] Non-favourite items A-Z sorted (case-insensitive, strip `Open ` prefix)
- [x] `bun run typecheck` clean
- [x] Manual smoke: Applications menu opens, favourites at top, separator, A-Z list

---

## Out of Scope (this epic)

- Edit menu (Undo/Redo scoping) — parking lot
- Dynamic top-level bar labels (macOS app-name menu) — Option C from spike, high complexity
- Per-window Scramble/Agent menu items in non-Applications menus

---

## Acceptance criteria (consolidated)

- [x] AC-1: `appTypes`, `favourite`, `separatorBefore` added to MenuPlacement — typecheck clean
- [x] AC-2: File menu filters by focused window's appType on open
- [x] AC-3: No focus → global fallback preserved
- [x] AC-4: Separator items render, skip on j/k, no-op on click
- [x] AC-5: Applications menu — Wib&Wob + Scramble pinned, separator, A-Z below
- [x] AC-6: `bun run typecheck` clean
- [x] AC-7: Manual smoke passes all three stories
