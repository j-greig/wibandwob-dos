---
Date: 2026-03-06
Type: bug-report / handover
Subsystem: WibWobWorld + WibWobWorld Iso — workspace restore
Status: partially bandaged, root cause open
---

# Bug: Hybrid mode + ISO window open → workspace restore crash

## Crash scenario (exact reproduction path)

1. Open WibWobWorld (`microapp.wibwobworld.open`).
2. Switch to "hybrid" render mode via the mode bar or `m` key.
3. Save a terrain export (`e` key) — this writes a `.json` artifact to
   `scratch/captures/`.
4. Open the WibWobWorld Iso window from that capture
   (`microapp.wibwobworld-iso.open`, or via the 3D/iso button if wired).
   The ISO window is now open alongside the main WibWobWorld window.
<codex-note>
`microapps-private/wibwobworld/index.ts:85-90` defines mode buttons as `terrain/contours/hybrid/firstperson` only; no ISO-open button is wired in this file.
</codex-note>
5. The desktop state is saved to workspace (auto-save or manual).
6. Restart the app. Restore fires. App crashes.

## What gets serialized

### WibWobWorld main window (microapps-private/wibwobworld/index.ts ~862)

```ts
return {
  seed, terrainIdx,
  renderMode,   // ← "hybrid" in this scenario
  seaLevel, levels, vegetationEnabled, sidebarOpen,
};
```

### WibWobWorld Iso window (microapps-private/wibwobworld-iso/index.ts ~356)

```ts
serialize: (window) => {
  const state = window.describeState?.() ?? {};
  if (state.appType !== "wibwobworld-iso") return undefined;
  return {
    path: state.sourcePath,   // ← absolute path into scratch/captures/
  };
},
restore: (_snapshot, payload) => {
  host.runCommand("open", payload);  // ← crashes if file is gone
},
```
<codex-note>
`microapps-private/wibwobworld-iso/index.ts:251-267` assigns `sourcePath` inside `win.describeState(...)` only on successful artifact load. On load error, serialize still runs (`:355-360`) but `state.sourcePath` can be `undefined`, so restore may reopen with no path and fall back to "latest file" behavior instead of the original capture.
</codex-note>

`sourcePath` is an absolute path like
`/Users/james/Repos/wibandwob-dos/scratch/captures/wibwobworld_ridge_42381_1741270312345.json`.
It is not guaranteed to exist after a restart (scratch/ is ephemeral, the file
could have been cleared, renamed, or never written).

## What happens on restore

1. Workspace restore fires both windows' restore handlers.
2. WibWobWorld main window restores first — currently safe because of the
   `restoreSafeMode` bandage (see below).
3. ISO window restore calls `host.runCommand("open", { path: sourcePath })`.
4. `openIso()` reads and parses the file at `sourcePath`.
5. If the file is missing: `fs.readFileSync` throws → unhandled → crash.
6. If the file exists but is malformed or from an incompatible build:
   `JSON.parse` or `isSavedTerrainArtifact` guard fails → crash or silent bail.
<codex-note>
Current `openIso()` wraps `loadArtifact(sourcePath)` in `try/catch` (`microapps-private/wibwobworld-iso/index.ts:224-275`) and renders a `"load error"` status instead of throwing. The "unhandled crash" claim does not match current code.
</codex-note>
<codex-note>
Boot restore is also wrapped in a top-level `try/catch` (`src/core/app-controller.ts:319-340`). Even if a handler throws, startup falls back to empty desktop rather than process crash.
</codex-note>

## Current bandage (does NOT fix the ISO window)

`ae0ad94` added a `restoreSafeMode` guard in WibWobWorld's `openWorld()`:

```ts
// microapps-private/wibwobworld/index.ts ~186
const restoreSafeMode: TerrainRenderMode | undefined =
  args?.__restoring === true ? "contours" : undefined;
let renderMode: TerrainRenderMode = restoreSafeMode ?? requestedRenderMode ?? "hybrid";
```

This forces the MAIN window to "contours" on every restore, regardless of what
`renderMode` was serialized. It prevents restoring into "firstperson" (the hard
crash path that existed before).

`b3e5ea4` then removed a separate firstperson-specific bandage (a deferred render
guard), keeping the `restoreSafeMode` logic.

So the main window is now survivable. The ISO window restore is NOT protected.

## Root causes (distinct)

### RC-1: ISO restore does not guard against missing sourcePath

`wibwobworld-iso` restore passes `payload` straight to `openIso()` with no
existence check. `scratch/captures/` files are ephemeral — not committed,
not guaranteed to survive between sessions.
<codex-note>
The concrete bug now is restore fidelity, not crash: missing/invalid files degrade to in-window load error (`microapps-private/wibwobworld-iso/index.ts:269-275`) and `path: undefined` can reopen arbitrary latest capture (`:188-191`, `:294-295`).
</codex-note>

