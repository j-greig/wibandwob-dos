# E043 Phase 2+3 — Window Factory Migration + Action Wiring

## Status: Ready to execute

### Architecture

```
command-catalog.ts  ←  defines command IDs + AppMenuActions interface
        ↓
command-registry.ts ←  dispatches via AppMenuActions function pointers
        ↓
getAppMenuActions() ←  TODAY: 536 LOC in app-controller wiring actions to this.openXxx()
        ↓                GOAL: thin mapper delegating to host-window-registry
host-window-registry.ts ← openRegisteredWindow() already works (3 windows + focusOrCreate)
        ↓
host-window-registrations.ts ← factory registrations (currently 3, goal: ~25)
```

### Key insight

Most `openXxxWindow()` methods in app-controller are already thin:
```ts
private openTerrainLabWindow() { return this.openHostWindow("terrain-lab"); }
private openMusicPlayerWindow(r?) { return this.openHostWindow("music-player", r); }
```

The remaining ones have **custom dep shapes** — each window factory expects
its own interface, not `HostWindowDeps`. The adapter pattern is:

```ts
registerHostWindow({
  appType: "xxx",
  factory: (deps, restore) => {
    openXxxWindowFactory({
      screen: deps.screen,
      windowManager: deps.windowManager,
      // map HostWindowDeps → factory-specific shape
    });
  },
});
```

---

## Step-by-step (one commit each)

### Step 1: Migrate 4 already-trivial wrappers to direct registry calls

These are already `return this.openHostWindow("xxx", restore)`:
- `openTerrainLabWindow()` → remove, use `openHostWindow("terrain-lab")` in getAppMenuActions
- `openMusicPlayerWindow(restore)` → remove, use `openHostWindow("music-player", restore)`
- `openCompanionWindow(restore)` → special case (mode routing), keep for now

**LOC saved:** ~12

### Step 2: Register backrooms cluster (4 methods)

Already delegate to imported `openBackroomsXxxWindow()` factories.
Register each, adapt `BackroomsWindowContext` from `HostWindowDeps`:

```
openBackroomsLogBrowserWindow → appType: "backrooms-log-browser"
promptForBackroomsTv → appType: "backrooms-primer-picker" (initial prompt)
openBackroomsPrimerPicker → appType: "backrooms-primer-picker" (with args)
openBackroomsTv → appType: "backrooms-tv" (multiInstance: true)
```

**Complication:** These use `getBackroomsWindowContext()` (11 deps). Add a 
`buildBackroomsContext` helper in registrations.ts that maps from HostWindowDeps.

**LOC saved:** ~50

### Step 3: Register primer/browser windows (3 methods)

```
openPrimerBrowserWindow → appType: "primer-browser"
openChromeBrowserWindow → appType: "chrome-browser"
openBrowserReaderWindow → appType: "browser-reader"
```

These have simple dep shapes mappable from HostWindowDeps.

**LOC saved:** ~45

### Step 4: Register scramble windows (2 methods)

```
openScrambleFloating → appType: "companion-widget"
openScrambleSmol → variant of "companion-widget"
```

**Complication:** Two factory functions for same appType (floating vs smol).
The existing `openCompanionWindow` dispatches by `displayMode`. Register one
entry that inspects `restore.displayMode`.

**LOC saved:** ~40

### Step 5: Register utility windows (4 methods)

```
openWorkspaceManagerWindow → appType: "workspace-manager"
openCommandPaletteWindow → appType: "command-palette"
openStateInspectorWindow → appType: "inspector"
openPrimerGalleryWindow → appType: "primer-gallery"
```

**LOC saved:** ~50

### Step 6: Register file-manager + agent (2 methods)

```
openFileManagerWindow → appType: "file-manager"
openWibWobAgentWindow → appType: "wibwob-agent"
```

Agent window is complex (session lifecycle). May stay as-is if registration
adds too much adapter code.

**LOC saved:** ~30

### Step 7: Simplify getAppMenuActions

After Steps 1–6, most entries become:
```ts
openTerrainLab: () => this.openHostWindow("terrain-lab"),
```

Extract to `src/core/app-action-wiring.ts` as a pure function:
```ts
export function buildAppMenuActions(
  app: { openHostWindow, overlays, editor, ... },
): AppMenuActions { ... }
```

**LOC saved:** ~300 (from app-controller), ~200 new in app-action-wiring.ts

### Step 8: Simplify getRestoreActions

Workspace restore handlers that call `openXxxWindow(snapshot)` can now
call `openHostWindow(appType, snapshot)`. ~10 entries simplified.

**LOC saved:** ~30

---

## Expected result

| File | Before | After |
|------|--------|-------|
| app-controller.ts | 2160 | ~1400 |
| host-window-registrations.ts | 43 | ~300 |
| app-action-wiring.ts | 0 | ~200 |

## Tools & verification

```bash
# After each step:
bun run typecheck          # type safety
bun run health             # full gate (tests + COAT + circular deps)
npx madge --circular src/  # verify no new cycles

# Measure progress:
wc -l src/core/app-controller.ts
grep -c 'focusOrCreate\|openHostWindow' src/core/app-controller.ts
```

## Risk mitigation

- **Never** let extracted modules call `commands.run()` (dispatch loop)
- **Never** import `TsTuiMvpApp` from new modules (circular dep)
- Test the running TUI after each phase (visual verification)
- Each step is one commit — easy to revert individually
