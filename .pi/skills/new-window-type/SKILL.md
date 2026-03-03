# Skill: New Window Type Checklist

Use when adding a new window type to WibWob-DOS.

## Pre-flight

Before writing code, confirm:
1. The window type has a clear `AppType` string (e.g. `"my-widget"`)
2. The type does not duplicate an existing surface — check `src/core/types.ts` for `AppType`

## Checklist

Every new window type must complete ALL of these steps:

### 1. Type registration
- [ ] Add to `AppType` union in `src/core/types.ts`
- [ ] Add to `PersistableAppType` union if the window should survive workspace save/load

### 2. Window factory
- [ ] Create or extend a factory in `src/windows/`
- [ ] Factory accepts `onStateChanged?: () => void` callback
- [ ] Call `params.onStateChanged?.()` after any mutation that changes `describeState()` output
- [ ] Implement `describeState()` on the frame — return semantic metadata, not UI text

### 3. Snapshot registry (if persistable)
- [ ] Add snapshot/restore entry in `src/core/snapshot-registry.ts`
- [ ] Snapshot captures enough state to reconstruct the window on reload

### 4. Command catalog
- [ ] Add command(s) to `src/core/command-catalog.ts`
- [ ] Set `api: true, agent: true` with a non-empty `description`
- [ ] Set correct `menuPlacements` (usually one placement under Applications)
- [ ] Wire `actionKey` to a new entry in `AppMenuActions`

### 5. Controller wiring
- [ ] Add action handler in `src/core/app-controller.ts` `buildMenuActions()`
- [ ] Use `focusOrCreate()` if only one instance should exist
- [ ] Pass `onStateChanged: () => this.syncState()` to the factory

### 6. Verification
- [ ] `bun run typecheck` passes
- [ ] `scripts/check-surface-parity.sh` passes (run it!)
- [ ] Manual smoke: open via menu, open via `/commands/run`, verify `/state` shows correct metadata
- [ ] If persistable: save workspace, close window, load workspace, verify window restored

## Common mistakes
- Forgetting `onStateChanged` — state lies until next unrelated event
- Forgetting snapshot registry entry — workspace save silently drops the window
- Missing `api: true` on command — agent cannot discover or open the window
- Hardcoding chrome offsets inline instead of using `window-chrome.ts`
- Not calling `describeState()` — window appears as opaque box in /state
