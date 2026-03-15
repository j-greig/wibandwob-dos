> **E042 Solid Foundations** — Slice 7 of 10
> → Next: [`e42-S08` Handle API Components](../e42-S08/autoresearch.md)
> Planning: `.planning/epics/e042-solid-foundations/e042-slices-7-10.md`

# Autoresearch: E042-S07 — SDK Naming: Drop `Simple` Prefix

## Objective

Give clean canonical names to SDK Handle components. The `createSimpleStatusBar` /
`createSimpleButtonBar` names exist because the old LayoutPart versions already owned
`createStatusBar` / `createButtonBar`. Fix: rename the old LayoutPart ones to
`createLayoutStatusBar` / `createLayoutButtonBar` in all internal files, then drop
`Simple` from the SDK versions.

Target: zero `createSimple*` in SDK-facing exports. Clean `create<Component>` names
matching the nomenclature in `docs/design-system.md`.

## Metrics

- **Primary**: `simple_prefix_count` (count, lower is better) — occurrences of
  `createSimple` in SDK exports + microapps + docs. Target: 0.
- **Secondary**:
  - `layout_prefix_count` — occurrences of `createLayout` in internal files (should increase)
  - `typecheck_seconds` — regression watch

## How to Run

`./autoresearch.sh` — outputs `METRIC name=number` lines.

## Files in Scope

| File | Change |
|------|--------|
| `src/ui/chrome.ts` | Rename `createStatusBar` → `createLayoutStatusBar`, `createButtonBar` → `createLayoutButtonBar` |
| `src/core/modal.ts` | Update import |
| `src/core/overlay-manager.ts` | Update import |
| `src/core/primitives.ts` | Update re-export |
| `src/sdk/microapp-host.ts` | Update import + type |
| `src/services/microapp-loader.ts` | Update import + host wiring |
| `src/windows/music-player-window.ts` | Update import |
| `src/windows/terrain-lab-window.ts` | Update import |
| `src/sdk/composition-helpers.ts` | Rename `createSimpleStatusBar` → `createStatusBar`, `createSimpleButtonBar` → `createButtonBar` |
| `src/services/microapp-sdk.ts` | Update exports (drop `Simple`) |
| `microapps/notepad/index.ts` | Update import |
| `microapps/data-dashboard/index.ts` | Update import |
| `docs/sdk-primitives.md` | Update names |
| `docs/design-system.md` | Update names |
| `docs/microapp-examples.md` | Update names |

## Off Limits

- Adding or removing components — naming only
- Changing component behaviour
- Touching non-SDK microapps

## Constraints

- `bun run health` must pass (tests + typecheck + COAT + 0 cycles)
- All existing imports continue to work
- Old LayoutPart barrel re-exports from `src/core/ui-parts.ts` updated

## What's Been Tried

_Nothing yet — fresh start._
