# WibWob Refactor Execution Checklist v1.3

Working companion to [wibwob_refactor_plan_v1.3.md](./wibwob_refactor_plan_v1.3.md).

This file is the execution surface for the refactor. The masterplan stays conceptual; this document tracks concrete work and decisions.

## Status Rules

- `[ ]` not started
- `[~]` in progress
- `[x]` done
- `[-]` dropped / intentionally deferred

## Current Position

- `[x]` Read `X-CODEX-REFACTOR/wibwob_refactor_plan_v1.3.md`
- `[x]` Read `X-CODEX-REFACTOR/microprompt1.txt`
- `[x]` Read `X-CODEX-REFACTOR/microprompt2.txt`
- `[x]` Confirm branch is not `main` (`epic/refactor-13`)
- `[x]` Agree the first implementation slice and freeze scope for it

## Working Assumptions

- Keep the current app running while refactoring incrementally; avoid a big-bang rewrite.
- Preserve current module compatibility while extracting the SDK boundary.
- Prefer extracting shared semantics from existing owners instead of creating parallel owners.
- If a file is in doubt, move it into repo-local `.trash/` instead of leaving it half-retired in place.
- Introduce canonical `instance_id` and replace `sessionId` rather than carrying both long-term.
- `instanceLabel` may remain as a human-facing alias, but not as machine identity.
- Create `src/domain`, `src/application`, `src/runtime`, `src/sdk`, and `src/adapters` up front as thin anchors.
- First-pass multi-instance scope is identity scaffolding only, not registry/orchestration.
- Keep `src/services/microapp-sdk.ts` as the stable module import path during migration.
- API/TUI convergence can land before full CLI parity.
- First proof slice priority is:
  1. architecture mapping
  2. shared command pipeline
  3. runtime inspection seam
  4. instance identity scaffolding

## Locked Decisions

- `[x]` Canonical runtime identity is `instance_id`
- `[x]` `sessionId` should be migrated away quickly rather than preserved by default
- `[x]` `instanceLabel` is display-only when retained
- `[x]` New top-level folders exist up front as architectural anchors
- `[x]` Uncertain files should be parked in `.trash/` rather than left in ambiguous active locations
- `[x]` Multi-instance work in pass 1 is limited to identity scaffolding
- `[x]` Host-owned in pass 1:
  - window manager
  - focus manager
  - command bus / dispatch core
  - event bus
  - runtime state container
  - workspace load/save core
  - diagnostics core
  - control API plumbing
  - microapp loader / registry
  - rendering engine / Blessed integration
- `[x]` Future proof microapp target is Runtime Inspector after the inspection seam exists
- `[x]` Stable SDK import path remains `src/services/microapp-sdk.ts`
- `[x]` CLI must not diverge architecturally, but does not need full parity in pass 1

## Execution Slices v1.4

### Slice 1: Duplicate-Path Audit and Godfile Closure

- `[x]` Write the Godfile list with reasons in the refactor docs
- `[x]` Identify the main duplicate behaviors across TUI / API / CLI / agent
- `[x]` Identify the highest-value direct widget mutation hotspots that still bypass shared semantics
- `[x]` Mark duplicate paths as keep, move, delete, or defer in the architecture mapping
- `[~]` Retire or merge stale docs only when the replacement text is already better

### Slice 2: Workspace Service Convergence

- `[x]` Create a workspace application service under `src/application/`
- `[x]` Route boot restore, TUI prompt flows, command actions, and control API workspace endpoints through it
- `[x]` Keep the current workspace file format unchanged
- `[x]` Keep snapshot/restore callbacks in the host rather than inventing a second owner
- `[x]` Verify save/load semantics are shared across TUI prompts and API

### Slice 3: File/Open and Overlay State Hardening

- `[ ]` Inventory all file-open and picker-style flows
- `[ ]` Decide for each flow whether shared overlay control is enough, an explicit command seam is needed, or the flow should be removed
- `[ ]` Ensure every blocking state has a canonical continue/select/cancel path or `desktop.clear-all`
- `[ ]` Expose blocked-state info through runtime inspection where it matters
- `[ ]` Prefer command ids over bespoke new HTTP endpoints

### Slice 4: Runtime Node and Instance-Scoped Paths

- `[ ]` Define the runtime node object that owns stateful runtime services
- `[ ]` Make scratch/export/workspace paths instance-aware where low-risk
- `[ ]` Remove remaining single-instance assumptions from scripts and captures where practical
- `[ ]` Ensure `/health`, `/state`, `/runtime/inspection`, and scripts report `instanceId` consistently
- `[ ]` Leave seams for future registry work without building the registry

### Slice 5: SDK Boundary Extraction

