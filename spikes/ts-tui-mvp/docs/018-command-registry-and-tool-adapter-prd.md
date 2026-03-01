# PRD: Command Registry And Tool Adapter

Status: partial
Scope: terminal-native TS spike

## TL;DR

We should stop defining the same app feature separately for:

- menus
- command palette
- control API
- agent tools
- future MCP tools

Instead, define each feature once in a `CommandRegistry`, then project it into:

- menu items
- palette entries
- HTTP/control API routes
- agent tool surfaces
- later MCP tool surfaces

This is the cleanest anti-duplication move available to the TS rebuild.

The new file manager is the perfect example:

Today it already needed wiring in multiple places:

- window implementation
- controller action
- menu config
- palette entries
- control API route
- workspace restore logic

That is exactly the kind of repetition we should collapse.

## Problem

The C++/Python/TVision app drifted because the same feature had to be described
repeatedly in different layers. The TS spike is already in danger of repeating
that pattern.

For a single feature like `Open File Manager`, we currently have to touch:

- window implementation
- app controller method
- menu config
- command palette list
- control API route
- possibly context menu
- possibly workspace restore/open logic
- eventually agent tools
- eventually MCP tools

That is too many definition points.

## Goal

Define a user-visible command once, then expose it everywhere from that one
definition.

## Non-goals

- not a full plugin system yet
- not a grand event-bus rewrite
- not replacing existing workspace snapshot logic immediately
- not forcing every low-level helper into the registry

This is for **user-visible app commands** and agent-exposed app actions.

## Canonical name

Use these terms:

- `CommandRegistry` = source of truth
- `CommandDefinition` = one command entry
- `CommandHandler` = implementation
- `ToolAdapter` = exposes commands to agents/MCP
- `MenuAdapter` = derives menus/palette from registry
- `ApiAdapter` = derives control API routes from registry

Avoid vaguer names like "auto translation layer" in code.

## Ranked solution options

### 1. CommandRegistry + adapters (RECOMMENDED)

One typed command model, projected into:

- menu
- palette
- control API
- agent tools
- future MCP

Pros:

- one source of truth
- fits this app well
- low conceptual overhead
- highly DRY
- supports introspection
- supports state-aware agents

Cons:

- requires migrating existing ad hoc action wiring
- command schema discipline needed from day one

### 2. Tool-first registry

Define everything first as an agent/MCP tool, then adapt back to menu/API.

Pros:

- very agent-centric
- nice for automation-first products

Cons:

- user-facing menu/keyboard semantics become second-class
- awkward for purely local UI actions
- wrong priority for a desktop shell

### 3. Route-first API registry

Define HTTP/control API first, derive everything else from routes.

Pros:

- easy for tests and external clients

Cons:

- UI semantics get flattened into RPC
- menu and keyboard concerns become awkward
- bad fit for a terminal desktop app

### 4. Keep current ad hoc action wiring

Pros:

- no refactor needed immediately

Cons:

- repeats the exact architecture drift we are trying to escape
- scales badly
- brittle for agent integration

## Recommendation

Choose **Option 1: CommandRegistry + adapters**.

This keeps the app desktop-first while still making it agent-friendly.

## Current implementation status

Phase 1 has landed in the spike:

- menus and command palette now derive from a shared command catalog
- the catalog now carries canonical command ids, groups, multi-menu placements,
  palette placement, surface visibility, and action keys
- a real registry now projects that catalog into:
  - menus
  - command palette
  - generic command discovery
  - generic command execution over the control API

Current source files:

- [/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/src/core/command-catalog.ts](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/src/core/command-catalog.ts)
- [/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/src/core/command-registry.ts](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/src/core/command-registry.ts)
- [/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/src/core/menu-config.ts](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/src/core/menu-config.ts)
- [/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/src/services/control-api.ts](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/src/services/control-api.ts)

This is still not the full end-state registry. MCP is not yet derived from the
same source, and some special-case UI surfaces still sit outside the generic
path. But the spike now has a real execution-capable registry seam projected
into:

- menus
- command palette
- control API
- agent tools

The remaining work is cleanup, deeper migration, and MCP projection, not
proving the basic registry direction.

## Core design

### CommandDefinition

Each command should define:

```ts
interface CommandDefinition<TArgs = unknown, TResult = unknown> {
  id: string;
  label: string;
  category: "file" | "edit" | "view" | "window" | "tools" | "agent";
  description: string;
  argsSchema?: unknown;
  visibility: {
    menu?: boolean;
    palette?: boolean;
    api?: boolean;
    agent?: boolean;
    mcp?: boolean;
  };
  when?: (ctx: CommandContext) => boolean;
  run: (ctx: CommandContext, args: TArgs) => Promise<TResult> | TResult;
}
```

### CommandContext

The handler context should expose only stable app services:

```ts
interface CommandContext {
  getState: () => DesktopState;
  windowManager: WindowManager;
  content: ContentService;
  workspace: WorkspaceService;
  overlays: OverlayManager;
  openEditorWindow: (...) => void;
  openViewerWindow: (...) => void;
  openFileManagerWindow: (...) => void;
}
```

This context becomes the stable seam between app internals and command surfaces.

## File manager as the concrete example

The new file manager feature is the model case.

### Today’s actual duplication

`Open File Manager` required changes in:

- [/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/src/windows/content-windows.ts](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/src/windows/content-windows.ts)
- [/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/src/core/app-controller.ts](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/src/core/app-controller.ts)
- [/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/src/core/menu-config.ts](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/src/core/menu-config.ts)
- [/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/src/services/control-api.ts](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/src/services/control-api.ts)
- [/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/src/core/workspace-snapshots.ts](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/src/core/workspace-snapshots.ts)

