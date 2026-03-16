# E043 — God File Decomposition

## Objective

Decompose `app-controller.ts` (2358 LOC, 80+ methods) into coherent modules
following natural seams. Target: ~1000 LOC remaining (composition root only).

Secondary: assess `file-manager-window.ts` (1627 LOC) for extraction opportunities.

## Guiding Principles

- **COAT:** command dispatch path is untouched — `command-catalog.ts → command-registry.ts → AppMenuActions`
- **No circular deps:** new modules import from types/services, app-controller imports from new modules
- **Composition root stays:** constructor, `run()`, `destroy()`, `bindGlobalKeys` stay in app-controller
- **Incremental:** one commit per extraction, `bun run health` after each

## Pre-conditions

- ✅ 0 circular deps (madge verified)
- ✅ Nothing imports from app-controller.ts
- ✅ host-window-registry pattern proven (3 windows registered)
- ✅ Quality sweep landed (as any 99→20, blessed-augment.d.ts)

## Phases

### Phase 1: FX Pipeline → `src/core/fx-pipeline.ts` (~230 LOC)

Extract `resolveSmearSource()`, `runFxScript()`, `smearTextSurface()` (L1535–L1764).

Self-contained cluster with minimal deps:
- `getFocusedWindow()` — source resolution
- `overlays.flash()` — user feedback
- `openTextViewerWindow()` / `openPrimerWindow()` — output display

Deps interface pattern:
```ts
interface FxPipelineDeps {
  screen: blessed.Widgets.Screen;
  windowManager: WindowManager;
  overlays: OverlayManager;
  openViewer: (...) => WindowRecord | undefined;
  openPrimer: (filePath: string) => WindowRecord | undefined;
  onStateChanged: () => void;
}
```

**Risk:** None. Pure-ish functions, no cross-references.

### Phase 2: Window Factories → `host-window-registry` (~600 LOC)

Migrate remaining 27 `openXxxWindow` methods to the existing host-window-registry pattern.

**Pre-requisite:** Move `focusOrCreate()` to `WindowManager` (it's a window management concern).

**Batch order (easiest first):**
1. Backrooms cluster (4 methods, already delegate to imported factories)
2. Terrain lab, companion, music player (already in registry — verify)
3. Browser windows (chrome-browser, browser-reader, primer-browser)
4. Content viewers (markdown-viewer, text-viewer, state-inspector)
5. Scramble windows (floating, smol)
6. Agent window, workspace manager, command palette
7. File manager, primer gallery

Each batch: ~20 LOC removed from app-controller per method.

### Phase 3: Action Wiring → `src/core/app-action-wiring.ts` (~400 LOC post-P2)

Extract `getAppMenuActions()` (536 LOC). After Phase 2, most entries become one-liner 
`openHostWindow("xxx")` calls. The function becomes a pure mapping from action keys 
to registry lookups + a few remaining non-window actions (theme, workspace, clipboard).

### Phase 4: Workspace Restore Simplification (~60 LOC)

`getRestoreActions()` simplifies once factories are in the registry —
restore handlers call `openHostWindow("xxx", snapshot)` directly.

## Progress

| Phase | Status | Commit | LOC change |
|-------|--------|--------|------------|
| Phase 1: FX Pipeline | ✅ Done | 4bd3ee65 | -198 LOC from app-controller |
| Phase 2.1: Trivial wrappers | ✅ Done | 05037410 | -10 LOC |
| Phase 2.2: Backrooms cluster | ✅ Done | 3b73f7f2 | -9 LOC |
| Phase 2 prep: openRegisteredWindow | ✅ Done | e97bcde3 | +35 LOC in registry |
| Phase 2.3-2.8: Remaining windows | ⬜ Ready | — | ~-100 LOC est. |
| Phase 3: getAppMenuActions extract | ⬜ Ready | — | ~-400 LOC est. |
| Phase 4: Restore simplification | ⬜ Ready | — | ~-30 LOC est. |

app-controller.ts: 2358 → 2141 (current, -217 LOC, -9.2%)

## Expected Outcome

| File | Before | After |
|------|--------|-------|
| app-controller.ts | 2358 | ~1400 |
| host-window-registrations.ts | 43 | ~350 |
| fx-pipeline.ts | 0 | ~280 |
| app-action-wiring.ts | 0 | ~200 |

## Verification

- `bun run health` after every commit
- `npx madge --circular` stays at 0
- COAT check passes
- All 36 tests pass
- Visual verification on running TUI after each phase

## File Manager (assessment only)

`file-manager-window.ts` (1627 LOC) is a single function. Natural seams:
- Git status logic (~30 LOC) → could extract to `git-status.ts`
- Icon helpers (~30 LOC) → could extract to `file-icons.ts`  
- Context menu (~100 LOC) → could extract
- Preview pane (~200 LOC) → could extract

However: this file is **one window implementation**, not a composition root.
Large functions are normal for complex windows. Defer unless specific
maintenance pain surfaces.

## Non-Goals

- Don't extract CORE (composition root is supposed to know about everything)
- Don't extract THEME or MENU (small, tightly coupled to screen/chrome)
- Don't create abstract factory patterns — plain functions with deps interfaces