- `[ ]` Move clear SDK-owned exports into `src/sdk/`
- `[ ]` Keep `src/services/microapp-sdk.ts` as the stable import path
- `[ ]` Stop module-facing leakage from unrelated core/services files
- `[ ]` Separate public SDK exports from host-internal helpers
- `[ ]` Push Blessed-specific internals behind host/runtime boundaries where practical

### Slice 6: CLI Convergence

- `[ ]` Route CLI work through the same command and inspection semantics already used by the API
- `[ ]` Add CLI coverage for the stabilized window/control behaviors
- `[ ]` Remove CLI references to retired aliases and pre-refactor field names
- `[ ]` Keep the CLI thin instead of growing a second architecture

### Slice 7: Runtime Inspector Proof Microapp

- `[ ]` Use Runtime Inspector as the first proof microapp
- `[ ]` Consume the shared runtime inspection seam rather than host internals directly
- `[ ]` Show state, menu/overlay status, stats, and instance identity from the shared snapshot
- `[ ]` Keep host-owned runtime responsibilities in the host
- `[ ]` Avoid broad built-in migration in the same slice

### Slice 8: Legacy Pruning, Docs Consolidation, and Stable-State Tooling

- `[ ]` Remove dead command paths, shims, and docs once the replacement seams are proven
- `[ ]` Move uncertain files/docs into `.trash/` instead of leaving them ambiguously active
- `[ ]` Consolidate overlapping markdown into fewer stronger agent-facing docs
- `[ ]` Update `.planning` to match the landed architecture
- `[ ]` Fold the stable refactor shape into scripts and `bun run dev` workflows
- `[ ]` Preserve text-first whole-TUI capture as the default evidence path and PNG as secondary evidence
- `[ ]` Turn the Ghostty-vs-terminal-microapp agent efficiency comparison into a concrete later tooling task

## Phase 1: Architecture Mapping

- `[x]` Produce a current-state diagram for the actual runtime path: `src/app.ts` -> `src/core/app-controller.ts` -> services/windows/core
- `[x]` Trace command flow across:
  - `src/core/command-catalog.ts`
  - `src/core/command-registry.ts`
  - `src/core/app-controller.ts`
  - `src/services/control-api.ts`
  - `src/services/agent-tools.ts`
  - `src/cli/wibwob.ts`
- `[x]` Trace state ownership across:
  - `src/core/window-manager.ts`
  - `src/services/state-service.ts`
  - `src/services/workspace-service.ts`
  - `src/core/workspace-snapshots.ts`
  - `src/core/snapshot-registry.ts`
- `[x]` Trace the microapp boundary across:
  - `src/services/module-loader.ts`
  - `src/services/microapp-sdk.ts`
  - representative modules under `modules/`
- `[x]` Identify duplicate behaviors implemented separately in TUI / API / CLI
- `[x]` Identify direct widget mutations that bypass shared semantics
- `[x]` Confirm current single-instance assumptions:
  - fixed API port behavior
  - process identity
  - scratch/workspace paths
  - global singleton services
- `[x]` Write the Godfile list with reasons

### Likely Godfiles / Hotspots

- `[x]` `src/core/app-controller.ts`
- `[x]` `src/core/ui-parts.ts`
- `[x]` `src/windows/browser-windows.ts`
- `[x]` `src/core/command-catalog.ts`
- `[x]` `src/services/control-api.ts`
- `[x]` `src/services/module-loader.ts`
- `[x]` `src/services/wibwob-agent-session.ts`

## Phase 2: Extract Pure Logic Into Domain

- `[x]` Define the initial `src/domain/` shape without over-expanding it
- `[ ]` Extract side-effect-free window model logic from UI/render owners
- `[~]` Extract command definitions and schemas that are currently mixed with dispatch or UI concerns
- `[ ]` Extract workspace snapshot schema / transforms into pure logic
- `[x]` Define an explicit instance descriptor model
- `[ ]` Add focused tests for each extracted pure unit

### Candidate Domain Objects

- `[ ]` Window model
- `[ ]` Layout rules
- `[~]` Command definition / argument schema
- `[ ]` Workspace snapshot
- `[x]` Instance descriptor
- `[x]` Runtime inspection shapes

## Phase 3: Isolate Side Effects

- `[ ]` Inventory filesystem touchpoints
- `[ ]` Inventory process / spawn / restart touchpoints
- `[ ]` Inventory timer ownership
- `[ ]` Inventory network / fetch usage
- `[ ]` Introduce thin infrastructure wrappers only where extraction materially reduces coupling
- `[ ]` Ensure extracted domain logic depends on no Bun / Blessed / filesystem APIs

## Phase 4: Introduce Application Services

- `[x]` Define the first service layer under `src/application/`
- `[~]` Promote shared verbs out of interface handlers and into service functions
- `[x]` Establish one command execution path shared by TUI / API / CLI where practical
- `[x]` Establish one workspace save / load path shared by all interfaces (`src/application/runtime-workspace-service.ts`)
- `[x]` Establish one runtime inspection path shared by all interfaces

