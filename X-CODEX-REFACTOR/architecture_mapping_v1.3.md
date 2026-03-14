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

### Example: What `desktop.clear-all` Actually Is

`desktop.clear-all` is a runtime command id, not a shell command.

That distinction matters because the same runtime command can be invoked from several surfaces:

- shell/CLI:
  - `wibwob cmd desktop.clear-all`
  - shell command = `wibwob`
  - runtime command id = `desktop.clear-all`
- HTTP/API:
  - `POST /commands/run`
  - body = `{"id":"desktop.clear-all","args":{"all":true}}`
- agent:
  - `tui_run_command("desktop.clear-all", { all: true })`
- TUI:
  - menu/palette item mapped to the same command metadata

Concrete path for the API case:

```text
script / CLI / curl
  -> POST /commands/run
  -> src/services/control-api.ts runApiCommand()
  -> src/application/runtime-command-service.ts
  -> src/core/command-registry.ts run()
  -> src/core/command-catalog.ts definition for "desktop.clear-all"
  -> actionKey "clearDesktop"
  -> src/core/app-controller.ts clearDesktop()
  -> overlay cancel + menu close + windowManager.closeWindow(...)
  -> Blessed window frames removed from the live TUI
```

So:

- shell command = transport/client command
- runtime command id = semantic action inside WibWob
- command registry = dispatch layer
- app-controller/window manager = concrete TUI mutation path

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
src/services/microapp-loader.ts
  -> module discovery, loading, manifest handling, host bridge

src/services/microapp-sdk.ts
  -> canonical microapp author import surface

microapps/*
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

## Duplicate Path Audit

### Canonical Owners After The First Parcels

- Command listing and execution:
  - owner: `src/application/runtime-command-service.ts`
  - consumers: control API, agent tools, command registry bridge
  - status: keep consolidating; CLI still converges later
- Window verbs:
  - owner: `src/application/runtime-window-service.ts`
  - consumers: control API, agent tools
  - status: shared for API/agent; TUI still owns raw widget interactions
- Runtime inspection:
  - owner: `src/application/runtime-inspection-service.ts`
  - consumers: control API, agent tools, future Runtime Inspector
  - status: keep; expand typed snapshot rather than new ad hoc endpoints
- Workspace save/load:
  - owner: `src/application/runtime-workspace-service.ts`
  - consumers: TUI prompt flows, command actions, control API
  - status: shared; CLI convergence deferred

### Duplicate Or Legacy Paths And Their Disposition

- `/view/*` open routes:
  - disposition: keep for now
  - reason: useful operator convenience aliases, but not canonical architecture
- `/commands/run`:
  - disposition: keep as canonical command execution endpoint
  - reason: single runtime command path
- prompt-driven `File -> Open` flows:
  - disposition: move or harden in Slice 3
  - reason: several still strand the UI without symmetric API exits
- direct app-controller workspace restore/save logic:
  - disposition: moved into application service
  - reason: was duplicated across boot, commands, and API-adjacent paths
- CLI command semantics:
  - disposition: defer to Slice 6
  - reason: currently thin HTTP client, should converge after API/TUI seams settle

### Direct Widget Mutation Hotspots That Still Bypass Shared Semantics

- `src/core/app-controller.ts`
  - menu actions still open many windows directly and mix orchestration with widget concerns
- `src/windows/browser-windows.ts`
  - file/open and picker-style surfaces still own too much interaction state locally
- `src/windows/generative-windows.ts`
  - inspector/workspace-manager UI remains host-driven and not yet service-backed
- `src/services/microapp-loader.ts`
  - host bridge still exposes more runtime detail than the future SDK boundary should allow

## Godfiles / Hotspots With Reasons

- `src/core/app-controller.ts`
  - still the largest mixed owner: startup, commands, window creation, restore, agent wiring
- `src/services/control-api.ts`
  - broad endpoint surface, legacy convenience aliases, and response-shape drift risk
- `src/core/command-catalog.ts`
  - command metadata source of truth, but still carries too much argument semantics inline
- `src/services/microapp-loader.ts`
  - real host/module boundary and the likely place SDK leakage must be reduced
- `src/windows/browser-windows.ts`
  - concentration of picker/file-browser state that can trap the UI
- `src/services/wibwob-agent-session.ts`
  - large agent integration owner with potential duplicate control semantics
- `src/core/ui-parts.ts`
  - still likely retireable or shrinkable, but lower priority than the files above

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
