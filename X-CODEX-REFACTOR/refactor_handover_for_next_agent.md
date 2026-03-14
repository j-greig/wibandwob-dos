# WibWob Refactor Handover For Next Agent

Audience: an agent continuing work outside this Codex session.

Read this first, then use:

- [wibwob_refactor_plan_v1.3.md](/Users/james/Repos/wibandwob-dos/X-CODEX-REFACTOR/wibwob_refactor_plan_v1.3.md)
- [wibwob_refactor_checklist_v1.3.md](/Users/james/Repos/wibandwob-dos/X-CODEX-REFACTOR/wibwob_refactor_checklist_v1.3.md)
- [architecture_mapping_v1.3.md](/Users/james/Repos/wibandwob-dos/X-CODEX-REFACTOR/architecture_mapping_v1.3.md)

## Executive Summary

The main `X-CODEX-REFACTOR` execution plan is delivered.

The checklist is effectively closed:

- active refactor slices/phases are `[x]`
- anything not completed is intentionally `[-]` parked or deferred
- there should be no hidden half-done slice implied by the original v1.3/v1.4 plans

This refactor was not a broad rewrite for its own sake. The core aim was to make WibWob-DOS a clearer runtime for microapps, with one semantic path for commands, runtime inspection, windows, workspace operations, and agent-visible control surfaces.

## What Was Delivered

### 1. Runtime and identity cleanup

- Canonical runtime identity is now `instanceId`
- `sessionId` was removed from runtime-node identity usage rather than preserved as a compatibility layer
- runtime state, health, inspection, and related scripts were aligned around `instanceId`

### 2. Shared application-layer seams

The runtime now has explicit shared service seams instead of ad hoc interface-specific behavior:

- runtime command service
- runtime inspection service
- runtime window service
- runtime workspace service

These were introduced so TUI, API, CLI, and agent paths converge on the same semantics instead of each interface inventing its own behavior.

### 3. Runtime inspection seam

Runtime inspection was made explicit and inspectable as a first-class seam.

The proof outcome was:

- a shared inspection snapshot shape
- inspection access via the control/API surface
- a Runtime Inspector proof microapp consuming the same seam

### 4. Blocking-flow hardening

A recurring failure mode before the refactor was that the API could open a UI flow that had no corresponding API-visible exit path.

This was hardened by:

- exposing blocking state through inspection where relevant
- giving first-pass picker and overlay flows canonical command affordances
- treating `desktop.clear-all` as a last-resort escape hatch

### 5. SDK boundary extraction

The SDK boundary was clarified without breaking microapp authors:

- `src/sdk/` now exists as the ownership home
- [src/services/microapp-sdk.ts](/Users/james/Repos/wibandwob-dos/src/services/microapp-sdk.ts) remains the stable public import path
- host-internal and Blessed-specific leakage was reduced where ownership was already clear

### 6. CLI/API/TUI convergence

CLI was kept thin and brought closer to the same runtime semantics used by API/TUI rather than allowed to drift into a separate architecture.

### 7. Proof microapps instead of broad migration

The refactor intentionally avoided migrating everything at once.

Proof surfaces were used instead:

- Runtime Inspector
- Command Lab
- Workspace Beacon
- Layout Probe

These exist to prove the new runtime, SDK, workspace, inspection, and microapp authoring seams.

### 8. Legacy pruning and docs/tooling cleanup

The refactor also removed dead paths and clarified the operator/agent tooling story:

- duplicate command/control paths were pruned once the shared seams were proven
- docs were consolidated
- text-first TUI capture was kept as the default evidence path
- parity and live verification scripts were improved

## Architectural Layer Reminders From The `src/*/README.md` Anchors

These small README files are easy to skip. Their intent is important and should be treated as part of the refactor outcome.

### `src/domain`

This layer is for pure runtime models and rules.

Keep it free of:

- Blessed
- Bun server APIs
- filesystem and process side effects
- direct window/widget mutation

The refactor only partially populated this layer. Do not interpret that as permission to collapse runtime logic back into UI or transport layers.

### `src/application`

This layer owns shared semantic verbs and use-case orchestration.

It should:

- coordinate domain models with runtime owners
- own shared command/inspection/window/workspace verbs
- avoid becoming an interface adapter

If a future change affects TUI, API, CLI, and agent semantics, the first question should be whether it belongs here.

### `src/runtime`

This layer is the intended home for stateful ownership within one Runtime Node.

It should own:

- instance-scoped runtime state
- command and event dispatch core
- window/focus/runtime containers
- lifecycle plumbing