### First Verbs To Stabilize

- `[x]` `openWindow`
- `[x]` `closeWindow`
- `[x]` `focusWindow`
- `[x]` `runCommand`
- `[x]` `saveWorkspace`
- `[x]` `loadWorkspace`
- `[x]` `listCommands`
- `[x]` `inspectRuntime`

## Phase 5: Make Runtime State Instance-Scoped

- `[ ]` Define the runtime node object that owns stateful services
- `[x]` Decide how canonical `instance_id` relates to current `sessionId` and `instanceLabel`
- `[ ]` Remove assumptions that `127.0.0.1:8099` is the only active runtime
- `[ ]` Make export / scratch paths instance-aware where needed
- `[~]` Ensure control surfaces report instance identity consistently
- `[ ]` Prepare a lightweight runtime registry seam without building full orchestration yet

## Phase 6: Extract the SDK Boundary

- `[x]` Define what belongs in `src/sdk/` versus internal runtime code
- `[ ]` Stop SDK leakage from `src/core/*` and unrelated `src/services/*`
- `[ ]` Preserve a single canonical import surface for modules during migration
- `[ ]` Move Blessed-specific types and helpers behind internal boundaries
- `[ ]` Mark public, beta, and internal exports if needed

## Phase 7: Migrate Built-In Functionality Toward Microapps

- `[ ]` Decide which built-ins are in scope for this refactor pass
- `[ ]` Choose a proof microapp for the new runtime model
- `[ ]` Build the Runtime Inspector proof microapp once runtime inspection is real
- `[ ]` Migrate one representative built-in feature without regressing command/API parity
- `[ ]` Confirm existing external modules still load under the compatibility boundary

## Phase 8: Remove Legacy Paths

- `[~]` Delete dead or parallel command flows once shared services are stable
- `[ ]` Delete microapp imports that bypass the canonical SDK surface
- `[~]` Delete interface-specific logic that duplicates shared runtime verbs
- `[~]` Remove obsolete compatibility shims only after module validation passes

## Verification Gates

- `[x]` `bun run typecheck`
- `[x]` Run targeted test suites for touched areas
- `[x]` Restart the app when `src/` internals change
- `[x]` Verify `/health`
- `[x]` Verify `/state`
- `[x]` Verify command execution parity across TUI / API / CLI for the refactored slice
- `[ ]` Perform visual verification in tmux for affected UI behavior
- `[x]` Capture evidence when behavior changes materially
- `[x]` Preserve whole-desktop capture paths with text/API capture as the default path and PNG capture as secondary visual evidence

## Documentation / Planning

- `[ ]` Update `.planning` when scope or execution order becomes concrete
- `[x]` Record architecture decisions in the refactor docs as they solidify
- `[x]` Update `.agents/` or relevant skill docs if the refactor reveals repeated agent failure modes
- `[x]` Update scripts and local skills when the refactor changes assumptions they encode
- `[~]` Consolidate overlapping markdown into fewer, clearer agent-friendly docs when ownership is obvious
- `[ ]` Move retired or superseded markdown into `.trash/` once replacement docs are clearly better

## Resolved With Author

- `[x]` Canonical `instance_id` replaces `sessionId`; `instanceLabel` is not identity
- `[x]` Create the new top-level folders immediately
- `[x]` First-pass multi-instance scope is identity scaffolding only
- `[x]` Keep core runtime ownership in the host; defer broad built-in microapp migration
- `[x]` Keep `src/services/microapp-sdk.ts` as the stable import path
- `[x]` API/TUI convergence may land before CLI parity
- `[x]` Preferred first proof slice is command pipeline -> runtime inspection seam -> `instance_id`

## Immediate Next Slice Recommendation

- `[x]` Freeze the first slice as: architecture mapping + command/state/runtime-boundary extraction plan
- `[x]` Avoid touching all built-ins at once
- `[x]` Land one thin vertical slice before broad file moves

## Later-Stage Automation Note

- `[-]` Do not invest heavily in full automated script/suite coverage until the refactor reaches a stable state
- `[-]` Once stable, fold the refactor into the existing scripts and `bun run dev`-driven test workflows
- `[-]` As scripts, skills, or agent tooling break during the refactor, update them in-step rather than leaving stale assumptions behind
- `[-]` Stable-state automation should default to existing API-driven text capture for whole-TUI artifacts
- `[-]` PNG capture remains useful as secondary visual evidence when text/API capture is not sufficient
- `[-]` Add a host-vs-microapp agent runtime efficiency check: compare running a Pi agent or Claude Code agent in normal Ghostty versus inside the WibWob terminal microapp, using concrete metrics such as per-process RSS/PSS, idle memory, active-task peak memory, CPU while streaming, startup latency, and end-to-end command/response latency
