# TS TUI Refactor Epoch Plan

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

- [ ] Extract browser/gallery/workspace restore helpers into dedicated modules
- [ ] Reduce direct blessed widget construction inside `app-controller.ts`
- [ ] Normalize window-family state/restore hooks
- [ ] Add API/state parity checks for existing windows

## Epoch 3

- [ ] Collapse the dual terminal paths toward one owned subsystem
- [ ] Improve xterm-shell redraw correctness using scratch logs and captures
- [ ] Use the control API loop to regression-check terminal behavior after each parser change

---

## Parking lot

- **Tests**: zero test files exist — add bun test + content-measurement + workspace round-trip before epoch 2 refactors blind.
- **Theme tokens**: 28 hardcoded blessed style literals in controller will get copy-pasted into every extracted module — tokenise before bulk extraction.
- **WindowRecord shape**: ~10 optional fields (editor?, terminal?, chat?, writeInput?, refresh?) grow per window type — refactor to discriminated union or module-owned state before epoch 2.
- **Snapshot switches**: serializeWindowSnapshot/restoreWindowSnapshot are big switch statements that grow per type — modules must own their own serialize/restore, not just shuffle cases.
- **Overlay-manager coupling**: file browser prompt (lines 403-648) is coupled to gallery/browser content discovery — may need touching when epoch 2 extracts those windows.
- **API routes**: no epoch adds /commands discovery or new endpoints — extracted windows need control API parity as they land.
- **Pi Chat on legacy PTY**: epoch 3 kills the legacy terminal path but Pi Chat also rides openPtyWindow — must migrate Pi Chat too or it breaks.
- **Dual measurement**: openPrimerWindow re-measures via measurePrimerContent instead of consuming content-service's readPrimerMetadata — single measurement path when primers get extracted.