### RC-2: Restore does not coordinate ordering between paired windows

WibWobWorld and its ISO child are restored independently. If the ISO fires
before the main world has generated terrain, or if the main world generates
a NEW seed (because restore forced "contours" and the seed did survive), the
ISO's sourcePath is now dangling — it refers to a different terrain run.
<codex-note>
Ordering is sequential in snapshot array order (`src/core/app-controller.ts:332-336`, `:1574-1578`), not parallel. There is still no dependency graph/parent-child restore contract, so ordering is deterministic-but-uncoordinated.
</codex-note>

### RC-3: Serialized renderMode is overridden silently, not surfaced

The main window serialize saves `renderMode: "hybrid"` faithfully. But restore
ignores it and forces "contours". This is fine for crash prevention but means
the user's last mode is silently lost on every restart. Not a crash, but a UX
regression that will keep generating confusion.

## What "hybrid mode" specifically adds to the risk

In "hybrid" mode the status bar hint says "save terrain export with e". Users
are more likely to have the ISO window open alongside in hybrid mode (it's the
natural pairing — compare the 2D hybrid with the 3D iso). So the broken ISO
restore path fires more often in this combination than in pure terrain/contours
mode, which is why the crash was noticed here.

## Files involved

```
microapps-private/wibwobworld/index.ts
  ~186   restoreSafeMode bandage
  ~862   serialize block (saves renderMode, seed, etc.)
  ~877   restore block (passes __restoring: true)

microapps-private/wibwobworld-iso/index.ts
  ~356   serialize block (saves sourcePath only)
  ~362   restore block (no guard — the crash site)

src/services/microapp-loader.ts
  ~90    registerSnapshot — how restore handlers are wired

scratch/captures/          ← ephemeral, never committed
```

## Relevant commits

```
ae0ad94  never restore into firstperson (adds restoreSafeMode bandage — main window only)
b3e5ea4  debounce resize render + remove firstperson restore bandage (a different guard)
073f672  working wibwobworld contour window WITH 3d view (ISO window first landed)
```

## Options for a real fix

### Option A — Guard the ISO restore against missing file (minimal)

In the ISO restore handler, check `fs.existsSync(payload.path)` before calling
`openIso`. If the file is gone, skip restore silently (or open a blank ISO window
with a "source capture not found" message).

Risk: low. This stops the crash. It does not fix the dangling-path problem.
<codex-note>
Given current `try/catch` in `openIso()`, an `existsSync` guard is mainly a UX improvement (avoid opening into immediate load-error), not a crash fix.
</codex-note>

### Option B — Captures are part of the workspace bundle

When saving workspace state, copy any `sourcePath` files referenced by ISO windows
into a workspace-local directory (e.g. `.workspace/captures/`). Rewrite paths in
the serialized payload to point to the workspace copy. On restore, paths are valid.

Risk: medium. Requires a workspace-level artifact copy step, but it's the
honest solution — the ISO window IS part of the workspace.

### Option C — ISO window serializes terrain params, not a file path

Instead of saving `sourcePath`, the ISO window saves the same seed/terrainIdx/
renderMode/seaLevel/levels that the main window uses. On restore, it regenerates
from those params (same path as main window, same terrain). No dependency on
ephemeral files.

Risk: medium. Requires wibwobworld-iso to have its own terrain generation path
or to accept a terrain artifact injected by the main window on restore.

### Option D — Parent/child restore — ISO reopens as a child of WibWobWorld

WibWobWorld restore detects that an ISO window was open (serialized into the main
window's snapshot, not separately) and reopens it after terrain is generated.
Eliminates the ordering and dangling-path problems entirely.

Risk: higher. Requires a parent-owns-child snapshot model that does not exist yet.
But this is architecturally the cleanest for the long term — WibWobWorld Iso is
semantically a child of WibWobWorld, not a peer.

## Recommended short-term fix

Option A for the crash (one existsSync guard in ISO restore).
Option C or D as the proper fix when the ISO/3D surface gets a second pass.
<codex-note>
Additional gap worth tracking: dynamic microapp restore currently returns `undefined` by design (`src/services/microapp-loader.ts:259-261`), so `restoreWindowSnapshot()` cannot apply saved `left/top/width/height` for microapps (`src/core/workspace-snapshots.ts:35-40`). This affects ISO/main window restore parity beyond file-path handling.
</codex-note>

## Do not do

Do not extend the `restoreSafeMode` bandage to cover ISO. The issue is not the
render mode — it is the ephemeral file dependency. Patching mode selection
further obscures the real problem.
