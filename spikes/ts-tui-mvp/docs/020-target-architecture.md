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
│   └── persistence/integration
├── windows/
│   ├── content-windows
│   ├── agent-windows
│   ├── terminal-windows
│   ├── utility-windows
│   └── app-specific windows
├── adapters/
│   ├── control-api
│   ├── agent-tools
│   ├── future MCP
│   └── future automation surfaces
└── docs/
```

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
│   ├── window-chrome.ts
│   ├── window-manager.ts
│   ├── window-facade.ts
│   ├── command-types.ts
│   ├── command-catalog.ts
│   ├── command-registry.ts
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
│   └── youtube-transcript-service.ts
├── windows/
│   ├── text-windows.ts
│   ├── content-windows.ts
│   ├── figlet-windows.ts
│   ├── wibwob-agent-window.ts
│   ├── chrome-browser-window.ts
│   ├── backrooms-log-browser-window.ts
│   └── misc-windows.ts
└── adapters/
    ├── mcp-adapter.ts
    └── automation-adapter.ts
```

## File Responsibilities

### `src/app.ts`

Boot entry only. Normalizes environment, constructs the controller, and starts
the shell. No feature logic.

### `src/core/app-controller.ts`

Owns runtime composition of the app. Wires together shell, services, windows,
registry, state, menus, and adapters. It should orchestrate, not implement
window-specific behavior.

### `src/core/config.ts`

Central runtime paths, ports, and environment-derived defaults. No feature
logic.

### `src/core/types.ts`

Cross-cutting domain types for windows, state, chat records, geometry, and
shared UI contracts.

### `src/core/desktop-geometry.ts`

Desktop-relative width, height, and cell-aspect service. All layout math should
flow through here.

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

### `src/core/command-catalog.ts`

Single source of truth for user-visible commands. Defines ids, labels, category,
ordering, placement, visibility, and enablement predicates.

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

Serializes and restores window snapshots using stable, typed payloads. No
window-specific UI logic outside factory hooks.

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

### `src/services/workspace-service.ts`

Named workspace save/load persistence and file-system bookkeeping.

### `src/services/workspace-ui.ts`

UI glue for workspace picking, save-as, and load flows. Should rely on shared
overlay primitives rather than ad hoc prompts.

### `src/services/file-actions.ts`

Shared open/save/reveal actions across file-backed windows.

### `src/services/control-api.ts`

Local HTTP control plane for state, command execution, test automation, and
external driving of the TUI.

### `src/services/agent-tools.ts`

Registry-backed and low-level tools exposed to the native agent surface.

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

### `src/windows/text-windows.ts`

Factories for editor-like text windows and closely related text-entry surfaces.

### `src/windows/content-windows.ts`

Factories for viewers, galleries, file managers, primer browsers, and other
content-heavy panes.

### `src/windows/figlet-windows.ts`

Factories for figlet/banner-related windows and pickers.

### `src/windows/wibwob-agent-window.ts`

Native agent/chat UI surface. Owns transcript rendering, draft UI, and tool
event display.

### `src/windows/chrome-browser-window.ts`

Browser UI window built on top of the browser service.

### `src/windows/backrooms-log-browser-window.ts`

Log browser window for Backrooms artifacts and previews.

### `src/windows/misc-windows.ts`

Lightweight utility windows that do not yet justify their own module group.

### `src/adapters/mcp-adapter.ts`

Future projection of the command/state substrate into MCP resources and tools.

### `src/adapters/automation-adapter.ts`

Future projection of commands/state into recurring automation-safe tasks.

## Canonical Subsystems

The finished app should be understandable as five subsystems.

### 1. Shell

Menu bar, desktop, overlays, window manager, geometry, and theme.

### 2. Command Surface

Command catalog, registry, menu/context-menu/palette projection, control API,
future MCP.

### 3. Agent Surface

Native Wib&Wob agent window, agent session, tool adapters, state-aware desktop
control.

### 4. Content Surface

Viewer/editor/file-manager/browser/figlet/primer systems plus measurement and
rendering.

### 5. Persistence Surface

Workspace save/load, run logs, app state, content metadata caches, and future
multi-instance/event state.

## What This Architecture Rejects

1. No second command-definition path in menus or context menus.
2. No feature-specific state scraping when semantic state can be described once.
3. No god-object growth in `app-controller.ts` for window-specific behavior.
4. No nested PTY TUI as the primary chat/agent architecture.
5. No broad renderer pivot until the shell and command surface are boring.

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

---

## Review Findings (Codex, 2026-03-01)

Automated architecture review by Codex subagent against landed code.
Address these before promoting this doc to epic/story planning input.

