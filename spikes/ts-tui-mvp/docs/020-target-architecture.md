# TS TUI Target Architecture

Status: active
GitHub issue: —
PR: —

## Purpose

This is the canonical end-state architecture for the terminal-native TypeScript
rebuild.

Use this doc to answer:

- what the finished TS app should look like structurally
- which modules are first-class and which are adapters
- which seams should stay stable as features grow
- how to judge whether a new spike/PRD fits the intended architecture

This doc is **not** a direct migration plan. It is the target shape that later
epics and stories should move toward.

## Principles

1. One source of truth per concern.
2. User-visible commands are defined once, then projected outward.
3. Window state is semantic, not screen-scraped.
4. Window factories own window-specific behavior.
5. Core shell behavior must be renderer-boring before feature breadth expands.
6. Agents consume the same command/state substrate as menus and APIs.
7. The app stays terminal-native; browser/webview-only solutions are reference,
   not runtime dependencies.
8. Appearance is native to the app: semantic theme tokens first, renderer and
   external-theme adapters second.

## Reality Check

This doc is the target shape, not a claim that the spike already matches it.

Current known deltas:

- `app-controller.ts` is still too large and still owns terminal and Backrooms
  window construction directly.
- some core modules still depend on service-layer types and helpers.
- workspace snapshot and window state payloads are still more open-ended than
  the target architecture wants.
- startup still hardcodes a minimal fallback window instead of restoring the
  default workspace on boot.
- the next workspace-system slice should restore `scratch/workspaces/default.json`
  on boot, optionally via a last-used-workspace pointer, and only fall back to
  Scramble when no workspace can be restored.
- legacy Pi terminal and synthetic transcript chat flows have now been removed
  from the live spike, so the remaining deltas are structural rather than
  compatibility-driven.

## Top-Level Runtime Model

```text
ts-tui-mvp
├── app.ts
├── core/
│   ├── runtime-shell
│   ├── window-system
│   ├── command-system
│   ├── menu-system
│   ├── state-system
│   └── workspace-system
├── services/
│   ├── content-domain
│   ├── agent-domain
│   ├── terminal-domain
│   ├── browser-domain
│   ├── persistence/integration
│   └── projection-adapters
├── windows/
│   ├── content-windows
│   ├── agent-windows
│   ├── terminal-windows
│   ├── backrooms-windows
│   └── utility-windows
├── tests/
│   ├── command-contracts
│   ├── state-contracts
│   ├── workspace-roundtrip
│   └── window-manager
└── docs/
```

Note:

- `control-api.ts` and `agent-tools.ts` are projections of the core substrate.
- They currently live under `src/services/` and that is acceptable for now.
- If more projection surfaces arrive (`mcp`, `automation`, `ipc`), they should
  migrate into a dedicated `src/adapters/` or `src/projections/` area together.

## Desired Source Tree

This is the intended steady-state source layout. Some pieces already exist.
Others should be migration targets.

```text
src/
├── app.ts
├── core/
│   ├── app-controller.ts
│   ├── config.ts
│   ├── types.ts
│   ├── desktop-geometry.ts
│   ├── appearance-service.ts
│   ├── theme-types.ts
│   ├── theme-resolver.ts
│   ├── window-chrome.ts
│   ├── window-manager.ts
│   ├── window-facade.ts
│   ├── command-types.ts
│   ├── command-catalog.ts
│   ├── command-registry.ts
│   ├── menu-config.ts
│   ├── menu-overlay-manager.ts
│   ├── context-menu-items.ts
│   ├── overlay-manager.ts
│   ├── ui-primitives.ts
│   └── workspace-snapshots.ts
├── services/
│   ├── state-service.ts
│   ├── content-service.ts
│   ├── content-measurement.ts
│   ├── editor-service.ts
│   ├── figlet-service.ts
│   ├── animation-service.ts
│   ├── workspace-service.ts
│   ├── workspace-ui.ts
│   ├── file-actions.ts
│   ├── control-api.ts
│   ├── agent-tools.ts
│   ├── wibwob-agent-session.ts
│   ├── pty-session.ts
│   ├── terminal-buffer.ts
│   ├── terminal-renderer.ts
│   ├── backrooms-service.ts
│   ├── chrome-browser-service.ts
│   ├── brave-search-service.ts
│   ├── youtube-transcript-service.ts
│   └── pi-theme-adapter.ts
├── windows/
│   ├── text-windows.ts
│   ├── content-windows.ts
│   ├── figlet-windows.ts
│   ├── animation-windows.ts
│   ├── terminal-windows.ts
│   ├── backrooms-windows.ts
│   ├── wibwob-agent-window.ts
│   ├── chrome-browser-window.ts
│   ├── backrooms-log-browser-window.ts
│   └── misc-windows.ts
└── tests/
    ├── command-registry.test.ts
    ├── state-service.test.ts
    ├── workspace-snapshots.test.ts
    └── window-manager.test.ts
```

