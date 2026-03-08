---
id: spk-window-manifest
title: Window Manifest Registry — single source of truth for appType, commands, scene matching, snapshots
status: not-started
branch: spike/window-manifest
created: 2026-03-08
---

# Spike: Window Manifest Registry

## Problem

Adding a new window type currently requires 11–14 touch-points across disconnected files.
A confirmed appType mismatch bug (`"pattern-field"` vs `"pattern-animation"` in scene-planner)
proves this drift is not theoretical.

### Full touch-point list for a new commandable, scene-capable, persistable window
1. `src/windows/<name>-window.ts` — `describeState().appType`
2. `src/core/types.ts` — `AppType` union, `WindowKind` union, `animationAppType` map
3. `src/core/command-catalog.ts` — `AppMenuActions` interface + command entry with `actionKey`
4. `src/core/app-controller.ts` — import, private method, action map entry
5. `src/services/scene-planner.ts` — `matchWindowToRole` switch case
6. `src/services/timeline-types.ts` — `SceneWindow.open` discriminated union
7. `src/core/context-menu-items.ts` — `windowKinds` filter if context-menu entry needed
8. `src/core/workspace-snapshots.ts` — `PersistableAppType`, snapshot handler
9. `src/core/snapshot-registry.ts` — restore handler registration

## Proposed fix: WindowDefinition manifest

### Core type (`src/core/window-registry.ts`)

```typescript
interface WindowDefinition<A extends string = string> {
  // Identity
  appType: A;
  kind: WindowKind;
  title: string;

  // Factory
  open: (deps: BaseWindowDeps, args?: Record<string, unknown>) => void;

  // Command (optional — not all windows are commandable)
  command?: {
    id: string;           // e.g. "contour.open"
    label: string;
    description: string;
    palette?: boolean;
    api?: boolean;
    agent?: boolean;
    contextMenu?: { desktop?: boolean; windowKinds?: WindowKind[]; order: number };
    menuPlacements?: MenuPlacement[];
  };

  // Scene planner matching (optional)
  sceneMatcher?: (win: DesktopWindowState, sceneArgs: Record<string, unknown>) => boolean;

  // Snapshot persistence (optional)
  persist?: {
    capture: (win: WindowRecord) => Record<string, unknown>;
    restore: (args: Record<string, unknown>, deps: BaseWindowDeps) => void;
  };
}

// Global registry
const WINDOW_REGISTRY = new Map<string, WindowDefinition>();
export function registerWindow(def: WindowDefinition): void { ... }
export function getWindowDef(appType: string): WindowDefinition | undefined { ... }
```

### Derived outputs

**Commands** — `buildCommandsFromRegistry()` generates catalog entries. app-controller iterates registry for action map — no more per-window method/entry.

**Scene planner** — `matchWindowToRole` calls `getWindowDef(open.type)?.sceneMatcher(win, open)` instead of a switch. New window types get scene matching for free by registering a `sceneMatcher`.

**Snapshot registry** — persistence handler comes from `def.persist` — no manual registration.

**Context menu** — `windowKinds` filter built from registry instead of hardcoded strings.

## Implementation plan

### S01 — Fix confirmed bugs (DONE — in fix/scene-planner-apptype-bugs)
- [x] `pattern-field` → `pattern-animation` in scene-planner
- [x] protect check: also match against `win.kind`

### S02 — Write WindowDefinition type + WINDOW_REGISTRY
- [ ] `src/core/window-registry.ts` with the type + register/get functions
- [ ] No behaviour change yet — just the type and empty registry

### S03 — Migrate scene planner to registry-driven matching
- [ ] Replace `matchWindowToRole` switch with registry lookup
- [ ] Register `sceneMatcher` on: primer, figlet, art, pattern, contour, companion
- [ ] Add test: planSceneTransition reuses existing windows (not close+reopen)

### S04 — Migrate command wiring for 2–3 windows as proof of concept
- [ ] Pick: contour, plasma, terrain-lab
- [ ] Each exports a `WindowDefinition` with `command` field
- [ ] `buildCommandsFromRegistry()` generates catalog entries
- [ ] app-controller action map iterates registry (removes per-window boilerplate)

### S05 — createStandardWindow helper
- [ ] `src/core/window-factory.ts`
- [ ] `createStandardWindow({ title, kind, appType, mount, describe, ... })`
- [ ] Migrate 2–3 windows to use it

### S06 — Snapshot registry migration (optional — defer)
- [ ] Wire `persist` field into workspace-snapshots

## Priority
S01 done. S02 + S03 are the highest-leverage, lowest-risk next step.
S04–S05 are medium effort, high payoff.
S06 deferred until S04 proves the pattern.

## Key lesson from codex analysis

> No single authoritative "window definition" exists. appType, window creation,
> command metadata, scene matching, and persistence are spread across independent
> string literals and switch maps, so consistency depends on manual sync.

Every future window type should co-locate its identity, command, matcher, and
persistence in one exported `WindowDefinition`. The registry derives everything else.