The refactor did not force an immediate `src/core` -> `src/runtime` migration. The layer exists as a clear ownership destination, not as a mandate for speculative moves.

### `src/sdk`

This is the internal SDK ownership home.

Rules:

- keep [src/services/microapp-sdk.ts](/Users/james/Repos/wibandwob-dos/src/services/microapp-sdk.ts) as the stable public import path
- move real SDK ownership into `src/sdk/` gradually
- avoid exposing Blessed or unrelated host internals directly

Current anchor files under `src/sdk/` matter more than the README prose:

- `microapp-host.ts`
- `runtime-helpers.ts`
- `runtime-client.ts`
- `index.ts`

### `src/adapters`

This layer exists to hold peer-interface adapters over shared runtime semantics.

Examples:

- TUI
- API
- CLI

The important rule is not "move everything into `src/adapters` now". The important rule is:

- interface-specific plumbing should stop owning shared semantics

If a future change adds behavior to API, CLI, or TUI separately, check whether that behavior should instead be pulled into `src/application` or `src/runtime`, with adapters staying thin.

### `src/cli`

The CLI is not a private shortcut into shell internals.

Its architectural rule is:

- pure HTTP client
- zero command-catalog import
- zero direct `src/core/*` dependency for runtime semantics

Parity is maintained by runtime discovery via `GET /commands/list`, not by hardcoding command knowledge into the CLI.

This rule is part of the refactor and should remain intact.

## Biggest Breaking Changes

These are the most important changes for any follow-on agent.

### 1. Modules are now microapps

This rename is canonical, not cosmetic.

Changed:

- `modules/` -> `microapps/`
- `modules-private/` -> `microapps-private/`
- `.agents/module-dev/` -> `.agents/microapp-dev/`
- `module.json` -> `microapp.json`
- `modules.reload` -> `microapps.reload`
- runtime/container terminology now prefers `microapp`, not `module`

Keep the word `module` only where it genuinely means JavaScript/TypeScript/npm module semantics.

### 2. Watch/reload semantics were corrected

Current reality:

- `watch:microapp` defaults to a safe restart-and-reopen strategy
- `--strategy reload` is experimental
- the reliable path for fresh code is host restart plus reopen, not arbitrary stateful window hot-swap

### 3. Bare Tab is microapp-local

Global app cycling should not steal plain `Tab`.

Current expectation:

- plain `Tab` belongs to the focused microapp unless that microapp chooses not to use it
- shell-level app cycling is on `Meta-Tab` / `Meta-Shift-Tab`

### 4. Text-first verification is policy

For evidence and automation, prefer:

- `/screenshot/text`
- `scripts/screenshot-window.sh`
- `scripts/minimap.sh`

PNG/system capture is secondary evidence, not the default proof path.

## Current Status Of The Original Refactor Tasklist

Bird's-eye view of the original `X-CODEX-REFACTOR` scope:

### Delivered

- architecture mapping and godfile audit
- command pipeline convergence
- runtime inspection seam
- instance identity scaffolding
- workspace service convergence
- file/open and overlay hardening for first-pass blocking flows
- runtime node scaffolding
- SDK boundary extraction
- CLI convergence
- Runtime Inspector proof microapp
- legacy path pruning
- doc consolidation and operator/agent tooling signposting

<still-todo>

### Intentionally Deferred / Parked

These are the remaining follow-on tracks. They were explicitly moved out of the main refactor slice.

- peer provenance / actor attribution:
  - [022-peer-provenance-follow-on.md](/Users/james/Repos/wibandwob-dos/.planning/refactor-docs/022-peer-provenance-follow-on.md)
- Unicode/cell-aware rendering:
  - [021-unicode-cell-rendering-follow-on.md](/Users/james/Repos/wibandwob-dos/.planning/refactor-docs/021-unicode-cell-rendering-follow-on.md)
- Ghostty vs terminal-microapp agent efficiency benchmark:
  - [023-agent-runtime-efficiency-benchmark-follow-on.md](/Users/james/Repos/wibandwob-dos/.planning/refactor-docs/023-agent-runtime-efficiency-benchmark-follow-on.md)
- deeper agent-friendly microapp dev loop / hot-reload work:
  - [025-agent-friendly-microapp-dev-follow-on.md](/Users/james/Repos/wibandwob-dos/.planning/refactor-docs/025-agent-friendly-microapp-dev-follow-on.md)

### Deferred Because They Became Larger Separate Tracks

- deeper god-file decomposition
- deeper pure-domain extraction
- full side-effect inventory / infra wrappers
- broader event/persistence redesign
- broad host-owned built-in migration beyond the proof microapps
</still-todo>

