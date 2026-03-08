# New Window Type — Coordination Checklist

Use this skill when adding a new window type or microapp surface to WibWob-DOS.
It prevents the most common drift patterns: missing state contracts, orphaned
openers, duplicate patterns, and parity gaps.

For microapps under `modules/`, start with:

```bash
bash scripts/scaffold-microapp.sh modules/<name> <app-id> "<Title>"
```

Then edit the generated files against the canonical SDK surface:

```ts
import type { MicroappHost } from "../../src/services/microapp-sdk.js";
```

Do not locally redefine `MicroappHost` or shared layout types in new microapps.

## Before you build: check what exists

CRITICAL: before writing any new code, search for existing patterns.

1. Read `src/core/context-menu-items.ts` — shared context menu actions live here
2. Read `src/core/command-catalog.ts` — all user-visible commands are defined here
3. Read `src/core/snapshot-registry.ts` — all persistable window types are here
4. Grep for the CONCEPT you want, not the implementation you expect
5. If a similar window or interaction already exists, extend it rather than duplicating

The most common agent mistake: grepping for implementation details, finding nothing,
and concluding the concept does not exist. Read the files whose NAMES describe
the concept first.

## Checklist

When adding a new window type, complete ALL of these steps:

### 1. Type registration
- [ ] Add the appType to `PersistableAppType` or `TransientAppType` in `src/core/types.ts`
- [ ] If persistable, add serialize + restore handlers in `src/core/snapshot-registry.ts`
- [ ] The `satisfies Record<PersistableAppType, SnapshotHandler>` will enforce this at compile time

### 2. State contract
- [ ] Implement `describeState()` on the WindowRecord BEFORE calling `registerWindow()`
- [ ] Return a meaningful `appType`, `summary`, and any mutable semantic fields
- [ ] If the window has mutable state (selection, mode, search, playback), wire `onStateChanged`
- [ ] `onStateChanged` should call `syncLiveState()` (cheap path), NOT `persistState()`

### 3. Window factory
- [ ] Accept `onStateChanged?: () => void` in the factory params
- [ ] Call `params.onStateChanged?.()` after every state-visible mutation
- [ ] Implement `cleanup()` if the window owns timers, subscriptions, or external resources
- [ ] Implement `onRestyle()` if the window uses themed styles

### 4. Controller wiring
- [ ] Add an opener method in `src/core/app-controller.ts`
- [ ] Use `focusOrCreate()` for single-instance windows
- [ ] Pass `onStateChanged: () => this.syncLiveState()` from the controller
- [ ] The opener should return `WindowRecord | undefined`

### 5. Command registration
- [ ] Add the command to `src/core/command-catalog.ts` with:
  - Unique `id`
  - `description` (required if `agent: true`)
  - `menuPlacements` with explicit `order` values (use gaps: 0, 10, 20...)
  - `actionKey` pointing at an `AppMenuActions` entry
- [ ] Add the action implementation in `getAppMenuActions()` in app-controller.ts

### 6. Control API parity
- [ ] The command should be discoverable via `GET /commands/list`
- [ ] The command should be invokable via `POST /commands/run`
- [ ] If the window needs a dedicated open endpoint, add it to `control-api.ts`

### 7. Workspace persistence (if persistable)
- [ ] Verify save: open the window, save workspace, check the JSON contains it
- [ ] Verify restore: load the workspace, check the window appears with correct geometry
- [ ] Verify the restore handler returns the WindowRecord (not void)

### 8. Verification
- [ ] `bun run typecheck` passes
- [ ] `bash scripts/check-surface-parity.sh` passes
- [ ] If app is running: `bun run scripts/check-describe-state.ts` shows the new window
- [ ] Visual smoke test: open the window, interact, verify it looks correct

## Common mistakes to avoid

- Do NOT put detailed feature behavior in `app-controller.ts` — keep it in the window factory or a service
- Do NOT add inline chrome/sizing math — use `window-chrome.ts` and `desktop-geometry.ts`
- Do NOT hardcode geometry magic numbers — use named policies
- Do NOT add `persistState()` to routine mutation callbacks — that writes to disk
- Do NOT duplicate an interaction pattern that already exists in `context-menu-items.ts` or `overlay-manager.ts`
- Do NOT create a second state change path when `onStateChanged` already exists
