# Pi Monorepo Deep Review — WibWob-DOS Integration Lens

## TL;DR

- **Pi's extension system and WibWob's microapp system are structurally isomorphic** — same factory pattern, same command registration, same trust model — but pi has 30+ lifecycle events and LLM tool registration where WibWob has window management and a 350-export SDK. They're complementary halves.
- **Mitsuhiko's `control.ts` extension is already a working bridge protocol** — Unix socket JSON-RPC with session discovery, message relay, and event subscriptions. A WibWob microapp can connect to live pi sessions *today* with zero changes to pi.
- **Pi's codebase is exceptionally well-typed** (discriminated unions everywhere, zero enums, `import type` discipline) with two fixable structural issues: a theme dependency inversion and a `ThinkingLevel` type fork. WibWob should adopt the type patterns and avoid the god-file tendency.

## Executive Summary

This review analyzed ~110,000 lines across pi-mono's 7 packages, 14 mitsuhiko extensions, and WibWob-DOS's microapp infrastructure through three lenses: TypeScript coding style forensics, architecture & extension model design, and COAT/DRY/monorepo hygiene. The core finding is that pi and WibWob-DOS occupy adjacent but non-overlapping niches — pi is a headless agent runtime with a TUI shell, WibWob-DOS is a visual desktop shell with an embedded agent — and the most promising integration path is **not** embedding one inside the other, but connecting them via pi's existing `control.ts` socket protocol. The immediate opportunity is a WibWob microapp that discovers, connects to, and displays live pi sessions in WibWob windows. Longer-term, pi extension commands and tools can be wired into WibWob's command registry and agent window respectively, creating a unified surface where WibWob provides the spatial canvas and pi provides the agent intelligence.

## WibWob ↔ Pi Correlation Map

| Concept | Pi (`coding-agent`) | WibWob-DOS | Compatibility |
|---------|---------------------|------------|:---:|
| **App entry** | `interactive-mode.ts` (4,442 LOC) | `app-controller.ts` (composition root) | 🔶 Same role |
| **Extension factory** | `export default function(pi: ExtensionAPI)` | `export default function setup(host: MicroappHost)` | ✅ Identical pattern |
| **Command registration** | `pi.registerCommand(name, opts)` | `host.registerCommand(def)` | ✅ Near-identical |
| **Tool registration** | `pi.registerTool(def)` — LLM-callable | No equivalent | ❌ Gap |
| **Event system** | `pi.on("event", handler)` — 30+ events | No event bus | ❌ Gap |
| **UI rendering** | `ctx.ui.custom(factory)` → pi-tui Component | `host.createWindow(init)` → blessed box | 🔶 Overlay vs. window |
| **Dialogs** | `ctx.ui.select/confirm/input/editor` | `host.pickFile/flash/promptValue` | 🔶 Equivalent |
| **Settings** | `SettingsManager` (layered global/project, file-lock) | Scattered (env vars, JSON, `.wibwob`) | ❌ WibWob gap |
| **Persistence** | `pi.appendEntry()` (session JSONL) | `host.registerSnapshot()` (workspace JSON) | 🔶 Different model |
| **IPC** | Unix sockets (`~/.pi/session-control/*.sock`) | HTTP (`localhost:8099`) | 🔶 Both exist |
| **Hot-reload** | `/reload` (full teardown) | `reload-microapp.sh` (per-microapp) | ✅ WibWob better |
| **Sandboxing** | None (trust-based, like VS Code) | None (trust-based) | ✅ Same model |
| **Type system** | TypeBox schemas for tool params | TypeScript interfaces | 🔶 Pi more formal |
| **Component model** | `render(width) → string[]` (4-member interface) | blessed widget tree (50+ properties) | 🔶 Pi simpler |
| **Theme** | `Theme` type in core (misplaced in `modes/interactive/`) | `ThemeTokens` in `core/theme/` | ✅ WibWob cleaner |
| **SDK surface** | ~53 methods on `ExtensionAPI` | ~20 methods on `MicroappHost` + 350-export barrel | 🔶 Different shape |

---

## 🔥 Enhancing the Connection: Pi Extensions Inside WibWob Windows

### The Vision

WibWob-DOS becomes a **spatial canvas for pi sessions**. Instead of pi extensions rendering full-screen overlays via `ctx.ui.custom()`, they render inside WibWob windows — with chrome, overlapping, resizing, drag, and persistence. A developer has three pi sessions running (one reviewing a PR, one writing tests, one refactoring). Each appears as a WibWob window. WibWob's agent can see all three. Pi's tools are available to WibWob's agent. The command palettes merge.

### What Works TODAY With Zero Changes

Mitsuhiko's [`control.ts`](https://github.com/mitsuhiko/agent-stuff/blob/main/pi-extensions/control.ts) already implements the bridge protocol. When pi starts with `--session-control`, it creates a Unix socket at `~/.pi/session-control/<session-id>.sock` accepting newline-delimited JSON-RPC:

```
→ { "type": "send", "message": "refactor auth module", "mode": "steer" }
← { "type": "response", "command": "send", "success": true }

→ { "type": "get_message" }
← { "type": "response", "command": "get_message", "success": true, "data": { "message": "I'll start by..." } }

→ { "type": "get_summary" }
← { "type": "response", "command": "get_summary", "success": true, "data": { "summary": "Refactored auth...", "model": "claude-sonnet-4-20250514" } }

→ { "type": "subscribe", "event": "turn_end" }
← { "type": "response", "command": "subscribe", "success": true, "data": { "subscriptionId": "abc123" } }
← { "type": "event", "event": "turn_end", "data": { ... } }  // async, on each turn

→ { "type": "clear", "summarize": true }
→ { "type": "abort" }
```

Session discovery is filesystem-based — scan `~/.pi/session-control/` for `.sock` files and `.alias` symlinks. WibWob can enumerate all live pi sessions without any coordination.

**A WibWob microapp can connect to this today:**

