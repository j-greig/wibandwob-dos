## Agent-Friendly Microapp Dev Follow-On

Status: implemented-in-part
GitHub issue: —
PR: —

## Why This Exists

The runtime refactor improved the shared host seams, SDK ownership, and API parity.
The next quality bar for microapp development is agent ergonomics:

- fast proof microapps that exercise the new runtime/API/SDK seams
- low-friction build/test loops for microapp authors
- optional hot reload when a microapp's TypeScript source changes

## Goals

1. build a small handful of new proof microapps that stress:
   - runtime inspection reads
   - shared command execution
   - window/open/focus/close semantics
   - SDK primitives and updated public exports
   - API-visible state / describeState patterns
2. make the microapp dev loop agent-friendly:
   - scaffold -> typecheck -> open -> edit -> verify
   - minimize full-shell reload requirements when only `microapps/*` changed
3. explore optional per-microapp hot reload:
   - top-level microapp opt-in
   - watch TS file changes
   - reload microapp instance without full WibWob restart where safe

## Suggested Proof Set

- a runtime-inspection consumer with richer panes/tabs
- a command-lab microapp that invokes shared runtime verbs
- a workspace-aware microapp with snapshot/restore
- a layout-heavy microapp using newer SDK primitives/components

## Landed So Far

- canonical `microapps.reload` runtime command
- `scripts/watch-microapp.ts` using `microapp.json` and `dev.watch`
- proof microapps:
  - `microapps/runtime-inspector/`
  - `microapps/command-lab/`
  - `microapps/workspace-beacon/`
  - `microapps/layout-probe/`
- stable scaffold path: `bash scripts/scaffold-microapp.sh microapps/<name> ...`
- safe watcher default: `watch:microapp` now uses restart+reopen unless `--strategy reload` is requested
- canonical authoring docs under `.agents/microapp-dev/`

These proofs now cover:

- shared runtime inspection reads
- shared command execution
- workspace snapshot/restore from a microapp-owned state model
- layout SDK primitives and geometry reporting
- API-visible `describeState()` and text capture

## Acceptance Criteria

- at least several new microapps can be built and verified through the modern SDK path
- the proof set meaningfully exercises newly refactored seams
- editing module TS and seeing the change reflected is as close to instant as the architecture safely allows
- hot reload is either shipped as an explicit opt-in or clearly documented as not yet safe for certain microapp classes

## Current Refactor Outcome

- landed: canonical `microapps.reload` command for microapp-only reloads
- landed: `scripts/watch-microapp.ts` prototype and `dev.watch` / `dev.reopenCommand` manifest scaffolding
- landed: richer Runtime Inspector proof microapp
- landed: `microapps/command-lab/` proof microapp covering shared command execution + snapshot restore
- landed: `microapps/workspace-beacon/` proof microapp covering workspace-aware state round-trip
- landed: `microapps/layout-probe/` proof microapp covering layout SDK usage and region reports
- not yet claimed as solved: reliable hot-swapping of already-open microapp windows

## Canonical Dev Loop

Use this loop by default for authoring work inside `microapps/*`:

1. `bash scripts/scaffold-microapp.sh microapps/<name> wibwob.<id> "<Title>" <menuOrder>`
2. `bun run typecheck`
3. `wibwob cmd microapps.reload`
4. `wibwob cmd microapp.wibwob.<id>.open`
5. verify with:
   - `GET /state`
   - `GET /screenshot/text`
   - `./scripts/screenshot-window.sh "<Title>"`
   - `tmux attach -t wibwob`

Optional best-effort watcher:

- `bun run watch:microapp -- microapps/<name> --open`
- experimental in-process path: `bun run watch:microapp -- microapps/<name> --open --strategy reload`

## Why Hot Reload Is Still Parked

The remaining hard part is not command reload, it is safe window replacement:

- identifying live windows by semantic microapp ownership
- closing them without racing `focusOrCreate`
- reopening them with correct geometry and state handoff
- deciding when microapp-local state can be recreated vs must be restored

That needs a slightly higher-level host/runtime abstraction than this refactor
should invent mid-stream. Keep the scaffolding, but treat full hot window swap
as a post-refactor follow-on.

## Safe vs Unsafe Reload Boundaries

Safe enough now:

- safe restart → reopen loops for microapp authoring
- reloading command metadata
- best-effort close → reload → reopen with geometry restoration only when explicitly opting into `--strategy reload`

Not yet safe as a contract:

- arbitrary stateful window hot-swap
- seamless handoff of local widget state
- recovery from theme/widget crashes mid-reload
- swapping already-open complex overlays without a close/reopen boundary

## Notes

- prefer microapp-only reload over full shell restart whenever the change is confined to `microapps/*`
- keep this separate from host-owned runtime refactor closure; it is a developer-experience and proof-surface follow-on
- `microapps-private/` is the private sibling tree for non-public microapps in this setup; treat it as a separate private repo, not a public examples folder
