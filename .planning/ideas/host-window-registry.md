# Host Window Registry — Declarative Window Dispatch

## Problem

`app-controller.ts` has 30+ `private openXxxWindow()` methods that all follow the same pattern:

```typescript
private openXxx(restore?): WindowRecord | undefined {
  return this.focusOrCreate("xxx", () => {
    openXxxWindow({ screen: this.screen, windowManager: this.windowManager, ... });
  });
}
```

Each is a thin wrapper around `focusOrCreate()` + dependency injection. The actual
factory lives in `src/windows/xxx-window.ts`. The controller accumulates ~800 lines
of boilerplate for this wiring.

## Solution

A declarative **host window registry** (`src/core/host-window-registry.ts`) where each
window type registers its factory. The controller gets a single generic dispatcher:

```typescript
// Registration (done in window module files or a central registrations file)
registerHostWindow({
  appType: "file-manager",
  factory: (deps, restore) => openFileManagerWindow({ ...deps, restore }),
  multiInstance: false,
});

// Dispatch (one method replaces 30+)
openHostWindow(appType: string, restore?: Record<string, unknown>): WindowRecord | undefined {
  const entry = getHostWindow(appType);
  if (!entry) return undefined;
  return this.focusOrCreate(appType, () => entry.factory(this.deps, restore), entry.multiInstance);
}
```

## Why This Matches the Architecture

- **COAT:** Window creation becomes a runtime verb, not controller code
- **Single source of truth:** Registration lives with the factory (invariant #1)
- **Microapp parity:** Microapps already register commands declaratively — host windows should too
- **Agent-friendly:** `listHostWindows()` is introspectable, like `listCommands()`
- **Decomposition:** Removes ~800 lines from app-controller without changing behaviour

## Migration Path

1. ✅ Registry file created (`src/core/host-window-registry.ts`)
2. Register each of the 12 `focusOrCreate` window types
3. Replace `private openXxx()` methods with `openHostWindow("xxx", restore)`
4. Update command-catalog action handlers to use registry
5. Delete the 30+ private methods

## Current focusOrCreate Window Types

| appType | Factory file | Multi? |
|---------|-------------|--------|
| backrooms-log-browser | backrooms-log-browser-window.ts | no |
| backrooms-primer-picker | backrooms-windows.ts | no |
| command-palette | (inline) | no |
| companion-widget | generative-windows.ts | no |
| file-manager | file-manager-window.ts | no |
| music-player | music-player-window.ts | no |
| primer-browser | primer-browser-window.ts | no |
| primer-gallery | primer-gallery-window.ts | no |
| state-inspector | (inline) | no |
| terrain-lab | terrain-lab-window.ts | no |
| wibwob-agent | wibwob-agent-window.ts | no |
| workspace-manager | (inline) | no |

Plus text-viewer, editor, markdown-viewer, primer-viewer — these are multi-instance
and take content-specific args, so they stay as methods (or get a variant registry).