## Transitional Shims And Compatibility Flows

These are live modules or flows today. They are allowed in the target tree only
as transitional shims until their replacement is proven.

### `src/core/menu-config.ts`

Transitional shim around command wiring and menu actions. Keep until registry
execution plus context-sensitive menu projection fully subsume the remaining
manual action surface.

### Removal list

These should be struck off rather than carried forward into the target tree:

- `src/services/pi-service.ts`
- `src/services/chat-service.ts`
- `terminal.open_pi_legacy`
- `chat.open_transcript`

The target architecture favors `wibwob-agent-window.ts` plus
`wibwob-agent-session.ts` for native chat/agent behavior and `terminal-windows`
for real shell panes. The nested Pi terminal path and synthetic transcript chat
path should be deleted, not preserved as first-class compatibility surfaces.

## File Responsibilities

### `src/app.ts`

Boot entry only. Normalizes environment, constructs the controller, and starts
the shell. No feature logic.

### `src/core/app-controller.ts`

Owns runtime composition of the app. Wires together shell, services, windows,
registry, state, menus, and adapters. It should orchestrate, not implement
window-specific behavior.

Startup contract:

- on boot, try to restore `scratch/workspaces/default.json` first
- optionally support a last-used-workspace pointer once the workspace layer has
  a stable place to persist it
- only fall back to opening a bare minimum desktop surface such as Scramble if
  no workspace exists or the workspace cannot be loaded
- workspace save/quit flows may later auto-save into `default.json`, but that
  behavior should live in the workspace system rather than inside ad hoc boot
  code

### `src/core/config.ts`

Central runtime paths, ports, and environment-derived defaults. No feature
logic.

### `src/core/types.ts`

Cross-cutting domain types for windows, state, chat records, geometry, and
shared UI contracts.

Target note:

- shared contracts that are consumed by both core and services should live here
  or in a dedicated `core/contracts` area.
- current reverse imports from core into services are tolerated only as a
  transitional state.

### `src/core/desktop-geometry.ts`

Desktop-relative width, height, and cell-aspect service. All layout math should
flow through here.

### `src/core/appearance-service.ts`

Owns global appearance mode and theme variant selection.

Target contract:

- supports `system`, `light`, and `dark` appearance modes
- supports app-level theme variants such as `wibwob-tv`, `monochrome`, or future
  presets
- resolves the active semantic token set for the current session
- broadcasts appearance changes so all open windows can restyle without
  bespoke per-window toggles

### `src/core/theme-types.ts`

Canonical semantic token vocabulary for the app.

Target rule:

- no window or service should treat raw blessed colors as the source of truth
- text, background, border, selection, emphasis, warning, success, and desktop
  colors should be defined as semantic roles first
- external theme formats are adapters into this vocabulary, not the canonical
  source

### `src/core/theme-resolver.ts`

Compiles semantic theme tokens into concrete renderer-ready styles for blessed
and other in-process consumers.

### `src/core/window-chrome.ts`

Converts content bounds into framed window bounds. Owns titlebar/border/shadow
math so no `+2` or `+3` offsets leak across the app.

### `src/core/window-manager.ts`

Owns z-order, focus, drag, resize, tile, cascade, hit testing, and window
lifecycle. No content-specific behavior.

### `src/core/window-facade.ts`

Stable high-level surface for window operations consumed by adapters, tests, and
agent tooling.

### `src/core/command-types.ts`

Canonical command metadata types, command context, menu context, and adapter
projection types.

This file should eventually own:

- typed command args/results
- per-command argument schemas
- API/agent validation contracts
- context-menu selection payload types

### `src/core/command-catalog.ts`

Single source of truth for user-visible commands. Defines ids, labels, category,
ordering, placement, visibility, enablement predicates, and argument-schema
links.

### `src/core/command-registry.ts`

Execution-capable registry that projects the catalog into menus, palette,
context menus, control API, and agent tools.

### `src/core/menu-overlay-manager.ts`

Owns menu bar overlays and interactions. Consumes registry output; does not own
command definitions.

### `src/core/context-menu-items.ts`

Thin adapter that maps `MenuContext` plus registry output into blessed context
menu items. Must not become a second command-definition path.

### `src/core/overlay-manager.ts`

Shared transient overlays: prompts, list pickers, file browsers, notifications,
and modal UI helpers.

### `src/core/ui-primitives.ts`

Small presentational primitives reused across windows and overlays.

### `src/core/workspace-snapshots.ts`

Serializes and restores window snapshots using typed payload contracts as the
target state. The current spike still has open-ended payload maps and should
move toward discriminated unions or runtime schemas.

### `src/services/state-service.ts`

Builds the live semantic desktop state exposed to inspector windows, adapters,
and agents.