That is already too much wiring for one feature.

### What best practice would look like

Define:

```ts
registry.register({
  id: "file_manager.open",
  label: "Open File Manager",
  category: "file",
  description: "Open the FAR.js-inspired file manager window.",
  visibility: {
    menu: true,
    palette: true,
    api: true,
    agent: true,
    mcp: true
  },
  run: (ctx) => {
    ctx.openFileManagerWindow();
  }
});
```

Then derive:

- `File -> Open File Manager`
- `Window -> Open File Manager`
- `Tools -> File Manager`
- palette command
- `POST /commands/file_manager.open`
- agent tool `command_run("file_manager.open")`
- MCP tool `command_run`

That is the target model.

## Best-practice surface model

### Menus

Do **not** hand-maintain parallel menu action interfaces forever.

Instead:

- menu config should query the registry for commands in each category
- menu labels come from command labels
- the menu action just calls `registry.execute(id, args?)`

### Command palette

Do **not** keep a second static list.

Instead:

- palette lists `visibility.palette === true` commands
- optional search/filter by `label`, `id`, `description`

### Control API

Avoid one bespoke route per command long-term.

Instead add a generic route:

```http
POST /commands/run
{
  "id": "file_manager.open",
  "args": {}
}
```

Keep a few special routes for state or streaming if needed, but command dispatch
should converge toward a generic route.

### Agent tools

Do **not** hand-code every agent tool if the command already exists.

Instead:

- expose a generic tool like `tui_run_command`
- expose a discovery tool like `tui_list_commands`
- optionally expose a curated subset as first-class tools later

This keeps agent integration DRY.

### MCP

Later:

- expose the same registry via MCP tools
- resources stay separate (`desktop://state`, etc.)
- tools invoke commands

## Proposed architecture

New files:

- `src/core/command-registry.ts`
- `src/core/command-types.ts`
- `src/core/command-catalog.ts`
- `src/services/command-api-adapter.ts`
- `src/services/agent-command-adapter.ts`

### command-types.ts

Owns:

- `CommandDefinition`
- `CommandContext`
- result types
- visibility types

### command-registry.ts

Owns:

- register
- lookup by id
- execute
- list by category/visibility

### command-catalog.ts

Owns:

- all built-in command definitions
- grouped logically by area

### command-api-adapter.ts

Owns:

- generic route for listing/executing commands
- maps registry errors to API responses

### agent-command-adapter.ts

Owns:

- `tui_list_commands`
- `tui_run_command`
- optional command subset filtering for the agent

## Migration order

### Phase 1 — foundation

- [x] add registry types
- [x] add registry implementation
- [x] register only 5-10 pilot commands plus compatibility coverage for the rest

Initial commands:

- `file_manager.open`
- `workspace.save`
- `workspace.load`
- `window.tile`
- `window.cascade`
- `wibwob_chat.open`
- `wibwob_agent.open`

### Phase 2 — menu/palette projection

- [x] derive menu items from registry for the migrated commands
- [x] derive palette items from registry
- [x] keep old ad hoc paths for untouched commands temporarily
- [x] support one canonical command appearing in multiple menus via `menuPlacements`

Pilot commands now using the cleaner multi-placement model:

- `browser.open_chrome`
- `file.open_file_manager`
- `chat.open_wibwob`
- `agent.open_wibwob`
- `window.tile`
- `window.cascade`

### Phase 3 — API projection

- [x] add `/commands/list`
- [x] add `/commands/run`
- [x] keep old bespoke routes temporarily

### Phase 4 — agent projection

- [x] add `tui_list_commands`
- [x] add `tui_run_command`
- [~] let `Wib&Wob Agent` use those instead of bespoke per-command tools where sensible

Current spike status:

- `Wib&Wob Agent` can now discover registry-backed commands via `tui_list_commands`
- `Wib&Wob Agent` can run registry-backed commands via `tui_run_command`
- lower-level window tools remain available alongside the registry path for now
- agent guidance now explicitly prefers registry commands first for high-level app actions

### Phase 5 — cleanup

- [ ] remove duplicated action definitions
- [ ] collapse redundant menu action interfaces
- [ ] keep only truly special-case routes outside the generic command path

## Success criteria

- adding one new feature requires defining the command once
- menus and palette derive from the same command source
- control API can execute commands generically
- agent window can discover and invoke app commands generically
- the file manager becomes the reference example of this pattern

## Risks

### Risk 1: over-generic command definitions

If command definitions become too abstract, they stop being pleasant to use for
UI code.

Mitigation:

- keep command ids explicit
- keep categories human-meaningful
- do not turn everything into one giant RPC blob

### Risk 2: mixed old/new systems during migration

This is unavoidable for a while.

Mitigation:

- migrate only a small vertical slice first
- use the file manager as the reference implementation

### Risk 3: commands vs state confusion

Commands mutate behavior. State describes the desktop. They are related but not
the same.

Mitigation:

- keep `StateService` separate
- keep `CommandRegistry` separate
- let adapters consume both

## Recommendation for today

Treat this PRD as active substrate guidance, not a future-only proposal.

The basic registry direction is already proven in the spike. Remaining work is:

- continue migrating duplicated command surfaces onto the registry
- enrich command context for selection-aware/context-menu commands
- project the same registry into future MCP tools
- remove residual bespoke action definitions once replacements are stable