## SDK State: What Is Stable vs Still Soft

There was an idea in the plan about distinguishing stable/approved SDK pieces from beta/experimental/internal ones.

Important: that taxonomy was only partially realized.

What is true now:

- the stable public import surface is [src/services/microapp-sdk.ts](/Users/james/Repos/wibandwob-dos/src/services/microapp-sdk.ts)
- the ownership home is `src/sdk/`
- host internals and Blessed-specific helpers were pushed behind clearer boundaries where practical

What is not fully true yet:

- there is not a rigorous, enforced repo-wide SDK stability labeling system
- there is not yet a formal public API manifest that says "stable", "beta", and "internal" for every export

So if you need to build on the SDK:

- treat `src/services/microapp-sdk.ts` as canonical
- treat direct imports from unrelated `src/core/*` or `src/services/*` as suspect
- if you formalize SDK tiers later, do it as a separate explicit piece of work rather than assuming it already exists

## Operational Notes For The Next Agent

### Verification expectations

Minimum:

- `bun run typecheck`
- restart when touching `src/`: `bash scripts/restart.sh`
- verify:
  - `GET /health`
  - `GET /state`
  - `GET /commands/list`
  - `GET /runtime/inspection`
  - `GET /screenshot/text`

Preferred live proofs:

- `bash scripts/runtime-parity-check.sh`
- `bash scripts/live-api-test-suite.sh`
- targeted text screenshots of touched windows
- `tmux attach -t wibwob` for visual confirmation

### If a file or doc is uncertain

Move it into repo-local `.trash/`.

Do not leave ambiguous duplicate docs or semi-retired code active if you are no longer sure which one is canonical.

### If the control/API surface grows

Do not add one-off bespoke behavior if it should be a runtime command instead.

The refactor bias was:

- one command path
- one inspection path
- one window path
- one workspace path

Extend the existing owner instead of creating a parallel helper.

## Known Limits And Honest Caveats

### 1. Hot reload is not true stateful hot swap

The authoring loop is materially better than before, but not magical.

Safe claim:

- microapp edits can be watched
- the app can be restarted automatically
- the microapp can be reopened automatically

Unsafe claim:

- arbitrary stateful windows can always be swapped in place with zero loss

### 2. Proof microapps are proofs, not a full migration

Runtime Inspector and the other proof microapps demonstrate the architecture.

They do not mean every host-owned built-in has been fully re-platformed.

### 3. SDK tiering is still soft

See the SDK section above.

### 4. Some bigger architectural tracks were intentionally not folded into this refactor

Especially:

- provenance/history
- Unicode/cell-aware rendering
- terminal/microapp efficiency benchmarking
- deeper event/persistence redesign

<still-todo>

## Recommended Order For Follow-On Work

If you are picking up the parked items, this order is the safest:

1. finish any remaining documentation/agent-tooling clarity tied to the already-landed seams
2. continue [025-agent-friendly-microapp-dev-follow-on.md](/Users/james/Repos/wibandwob-dos/.planning/refactor-docs/025-agent-friendly-microapp-dev-follow-on.md) without overselling hot reload
3. tackle peer provenance as a distinct track
4. tackle Unicode/cell-aware rendering as a distinct rendering track
5. only then consider broader host -> microapp migration beyond the existing proofs
</still-todo>

## Things The Human Did Not Explicitly Ask For But The Next Agent Should Know

### 1. The refactor deliberately preferred thin vertical slices

If you continue from here, keep that habit.

Broad churn without a proving slice was repeatedly treated as a regression risk.

### 2. The runtime is meant to be peer-controlled

The architecture is intentionally moving toward a shared runtime with:

- TUI
- CLI
- API
- agent control surfaces

Do not let one interface become the "real" owner again.

### 3. Avoid widget-driven local special cases

When possible:

- runtime/services own semantics
- windows own rendering and input wiring
- microapps consume the SDK

### 4. Keep docs agent-friendly

The refactor included a strong bias toward:

- fewer docs, better docs
- explicit signposting to scripts
- examples that can actually be run
- text-first proofs rather than vague prose

If you add docs, keep them short, canonical, and executable.

## Final Handover Note

The important thing is not merely that many files changed. The important thing is that WibWob-DOS now has a much clearer semantic center:

- runtime identity is cleaner
- command execution is more canonical
- inspection is real
- microapp authoring has a better boundary
- the control surfaces are less divergent

Treat the parked items as new tracks, not as evidence that the original refactor failed to finish.