### `src/services/content-service.ts`

Discovers primers, docs, file lists, and content groupings used by viewers and
file managers.

### `src/services/content-measurement.ts`

Canonical measurement layer for plain text, primers, figlet output, and future
text surfaces.

### `src/services/editor-service.ts`

Owns text-buffer mutation and rendering helpers for the native editor surface.

### `src/services/figlet-service.ts`

Owns figlet font catalog, rendering, and measurement.

### `src/services/animation-service.ts`

Owns ASCII animation parsing, timing, playback state, and frame composition.

Target contract:

- supports pre-rendered frame files with explicit frame separators and playback
  rate metadata
- supports live-rendered animation sources for math/generative views
- exposes frame dimensions, frame count, fps, loop mode, and current playback
  state as semantic metadata
- composes overlays such as figlet banners or subtitle/karaoke text without
  every animated window reimplementing timing and repaint rules

### `src/services/workspace-service.ts`

Named workspace save/load persistence and file-system bookkeeping.

Target note:

- this service should own the default-workspace convention and any future
  last-used-workspace pointer
- boot restore should ask this service for the startup workspace decision
  instead of probing files ad hoc from the controller

### `src/services/workspace-ui.ts`

UI glue for workspace picking, save-as, and load flows. Should rely on shared
overlay primitives rather than ad hoc prompts.

### `src/services/file-actions.ts`

Shared open/save/reveal actions across file-backed windows.

### `src/services/control-api.ts`

Local HTTP control plane for state, command execution, test automation, and
external driving of the TUI.

Architecturally this is a projection adapter implemented in `services/` today.

### `src/services/agent-tools.ts`

Registry-backed and low-level tools exposed to the native agent surface.

Architecturally this is a projection adapter implemented in `services/` today.

### `src/services/wibwob-agent-session.ts`

Owns native agent session lifecycle, prompts, tool wiring, and streaming
behavior.

### `src/services/pty-session.ts`

PTY process lifecycle only: spawn, write, resize, kill, events.

### `src/services/terminal-buffer.ts`

Terminal cell buffer and scrollback state. Must be the source of truth for any
real shell pane.

### `src/services/terminal-renderer.ts`

Renders terminal cell state into blessed-safe text output.

### `src/services/backrooms-service.ts`

Backrooms run orchestration, log files, playback/fallback behavior, and run
metadata.

### `src/services/chrome-browser-service.ts`

Chrome/DevTools-backed browsing, extraction, and navigation data.

### `src/services/brave-search-service.ts`

Search integration service used by browser/agent flows.

### `src/services/youtube-transcript-service.ts`

Transcript extraction service used by browser/agent flows.

### `src/services/pi-theme-adapter.ts`

Imports and exports Pi-style theme JSON as an adapter over the app's native
semantic token model. This is an integration surface, not the source of truth.

### `src/windows/text-windows.ts`

Factories for editor-like text windows and closely related text-entry surfaces.

### `src/windows/content-windows.ts`

Factories for viewers, galleries, file managers, primer browsers, and other
content-heavy panes.

### `src/windows/figlet-windows.ts`

Factories for figlet/banner-related windows and pickers.

### `src/windows/animation-windows.ts`

Factories for frame-based and live-rendered ASCII animation windows.

Target note:

- this family should cover both pre-baked frame movies such as donut-style
  `----`-delimited frame files and live animation generators
- animation playback should be a first-class window type, not hidden inside
  miscellaneous art/demo windows
- minimalist chrome variants are acceptable here when the content is the focus

### `src/windows/terminal-windows.ts`

Factories for terminal, XTerm-shell, and future shell-like panes. Their logic
should move here out of `app-controller.ts`.

### `src/windows/backrooms-windows.ts`

Factories for Backrooms TV, Backrooms primer picker, and related Backrooms
panes. Their logic should move here out of `app-controller.ts`.

### `src/windows/wibwob-agent-window.ts`

Native agent/chat UI surface. Owns transcript rendering, draft UI, and tool
event display.

### `src/windows/chrome-browser-window.ts`

Browser UI window built on top of the browser service.

### `src/windows/backrooms-log-browser-window.ts`

Log browser window for Backrooms artifacts and previews.

### `src/windows/misc-windows.ts`

Lightweight utility windows that do not yet justify their own module group.

Extraction rule:

- no new complex domain should land here
- once a domain has 2+ related windows or >~200 lines of dedicated behavior,
  it should move to its own module family
- terminal and Backrooms are already past that threshold and should be
  extracted first

### `src/tests/command-registry.test.ts`

Contract tests for command discovery, ordering, context filtering, and generic
execution.

### `src/tests/state-service.test.ts`

Contract tests for semantic desktop state shape and key per-window fields.

### `src/tests/workspace-snapshots.test.ts`

Round-trip tests for snapshot serialization and restore semantics.

