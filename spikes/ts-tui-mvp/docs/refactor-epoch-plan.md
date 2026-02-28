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

## Parking lot — things potentially missing from epochs 1-3

Cross-checked against BUILD-ORDER-FINAL.md, BUILD-ORDER.md (codex meta-review),
and the current source as of this commit.

### Tests (no epoch covers this)

Zero test files exist outside node_modules. No `test` script in package.json.
BUILD-ORDER says tests must exist from step 1. Epochs 1-3 refactor without
a safety net. Consider adding before or during epoch 2:
- `bun test` script in package.json
- content-measurement unit tests (the safest, most isolated module)
- workspace round-trip test (serialize → restore → serialize, diff payloads)
- screenshot/state JSON export for regression diffing between epochs

### Theme tokens (no epoch covers this)

28 hardcoded `style: { fg: "...", bg: "..." }` literals in app-controller.ts
plus more in window-manager.ts and overlay-manager.ts. Every extracted window
module will copy-paste these. BUILD-ORDER says tokenise before bulk extraction.
Epochs 2-3 extract more windows without addressing this. Consider a small
epoch 2.5 or fold into epoch 2:
- `src/core/theme.ts` with semantic token map (e.g. `theme.windowBorder`,
  `theme.titleBarFg`, `theme.menuBg`)
- Replace literals in existing extracted modules first (misc-windows.ts,
  menu-config.ts, ui-primitives.ts)
- New extractions in epoch 2 use tokens from day one

### WindowRecord bag-of-optionals (no epoch covers this)

Both codex and pi-agent agreed this is the biggest structural debt. The
shared WindowRecord has ~10 optional fields that grow with each window type.
Epoch 1 extracted misc-windows.ts but WindowRecord still has `editor?`,
`terminal?`, `chat?`, `writeInput?`, `refresh?` etc. Epoch 2 extracts more
windows but doesn't mention refactoring the record shape. Consider:
- Discriminated union: `WindowRecord & { kind: "editor", state: EditorState }`
- Or: generic `state: TState` owned by the window module
- Or at minimum: move optional fields behind `describeState()` so the shared
  interface stops growing

### Snapshot serialize/restore switches (epoch 2 mentions "normalize" but vaguely)

`serializeWindowSnapshot` and `restoreWindowSnapshot` are two big switch
statements (lines 2259-2440) that grow with every window type. Epoch 2 says
"normalize window-family state/restore hooks" but doesn't specify the target
pattern. The BUILD-ORDER target is: each window module owns its own
`serialize()` and `restore()` methods, called by the registry. Spell this out
so the epoch 2 agent doesn't just shuffle the switch cases into a helper file.

### Overlay manager extraction (epoch 2 doesn't mention it)

overlay-manager.ts is 648 lines of prompt/overlay UI. Codex confirmed it's
NOT the menu owner (menus are in app-controller) but it IS the prompt owner
(value prompts, path prompts, list prompts, file browser prompts). Epoch 2
extracts browser/gallery but doesn't mention overlay-manager. It's fine to
leave it, but note that the file browser prompt (lines 403-648) is tightly
coupled to how gallery/browser windows discover content. If epoch 2 extracts
those windows, it may need to touch overlay-manager too.

### Control API route expansion (no epoch covers this)

Epoch plan says "every user-visible surface must stay mirrored in state and
control API" but no epoch adds new API routes. As windows get extracted, their
commands should register with the control API. Consider adding to epoch 2:
- `/commands` discovery endpoint (even if it just lists hardcoded names)
- Smoke test script that hits every endpoint and checks 200

### Pi Chat on legacy terminal (epoch 3 misses this)

Epoch 3 says "collapse dual terminal paths" but codex found that Pi Chat
also rides the legacy transcript PTY path (openPtyWindow). When killing the
legacy path, Pi Chat needs to migrate too. Note this explicitly so the
epoch 3 agent doesn't break Pi Chat while fixing terminals.

### Content-service dual measurement (not mentioned)

content-service.ts already measures primers via readPrimerMetadata(), but
openPrimerWindow() in app-controller re-measures with measurePrimerContent().
Two measurement paths = two potential disagreements. As primer windows get
extracted in epoch 2, ensure they consume the service measurement, not
re-measure on open.