```typescript
// microapps/pi-sessions/index.ts
import type { MicroappHost } from "../../src/services/microapp-sdk.js";
import * as net from "node:net";
import * as fs from "node:fs";
import * as path from "node:path";

const CONTROL_DIR = path.join(require("os").homedir(), ".pi", "session-control");
const SOCK_EXT = ".sock";

interface PiSession { id: string; socketPath: string; alias?: string; }

async function discoverSessions(): Promise<PiSession[]> {
  const entries = await fs.promises.readdir(CONTROL_DIR, { withFileTypes: true });
  const sessions: PiSession[] = [];
  const aliases = new Map<string, string>();

  // First pass: collect aliases
  for (const e of entries) {
    if (e.name.endsWith(".alias")) {
      const target = await fs.promises.readlink(path.join(CONTROL_DIR, e.name));
      const id = path.basename(target, SOCK_EXT);
      aliases.set(id, e.name.replace(".alias", ""));
    }
  }

  // Second pass: collect live sockets
  for (const e of entries) {
    if (e.name.endsWith(SOCK_EXT) && e.isSocket?.() !== false) {
      const id = e.name.slice(0, -SOCK_EXT.length);
      sessions.push({
        id,
        socketPath: path.join(CONTROL_DIR, e.name),
        alias: aliases.get(id),
      });
    }
  }
  return sessions;
}

function connectSession(socketPath: string): {
  send: (cmd: object) => Promise<object>;
  subscribe: (event: string, cb: (data: unknown) => void) => void;
  close: () => void;
} {
  const socket = net.createConnection(socketPath);
  const pending = new Map<string, (resp: any) => void>();
  const subscribers = new Map<string, ((data: unknown) => void)[]>();
  let buffer = "";

  socket.on("data", (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split("\n");
    buffer = lines.pop()!;
    for (const line of lines) {
      if (!line.trim()) continue;
      const msg = JSON.parse(line);
      if (msg.type === "event") {
        const cbs = subscribers.get(msg.event) ?? [];
        for (const cb of cbs) cb(msg.data);
      } else if (msg.type === "response") {
        const resolve = pending.get(msg.command);
        if (resolve) { pending.delete(msg.command); resolve(msg); }
      }
    }
  });

  return {
    send: (cmd: object) => new Promise((resolve) => {
      const type = (cmd as any).type;
      pending.set(type, resolve);
      socket.write(JSON.stringify(cmd) + "\n");
    }),
    subscribe: (event, cb) => {
      const list = subscribers.get(event) ?? [];
      list.push(cb);
      subscribers.set(event, list);
      socket.write(JSON.stringify({ type: "subscribe", event }) + "\n");
    },
    close: () => socket.destroy(),
  };
}

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: "Pi Sessions",
    description: "View and interact with live pi coding sessions",
    action: async () => {
      const handle = host.createWindow({
        title: "Pi Sessions", width: 80, height: 40,
      });
      const sessions = await discoverSessions();
      // Render session list, connect on select, show live output
      // ... (blessed list → socket connection → streaming display)
    },
    menu: [{ category: "Tools", order: 50 }],
  });
}
```

### Phase 1: Command Bridge (pi extension commands → WibWob commands)

Pi extensions register commands via `pi.registerCommand(name, opts)`. These commands have a name, description, and handler. WibWob has `host.registerCommand(def)` with the same shape.

