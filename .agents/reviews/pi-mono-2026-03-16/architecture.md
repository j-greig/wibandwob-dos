# Pi-Mono Architecture Review & WibWob-DOS Correlation Analysis

**Date:** 2026-03-16
**Scope:** pi-mono monorepo, mitsuhiko pi-extensions, WibWob-DOS microapp system
**Reviewer:** Architecture review agent

---

## Table of Contents

1. [Pi-Mono Package Architecture](#1-pi-mono-package-architecture)
2. [Extension System Deep Dive](#2-extension-system-deep-dive)
3. [SDK Surface Analysis](#3-sdk-surface-analysis)
4. [Settings/Config Patterns](#4-settingsconfig-patterns)
5. [Mitsuhiko Extensions Analysis](#5-mitsuhiko-extensions-analysis)
6. [WibWob-DOS Microapp System](#6-wibwob-dos-microapp-system)
7. [Correlation Matrix: Extensions ↔ Microapps](#7-correlation-matrix-extensions--microapps)
8. **[Pi↔WibWob Bridge Architecture (CRITICAL)](#8-piwibwob-bridge-architecture)**
9. [Risk Assessment & Recommendations](#9-risk-assessment--recommendations)

---

## 1. Pi-Mono Package Architecture

### Package Map

```
pi-mono/
├── packages/
│   ├── ai/            ← Provider abstraction, model registry, streaming
│   ├── agent/         ← Core agent loop, tool calling, state machine
│   ├── coding-agent/  ← Full coding agent: extensions, SDK, settings, TUI mode
│   ├── tui/           ← Terminal UI component library (ink-like)
│   ├── mom/           ← Model Operations Manager (Docker deployment)
│   ├── pods/          ← (not examined)
│   └── web-ui/        ← (not examined)
```

### Dependency Graph

```
                    ┌─────────────────┐
                    │   coding-agent   │  ← TOP: orchestrator + extension host
                    └──┬───┬───┬──────┘
                       │   │   │
           ┌───────────┘   │   └──────────┐
           ▼               ▼              ▼
    ┌────────────┐  ┌────────────┐  ┌──────────┐
    │   agent    │  │    tui     │  │ typebox   │
    │ (pi-agent- │  │  (pi-tui)  │  │ (schema)  │
    │   core)    │  └──────┬─────┘  └──────────┘
    └─────┬──────┘         │
          │                │  (no dependency)
          ▼                │
    ┌────────────┐         │
    │     ai     │◄────────┘  tui has NO dep on ai
    │   (pi-ai)  │
    └────────────┘

    agent → ai (runtime dep)
    coding-agent → agent + ai + tui (composes all)
    tui → standalone (chalk, marked, mime-types only)
    ai → anthropic SDK, openai SDK, google SDK, typebox
```

**Key insight:** The layering is clean. `tui` is completely independent of `ai` and `agent`. The `coding-agent` package is the composition root that wires everything together. Extensions can import from all four packages.

### Fan-In / Fan-Out

| Package | Fan-In (depended on by) | Fan-Out (depends on) |
|---------|------------------------|---------------------|
| `ai` | agent, coding-agent, extensions | anthropic/openai/google SDKs, typebox |
| `agent` | coding-agent | ai |
| `tui` | coding-agent, extensions | chalk, marked |
| `coding-agent` | extensions (via SDK) | agent, ai, tui, jiti, typebox |

---

## 2. Extension System Deep Dive

### Architecture Overview

```
Discovery → Loading → Registration → Binding → Runtime
   │           │           │            │          │
   │    loader.ts    ExtensionAPI   runner.ts   Event dispatch
   │   (jiti JIT)   (per-extension)  bindCore()  emit*() methods
   │                                  bindUI()
   │
   ├── .pi/extensions/ (project-local)
   ├── ~/.pi/agent/extensions/ (global)
   ├── settings.json extensions[] (explicit paths)
   └── package.json pi.extensions (npm packages)
```

### File Responsibilities

| File | Lines | Role |
|------|-------|------|
| `types.ts` | ~750 | Complete type system: events, API, context, tool defs |
| `loader.ts` | ~350 | Discovery, jiti compilation, module loading, API creation |
| `runner.ts` | ~650 | Event dispatch, context creation, lifecycle management |
| `wrapper.ts` | ~30 | Thin adapter: RegisteredTool → AgentTool |
| `index.ts` | ~130 | Re-export barrel |

### Extension Lifecycle

```
1. DISCOVERY
   discoverAndLoadExtensions()
   ├── Scan .pi/extensions/ (project)
   ├── Scan ~/.pi/agent/extensions/ (global)
   ├── Resolve configured paths
   └── Deduplicate by resolved path

2. LOADING (per extension)
   loadExtension()
   ├── Resolve path (expand ~, resolve relative)
   ├── Create jiti instance (virtualModules for Bun binary)
   ├── Import module → get factory function
   ├── Create Extension object (empty maps)
   ├── Create ExtensionAPI (writes to Extension + shared runtime)
   └── Call factory(api) — extension registers handlers/tools/commands

3. REGISTRATION (during factory call)
   ExtensionAPI methods:
   ├── pi.on("event_name", handler) → extension.handlers map
   ├── pi.registerTool(def) → extension.tools map
   ├── pi.registerCommand(name, opts) → extension.commands map
   ├── pi.registerShortcut(key, opts) → extension.shortcuts map
   ├── pi.registerFlag(name, opts) → extension.flags map
   ├── pi.registerMessageRenderer(type, fn) → extension.messageRenderers map
   └── pi.registerProvider(name, config) → runtime.pendingProviderRegistrations

4. BINDING (after all extensions loaded)
   runner.bindCore(actions, contextActions)
   ├── Replace throwing stubs with real implementations
   ├── Flush pending provider registrations
   └── Switch to direct ModelRegistry calls

5. RUNTIME
   runner.emit(event) / runner.emitToolCall(event) / etc.
   ├── Create ExtensionContext on each call
   ├── Iterate extensions in load order
   ├── Call matching handlers with (event, ctx)
   └── Collect/merge results (chaining for transforms)
```

### Event System

**30+ event types** organized into categories:

| Category | Events | Can Modify? |
|----------|--------|-------------|
| Resources | `resources_discover` | Return paths |
| Session | `session_start`, `session_before_switch`, `session_switch`, `session_before_fork`, `session_fork`, `session_before_compact`, `session_compact`, `session_shutdown`, `session_before_tree`, `session_tree` | `before_*` can cancel |
| Agent | `context`, `before_provider_request`, `before_agent_start`, `agent_start`, `agent_end` | context/provider can transform |
| Turn | `turn_start`, `turn_end` | Read-only |
| Message | `message_start`, `message_update`, `message_end` | Read-only |
| Tool | `tool_call`, `tool_result`, `tool_execution_start/update/end` | call can block, result can modify |
| Model | `model_select` | Read-only |
| Input | `input` | Transform or handle |
| Bash | `user_bash` | Replace execution |

### Hot-Reload

**Partial.** The `/reload` command (via `ExtensionCommandContext.reload()`) triggers a full resource reload including extensions. But there is no file-watcher or granular reload — it's a full teardown-and-rebuild of all extensions. The `jiti` loader uses `moduleCache: false` to ensure fresh code.

### Sandboxing

**None.** Extensions run in the same process, same V8 isolate. They have full access to:
- Node.js APIs (fs, net, child_process)
- The extension context (session manager, model registry)
- The TUI (via `ctx.ui.custom()`)
- The event bus (cross-extension communication)
- `pi.exec()` for shell commands

This is a trust-based model, identical to VS Code extensions.

---

## 3. SDK Surface Analysis

### Pi SDK (`@mariozechner/pi-coding-agent`)

The SDK export surface (`sdk.ts` → `createAgentSession()`) provides:

```typescript
// Main entry point
createAgentSession(options?: CreateAgentSessionOptions): Promise<CreateAgentSessionResult>

// Options include:
- cwd, agentDir                    // Paths
- authStorage, modelRegistry       // Auth/model resolution
- model, thinkingLevel, scopedModels // Model config
- tools, customTools               // Tool selection
- resourceLoader                   // Skill/prompt/theme loading
- sessionManager, settingsManager  // State management

// Pre-built tools
readTool, bashTool, editTool, writeTool, grepTool, findTool, lsTool
codingTools, readOnlyTools, allBuiltInTools

// Tool factories (custom cwd)
createReadTool(cwd), createBashTool(cwd), ...
```

### Extension API Surface

The `ExtensionAPI` is the primary SDK for extension authors. Surface area:

| Category | Methods | Count |
|----------|---------|-------|
| Event subscription | `on(event, handler)` | 30 overloads |
| Tool registration | `registerTool(def)` | 1 |
| Commands | `registerCommand`, `registerShortcut`, `registerFlag`, `getFlag` | 4 |
| Rendering | `registerMessageRenderer` | 1 |
| Messages | `sendMessage`, `sendUserMessage`, `appendEntry` | 3 |
| Session | `setSessionName`, `getSessionName`, `setLabel` | 3 |
| Tools | `getActiveTools`, `getAllTools`, `setActiveTools`, `getCommands` | 4 |
| Model | `setModel`, `getThinkingLevel`, `setThinkingLevel` | 3 |
| Provider | `registerProvider`, `unregisterProvider` | 2 |
| Shell | `exec` | 1 |
| Events | `events` (EventBus) | 1 |
| **Total** | | **~53 methods** |

### Extension UI Context Surface

| Category | Methods |
|----------|---------|
| Dialogs | `select`, `confirm`, `input`, `editor` |
| Notifications | `notify`, `setStatus`, `setWorkingMessage` |
| Widgets | `setWidget`, `setFooter`, `setHeader` |
| Editor | `pasteToEditor`, `setEditorText`, `getEditorText`, `setEditorComponent` |
| Custom UI | `custom` (full takeover with component factory) |
| Theme | `theme`, `getAllThemes`, `getTheme`, `setTheme` |
| Terminal | `onTerminalInput`, `setTitle` |
| State | `getToolsExpanded`, `setToolsExpanded` |

### WibWob SDK Surface (for comparison)

The `MicroappHost` provides:

| Category | Methods |
|----------|---------|
| Window | `createWindow(init)` → `MicroappWindowHandle` |
| Commands | `registerCommand(def)`, `runCommand(id)`, `runGlobalCommand(id)` |
| Snapshot | `registerSnapshot(handlers)` |
| Theme | `registerTheme(variant)`, `theme` (direct access) |
| Overlays | `pickFile`, `flash`, `promptValue` |
| System | `screen`, `geometry`, `windows`, `worldChat`, `repoRoot` |
| UI Parts | `ui.createStack`, `ui.createRow`, `ui.createHeaderBar`, etc. |

Plus the massive `microapp-sdk.ts` barrel (~350 exports) covering:
- Layout primitives (stack, row, grid, scroll, tabs)
- Form controls (button, checkbox, radio, select, text area)
- Feedback (progress bar, spinner, toast)
- Data display (key-value panel, log view, data table)
- Animation, terrain, contour, webcam, skeleton
- ASCII composition, markdown/figlet rendering
- Motion/tween, syntax highlighting

---

## 4. Settings/Config Patterns

### Pi Settings

```
┌─────────────────┐     ┌──────────────────┐
│  Global settings │     │ Project settings  │
│ ~/.pi/agent/     │ ──► │ .pi/settings.json │
│  settings.json   │     │ (per-project)     │
└─────────────────┘     └──────────────────┘
         │                        │
         └──────── merge ─────────┘
                     │
              ┌──────▼──────┐
              │   Effective  │
              │   Settings   │
              └──────────────┘
```

**Merge strategy:** Deep merge. Project overrides global. Nested objects merge recursively. Arrays/primitives: project wins.

**Persistence:** File-lock based (`proper-lockfile`). Write queue with async flush. Modified field tracking (only writes changed fields on save).

**Schema:** TypeScript interface `Settings` with ~40 fields. No JSON Schema validation — just TypeScript types. Migration support for legacy formats.

**Scope awareness:** Every getter/setter pair knows whether it's global or project. `markModified(field)` / `markProjectModified(field)` tracking.

### WibWob Settings

WibWob has no centralized settings manager. Configuration is scattered:
- Workspace save/restore (JSON files in `scratch/`)
- Microapp registry (hardcoded tier assignments)
- Theme resolver (file-based)
- Environment variables (`WW_MODE`, etc.)
- `.wibwob` shell config

**Gap:** WibWob lacks pi's layered settings model. This would be needed for bridge config.

---

## 5. Mitsuhiko Extensions Analysis

### Extension Complexity Spectrum

| Extension | Lines | Complexity | Key Patterns Used |
|-----------|-------|------------|-------------------|
| `control.ts` | 1748 | **Extreme** | Unix sockets, JSON-RPC server, inter-session messaging, CLI flags, tools, custom message rendering, subscriptions |
| `todos.ts` | 2076 | **Very High** | File-based storage, TUI (custom component via `ctx.ui.custom`), tool registration, file locking, GC |
| `review.ts` | 1971 | **Very High** | Git operations, PR checkout, session forking, loop automation, widget display |
| `session-breakdown.ts` | 1629 | **High** | JSONL parsing, TUI calendar visualization, statistical aggregation |
| `prompt-editor.ts` | 1315 | **High** | Full editor component, file browser, multi-buffer |
| `files.ts` | 1114 | **High** | File management tool, directory navigation |
| `multi-edit.ts` | 772 | **Medium** | Custom tool, batch editing |
| `context.ts` | 578 | **Medium** | Context manipulation |
| `answer.ts` | 532 | **Medium** | Custom answer handling |
| `whimsical.ts` | 474 | **Low** | Decorative/fun |
| `loop.ts` | 446 | **Low** | Automated looping |
| `go-to-bed.ts` | 188 | **Low** | Timer/notification |
| `uv.ts` | 123 | **Low** | Python env setup |
| `notify.ts` | 88 | **Minimal** | OS notifications |

### control.ts — Architecture Exemplar

This is the most architecturally significant extension. It demonstrates:

1. **Inter-process communication:** Creates Unix domain sockets at `~/.pi/session-control/<session-id>.sock`
2. **JSON-RPC protocol:** Newline-delimited JSON commands (send, get_message, get_summary, clear, abort, subscribe)
3. **Session discovery:** Can list live sessions, resolve aliases, check socket liveness
4. **Tool registration:** `send_to_session` tool lets the AI communicate with other pi sessions
5. **CLI flag orchestration:** 6 custom flags for startup-time cross-session messaging
6. **Custom message rendering:** Renders received session messages with special UI
7. **Subscription system:** Turn-end event subscriptions for async coordination

**This is effectively a microkernel IPC system built as an extension.** It's the closest analog to WibWob's control API.

### todos.ts — Full Application as Extension

Demonstrates the extension system can host a complete application:
- File-based storage with JSON frontmatter
- TUI with fuzzy search, selection, editing
- Tool for LLM interaction
- Session-scoped locking
- Garbage collection

---

## 6. WibWob-DOS Microapp System

### Architecture

```
Discovery → Manifest Parse → Registry Gate → Module Import → Host Creation → Setup
   │             │                │                │              │            │
   scan dirs   microapp.json   tier check    dynamic import   createHost   setup(host)
   (2 roots)   parse+validate  enabled?     cache-bust       wire deps    register cmds
```

### Key Differences from Pi Extensions

| Aspect | Pi Extensions | WibWob Microapps |
|--------|--------------|------------------|
| **Discovery** | `.pi/extensions/`, `~/.pi/agent/extensions/`, settings paths | `microapps/`, `microapps-private/` dirs |
| **Manifest** | None (just a .ts/.js file) or package.json `pi.extensions` | Required `microapp.json` with typed fields |
| **Entry** | Default export = factory function | Default export = setup function |
| **Factory arg** | `ExtensionAPI` (event-driven) | `MicroappHost` (imperative) |
| **UI model** | Component factories via `ctx.ui.custom()` (overlay) | `host.createWindow()` → blessed box in WM |
| **Registration** | `pi.on()`, `pi.registerTool()`, `pi.registerCommand()` | `host.registerCommand()`, `host.registerSnapshot()` |
| **Tier/visibility** | All extensions equal (first-wins for conflicts) | 4-tier: core/beta/internal/disabled |
| **Multi-instance** | N/A (extensions are singletons) | Per-command `multiInstance` flag |
| **Persistence** | Session entries (`pi.appendEntry()`) | Workspace snapshot/restore |
| **Hot-reload** | `/reload` (full) | `scripts/reload-microapp.sh` (per-microapp) |
| **Sandboxing** | None | None |
| **IPC** | EventBus + control.ts sockets | HTTP control API (port 8099) |

---

## 7. Correlation Matrix: Extensions ↔ Microapps

### Concept Mapping

| Pi Extension Concept | WibWob Microapp Concept | Compatibility |
|---------------------|------------------------|---------------|
| `ExtensionFactory` | `setup(host: MicroappHost)` | ⚡ Same pattern |
| `ExtensionAPI` | `MicroappHost` | 🔶 Different surface |
| `pi.on("event", handler)` | No equivalent | ❌ Missing in WibWob |
| `pi.registerTool(def)` | No equivalent | ❌ WibWob has no LLM tools |
| `pi.registerCommand(name, opts)` | `host.registerCommand(def)` | ✅ Nearly identical |
| `ctx.ui.custom(factory)` | `host.createWindow(init)` | 🔶 Overlay vs. window |
| `ctx.ui.select/confirm/input` | `host.pickFile/flash/promptValue` | 🔶 Similar dialogs |
| `pi.registerShortcut` | No equivalent | ❌ WibWob uses blessed key handlers |
| `pi.registerProvider` | `host.registerTheme` | 🔶 Different domain |
| `pi.sendMessage` | `host.runCommand/runGlobalCommand` | 🔶 Message vs. command |
| `pi.appendEntry` | `host.registerSnapshot` | 🔶 Session vs. workspace |
| `pi.exec()` | No equivalent (use Bun APIs directly) | ❌ |
| `pi.events` (EventBus) | No equivalent | ❌ |
| `pi.registerMessageRenderer` | blessed widget rendering | 🔶 Different paradigm |

### Surface Area Comparison

```
Pi Extension API:       ████████████████████████████████████ (53 methods)
WibWob MicroappHost:    ████████████████████ (20 methods)
                        ↑                                  ↑
                   Focused on                         Focused on
                   agent events,                      window creation,
                   LLM interaction,                   blessed rendering,
                   session control                    command dispatch
```

---

## 8. Pi↔WibWob Bridge Architecture

### The Question

> Could pi extensions be hot-loaded into WibWob microapp containers?

### Current State: "Open Bigger"

Pi extensions already have `ctx.ui.custom()` which takes over the full terminal with a custom TUI component. This is the "open bigger" pattern — an extension renders a full-screen overlay. Example: `todos.ts` renders a full todo manager, `session-breakdown.ts` renders a calendar visualization.

### What "Open INTO a WibWob Window" Means

Instead of a full-screen overlay in the pi terminal, a pi extension's UI would render inside a WibWob-DOS window — with chrome, window management, overlapping, resizing, and persistence.

### Architecture Options

#### Option A: Process Bridge (RPC)

```
┌─────────────────────────┐     ┌──────────────────────────────┐
│ Pi Process               │     │ WibWob-DOS Process            │
│                          │     │                               │
│  Extension               │     │  Bridge Microapp              │
│  ├── ctx.ui.custom()     │◄───►│  ├── host.createWindow()     │
│  │   returns Component   │ RPC │  │   blessed body             │
│  │                       │     │  │                            │
│  └── render() → text     │────►│  └── body.setContent(text)   │
│      handleInput(key)  ◄─│────│      body.on('keypress')     │
└─────────────────────────┘     └──────────────────────────────┘
       via Unix socket / HTTP / stdio pipe
```

**Protocol needed:**
- `render` → Send rendered text lines to WibWob window
- `resize` → WibWob notifies pi of window dimension changes  
- `keypress` → Forward blessed keypresses to pi extension
- `focus` / `blur` → Focus state synchronization
- `close` → Bidirectional window close

**Pros:** Clean process isolation, extensions don't need modification
**Cons:** Latency for interactive UI, complexity, two-process coordination

#### Option B: Shared Runtime (Bun)

Both pi and WibWob run on Bun/Node. Load pi extensions directly into WibWob's process:

```
┌─────────────────────────────────────────────────┐
│ WibWob-DOS Process (Bun)                         │
│                                                  │
│  ┌─────────────────┐    ┌─────────────────────┐ │
│  │ Pi Extension     │    │ Bridge Adapter       │ │
│  │ (loaded via jiti)│    │                      │ │
│  │                  │    │ ExtensionUIContext    │ │
│  │ factory(api)     │───►│ → MicroappHost       │ │
│  │                  │    │                      │ │
│  │ ctx.ui.custom()  │───►│ custom() → window    │ │
│  │ ctx.ui.notify()  │───►│ notify() → flash()   │ │
│  │ ctx.ui.select()  │───►│ select() → overlay   │ │
│  └─────────────────┘    └─────────────────────┘ │
│                                                  │
│  ┌─────────────────┐                             │
│  │ pi-tui Component │◄── Rendered into blessed   │
│  │ (Box, Text, etc) │    window body via adapter │
│  └─────────────────┘                             │
└─────────────────────────────────────────────────┘
```

**This is the more viable path.** Here's why:

1. **Pi's jiti loader already works in any Node/Bun process.** The `loadExtensionModule()` function uses jiti with virtualModules — it could load extensions into WibWob's Bun runtime.

2. **Pi's TUI components are standalone.** The `@mariozechner/pi-tui` package has zero dependency on `@mariozechner/pi-ai` or `@mariozechner/pi-agent-core`. Components (Box, Text, Markdown, SelectList, etc.) render to a `Terminal` abstraction.

3. **The rendering bridge is the hard part.** Pi-tui components render via a `TUI` class that owns a terminal. WibWob windows render via blessed boxes. The bridge needs to:
   - Create a virtual `Terminal` that writes to a blessed box
   - Map pi-tui's layout system to blessed's coordinate system
   - Forward blessed keypresses through pi-tui's key parsing

### Minimal Viable Integration

**Phase 1: Extension-as-Microapp Adapter (UI-less)**

```typescript
// wibwob-pi-bridge microapp
import { loadExtensions, createExtensionRuntime } from "@mariozechner/pi-coding-agent";

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "load-pi-ext",
    label: "Load Pi Extension",
    action: async () => {
      const result = await loadExtensions(
        ["/path/to/extension.ts"],
        process.cwd()
      );
      // Wire extension commands → WibWob commands
      for (const ext of result.extensions) {
        for (const [name, cmd] of ext.commands) {
          host.registerCommand({
            id: `pi.${name}`,
            label: cmd.description ?? name,
            action: () => cmd.handler("", mockCommandContext),
          });
        }
      }
    },
  });
}
```

This gets pi extension **commands** running in WibWob, without UI.

**Phase 2: Tool Bridge**

Wire pi extension tools to the WibWob agent:

```typescript
// For each registered pi tool, create a WibWob agent tool adapter
for (const [name, tool] of ext.tools) {
  // Register with WibWob's agent window as available tools
  agentBridge.registerTool({
    name: tool.definition.name,
    description: tool.definition.description,
    parameters: tool.definition.parameters,
    execute: (params) => tool.definition.execute(
      crypto.randomUUID(), params, undefined, undefined, bridgeContext
    ),
  });
}
```

**Phase 3: UI Bridge (Hard)**

Create a `BlessedTerminal` adapter that implements pi-tui's `Terminal` interface but renders into a blessed box:

```typescript
class BlessedTerminalAdapter implements Terminal {
  constructor(private body: blessed.Widgets.BoxElement) {}
  
  get columns() { return (this.body.width as number) - 2; }
  get rows() { return (this.body.height as number) - 2; }
  
  write(data: string) {
    // Parse ANSI sequences, map to blessed content
    this.body.setContent(data);
    this.body.screen.render();
  }
  
  onResize(handler: () => void) {
    this.body.on('resize', handler);
  }
  
  onData(handler: (data: string) => void) {
    this.body.on('keypress', (ch, key) => {
      handler(encodeKey(key)); // Map blessed key → pi-tui key format
    });
  }
}
```

### Blockers

| Blocker | Severity | Detail |
|---------|----------|--------|
| **Terminal abstraction mismatch** | 🔴 High | Pi-tui uses a raw terminal stream (ANSI escape codes). Blessed uses a widget tree with its own rendering. Bridging these requires either (a) a virtual terminal emulator in blessed, or (b) rewriting pi-tui components as blessed widgets. |
| **Focus model conflict** | 🟡 Medium | Pi-tui assumes it owns the terminal focus. WibWob has window-level focus. A pi extension running in a WibWob window needs focus routing. |
| **Event system gap** | 🟡 Medium | WibWob has no event bus equivalent to pi's 30+ lifecycle events. Extensions that depend on `session_start`, `agent_end`, `tool_result` etc. won't fire unless WibWob provides these events. |
| **No agent core in WibWob** | 🔴 High | Pi extensions that register tools or intercept LLM events have no analog in WibWob unless WibWob embeds `@mariozechner/pi-agent-core`. WibWob has its own agent (wibwob-agent), which is a different system. |
| **Session manager dependency** | 🟡 Medium | Pi's `ExtensionContext` requires a `SessionManager`. WibWob would need a stub or adapter. |
| **Dependency bundling** | 🟢 Low | Pi's jiti loader with `virtualModules` can supply `@mariozechner/pi-tui`, `@sinclair/typebox`, etc. even without npm install. Just need the bundles available. |

### What Would Work TODAY (No Blockers)

1. **Pi extensions that only register commands** → Can run in WibWob as microapp commands
2. **Pi extensions that only use `pi.exec()`** → Shell commands work anywhere  
3. **Pi extensions that register tools** → Could feed into WibWob's agent window if a tool adapter exists
4. **Pi extensions that use `pi.on("input", ...)` for text transforms** → Could intercept WibWob agent input

### What Would NOT Work Without Major Bridge Work

1. **`ctx.ui.custom()` components** → Pi-tui rendering into blessed windows
2. **Session lifecycle events** → No `session_before_compact`, `turn_end`, etc.
3. **`pi.sendMessage()` / `pi.sendUserMessage()`** → No pi agent loop in WibWob
4. **Provider registration** → WibWob uses its own LLM setup

### Recommended Integration Path

```
Phase 0: Shared types package
  └── Extract common interfaces: ToolDefinition, CommandDefinition

Phase 1: Command bridge (weeks)
  └── Load pi extensions, wire commands to WibWob command registry

Phase 2: Tool bridge (weeks)  
  └── Pi tools available to WibWob's agent

Phase 3: control.ts as the protocol (months)
  └── control.ts already implements IPC. Have WibWob be a 
      "session control" client that sends messages to pi sessions.
      This gives WibWob access to any running pi session.

Phase 4: UI bridge (months)
  └── Virtual terminal adapter for pi-tui → blessed rendering
      OR: New rendering backend for pi-tui that targets blessed directly
```

### The control.ts Shortcut

**Mitsuhiko's `control.ts` is already a bridge protocol.** It exposes:
- Send messages to any pi session
- Get last assistant message
- Get AI-generated summaries
- Clear/rewind sessions
- Subscribe to turn_end events

WibWob could create a microapp that:
1. Lists live pi sessions (via socket discovery in `~/.pi/session-control/`)
2. Sends messages to them (via JSON-RPC over Unix socket)
3. Receives turn_end events
4. Displays pi session output in WibWob windows

This requires **zero changes to pi** and **zero UI bridging**. It's pure IPC.

```typescript
// WibWob microapp: pi-session-viewer
export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: "Pi Session Viewer",
    action: async () => {
      const handle = host.createWindow({ title: "Pi Sessions" });
      const sessions = await discoverPiSessions(); // scan ~/.pi/session-control/
      // Show list, connect via Unix socket, display messages
    },
  });
}
```

---

## 9. Risk Assessment & Recommendations

### Breaking Change Risks in Pi

| Area | Risk | Detail |
|------|------|--------|
| ExtensionAPI additions | 🟢 Low | New methods are additive, TypeScript catches usage |
| Event type changes | 🟡 Medium | Adding fields is safe; removing/renaming breaks handlers |
| TUI component API | 🟡 Medium | Extensions create TUI components; interface changes break them |
| Settings schema | 🟢 Low | Migration path exists, deep merge is resilient |
| Tool definition schema | 🔴 High | TypeBox schemas in tools are contract with LLM; changes break tool calls |

### Architecture Quality Assessment

| Aspect | Pi | WibWob | Notes |
|--------|-----|--------|-------|
| Layering | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Pi's package boundaries are excellent. WibWob's COAT principle enforces clean separation but sdk.ts is a large barrel. |
| Extension ergonomics | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Pi's event-driven API is very expressive. WibWob's host is simpler but less powerful. |
| Type safety | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Pi uses TypeBox for tool schemas, full TS for events. WibWob uses TS but less schema validation. |
| Settings | ⭐⭐⭐⭐ | ⭐⭐ | Pi has a proper layered settings system. WibWob has scattered config. |
| Hot-reload | ⭐⭐⭐ | ⭐⭐⭐⭐ | Pi reloads everything. WibWob can reload individual microapps. |
| Discoverability | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | WibWob's manifest + tier system is more discoverable than pi's convention-based approach. |

### Top Recommendations

1. **Start with the control.ts shortcut.** Build a WibWob microapp that connects to live pi sessions via the existing Unix socket protocol. This gives immediate value with zero architectural risk.

2. **Extract a shared `ToolDefinition` type.** Both systems could benefit from a common tool schema that the LLM understands. This enables tool portability between pi extensions and WibWob's agent.

3. **Don't attempt the UI bridge yet.** The terminal abstraction mismatch (pi-tui's ANSI stream vs. blessed's widget tree) is a deep impedance mismatch. Wait for pi-tui to mature or for a shared rendering abstraction to emerge.

4. **Use pi's settings pattern in WibWob.** The layered global/project settings with file-lock persistence is a solved problem in pi. WibWob would benefit from adopting this pattern.

5. **Consider a shared event vocabulary.** If both systems emit events with the same names and shapes, cross-system tooling becomes trivial. Start with: `session_start`, `session_end`, `command_executed`, `tool_called`.

---

*End of review. Total source analyzed: ~25,000 lines across pi-mono, ~13,000 lines of mitsuhiko extensions, ~3,000 lines of WibWob microapp infrastructure.*
