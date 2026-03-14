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
- `[x]` Retire or merge stale docs only when the replacement text is already better

### Slice 2: Workspace Service Convergence

- `[x]` Create a workspace application service under `src/application/`
- `[x]` Route boot restore, TUI prompt flows, command actions, and control API workspace endpoints through it
- `[x]` Keep the current workspace file format unchanged
- `[x]` Keep snapshot/restore callbacks in the host rather than inventing a second owner
- `[x]` Verify save/load semantics are shared across TUI prompts and API

### Slice 3: File/Open and Overlay State Hardening

- `[x]` Inventory the first-pass file-open and picker-style flows worth hardening: primer, editor text file, markdown, shared overlays, Backrooms custom picker
- `[x]` Decide the first-pass disposition:
  - shared overlay flows get explicit `*.picker.open` entrypoints plus `overlay.*`
  - Backrooms keeps dedicated `backrooms.picker.*` commands for now
  - broader module-local picker migration is deferred
- `[x]` Ensure every first-pass blocking state has a canonical continue/select/cancel path or `desktop.clear-all`
- `[x]` Expose blocked-state info through runtime inspection where it matters
- `[x]` Prefer command ids over bespoke new HTTP endpoints

### Slice 4: Runtime Node and Instance-Scoped Paths

- `[x]` Define the runtime node object that owns stateful runtime services
- `[x]` Make scratch/export/workspace paths instance-aware where low-risk
- `[x]` Remove remaining single-instance assumptions from scripts and captures where practical
- `[x]` Ensure `/health`, `/state`, `/runtime/inspection`, and scripts report `instanceId` consistently
- `[x]` Leave seams for future registry work without building the registry

### Slice 5: SDK Boundary Extraction

- `[x]` Move clear SDK-owned exports into `src/sdk/`
- `[x]` Keep `src/services/microapp-sdk.ts` as the stable import path
- `[x]` Stop module-facing leakage from unrelated core/services files where ownership is already clear
- `[x]` Separate public SDK exports from host-internal helpers
- `[x]` Push Blessed-specific internals behind host/runtime boundaries where practical in this pass

### Slice 6: CLI Convergence

- `[x]` Route CLI work through the same command and inspection semantics already used by the API
- `[x]` Add CLI coverage for the stabilized window/control behaviors
- `[x]` Remove CLI references to retired aliases and pre-refactor field names
- `[x]` Keep the CLI thin instead of growing a second architecture

### Slice 7: Runtime Inspector Proof Microapp

- `[x]` Use Runtime Inspector as the first proof microapp
- `[x]` Consume the shared runtime inspection seam rather than host internals directly
- `[x]` Show state, menu/overlay status, stats, and instance identity from the shared snapshot
- `[x]` Keep host-owned runtime responsibilities in the host
- `[x]` Avoid broad built-in migration in the same slice

### Slice 8: Legacy Pruning, Docs Consolidation, and Stable-State Tooling

- `[x]` Remove dead command paths, shims, and docs once the replacement seams are proven
- `[x]` Move uncertain files/docs into `.trash/` instead of leaving them ambiguously active
- `[x]` Consolidate overlapping markdown into fewer stronger agent-facing docs
- `[x]` Review docs again for agentic-friendliness and explicitly signpost the related scripts and live verification tools agents actually need
- `[x]` Update `.planning` to match the landed architecture
- `[x]` Fold the stable refactor shape into scripts and `bun run dev` workflows
- `[x]` Preserve text-first whole-TUI capture as the default evidence path and PNG as secondary evidence
- `[x]` Turn the Ghostty-vs-terminal-microapp agent efficiency comparison into a concrete later tooling task

## Deferred Cross-Cutting Track: Peer Provenance / Attribution

- `[-]` Define a lightweight peer/actor descriptor separate from runtime `instanceId` — parked in `.planning/refactor-docs/022-peer-provenance-follow-on.md`
- `[-]` Distinguish human, agent, and system-originated mutations in runtime-owned events — parked in `.planning/refactor-docs/022-peer-provenance-follow-on.md`
- `[-]` Add optional actor metadata seams to workspace saves, document edits, and persistent history logs — parked in `.planning/refactor-docs/022-peer-provenance-follow-on.md`
- `[-]` Prefer append-only provenance metadata before any full collaborative-edit history — parked in `.planning/refactor-docs/022-peer-provenance-follow-on.md`
- `[-]` Evaluate canonical TypeScript-native event/audit approaches when this work becomes active — parked in `.planning/refactor-docs/022-peer-provenance-follow-on.md`

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
- `[-]` Extract side-effect-free window model logic from UI/render owners — deferred to broader E042 god-file decomposition
- `[-]` Extract command definitions and schemas that are currently mixed with dispatch or UI concerns — deferred beyond this thin runtime slice
- `[-]` Extract workspace snapshot schema / transforms into pure logic — deferred to broader E042 workspace decomposition
- `[x]` Define an explicit instance descriptor model
- `[-]` Add focused tests for each extracted pure unit — deferred until the broader extractions above are active