```json
[
  {
    "type": "gap",
    "section": "Desired Source Tree",
    "summary": "The tree omits live modules that the current app still depends on.",
    "detail": "The canonical tree leaves out src/core/menu-config.ts, src/services/pi-service.ts, and src/services/chat-service.ts. Those are not dead files: command-catalog.ts, command-registry.ts, app-controller.ts, and misc-windows.ts import them today. The doc should either include them in the steady-state tree or explicitly mark them as transitional shims with removal criteria."
  },
  {
    "type": "contradiction",
    "section": "Top-Level Runtime Model",
    "summary": "Control API and agent tools are classified as adapters in one section and services in another.",
    "detail": "The runtime model places control-api and agent-tools under adapters/, which implies they are projections of the core substrate. The desired tree and file responsibilities then place both under src/services/, which makes them look like domain services instead. That split weakens the architectural boundary the doc is trying to establish, especially once MCP and automation adapters arrive."
  },
  {
    "type": "contradiction",
    "section": "Principles",
    "summary": "The document says window factories own window-specific behavior, but major window implementations still have no module home outside app-controller.ts.",
    "detail": "Terminal, Backrooms primer picker, and Backrooms TV windows are still built directly inside app-controller.ts, and the desired tree does not reserve a terminal-windows.ts or backrooms-windows.ts destination for them. The top-level model talks about terminal and app-specific window groups, but the concrete tree does not. That leaves the controller as the default landing zone for some of the most complex window logic, which is the opposite of Principle 4."
  },
  {
    "type": "concern",
    "section": "File Responsibilities",
    "summary": "The doc describes a layered core/services split, but the current core already depends on services.",
    "detail": "src/core/types.ts imports ContentMeasurement from src/services/content-measurement.ts, and src/core/workspace-snapshots.ts imports getDefaultFigletFont from src/services/figlet-service.ts. That creates a reverse dependency from core into services and makes the layering less stable than the document implies. The doc should either formalize that dependency direction or move those shared contracts into core so the boundary is real."
  },
  {
    "type": "gap",
    "section": "src/core/command-types.ts",
    "summary": "The command architecture still lacks a typed argument contract for API and agent execution.",
    "detail": "The live command path still uses inline types in command-catalog.ts and an unvalidated Record<string, unknown> in CommandRegistry.run(). Parameterized commands such as Backrooms parsing are handled ad hoc in app-controller.ts, which means API and agent callers do not get a machine-checkable contract. For a registry that is supposed to be the single source of truth, argument schemas and validation rules are a missing seam."
  },
  {
    "type": "concern",
    "section": "What This Architecture Rejects",
    "summary": "The rejection list mixes enforced rules with aspirational ones, but the doc does not say which are actually guarded.",
    "detail": "The no-second-command-path rule is materially enforced by context-menu-items.ts delegating to the registry, and the chat/agent direction is mostly enforced by wibwob-agent-window.ts plus WibWobAgentSession. By contrast, the no-god-object rule is not enforced at all: app-controller.ts is still about 2050 lines and owns terminal, Backrooms, workspace restore, editor key handling, and control API composition. The doc needs explicit guardrails or exit criteria, otherwise that section reads more like intent than architecture."
  },
  {
    "type": "contradiction",
    "section": "src/core/workspace-snapshots.ts",
    "summary": "The document overstates how typed the snapshot and state contracts currently are.",
    "detail": "WindowSnapshot.payload is still Record<string, unknown>, and WindowStateDetails is an open-ended map with an index signature. Restore logic branches on free-form appType strings and manual property checks instead of discriminated unions or runtime schemas. That is workable for a spike, but it is weaker than the doc's claim of stable, typed payloads and semantic state."
  },
  {
    "type": "gap",
    "section": "Canonical Subsystems",
    "summary": "The architecture doc does not say enough about testing or contract enforcement for the seams it treats as stable.",
    "detail": "There are no spike-local test directories, and the doc does not define what must be covered before these interfaces are trusted. The command surface, WindowFacade, workspace snapshot round-trips, and StateService schema all need contract tests if they are meant to anchor future adapters and agents. Without that, the document names the seams but does not explain how regressions will be caught."
  },
  {
    "type": "concern",
    "section": "Canonical Subsystems",
    "summary": "misc-windows.ts is too vague as a long-term bucket for a 15-20 window app.",
    "detail": "For a tiny MVP, misc-windows.ts is fine, but the current app already has enough window types that the file risks becoming a junk drawer. The doc should define extraction thresholds or first-class groups for terminal, Backrooms, and utility windows instead of leaving only misc-windows.ts as the catch-all. Otherwise subsystem decomposition will drift back toward file-size-based organization instead of architectural boundaries."
  },
  {
    "type": "question",
    "section": "Agent Surface",
    "summary": "The steady-state status of legacy chat and Pi terminal flows is unclear.",
    "detail": "The doc says chat has collapsed into the native agent surface and rejects a nested PTY TUI as the primary chat architecture, but the app still exposes terminal.open_pi_legacy, PiService, and the older synthetic openChatWindow path. The desired tree omits those modules, which suggests they are not part of the target architecture, but the document never says that explicitly. It should state whether those flows are compatibility-only, deprecated, or intentionally preserved."
  }
]
```