### `src/tests/window-manager.test.ts`

Behavioral tests for focus, z-order, drag, resize, tile, and cascade.

## Canonical Subsystems

The finished app should be understandable as five subsystems.

### 1. Shell

Menu bar, desktop, overlays, window manager, geometry, appearance, and theme.

### 2. Command Surface

Command catalog, registry, menu/context-menu/palette projection, control API,
future MCP.

### 3. Agent Surface

Native Wib&Wob agent window, agent session, tool adapters, state-aware desktop
control.

### 4. Content Surface

Viewer/editor/file-manager/browser/figlet/primer systems plus measurement and
rendering.

Animation belongs here too:

- frame-file ASCII movies
- live-generated ASCII animation
- figlet/subtitle overlays on animated content
- future concrete-poetry / karaoke-style timed text layers

### 5. Persistence Surface

Workspace save/load, run logs, app state, content metadata caches, and future
multi-instance/event state.

## Guardrails And Exit Criteria

These are the checks that turn architectural intent into something enforceable.

### `app-controller.ts` shrink target

- target: controller stays orchestration-only
- exit criterion: terminal and Backrooms window construction no longer live in
  `app-controller.ts`
- target threshold: controller should trend downward toward composition rather
  than continue as the default landing zone

### Command surface contract

- registry owns user-visible command metadata
- menus, palette, control API, agent tools, and context menus should all derive
  shared actions from that registry
- target-specific actions require typed selection payloads, not bespoke
  side-channel callbacks

### Snapshot/state contract

- window snapshot payloads should move from `Record<string, unknown>` toward
  discriminated unions or runtime-validated schemas
- state details should become more structured where windows are first-class
  long-lived surfaces

### Theme/appearance contract

- appearance mode is global and should support `system`, `light`, and `dark`
- windows consume semantic tokens, not ad hoc color literals
- renderer-facing blessed styles should be compiled from the theme resolver
- external theme formats such as Pi theme JSON should be adapters, not the
  canonical app theme model
- no new inline blessed style literals should be introduced when a semantic
  token already exists

### Test contract

Before a seam is treated as stable, it should have spike-local coverage:

- command registry: list/run/context behavior
- state service: schema and key fields
- workspace snapshots: round-trip restore
- window manager: focus/drag/resize/layout behavior
- animation service: frame parsing, fps playback timing, and overlay
  composition behavior

## What This Architecture Rejects

1. No second command-definition path in menus or context menus.
2. No feature-specific state scraping when semantic state can be described once.
3. No indefinite god-object growth in `app-controller.ts` for window-specific behavior.
4. No nested PTY TUI as the primary chat/agent architecture.
5. No broad renderer pivot until the shell and command surface are boring.

Today:

- rules 1 and 4 are materially directionally enforced
- rules 2, 3, and 5 are still active migration targets, not finished facts

## Menu Direction

The target menu system should have one consolidated desktop launcher area rather
than scattering app/window launchers across multiple top-level menus.

Target rule:

- desktop mode gets a single Finder/Desktop-style launcher surface
- application/window launchers live there first
- app-specific commands still appear contextually in File/Edit/View/Window/Applications

This does not require throwing away the command registry. It means the registry
should support:

- desktop launcher grouping
- per-context top-level placement
- contextual filtering without duplicating command definitions

## Menu Configuration Strategy

Use code for semantics and TOML for declarative presentation.

Recommended split:

- command ids, handlers, predicates, schemas: **code**
- top-level menu grouping, ordering, labels, desktop/app launcher sections:
  **TOML**
- long-form help and human documentation: **Markdown**

Why:

- TOML is good for stable declarative menu structure
- Markdown is good for docs and help, not machine-trustworthy menu config
- predicates like `enabled(ctx)` and selection-aware behavior belong in code,
  not in free-form config

Target shape:

- `menus/main.toml`
  - top-level menu layout
  - launcher sections
  - ordering/group names
- `menus/apps/*.toml`
  - optional per-app presentation overrides
  - labels, grouping, inclusion/exclusion of existing command ids

Hard rule:

- config may rearrange, rename, group, or hide command ids
- config must not become a second executable command-definition path

## How Existing Docs Should Relate To This One

Use older docs as inputs, not as the top-level plan:

- `overview.md` and `002-*` explain the rebuild problems
- `015`, `018`, and `019` refine key subsystems
- `spk-agent-window-enhancement.md` explains the agent direction
- feature-specific spike docs remain reference material unless they strengthen
  this target architecture

If a doc conflicts with this file, this file should win unless the newer change
is deliberate and then this file should be updated the same day.

## Immediate Use

This doc should drive the next planning layer:

1. `021-epic-map.md`
2. `022-migration-backlog.md`

Those should translate the target architecture into delivery slices without
being trapped by the order or wording of older spike docs.
