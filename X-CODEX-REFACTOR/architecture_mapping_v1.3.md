# WibWob Refactor Architecture Mapping v1.3

Initial mapping against the current codebase. This is not the target architecture. It records where the current owners actually are so the first refactor slice can extract shared semantics from real code instead of inventing parallel structures.

## Current Runtime Path

```text
src/app.ts
  -> boot env/process identity
  -> create TsTuiMvpApp(instanceLabel, instanceId)
  -> src/core/app-controller.ts
       -> constructs Blessed screen
       -> wires WindowManager, CommandRegistry, StateService, ControlApiService,
          WorkspaceService, module loader, agent session, world chat, overlays
       -> owns most startup and orchestration
```

## Current Architectural Reality

### Composition Root

- `src/core/app-controller.ts` is the dominant composition root and orchestration owner.
- It currently mixes:
  - startup wiring
  - screen construction
  - control API wiring
  - workspace restore
  - command action implementations
  - window opening
  - instance display logic

This is the strongest current candidate for extracting application services from existing ownership.

### Command Pipeline

Current command flow is split across:

```text
src/core/command-catalog.ts
  -> static command definitions / metadata

src/core/command-registry.ts
  -> assembled runtime command surface

src/core/app-controller.ts
  -> AppMenuActions implementations and wiring

src/services/control-api.ts
  -> HTTP adapter over listCommands/runCommand

src/cli/wibwob.ts
  -> thin HTTP client over /commands/*

src/services/agent-tools.ts
  -> agent-facing command access
```

Implication:

- There is already a near-central command path.
- The first vertical slice should strengthen that path rather than replacing it wholesale.
- TUI and API can converge on one shared execution seam before CLI is fully reworked.

### State / Inspection Path

Current inspection and state ownership is split across:

```text
src/core/window-manager.ts
  -> live window records and mutations

src/services/state-service.ts
  -> desktop state projection

src/core/workspace-snapshots.ts
src/core/snapshot-registry.ts
src/services/workspace-service.ts
  -> persistence and restore transforms
```

Implication:

- `state-service.ts` is already a partial runtime-inspection seam.
- It should likely evolve into inspectable runtime shapes rather than staying a thin dump over implicit UI state.

### Microapp Boundary

Current microapp boundary is:

```text
src/services/module-loader.ts
  -> module discovery, loading, manifest handling, host bridge

src/services/microapp-sdk.ts
  -> canonical module author import surface

modules/*
  -> current external/built-in microapps import from microapp-sdk.ts
```

Implication:

- `src/services/microapp-sdk.ts` must remain stable during migration.
- Internal SDK ownership can move under `src/sdk/`, but the import path should stay intact in pass 1.

## Identity Hotspots

Current machine-facing identity is inconsistent.

Before this slice, runtime identity was inconsistent.

- `src/app.ts` generated `sessionId`
- `src/core/app-controller.ts` passed `instanceLabel` plus `sessionId`
- `src/services/state-service.ts` exposed both on app state
- `src/services/control-api.ts` returned both on `/health` and `/`
- `scripts/restart.sh`, `scripts/attach.sh`, and other tooling keyed off `sessionId`
- `src/services/world-chat-service.ts` used `WIBWOB_SESSION_ID`

Implication:

- `instance_id` replacement touches runtime code, control surfaces, and agent tooling.
- This slice is migrating the runtime identity model and exposing it consistently, then sweeping scripts/tooling.

## Single-Instance Assumptions Already Visible

- Default port `8099` is hard-coded or assumed in many scripts and docs.
- `CONTROL_API_PORT` exists, but surrounding tooling still tends to assume one active default instance.
- Scratch/export assumptions are not consistently instance-aware.
- World chat and some agent paths historically derived identity from environment variables tied to `sessionId`.

These are scaffolding targets, not a reason to build a registry yet.

## Likely Godfiles / Hotspots

- `src/core/app-controller.ts`
- `src/core/ui-parts.ts`
- `src/windows/browser-windows.ts`
- `src/core/command-catalog.ts`
- `src/services/control-api.ts`
- `src/services/module-loader.ts`
- `src/services/wibwob-agent-session.ts`

## First Slice Recommendation

Refactor in this order:

1. make runtime identity explicit as `instance_id`
2. stabilise one shared command execution seam
3. expose a cleaner runtime inspection shape from existing state owners
4. only then start broader moves into the new layer folders

## New Layer Anchors

The following top-level folders are created up front as architectural anchors:

- `src/domain`
- `src/application`
- `src/runtime`
- `src/sdk`
- `src/adapters`

They should remain thin until concrete ownership moves into them.