**Bridge:** Load pi extensions via [`jiti`](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/src/core/extensions/loader.ts) (pi's existing JIT TypeScript loader) into WibWob's Bun process. Intercept `pi.registerCommand()` calls and forward them to `host.registerCommand()`:

```typescript
// Phase 1: Command bridge adapter
import { createJiti } from "jiti";

function createPiCommandBridge(host: MicroappHost, extensionPath: string) {
  const jiti = createJiti(import.meta.url, { moduleCache: false });

  // Create a mock ExtensionAPI that captures registrations
  const registeredCommands: Array<{ name: string; handler: Function }> = [];

  const mockApi: Partial<ExtensionAPI> = {
    registerCommand(name: string, opts: { description?: string; handler: Function }) {
      registeredCommands.push({ name, handler: opts.handler });
      // Forward to WibWob command registry
      host.registerCommand({
        id: `pi.${name}`,
        label: opts.description ?? name,
        action: () => opts.handler("", mockContext),
        menu: [{ category: "Pi Extensions", order: 100 }],
      });
    },
    // Stub other API methods...
    on: () => () => {},
    registerTool: () => {},
    exec: (cmd: string) => Bun.spawn(["sh", "-c", cmd]),
  };

  // Load extension
  const factory = jiti(extensionPath).default;
  factory(mockApi);
}
```

This gets extensions like [`go-to-bed.ts`](https://github.com/mitsuhiko/agent-stuff/blob/main/pi-extensions/go-to-bed.ts) (188 LOC, timer + notification), [`notify.ts`](https://github.com/mitsuhiko/agent-stuff/blob/main/pi-extensions/notify.ts) (88 LOC, OS notifications), and [`uv.ts`](https://github.com/mitsuhiko/agent-stuff/blob/main/pi-extensions/uv.ts) (123 LOC, Python env setup) running in WibWob immediately — any extension that only uses commands and `pi.exec()`.

### Phase 2: Tool Bridge (pi tools available to WibWob's agent)

Pi extensions register LLM-callable tools via `pi.registerTool(def)` with TypeBox parameter schemas. WibWob's agent window could consume these:

```typescript
// Phase 2: Tool bridge — pi extension tools → WibWob agent tools
for (const [name, tool] of capturedTools) {
  // Convert pi tool definition to WibWob agent tool format
  const wibwobTool = {
    name: `pi_${tool.definition.name}`,
    description: tool.definition.description,
    parameters: tool.definition.parameters, // TypeBox schema → JSON Schema
    execute: async (params: unknown) => {
      const result = await tool.definition.execute(
        crypto.randomUUID(),  // toolCallId
        params,               // args
        undefined,            // abortSignal
        undefined,            // streamUpdate
        bridgeContext,        // ExtensionContext (stubbed)
      );
      return typeof result === "string" ? result : JSON.stringify(result);
    },
  };
  // Register with WibWob's agent window
  agentToolRegistry.add(wibwobTool);
}
```

This enables extensions like [`files.ts`](https://github.com/mitsuhiko/agent-stuff/blob/main/pi-extensions/files.ts) (file management tool), [`multi-edit.ts`](https://github.com/mitsuhiko/agent-stuff/blob/main/pi-extensions/multi-edit.ts) (batch editing tool), and the `send_to_session` tool from `control.ts` to be available to WibWob's embedded agent.

### Phase 3: `control.ts` as the Protocol (WibWob as session control client)

Instead of loading extensions locally, WibWob connects to a **running pi instance** via the control socket and acts as a remote control surface:

```
┌──────────────────────────────────────────────────────┐
│  WibWob-DOS (blessed TUI, port 8099)                  │
│                                                       │
│  ┌─────────────────┐  ┌────────────────────────────┐ │
│  │ Pi Session #1    │  │ Pi Session #2               │ │
│  │ "refactor-auth" │  │ "write-tests"              │ │
│  │                  │  │                             │ │
│  │  > Refactoring   │  │  > Running test suite...    │ │
│  │    auth module   │  │    14/27 passing            │ │
│  │    ...           │  │    ...                      │ │
│  │                  │  │                             │ │
│  │ [Send message]   │  │ [Send message]              │ │
│  │ [Get summary]    │  │ [Get summary]               │ │
│  │ [Abort]          │  │ [Abort]                     │ │
│  └─────────────────┘  └────────────────────────────┘ │
│                                                       │
│  ┌─────────────────────────────────────────────────┐ │
│  │ WibWob Agent Window                              │ │
│  │ "Ask both sessions to coordinate on the API"     │ │
│  │ → uses send_to_session tool on #1 and #2         │ │
│  └─────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
        │                           │
        │ Unix socket               │ Unix socket
        ▼                           ▼
  ~/.pi/session-control/      ~/.pi/session-control/
    refactor-auth.sock          write-tests.sock
        │                           │
        ▼                           ▼
  ┌──────────────┐          ┌──────────────┐
  │ Pi Session 1 │          │ Pi Session 2 │
  │ (separate    │          │ (separate    │
  │  terminal)   │          │  terminal)   │
  └──────────────┘          └──────────────┘
```

WibWob becomes a **multi-session orchestrator** — the spatial desktop where you can see, steer, and coordinate multiple pi sessions simultaneously. Each session is a window. WibWob's agent can use `send_to_session` to coordinate between them.

### Phase 4: UI Bridge (the hard problem — pi-tui vs blessed)

Pi-tui components use a functional rendering model:
```typescript
// Pi-tui: Component renders to string lines
interface Component {
  render(width: number): string[];      // ← Pure function, returns ANSI strings
  handleInput?(data: string): void;
  invalidate(): void;
}
```

WibWob uses blessed widgets that own screen regions:
```typescript
// WibWob: blessed widgets paint to a screen buffer
const box = blessed.box({ top: 0, left: 0, width: 40, height: 20 });
box.setContent("...");   // ← Imperative, side-effectful
screen.render();
```

**The impedance mismatch is fundamental.** Pi-tui's `render(width) → string[]` produces ANSI-escaped text lines. Blessed's boxes consume plain text or blessed-specific markup. Bridging requires one of:

| Approach | Effort | Fidelity |
|----------|--------|----------|
| **A. ANSI→blessed content** — pipe `render()` output into `box.setContent()` | Low | 🟡 Partial — blessed re-parses ANSI, some sequences lost |
| **B. Virtual terminal** — full terminal emulator (xterm.js headless) rendering pi-tui output, blessed displays the buffer | High | 🟢 Full — but heavy runtime cost |
| **C. Shared component library** — new abstraction both systems render to | Very High | 🟢 Full — but massive refactor |
| **D. Skip it** — use Phase 3 (socket protocol) for data, WibWob renders its own UI | None | 🟢 Full — different UI, same data |

**Recommendation: Option D for now, Option A as experiment.** The socket protocol (Phase 3) gives WibWob all the *data* it needs. Building WibWob-native UI for pi session data is easier and better-looking than trying to embed pi-tui components inside blessed windows.

### Shared Runtime Option (Both Run Bun)

Both pi and WibWob run on Bun. Pi's extension loader uses [`jiti`](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/src/core/extensions/loader.ts#L1) for JIT TypeScript compilation with `virtualModules` to supply bundled packages even when they're not installed. WibWob could use the same loader to import pi extensions directly:

```typescript
// WibWob loading a pi extension directly (shared Bun process)
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, {
  moduleCache: false,
  virtualModules: {
    // Supply pi packages from WibWob's node_modules or bundled
    "@mariozechner/pi-coding-agent": piCodingAgentExports,
    "@mariozechner/pi-tui": piTuiExports,
    "@mariozechner/pi-ai": piAiExports,
  },
});

const extensionFactory = jiti("/path/to/extension.ts").default;
extensionFactory(bridgeApi); // Our adapter API
```

This means WibWob could load pi extensions **without pi running** — useful for command-only and tool-only extensions. But it requires WibWob to bundle or depend on pi's packages.

### Blockers and What's NOT Possible Yet

| Blocker | Severity | Detail |
|---------|:--------:|--------|
| **No event bus in WibWob** | 🔴 | Pi extensions that depend on `session_start`, `agent_end`, `turn_end`, `tool_result` (28 of 30+ event types) won't fire unless WibWob implements a compatible event system or proxies events from a live pi session |
| **No agent core in WibWob** | 🔴 | Pi extensions that call `pi.sendMessage()`, `pi.sendUserMessage()`, or intercept LLM events need `@mariozechner/pi-agent-core`. WibWob's agent (wibwob-agent) is a different system |
| **Terminal abstraction mismatch** | 🔴 | Pi-tui → blessed rendering bridge (Phase 4) requires either ANSI passthrough or a virtual terminal. Neither is trivial |
| **Session manager dependency** | 🟡 | Pi's `ExtensionContext` requires a `SessionManager` with branching/forking/compaction. WibWob would need a stub or adapter |
| **Focus model conflict** | 🟡 | Pi-tui assumes terminal focus ownership. WibWob has window-level focus with a focus stack. A pi component in a WibWob window needs focus routing |
| **Extension UI/headless split** | 🟡 | Pi's `ExtensionAPI` mixes headless operations (`registerTool`) with TUI operations (`ctx.ui.custom`). Extensions can't declare they're headless-only. This is [a known COAT violation](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/src/core/extensions/types.ts) in pi |

### Architecture Diagram

```
                        ┌─────────────────────────────────────────────┐
                        │            WibWob-DOS Process                │
                        │            (Bun, blessed, port 8099)         │
                        │                                              │
  ┌──────────┐          │  ┌──────────────────────────────────────┐   │
  │ Pi       │ control  │  │ Pi Sessions Microapp                  │   │
  │ Session  │◄────────►│  │                                       │   │
  │ #1       │ .sock    │  │  ┌────────┐  ┌────────┐  ┌────────┐ │   │
  │ (term 1) │          │  │  │ Win: S1│  │ Win: S2│  │ Win: S3│ │   │
  └──────────┘          │  │  │ stream │  │ stream │  │ stream │ │   │
                        │  │  └───┬────┘  └───┬────┘  └───┬────┘ │   │
  ┌──────────┐          │  │      │           │           │       │   │
  │ Pi       │ control  │  │      └─────┬─────┘           │       │   │
  │ Session  │◄────────►│  │            │                 │       │   │
  │ #2       │ .sock    │  │    ┌───────▼─────────────────▼──┐    │   │
  │ (term 2) │          │  │    │  Socket Manager             │    │   │
  └──────────┘          │  │    │  (discover, connect, pool)  │    │   │
                        │  │    └─────────────────────────────┘    │   │
  ┌──────────┐          │  └──────────────────────────────────────┘   │
  │ Pi       │ control  │                                              │
  │ Session  │◄────────►│  ┌──────────────────────────────────────┐   │
  │ #3       │ .sock    │  │ Agent Window                          │   │
  │ (term 3) │          │  │  "Coordinate sessions #1 and #2"     │   │
  └──────────┘          │  │  → send_to_session tool (via bridge) │   │
                        │  └──────────────────────────────────────┘   │
                        │                                              │
                        │  ┌──────────────────────────────────────┐   │
                        │  │ Pi Command Bridge                     │   │
                        │  │  pi.go-to-bed → wibwob command        │   │
                        │  │  pi.notify    → wibwob command        │   │
                        │  │  pi.uv        → wibwob command        │   │
                        │  └──────────────────────────────────────┘   │
                        └─────────────────────────────────────────────┘
                                         │
                                    HTTP :8099
                                         │
                                    ┌────▼────┐
                                    │ Agents, │
                                    │ scripts │
                                    └─────────┘
```

### Minimal Viable Integration: End-to-End Code Sketch

The smallest useful thing: a WibWob microapp that shows live pi sessions and lets you send messages to them.

```typescript
// microapps/pi-sessions/microapp.json
{
  "id": "wibwob.pi-sessions",
  "name": "Pi Sessions",
  "description": "Connect to live pi coding agent sessions",
  "version": "0.1.0",
  "entry": "index.ts"
}
```

```typescript
// microapps/pi-sessions/index.ts
import type { MicroappHost, MicroappWindowHandle } from "../../src/services/microapp-sdk.js";
import * as net from "node:net";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";

const CONTROL_DIR = path.join(os.homedir(), ".pi", "session-control");

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: "Pi Sessions",
    description: "View and interact with live pi sessions",
    action: () => openSessionBrowser(host),
    menu: [{ category: "Tools", order: 50, label: "Pi Sessions" }],
    palette: { order: 10, label: "Pi Sessions" },
  });

  host.registerCommand({
    id: "connect",
    label: "Connect to Pi Session",
    description: "Connect to a specific pi session by name or ID",
    action: (args) => {
      const sessionId = args?.sessionId as string;
      if (sessionId) openSessionWindow(host, sessionId);
    },
  });
}

async function openSessionBrowser(host: MicroappHost) {
  const handle = host.createWindow({
    title: "Pi Sessions", width: 60, height: 30,
  });

  const refresh = async () => {
    const sessions = await discoverSessions();
    const lines = sessions.map((s) =>
      ` ${s.alias ?? s.id.slice(0, 8)}  ${s.alive ? "{green-fg}●{/}" : "{red-fg}○{/}"}`
    );
    handle.body.setContent(
      `{bold}Live Pi Sessions{/bold}  (${sessions.length} found)\n\n` +
      (lines.length ? lines.join("\n") : "  No sessions. Start pi with --session-control") +
      "\n\n{gray-fg}Enter: connect  r: refresh  q: close{/}"
    );
    handle.body.screen.render();
    return sessions;
  };

  let sessions = await refresh();
  let selected = 0;

  handle.onInput((key) => {
    if (key === "r") refresh().then((s) => { sessions = s; });
    if (key === "j" || key === "down") selected = Math.min(selected + 1, sessions.length - 1);
    if (key === "k" || key === "up") selected = Math.max(selected - 1, 0);
    if (key === "\r" && sessions[selected]?.alive) {
      openSessionWindow(host, sessions[selected].id);
    }
  });
}

async function openSessionWindow(host: MicroappHost, sessionId: string) {
  const socketPath = path.join(CONTROL_DIR, `${sessionId}.sock`);
  const conn = connectPiSession(socketPath);

  const handle = host.createWindow({
    title: `Pi: ${sessionId.slice(0, 12)}`, width: 80, height: 40,
  });

  // Subscribe to turn_end events for live streaming
  conn.subscribe("turn_end", (data: any) => {
    const msg = data?.message;
    if (msg) appendOutput(handle, `\n${msg}\n`);
  });

  // Get initial state
  const initial = await conn.send({ type: "get_message" });
  if (initial.success && initial.data?.message) {
    handle.body.setContent(initial.data.message as string);
    handle.body.screen.render();
  }

  // Input: type a message and send it to the pi session
  let inputBuffer = "";
  handle.onInput((key) => {
    if (key === "\r" && inputBuffer.trim()) {
      conn.send({ type: "send", message: inputBuffer.trim(), mode: "steer" });
      inputBuffer = "";
    } else if (key === "\x7f") {  // backspace
      inputBuffer = inputBuffer.slice(0, -1);
    } else if (key.length === 1) {
      inputBuffer += key;
    }
    updateInputLine(handle, inputBuffer);
  });

  handle.onCleanup(() => conn.close());

  handle.describeState(() => ({
    summary: `Connected to pi session ${sessionId}`,
    sessionId,
    contentPreview: handle.body.getContent().slice(0, 200),
  }));
}

// --- Socket helpers (same protocol as control.ts) ---

interface PiSession { id: string; socketPath: string; alias?: string; alive: boolean; }

async function discoverSessions(): Promise<PiSession[]> {
  try { await fs.access(CONTROL_DIR); } catch { return []; }
  const entries = await fs.readdir(CONTROL_DIR, { withFileTypes: true });
  const aliases = new Map<string, string>();
  for (const e of entries) {
    if (e.name.endsWith(".alias")) {
      try {
        const target = await fs.readlink(path.join(CONTROL_DIR, e.name));
        const id = path.basename(target, ".sock");
        aliases.set(id, e.name.replace(".alias", ""));
      } catch {}
    }
  }
  const sessions: PiSession[] = [];
  for (const e of entries) {
    if (!e.name.endsWith(".sock")) continue;
    const id = e.name.slice(0, -5);
    const socketPath = path.join(CONTROL_DIR, e.name);
    const alive = await isSocketAlive(socketPath);
    sessions.push({ id, socketPath, alias: aliases.get(id), alive });
  }
  return sessions;
}

async function isSocketAlive(socketPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const s = net.createConnection(socketPath);
    s.on("connect", () => { s.destroy(); resolve(true); });
    s.on("error", () => resolve(false));
    setTimeout(() => { s.destroy(); resolve(false); }, 500);
  });
}

function connectPiSession(socketPath: string) {
  const socket = net.createConnection(socketPath);
  const pending = new Map<string, (resp: any) => void>();
  const subs = new Map<string, ((data: unknown) => void)[]>();
  let buf = "";

  socket.on("data", (chunk) => {
    buf += chunk.toString();
    const lines = buf.split("\n");
    buf = lines.pop()!;
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const msg = JSON.parse(line);
        if (msg.type === "event") {
          for (const cb of subs.get(msg.event) ?? []) cb(msg.data);
        } else if (msg.type === "response") {
          pending.get(msg.id ?? msg.command)?.(msg);
          pending.delete(msg.id ?? msg.command);
        }
      } catch {}
    }
  });

  return {
    send: (cmd: Record<string, unknown>): Promise<any> =>
      new Promise((resolve) => {
        const id = crypto.randomUUID();
        pending.set(id, resolve);
        socket.write(JSON.stringify({ ...cmd, id }) + "\n");
        setTimeout(() => { pending.delete(id); resolve({ success: false, error: "timeout" }); }, 10000);
      }),
    subscribe: (event: string, cb: (data: unknown) => void) => {
      const list = subs.get(event) ?? [];
      list.push(cb);
      subs.set(event, list);
      socket.write(JSON.stringify({ type: "subscribe", event }) + "\n");
    },
    close: () => socket.destroy(),
  };
}

function appendOutput(handle: MicroappWindowHandle, text: string) {
  const current = handle.body.getContent();
  handle.body.setContent(current + text);
  handle.body.screen.render();
}

function updateInputLine(handle: MicroappWindowHandle, input: string) {
  // Update last line with input prompt
  const content = handle.body.getContent();
  const lines = content.split("\n").filter((l) => !l.startsWith("► "));
  lines.push(`► ${input}▌`);
  handle.body.setContent(lines.join("\n"));
  handle.body.screen.render();
}
```

---

## Findings by Priority

### 🔴 P0: Critical (fix/adopt now)

| # | Finding | Source | Action |
|---|---------|--------|--------|
| P0-1 | **Pi's discriminated union event system is best-in-class** — 30+ event types with `type` discriminants, full JSDoc contracts, typed overloads for tool narrowing | [types.ts](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/src/core/extensions/types.ts) | WibWob should adopt for its command/event system |
| P0-2 | **String literal unions over enums everywhere** — zero `enum` declarations across 110k LOC. Avoids double-mapping, works with discriminated unions, tree-shakes | [types.ts](https://github.com/badlogic/pi-mono/blob/main/packages/agent/src/types.ts) | Audit WibWob for remaining enums, migrate to unions |
| P0-3 | **`import type` used with 100% discipline** — every type-only import marked. Enforced across all 7 packages | All packages | WibWob should enforce via biome rule |
| P0-4 | **`ThinkingLevel` type fork** — `ai` defines `"minimal"|"low"|"medium"|"high"|"xhigh"`, `agent` adds `"off"`. Two definitions of the same concept | [ai/types.ts:45](https://github.com/badlogic/pi-mono/blob/main/packages/ai/src/types.ts), [agent/types.ts:220](https://github.com/badlogic/pi-mono/blob/main/packages/agent/src/types.ts) | Upstream issue: unify in `ai` package |
| P0-5 | **`truncate.ts` copy-pasted** — 89% identical between `coding-agent` and `mom` (265 vs 236 LOC) | [coding-agent/truncate.ts](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/src/core/tools/truncate.ts), [mom/truncate.ts](https://github.com/badlogic/pi-mono/blob/main/packages/mom/src/tools/truncate.ts) | Upstream: extract to shared package or `ai` |
| P0-6 | **Zero custom Error classes in pi** — all errors are plain `Error` with string messages. Can't discriminate error types in catch blocks | All packages | WibWob should **not** copy this — keep its typed errors |
| P0-7 | **`interactive-mode.ts` is 4,442 lines** — handles rendering, input routing, state machine, UI composition in one file | [interactive-mode.ts](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/src/modes/interactive/interactive-mode.ts) | Warning: WibWob's `app-controller.ts` is trending the same way |

### 🟡 P1: Important (next quarter)

| # | Finding | Source | Action |
|---|---------|--------|--------|
| P1-1 | **Factory methods with private constructors** — `SessionManager.create()`, `.open()`, `.continueRecent()`, `.inMemory()`, `.forkFrom()`. 5 static factories, constructor is private | [session-manager.ts](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/src/core/session-manager.ts) | WibWob should adopt for complex constructors |
| P1-2 | **`ReadonlyX = Pick<X, read-methods>` pattern** — `ReadonlySessionManager` exposes read surface without mutation. Better than `Readonly<T>` when the read surface is a subset | [types.ts](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/src/core/extensions/types.ts) | Adopt for WibWob service facades |
| P1-3 | **Extension error isolation** — every handler call wrapped in try/catch with `emitError()`. A misbehaving extension can't crash the host | [runner.ts](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/src/core/extensions/runner.ts) | WibWob microapps need similar isolation |
| P1-4 | **Agent loop is pure** — `runLoop()` takes config + emit callback, has no mutable external state. Testable, predictable | [agent-loop.ts](https://github.com/badlogic/pi-mono/blob/main/packages/agent/src/agent-loop.ts) | Model for any WibWob stateful loop |
| P1-5 | **`"Contract:"` JSDoc prefix** — appears 4 times in `types.ts`, documenting error handling expectations. Rare and valuable | [types.ts](https://github.com/badlogic/pi-mono/blob/main/packages/agent/src/types.ts) | Adopt for WibWob key interfaces |
| P1-6 | **Theme dependency inversion** — core imports from `modes/interactive/theme/`. The adapter should depend on core, not reverse | [agent-session.ts:29](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/src/core/agent-session.ts) | WibWob already has this correct (`core/theme/`) |
| P1-7 | **Extension API mixes headless + TUI** — `registerTool()` and `ctx.ui.setContent()` on the same API. Extensions can't declare headless-only | [types.ts](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/src/core/extensions/types.ts) | Relevant to bridge: WibWob can only use headless surface |
| P1-8 | **`catch (error: any)` pattern** — ~12 occurrences. Pre-TypeScript 4.4 style; should be `catch (error: unknown)` | Various | WibWob should use `unknown` consistently |
| P1-9 | **Extension error handling copy-pasted 15×** in `runner.ts` — same try/catch/stringify/emit block repeated | [runner.ts](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/src/core/extensions/runner.ts) | Should extract to `safeCall` helper |
| P1-10 | **Closure-based state in extensions** — module-scoped mutable state, no class needed. State restored from session entries on startup | [loop.ts](https://github.com/mitsuhiko/agent-stuff/blob/main/pi-extensions/loop.ts) | WibWob microapps could adopt this vs class state |

### 🟢 P2: Nice-to-have (backlog)

| # | Finding | Source | Action |
|---|---------|--------|--------|
| P2-1 | **`KnownApi | (string & {})` pattern** — autocomplete for known values while allowing arbitrary strings | [ai/types.ts](https://github.com/badlogic/pi-mono/blob/main/packages/ai/src/types.ts) | Useful for WibWob theme/command IDs |
| P2-2 | **Constants block at module top** — all mitsuhiko extensions declare constants before functions. Clean and scannable | [todos.ts](https://github.com/mitsuhiko/agent-stuff/blob/main/pi-extensions/todos.ts) | Style convention worth adopting |
| P2-3 | **Explicit barrel exports (no `export *`)** — every export deliberate, alphabetically organized | [extensions/index.ts](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/src/core/extensions/index.ts) | WibWob's `microapp-sdk.ts` barrel is too large (~350 exports) |
| P2-4 | **No build orchestrator** — serial `cd && build` chain in root `package.json` | [package.json](https://github.com/badlogic/pi-mono/blob/main/package.json) | Not WibWob's problem, but note for monorepo awareness |
| P2-5 | **`CustomAgentMessages` declaration merging** — open-ended extensibility via module augmentation | [types.ts](https://github.com/badlogic/pi-mono/blob/main/packages/agent/src/types.ts) | Interesting pattern if WibWob ever needs open message types |
| P2-6 | **Settings getter/setter boilerplate** — ~40 pairs in `SettingsManager` with identical structure | [settings-manager.ts](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/src/core/settings-manager.ts) | If WibWob settings grow, use a generic accessor |

---

## Detailed Analysis

### Coding Style & Conventions

**Repository metrics:**

| Package | Files | Lines | `any` | `catch` | Type guards | Generics |
|---------|------:|------:|------:|--------:|------------:|----------:|
| coding-agent | 114 | 39,333 | 83 | 199 | 29 | 43 |
| agent | 5 | 1,952 | 25 | 6 | 0 | 2 |
| tui | 25 | 10,373 | 7 | 12 | 7 | 1 |
| ai | 41 | 25,139 | 61 | 62 | 8 | 9 |
| mitsuhiko ext | 14 | 13,054 | 38 | — | — | — |

**`any` density per 1,000 lines:** tui (0.7) < coding-agent (2.1) < ai (2.4) < mitsuhiko (2.9) < agent (12.8). The `agent` package's high density is due to its small size — 25 `any` in 1,952 lines, mostly `Model<any>` and `AgentTool<any>` generics where the type parameter is the API type and many contexts work with heterogeneous models.

**Best typing pattern — discriminated unions everywhere:**
```typescript
// agent/types.ts — every event system uses this pattern
export type AgentEvent =
  | { type: "agent_start" }
  | { type: "agent_end"; messages: AgentMessage[] }
  | { type: "turn_start" }
  | { type: "turn_end"; message: AgentMessage; toolResults: ToolResultMessage[] }
  | { type: "tool_call"; toolName: string; input: Record<string, unknown> }
  | { type: "tool_result"; toolName: string; result: unknown; isError: boolean }
  // ... 4 more variants

// coding-agent — typed tool narrowing via function overloads
export function isToolCallEventType(toolName: "bash", event: ToolCallEvent): event is BashToolCallEvent;
export function isToolCallEventType(toolName: "read", event: ToolCallEvent): event is ReadToolCallEvent;
// ... 5 more overloads, then generic fallback
```

**Best structural pattern — extension loader/runner/wrapper separation:**
```
types.ts  (1,411 LOC) — pure types, zero logic, safe to import without side effects
loader.ts   (545 LOC) — discovery, jiti compilation, API creation (testable alone)
runner.ts   (884 LOC) — lifecycle, context creation, event dispatch
wrapper.ts   (30 LOC) — trivial adapter: RegisteredTool → AgentTool
```

WibWob's microapp system has similar separation (`microapp-loader.ts` + `microapp-registry.ts` + `microapp-host.ts`) but the SDK barrel (`microapp-sdk.ts`) conflates re-exports with the host interface.

### Architecture & Extension Model

**Pi's 4-layer dependency stack is clean and minimal:**

```
coding-agent (composition root: 39k LOC)
    ├── agent (core loop: 2k LOC)
    │     └── ai (provider abstraction: 25k LOC, 14k generated)
    └── tui (terminal UI: 10k LOC, zero dep on ai/agent)
```

`tui` is completely independent — no dependency on `ai` or `agent`. This means pi-tui components could be loaded into WibWob without pulling in the LLM stack. The `coding-agent` is the composition root that wires everything together, analogous to WibWob's `app-controller.ts`.

**Extension lifecycle is 5 stages:** Discovery → Loading → Registration → Binding → Runtime. Extensions are loaded via `jiti` (JIT TypeScript), receive an `ExtensionAPI`, and register handlers/tools/commands during their factory call. After all extensions load, `runner.bindCore()` replaces throwing stubs with real implementations. This two-phase initialization prevents extensions from calling runtime methods before the system is ready.

**Mitsuhiko extensions show the full spectrum of extension complexity:**

| Extension | LOC | What it demonstrates |
|-----------|----:|----------------------|
| [`notify.ts`](https://github.com/mitsuhiko/agent-stuff/blob/main/pi-extensions/notify.ts) | 88 | Minimum viable extension — one event subscription, pure helpers |
| [`uv.ts`](https://github.com/mitsuhiko/agent-stuff/blob/main/pi-extensions/uv.ts) | 123 | Shell command integration via `pi.exec()` |
| [`loop.ts`](https://github.com/mitsuhiko/agent-stuff/blob/main/pi-extensions/loop.ts) | 446 | Closure-based state with session persistence via `pi.appendEntry()` |
| [`todos.ts`](https://github.com/mitsuhiko/agent-stuff/blob/main/pi-extensions/todos.ts) | 2,076 | Full application: file CRUD, TUI components, tool registration, GC |
| [`control.ts`](https://github.com/mitsuhiko/agent-stuff/blob/main/pi-extensions/control.ts) | 1,748 | Microkernel IPC: Unix sockets, JSON-RPC, session discovery, subscriptions |

All 14 extensions are COAT-compliant — they build on top of the public API without reaching into core internals.

### COAT/DRY Analysis

**COAT compliance: 8/10.** The `AgentSession` class is a genuine shared semantic core (3,097 LOC). The three modes (interactive 13k, RPC 1.5k, print 124 LOC) are adapters of varying thickness. Print mode at 124 LOC is the gold standard — pure I/O wiring, zero business logic. Two violations:

1. **Core → interactive theme import** — 6 files in `core/` import from `modes/interactive/theme/`. The theme is semantics (HTML export, extension API surface, resource loading), not presentation. It belongs in `core/`.

2. **TUI types in extension API** — `ExtensionAPI` imports `Component`, `TUI`, `EditorComponent` from `@mariozechner/pi-tui`. Extensions using `ctx.ui.setContent()` fail the COAT test — they don't work without the TUI.

**DRY compliance: 9/10.** Cross-package duplication is remarkably low at 0.4% (380 duplicated LOC out of 97,235 total). The two issues:
- `truncate.ts` copy-pasted between `coding-agent` and `mom` (89% identical)
- `ThinkingLevel` defined in two packages with different members

**Monorepo hygiene: 7/10.** Lockstep versioning (`0.58.3` across all packages via `sync-versions.js`) is correct. Shared `tsconfig.base.json` and `biome.json`. Weaknesses: serial build chain (no turborepo/nx), sparse test infrastructure.

---

## Patterns WibWob-DOS Should Adopt

### 1. Discriminated union event system
**Pi:** Every event system uses `type` discriminants with exhaustive narrowing.
```typescript
// Pi pattern — adopt for WibWob command events, window events, agent events
export type WindowEvent =
  | { type: "window_created"; windowId: number; appType: string }
  | { type: "window_closed"; windowId: number }
  | { type: "window_focused"; windowId: number; previous?: number }
  | { type: "window_resized"; windowId: number; width: number; height: number };
```

### 2. Factory methods over public constructors
**Pi:** `SessionManager.create()`, `.open()`, `.continueRecent()`, `.inMemory()`, `.forkFrom()` — 5 static factories, constructor private.
**WibWob:** Use for `WindowManager`, `CommandRegistry`, any class with complex construction.

### 3. `ReadonlyX = Pick<X, read-methods>` facades
**Pi:** `ReadonlySessionManager` gives extensions read access without mutation.
**WibWob:** Apply to `MicroappHost` — microapps should get a `ReadonlyWindowFacade` for windows they don't own.

### 4. "Contract:" JSDoc prefix
**Pi:** Documents error handling expectations on key interfaces.
```typescript
/**
 * Contract: must not throw or reject. Return a safe fallback value instead.
 * Throwing interrupts the low-level agent loop without producing a normal event sequence.
 */
convertToLlm: (messages: AgentMessage[]) => Message[] | Promise<Message[]>;
```

### 5. Extension error isolation (try/catch per handler)
**Pi:** Every extension handler call is wrapped — a misbehaving extension can't crash the host.
**WibWob:** Microapp `setup()` calls, command handlers, snapshot serialize/restore should all be wrapped.

### 6. Closure-based state for extensions
**Pi/mitsuhiko:** Module-scoped mutable state via closure. Simple, no class ceremony.
**WibWob:** Microapps that don't need classes (most of them) should use this pattern.

---

## Patterns WibWob-DOS Should Avoid

### 1. God files
**Pi's `interactive-mode.ts`** at 4,442 lines handles rendering, input routing, state machines, and UI composition in one file. **WibWob's `app-controller.ts`** is trending the same direction. Split by concern before it's too late.

### 2. Zero custom Error classes
**Pi** uses plain `Error` with string messages everywhere. Error discrimination requires string matching. WibWob should keep its typed errors and add more — `CommandNotFoundError`, `MicroappLoadError`, `WindowLimitError`.

### 3. `catch (error: any)`
**Pi** has ~12 instances of this pre-4.4 pattern. Always use `catch (error: unknown)` with type guards.

### 4. Copy-pasted error handling blocks
**Pi's `runner.ts`** has the same try/catch/stringify/emit pattern repeated 15 times. Extract to a `safeCall(fn, errorContext)` helper.

### 5. Mixed headless/TUI extension API
**Pi's `ExtensionAPI`** puts `registerTool()` (headless) and `ctx.ui.custom()` (TUI-only) on the same interface. If WibWob bridges pi extensions, it can only use the headless subset. Keep WibWob's `MicroappHost` focused on window creation.

---

## Actionable Next Steps

1. **Build the `pi-sessions` microapp** (Phase 0) — the code sketch above is nearly complete. Discovers live pi sessions via `~/.pi/session-control/`, connects via Unix socket, displays output in WibWob windows. Zero changes to pi required. **Estimated: 1-2 days.**

2. **Enforce `import type` in WibWob** — add biome rule. Pi does this with 100% compliance across 110k LOC. WibWob is inconsistent. **Estimated: 1 hour.**

3. **Audit WibWob for remaining `enum` declarations** — migrate to string literal unions. Pi has zero enums. **Estimated: 2 hours.**

4. **Add extension error isolation to microapp loader** — wrap `setup(host)` in try/catch per microapp. A broken microapp shouldn't prevent others from loading. **Estimated: 30 minutes.**

5. **Extract a `ToolDefinition` interface** compatible with both pi's `RegisteredToolDefinition` and WibWob's agent tool format. This enables Phase 2 (tool bridge). **Estimated: half day.**

6. **Implement layered settings** — pi's `SettingsManager` pattern (global `~/.wibwob/settings.json` + project `.wibwob/settings.json`, deep merge, file-lock persistence) would replace WibWob's scattered config. **Estimated: 1-2 days.**

7. **Add a WibWob event bus** — start with 5 events: `window_created`, `window_closed`, `window_focused`, `command_executed`, `agent_turn_end`. This enables future pi extension event bridging. **Estimated: 1 day.**

8. **File upstream issues** on pi-mono for `ThinkingLevel` unification, `truncate.ts` extraction, and `ExtensionAPI` headless/TUI split. These would make the bridge cleaner. **Estimated: 1 hour.**

9. **Prototype the command bridge** (Phase 1) — load a simple pi extension like `notify.ts` or `go-to-bed.ts` via jiti into WibWob's process. Wire its registered commands to WibWob's command registry. **Estimated: 1-2 days.**

10. **Document the integration architecture** in `.agents/shell-dev/specs/` — formalize the phase model and protocol contracts so any agent can work on the bridge independently. **Estimated: half day.**

---

## Appendix: Raw Metrics

### Pi-Mono Package Inventory

| Package | npm name | LOC | Files | `any` | Catch blocks |
|---------|----------|----:|------:|------:|-------------:|
| coding-agent | `@mariozechner/pi-coding-agent` | 39,333 | 114 | 83 | 199 |
| ai | `@mariozechner/pi-ai` | 25,139 | 41 | 61 | 62 |
| web-ui | `@mariozechner/pi-web-ui` | 14,617 | 71 | — | — |
| tui | `@mariozechner/pi-tui` | 10,373 | 25 | 7 | 12 |
| mom | `@mariozechner/pi-mom` | 4,048 | 16 | — | — |
| agent | `@mariozechner/pi-agent-core` | 1,952 | 5 | 25 | 6 |
| pods | `@mariozechner/pi` | 1,773 | 9 | — | — |
| **Total** | | **97,235** | **281** | **176+** | **279+** |

### Mitsuhiko Extensions

| Extension | LOC | Complexity | COAT |
|-----------|----:|:----------:|:----:|
| [`todos.ts`](https://github.com/mitsuhiko/agent-stuff/blob/main/pi-extensions/todos.ts) | 2,076 | Very High | ✅ |
| [`review.ts`](https://github.com/mitsuhiko/agent-stuff/blob/main/pi-extensions/review.ts) | 1,971 | Very High | ✅ |
| [`control.ts`](https://github.com/mitsuhiko/agent-stuff/blob/main/pi-extensions/control.ts) | 1,748 | Extreme | ✅ |
| [`session-breakdown.ts`](https://github.com/mitsuhiko/agent-stuff/blob/main/pi-extensions/session-breakdown.ts) | 1,629 | High | ✅ |
| [`prompt-editor.ts`](https://github.com/mitsuhiko/agent-stuff/blob/main/pi-extensions/prompt-editor.ts) | 1,315 | High | 🟡 |
| [`files.ts`](https://github.com/mitsuhiko/agent-stuff/blob/main/pi-extensions/files.ts) | 1,114 | High | ✅ |
| [`multi-edit.ts`](https://github.com/mitsuhiko/agent-stuff/blob/main/pi-extensions/multi-edit.ts) | 772 | Medium | ✅ |
| [`context.ts`](https://github.com/mitsuhiko/agent-stuff/blob/main/pi-extensions/context.ts) | 578 | Medium | ✅ |
| [`answer.ts`](https://github.com/mitsuhiko/agent-stuff/blob/main/pi-extensions/answer.ts) | 532 | Medium | ✅ |
| [`whimsical.ts`](https://github.com/mitsuhiko/agent-stuff/blob/main/pi-extensions/whimsical.ts) | 474 | Low | ✅ |
| [`loop.ts`](https://github.com/mitsuhiko/agent-stuff/blob/main/pi-extensions/loop.ts) | 446 | Low | ✅ |
| [`go-to-bed.ts`](https://github.com/mitsuhiko/agent-stuff/blob/main/pi-extensions/go-to-bed.ts) | 188 | Low | ✅ |
| [`uv.ts`](https://github.com/mitsuhiko/agent-stuff/blob/main/pi-extensions/uv.ts) | 123 | Low | ✅ |
| [`notify.ts`](https://github.com/mitsuhiko/agent-stuff/blob/main/pi-extensions/notify.ts) | 88 | Minimal | ✅ |
| **Total** | **13,054** | | **13/14 clean** |

### Cross-Package Duplication

| Duplicated Code | LOC | Packages | Severity |
|-----------------|----:|----------|:--------:|
| `truncate.ts` | ~230 | coding-agent, mom | 🔴 |
| Tool implementations (bash, read) | ~150 | coding-agent, mom | 🟡 |
| `ThinkingLevel` type | 2 defs | ai, agent | 🔴 |
| **Total** | **~380** | | **0.4% of 97k** |

### COAT Scorecard

| Aspect | Score | Notes |
|--------|:-----:|-------|
| Semantic core isolation | 9/10 | `AgentSession` is clean. Only theme import violates. |
| Adapter thickness | 8/10 | Print (124 LOC) ✅, RPC (1,464) ✅, Interactive (13,425) thick but justified |
| Extension API purity | 7/10 | Mixed headless + TUI surface |
| Single-owner principle | 8/10 | `ThinkingLevel` and `truncate` are the only violations |
| Cross-package DRY | 9/10 | 0.4% duplication — excellent |
| **Overall** | **8/10** | Two structural fixes needed, otherwise exemplary |

---

*Analysis covers 110,289 lines across pi-mono (97,235), mitsuhiko extensions (13,054), and WibWob-DOS microapp infrastructure (~3,000). Generated 2026-03-16.*
