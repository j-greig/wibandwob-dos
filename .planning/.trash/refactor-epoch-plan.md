<retired reason="superseded" replacement=".planning/BUILD.md">
Epoch tracker. Epochs 1-2 landed. Epoch 3 and parking lot items absorbed into master checklist.
Master checklist: .planning/BUILD.md

# TS TUI Refactor Epoch Plan

Canonical plan file for this refactor pass.

Notes:
- this is the single source of truth
- update checkboxes here as work lands
- do not maintain a second duplicated tracker in parallel
- if machine-readable state is needed later, generate it from this file instead of hand-maintaining two plans

Goal: refine the existing spike into a cleaner substrate before adding more product surface.

Rules for this pass:
- no new window types
- no scattered new entry points
- keep behavior stable where possible
- every user-visible surface must stay mirrored in state and control API

## Epoch 1

- [x] Review `BUILD-ORDER-FINAL.md` and map the first extraction slice to the current spike
- [x] Tighten `AGENTS.md` so reorg passes stay reorg-only and state/control parity stays mandatory
- [x] Extract static menu and palette definitions out of `src/core/app-controller.ts`
- [x] Extract the low-risk window family out of `src/core/app-controller.ts`
- [x] Remove misplaced runtime artifacts from `src/`
- [x] Run `bun run typecheck`
- [x] Re-review the remaining `app-controller.ts` hot spots and record the next slice

### Epoch 1 result

- `src/core/app-controller.ts` dropped from 2878 lines to 2565 lines
- menu and palette definitions now live in `src/core/menu-config.ts`
- shared scrollbar primitive now lives in `src/core/ui-primitives.ts`
- simple window family now lives in `src/windows/misc-windows.ts`
- misplaced runtime snapshot `src/scratch/app-state.json` was removed

### Next hot spots

- terminal creation and PTY wiring
- browser/gallery windows
- editor and text-viewer factories
- workspace snapshot restore and payload serialization
- popup/system/window context menu ownership

## Epoch 2

- [x] Extract browser/gallery/workspace restore helpers into dedicated modules
- [x] Reduce direct blessed widget construction inside `app-controller.ts`
- [x] Normalize window-family state/restore hooks
- [x] Add API/state parity checks for existing windows

### Epoch 2 progress

- browser and gallery windows now live in `src/windows/content-windows.ts`
- editor factory now lives in `src/windows/text-windows.ts`
- workspace snapshot serialize/restore now lives in `src/core/workspace-snapshots.ts`
- editor mutation/render logic now lives in `src/services/editor-service.ts`
- figlet/browser/art window helpers now live outside the controller
- menu overlay ownership now lives in `src/core/menu-overlay-manager.ts`
- context-menu items now live in `src/core/context-menu-items.ts`
- file-open/save prompt helpers now live in `src/services/file-actions.ts`
- workspace prompt helpers now live in `src/services/workspace-ui.ts`
- `src/core/app-controller.ts` is now down to 1881 lines

### Remaining Epoch 2 work

- decide whether to extract workspace save/load UI prompts from the controller or keep them as orchestration
- tighten remaining control/API parity around extracted window families

### Evidence

- control/API parity loop passes via `scripts/window-state-parity-loop.sh`
- latest text capture: `scratch/captures/window-state-parity-loop.txt`
- latest state snapshot: `scratch/app-state.json`
- `bun run typecheck` passes after the latest extraction pass

### Plan hygiene

- `refactor-epoch-plan.md` is now the only canonical tracker
- the duplicate JSON tracker was removed because it was creating drift risk for no real benefit

## Epoch 3

- [x] Continue shrinking `app-controller.ts` by extracting remaining Backrooms and agent orchestration seams — absorbed into `.planning/BUILD.md` Tier 1
- [x] Harden repaint/invalidation rules so stale shadow/content cells stop surviving resize/move/close — absorbed into `.planning/BUILD.md` Tier 1
- [x] Keep using the control API loop to regression-check window-state and repaint behavior after each refactor — implicit in BUILD.md hardening work

---

## Parking lot - comments from Claude Code to maybe action or ignore if rubbish

- **Tests**: zero test files exist — add bun test + content-measurement + workspace round-trip before epoch 2 refactors blind.
- **Theme tokens**: 28 hardcoded blessed style literals in controller will get copy-pasted into every extracted module — tokenise before bulk extraction.
- **WindowRecord shape**: optional fields (`editor?`, `chat?`, `writeInput?`, `refresh?`) still grow per window type — refactor to discriminated union or module-owned state before epoch 2.
- **Snapshot switches**: serializeWindowSnapshot/restoreWindowSnapshot are big switch statements that grow per type — modules must own their own serialize/restore, not just shuffle cases.
- **Overlay-manager coupling**: file browser prompt (lines 403-648) is coupled to gallery/browser content discovery — may need touching when epoch 2 extracts those windows.
- **API routes**: no epoch adds /commands discovery or new endpoints — extracted windows need control API parity as they land.
- **Dual measurement**: openPrimerWindow re-measures via measurePrimerContent instead of consuming content-service's readPrimerMetadata — single measurement path when primers get extracted.
</retired>