### Candidate Domain Objects

- `[-]` Window model — deferred to broader E042 decomposition
- `[-]` Layout rules — deferred to broader E042 decomposition
- `[-]` Command definition / argument schema — partially extracted; deeper extraction deferred
- `[-]` Workspace snapshot — deferred to broader E042 decomposition
- `[-]` Peer / actor descriptor — parked in `.planning/refactor-docs/022-peer-provenance-follow-on.md`
- `[x]` Instance descriptor
- `[x]` Runtime inspection shapes

## Phase 3: Isolate Side Effects

- `[-]` Inventory filesystem touchpoints — deferred to broader E042 decomposition
- `[-]` Inventory process / spawn / restart touchpoints — deferred to broader E042 decomposition
- `[-]` Inventory timer ownership — deferred to broader E042 decomposition
- `[-]` Inventory network / fetch usage — deferred to broader E042 decomposition
- `[-]` Introduce thin infrastructure wrappers only where extraction materially reduces coupling — deferred to broader E042 decomposition
- `[-]` Ensure extracted domain logic depends on no Bun / Blessed / filesystem APIs — deferred to broader E042 decomposition

## Phase 4: Introduce Application Services

- `[x]` Define the first service layer under `src/application/`
- `[x]` Promote shared verbs out of interface handlers and into service functions
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

- `[x]` Define the runtime node object that owns stateful services
- `[x]` Decide how canonical `instance_id` relates to current `sessionId` and `instanceLabel`
- `[x]` Remove assumptions that `127.0.0.1:8099` is the only active runtime where low-risk shell/runtime seams were still hard-coded
- `[x]` Make export / scratch paths instance-aware where needed
- `[x]` Ensure control surfaces report instance identity consistently
- `[x]` Prepare a lightweight runtime registry seam without building full orchestration yet

## Phase 6: Extract the SDK Boundary

- `[x]` Define what belongs in `src/sdk/` versus internal runtime code
- `[x]` Stop SDK leakage from `src/core/*` and unrelated `src/services/*` where ownership is already clear
- `[x]` Preserve a single canonical import surface for modules during migration
- `[x]` Move Blessed-specific types and helpers behind internal boundaries where practical in pass 1
- `[x]` Mark public, beta, and internal exports if needed through `src/sdk/` ownership files rather than a broader taxonomy

## Phase 7: Migrate Built-In Functionality Toward Microapps

- `[x]` Decide which built-ins are in scope for this refactor pass
- `[x]` Choose a proof microapp for the new runtime model
- `[x]` Build the Runtime Inspector proof microapp once runtime inspection is real
- `[x]` Migrate one representative built-in feature without regressing command/API parity
- `[x]` Confirm existing external modules still load under the compatibility boundary

## Phase 8: Remove Legacy Paths

- `[x]` Delete dead or parallel command flows once shared services are stable
- `[x]` Delete microapp imports that bypass the canonical SDK surface
- `[x]` Delete interface-specific logic that duplicates shared runtime verbs
- `[x]` Remove obsolete compatibility shims only after module validation passes

## Verification Gates

- `[x]` `bun run typecheck`
- `[x]` Run targeted test suites for touched areas
- `[x]` Restart the app when `src/` internals change
- `[x]` Verify `/health`
- `[x]` Verify `/state`
- `[x]` Verify command execution parity across TUI / API / CLI for the refactored slice
- `[-]` Perform visual verification in tmux for affected UI behavior — text captures and live tmux pane inspection were preserved; human attach remains the final visual handoff step
- `[x]` Capture evidence when behavior changes materially
- `[x]` Preserve whole-desktop capture paths with text/API capture as the default path and PNG capture as secondary visual evidence

## Documentation / Planning

- `[x]` Update `.planning` when scope or execution order becomes concrete
- `[x]` Record architecture decisions in the refactor docs as they solidify
- `[x]` Update `.agents/` or relevant skill docs if the refactor reveals repeated agent failure modes
- `[x]` Update scripts and local skills when the refactor changes assumptions they encode
- `[x]` Consolidate overlapping markdown into fewer, clearer agent-friendly docs when ownership is obvious
- `[x]` Move retired or superseded markdown into `.trash/` once replacement docs are clearly better
- `[x]` Capture concrete command-surface examples in the refactor docs when they clarify how shell/CLI/API/runtime commands differ

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
- `[x]` Figlet banner sizing now uses rendered content plus corrected chrome math, and the runtime parity harness no longer forces a clipped 12-row banner box
