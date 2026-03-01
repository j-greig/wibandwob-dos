# Spike: Agent Window Enhancement

Enhance the Wib&Wob Chat window from a chat-only surface into a proper
coding agent window with tool execution, desktop awareness, and its own
menu/command surface.

## Context

We have two agent integration paths right now:

1. **WibWobChatService** (`src/services/wibwob-chat-service.ts`) — uses
   `@mariozechner/pi-agent-core` Agent directly. Native chat rendering in
   blessed. Has streaming, message history, tool events, model selection.
   No tool overrides — agent has no access to TUI state or commands.

2. **PiService** (`src/services/pi-service.ts`) — spawns pi binary in a
   PTY terminal window. Full pi TUI inside our TUI. Breaks on streaming
   repaints because our VT parser can't handle ink's redraw semantics.

Option 1 is the right foundation. Option 2 is a dead end for embedding
(fine as a standalone terminal, bad as an integrated agent surface).

## Practical evidence

Commit `f7fb247dd8efebea6cfb9666821a4691f4d76c38` is an important proof point:

- a Pi agent with commands to inspect and manipulate the TUI was effective in practice
- it successfully used the terminal app already built inside the spike
- it modified the app's code through that surface
- it added the figlet window functionality through the in-app tool/terminal path

This matters because it moves the agent-window idea from "interesting design
direction" to "already demonstrated useful workflow." The embedded agent is not
just a chat novelty; it can act as a real operator inside the WibWob desktop.

## Reference: Gondolin extension pattern

[gondolin/host/examples/pi-gondolin.ts](https://github.com/earendil-works/gondolin/blob/main/host/examples/pi-gondolin.ts)
shows how to override pi's built-in tools via the extension API:

- `pi.registerTool()` replaces read/write/edit/bash with VM-backed versions
- `pi.on("before_agent_start")` rewrites the system prompt
- `pi.on("session_start/shutdown")` manages VM lifecycle
- Path mapping: host paths become `/workspace` paths inside the guest
- The agent thinks it's in a normal Linux environment

The same pattern works for our TUI: instead of redirecting tools into a VM,
we redirect them into our desktop. The agent's bash runs in our terminal
window, its read/write operate on our filesystem, and it ALSO gets TUI
tools (open window, move window, read state, paint, etc).

## What we have vs what we need

| Surface | Have | Need |
|---------|------|------|
| Chat streaming | Yes (pi-agent-core Agent) | Keep |
| Tool execution events | Yes (tool_execution_start/end) | Display in status bar |
| Tool overrides | No | Register TUI tools with the Agent |
| Desktop state injection | No | Inject state per turn via system prompt |
| Window commands | No | Agent should open/move/close/resize windows |
| Menu bar entry | No | Agent menu: send, clear, model, status |
| Command registry | No | Commands: wibwob_ask, get_chat_history, etc |
| Multi-turn tools | No | Agent uses tools, sees results, continues |
| Workspace persistence | Partial (messages only) | Full (model, status, tool state) |

## Architecture

### Option A: pi-agent-core Agent + custom tools (RECOMMENDED)

Keep using `Agent` from `@mariozechner/pi-agent-core` directly, but
register custom tool definitions that give it TUI superpowers:

```
WibWobChatService
  └─ Agent (pi-agent-core)
       ├─ built-in: text generation, thinking
       └─ custom tools registered via Agent config:
            ├─ tui_get_state    → reads desktop state
            ├─ tui_open_window  → opens window by type
            ├─ tui_move_window  → move/resize by id
            ├─ tui_close_window → close by id
            ├─ tui_list_commands → command discovery
            ├─ tui_menu_command  → universal command dispatch
            ├─ bash             → runs in a terminal window
            ├─ read             → reads files
            └─ write            → writes files
```

The Agent class accepts tool definitions. We define tools that call back
into our window manager, state service, and command registry. The agent
gets a system prompt that describes the desktop and its capabilities.

This is the Gondolin pattern but pointed at our TUI instead of a VM.

### Option B: pi-coding-agent SDK session (createAgentSession)

Use the full `createAgentSession` from `@mariozechner/pi-coding-agent`:

```ts
import { createAgentSession, createBashTool, createReadTool, ... } from "@mariozechner/pi-coding-agent"
```

This gives us the complete pi tool suite (bash, read, write, edit, grep,
find, ls) pre-built, plus extension support. We'd add TUI tools on top.

Pro: full coding agent out of the box
Con: heavier dependency, less control over tool surface, may conflict
with our own command registry

### Option C: Extension API (like Gondolin)

Write a pi extension that overrides tools:

```ts
pi.registerTool({ ...createBashTool(cwd), execute: async (...) => { /* run in our terminal */ } })
```

Pro: cleanest separation, reusable as a standalone extension
Con: requires running pi as a process (back to PTY problems) or using
the extension API programmatically (not yet clear if pi-agent-core
supports this without the full pi TUI)

### Recommendation: Option A now, migrate to B later

Option A is the smallest step from where we are. WibWobChatService
already creates an Agent. We just need to register tools with it.
When the command registry (BUILD-ORDER step 4) exists, Option B
becomes natural — createAgentSession uses the command registry for
tool discovery.

## Step plan

### Step 1: Tool definitions for the Agent

Create `src/services/agent-tools.ts`:

```ts
interface TuiToolContext {
  getState: () => DesktopState
  executeCommand: (name: string, args: Record<string, string>) => unknown
  openWindow: (type: string, opts?: Record<string, unknown>) => number
  closeWindow: (id: number) => boolean
  moveWindow: (id: number, x: number, y: number, w?: number, h?: number) => boolean
}

function createTuiTools(ctx: TuiToolContext): ToolDefinition[]
```

Returns tool definitions compatible with pi-agent-core's Agent. Each tool
has a name, description, parameter schema, and execute function that calls
back into the TUI context.

Start with 4 tools: tui_get_state, tui_open_window, tui_close_window,
tui_menu_command. Add more as the command registry grows.

### Step 2: Wire tools into WibWobChatService

Extend `WibWobChatSession` to accept a `TuiToolContext` at construction.
Pass tool definitions to the Agent constructor. The agent now has TUI
awareness — it can read desktop state and manipulate windows.

### Step 3: Desktop state injection per turn

Before each agent turn, inject current desktop state into the system
prompt or as a system message. Use the same format as the C++ app's
desktop-state hook:

```
[Desktop 200x53 | theme/dark | 5 windows]
w1: Wib&Wob Chat (80x30 @ 2,1) focused
w2: Terminal (60x20 @ 85,1)
w3: Primer: folk-punk (61x29 @ 0,25)
```

This goes in `before_agent_start` or as a prepended context message.

### Step 4: Agent menu bar entry

Add an "Agent" menu to menu-config.ts:

```
Agent
  Send Message...     (prompt for text, call chat.send())
  Clear History       (reset session)
  Show Status         (flash current model/status)
  Switch Model...     (list available, switch)
  Toggle Tools        (enable/disable TUI tools)
```

### Step 5: Command registry commands

Register with the (future) command registry:

```
wibwob_ask        — send a message to the agent
get_chat_history  — return message history as JSON
agent_status      — return model, streaming state, message count
agent_clear       — clear message history
```

These mirror the C++ app's commands. External agents (MCP, API) can
drive the chat programmatically.

### Step 6: Tool execution display

Enhance the chat window to show tool execution inline:

```
You: open a terminal and run ls

Wob: Opening a terminal for you.
  [tool] tui_open_window type=terminal → w4
  [tool] tui_menu_command terminal_write text="ls\n" → ok

Wib: Done! Terminal w4 is showing your directory listing.
```

Tool events are already emitted by the Agent (tool_execution_start/end).
Render them as indented status lines in the transcript.

### Step 7: Control API integration

Add endpoints to control-api.ts:

```
POST /agent/send        — send message to agent
GET  /agent/status      — model, streaming, message count
GET  /agent/history     — full message history
POST /agent/clear       — clear history
```

These let external tools (smoke tests, MCP, other agents) interact with
the embedded agent.

## Files touched

| File | Change |
|------|--------|
| NEW `src/services/agent-tools.ts` | Tool definitions for TUI context |
| `src/services/wibwob-chat-service.ts` | Accept TuiToolContext, register tools, state injection |
| `src/windows/wibwob-chat-window.ts` | Tool execution display, enhanced status |
| `src/core/menu-config.ts` | Agent menu |
| `src/services/control-api.ts` | Agent endpoints |
| `src/core/app-controller.ts` | Wire TuiToolContext, pass deps to chat service |

## Dependencies

- `@mariozechner/pi-agent-core` (already installed) — Agent, tool definitions
- `@mariozechner/pi-coding-agent` (already installed) — createBashTool etc for Option B later
- No new packages needed for step 1-5

## Risks

- pi-agent-core Agent's tool registration API may not be public/stable
- Tool execution is synchronous in the agent loop — long TUI operations
  could block streaming
- Desktop state injection adds tokens per turn — keep it compact
- If pi-agent-core doesn't support custom tools, fall back to Option B

## Success criteria

- Agent can answer "what windows are open?" by reading desktop state
- Agent can open a terminal window when asked
- Agent can execute a shell command in that terminal
- Chat history survives workspace save/load
- External API can send messages to the agent and read history
- Tool executions appear inline in the chat transcript

## Codex review

### Root cause

The plan currently conflates three different APIs:

```ts
// pi-agent-core
constructor(opts?: AgentOptions);
setTools(t: AgentTool<any>[]): void;

export interface AgentTool<TParameters extends TSchema = TSchema, TDetails = any> extends Tool<TParameters> {
  label: string;
  execute: (
    toolCallId: string,
    params: Static<TParameters>,
    signal?: AbortSignal,
    onUpdate?: AgentToolUpdateCallback<TDetails>
  ) => Promise<AgentToolResult<TDetails>>;
}

// pi-coding-agent
interface CreateAgentSessionOptions {
  tools?: Tool[];
  customTools?: ToolDefinition[];
}

export interface ToolDefinition<TParams extends TSchema = TSchema, TDetails = unknown> {
  execute(
    toolCallId: string,
    params: Static<TParams>,
    signal: AbortSignal | undefined,
    onUpdate: AgentToolUpdateCallback<TDetails> | undefined,
    ctx: ExtensionContext
  ): Promise<AgentToolResult<TDetails>>;
}
```

Source:
- `node_modules/@mariozechner/pi-agent-core/dist/agent.d.ts:75,119`
- `node_modules/@mariozechner/pi-agent-core/dist/types.d.ts:126-128`
- `node_modules/@mariozechner/pi-coding-agent/dist/core/sdk.d.ts:30-32`
- `node_modules/@mariozechner/pi-coding-agent/dist/core/extensions/types.d.ts:249-259`

The practical consequence is:

- `Agent` does support custom tools, but as `AgentTool[]`, not as extension `ToolDefinition[]`.
- `before_agent_start`, `session_start`, `session_shutdown`, and `registerTool()` belong to the `pi-coding-agent` extension layer, not raw `pi-agent-core.Agent`.
- `WibWobChatSession` currently uses raw `Agent`, so the Gondolin extension pattern cannot be copied verbatim into the current service.

### Fix options with tradeoffs

- Option 1: Stay on raw `Agent` and implement `AgentTool[]`.
  Tradeoff: smallest delta from current `WibWobChatSession`, but you must build your own tool registration, prompt/tool discovery text, and per-turn desktop-state injection. Use `agent.setTools(...)` and likely `transformContext`.
- Option 2: Migrate the service to `createAgentSession({ tools, customTools })`.
  Tradeoff: heavier refactor, but this is the API that actually matches Gondolin. You get `ToolDefinition`, extension hooks, built-in coding tools, and session/tool plumbing through `AgentSession`.
- Option 3: Keep raw `Agent` but write an adapter layer inspired by `ToolDefinition`.
  Tradeoff: possible, but low value. You would still have to discard `ExtensionContext` and reimplement behavior already present in `AgentSession`.

### Risks and tests to add

- Risk: implementing against `ToolDefinition` in `WibWobChatSession` will fail type-level and conceptually; raw `Agent` expects `AgentTool`.
- Risk: inline tool rendering needs new state in the chat session; current code only keeps `lastToolName`, not a transcript of tool calls/results.
- Risk: “full workspace persistence” needs `src/core/workspace-snapshots.ts` changes. Current chat snapshot persistence stores `draft` and `messages`, not model/tool state.

Tests to add:

- Service test: registered tools execute through the chosen seam and emit `tool_execution_start`, `tool_execution_update`, and `tool_execution_end`.
- Service test: desktop-state injection happens on every turn, not only at initialization.
- Window test: tool events render inline in transcript text export, not only in transient status.
- Workspace round-trip test: save/load restores every claimed chat field.
- Control API test: `/agent/*` endpoints drive the same session state as the window.

### Section review

#### Context

Status: PARTIALLY ACCURATE

What the code says:

- `WibWobChatSession` does use raw `Agent` from `@mariozechner/pi-agent-core` and constructs it directly in `src/services/wibwob-chat-service.ts:171-180`.
- Chat streaming is implemented through `message_start`, `message_update`, `message_end`, and `agent_end` handling in `src/services/wibwob-chat-service.ts:318-386`.
- Tool lifecycle events are only partially handled: `tool_execution_start` and `tool_execution_end` update transient status, but `tool_execution_update` is ignored in `src/services/wibwob-chat-service.ts:355-363`.
- The service resolves an initial model during startup, but there is no model switching API on the service or window. The current model is only exposed in the snapshot from `src/services/wibwob-chat-service.ts:214-221`.

Suggested corrections:

- Change “Has streaming, message history, tool events, model selection” to “Has streaming, message history, startup model resolution, and start/end tool status handling; no inline tool transcript, no tool overrides, and no model-switch UI/API.”

#### Reference: Gondolin extension pattern

Status: PARTIALLY ACCURATE

What the code says:

- The example really does use `pi.registerTool(...)` for the built-in tool names in `/tmp/gondolin/host/examples/pi-gondolin.ts:268-312`.
- It really does use `pi.on("session_start"...)`, `pi.on("session_shutdown"...)`, and `pi.on("before_agent_start"...)` in `/tmp/gondolin/host/examples/pi-gondolin.ts:249-254,319-326`.
- It also overrides `user_bash`, which the plan omits, in `/tmp/gondolin/host/examples/pi-gondolin.ts:314-317`.
- Those hooks come from the `pi-coding-agent` extension API. The actual extension surface is declared at `node_modules/@mariozechner/pi-coding-agent/dist/core/extensions/types.d.ts:647-675`.

Suggested corrections:

- Add that Gondolin is an extension example for `pi-coding-agent`, not a raw `pi-agent-core.Agent` example.
- Mention `user_bash` if the plan wants true parity with the example.

#### What we have vs what we need

Status: PARTIALLY ACCURATE

What the code says:

- “Chat streaming: Yes” is accurate. See `src/services/wibwob-chat-service.ts:318-386`.
- “Tool execution events: Yes” is only partially accurate. Start/end events are handled, but only as status text via `lastToolName`; there is no inline transcript storage and no `tool_execution_update` handling. See `src/services/wibwob-chat-service.ts:304-363`.
- “Tool overrides: No” is accurate. The current `Agent` is created without tools in `src/services/wibwob-chat-service.ts:171-180`.
- “Desktop state injection: No” is accurate. There is no `transformContext`, no per-turn `setSystemPrompt`, and no injected system message in `src/services/wibwob-chat-service.ts`.
- “Window commands: No” is accurate in the current chat service/window.
- “Menu bar entry: No” is inaccurate. There is already menu wiring to open the window in `src/core/menu-config.ts:53,99,121`. What is missing is a dedicated in-window “Agent” command surface.
- “Command registry: No” is plausible but currently speculative in this spike. I did not find `wibwob_ask` or related commands in the current TS sources.
- “Multi-turn tools: No” is only partially accurate. The raw `Agent` can do multi-turn tool use, but this service registers no tools, so that path is unused.
- “Workspace persistence: Partial (messages only)” is inaccurate. Current persistence stores both `draft` and `messages` in `src/core/workspace-snapshots.ts:50-57`, restores them in `src/core/workspace-snapshots.ts:157-163`, and passes them through `src/core/app-controller.ts:370-385`. It does not persist model/tool state.

Suggested corrections:

- Split “menu bar entry” into “window-open menu entry exists” vs “no dedicated Agent command menu.”
- Change workspace persistence wording to “draft + messages persist; model/status/tool state do not.”

#### Architecture

##### Option A: pi-agent-core Agent + custom tools

Status: PARTIALLY ACCURATE

What the code says:

- Raw `Agent` does accept tools, but via `initialState.tools` or `agent.setTools(...)`, not via `ToolDefinition[]`. See `node_modules/@mariozechner/pi-agent-core/dist/agent.d.ts:75,119` and `node_modules/@mariozechner/pi-agent-core/dist/types.d.ts:126-128`.
- `Agent` has `transformContext`, which is the closest raw-Agent hook for per-turn state injection. See `node_modules/@mariozechner/pi-agent-core/dist/agent.d.ts:18,75` and `node_modules/@mariozechner/pi-agent-core/dist/types.d.ts:51`.
- `Agent` does not have extension hooks like `before_agent_start`.

Suggested corrections:

- Replace “ToolDefinition[] compatible with pi-agent-core” with `AgentTool[]`.
- Replace “registered via Agent config” with “set through `initialState.tools` or `agent.setTools(...)`.”
- Replace `before_agent_start` references under Option A with `transformContext` or explicit per-prompt prompt updates.

##### Option B: pi-coding-agent SDK session (createAgentSession)

Status: PARTIALLY ACCURATE

What the code says:

- `createAgentSession` supports built-in tools through `tools?: Tool[]` and custom extension-style tools through `customTools?: ToolDefinition[]` in `node_modules/@mariozechner/pi-coding-agent/dist/core/sdk.d.ts:30-32`.
- `createAgentSession` constructs a raw `Agent` internally in `node_modules/@mariozechner/pi-coding-agent/dist/core/sdk.js:152-198`, then wraps it in `AgentSession` in `node_modules/@mariozechner/pi-coding-agent/dist/core/sdk.js:214-223`.
- `AgentSession` turns `customTools` into wrapped agent tools and calls `this.agent.setTools(...)` in `node_modules/@mariozechner/pi-coding-agent/dist/core/agent-session.js:1582-1634`.

Suggested corrections:

- State that `createAgentSession` returns an `AgentSession`, not a bare `Agent`.
- State that custom tool support exists, but on the `pi-coding-agent` session/extension layer, not directly on `Agent`.

##### Option C: Extension API (like Gondolin)

Status: PARTIALLY ACCURATE

What the code says:

- The extension API is real and includes `registerTool(...)`, `on("before_agent_start"...)`, `on("session_start"...)`, and `on("session_shutdown"...)` in `node_modules/@mariozechner/pi-coding-agent/dist/core/extensions/types.d.ts:647-675`.
- It is not part of `pi-agent-core.Agent`.
- Programmatic use without the interactive CLI is already represented by `createAgentSession`, which builds an `AgentSession` plus `ExtensionRunner` in `node_modules/@mariozechner/pi-coding-agent/dist/core/sdk.js:214-223` and `node_modules/@mariozechner/pi-coding-agent/dist/core/agent-session.js:1582-1634`.

Suggested corrections:

- Replace “not yet clear if pi-agent-core supports this” with “raw `pi-agent-core.Agent` does not expose this; `pi-coding-agent` `AgentSession` does.”

##### Recommendation: Option A now, migrate to B later

Status: PARTIALLY ACCURATE

What the code says:

- Option A is closer to the current service shape.
- Option B is closer to the actual Gondolin extension model and already has first-class `customTools`, extension hooks, and system-prompt/tool management.

Suggested corrections:

- Keep the recommendation only if the doc explicitly says Option A must use `AgentTool[]` plus `transformContext`.
- If the goal is Gondolin-style extensibility, Option B is the more accurate API match.

#### Step plan

##### Step 1: Tool definitions for the Agent

Status: INACCURATE

What the code says:

- The raw `Agent` type is `AgentTool`, not `ToolDefinition`. See `node_modules/@mariozechner/pi-agent-core/dist/types.d.ts:126-128`.
- `ToolDefinition` belongs to `pi-coding-agent` extensions and includes `ctx: ExtensionContext` in the execute signature. See `node_modules/@mariozechner/pi-coding-agent/dist/core/extensions/types.d.ts:249-259`.

Suggested corrections:

- If staying on Option A, `createTuiTools` should return `AgentTool[]`.
- If the doc wants `ToolDefinition[]`, Step 2 must migrate to `createAgentSession`.

##### Step 2: Wire tools into WibWobChatService

Status: PARTIALLY ACCURATE

What the code says:

- `WibWobChatSession` currently only takes `cwd` in the constructor at `src/services/wibwob-chat-service.ts:143`.
- It creates `Agent` directly and never calls `setTools(...)` in `src/services/wibwob-chat-service.ts:171-181`.

Suggested corrections:

- For raw `Agent`, wire tools with `initialState.tools` or `agent.setTools(...)`.
- Do not describe this as passing extension `ToolDefinition`s to the `Agent` constructor.

##### Step 3: Desktop state injection per turn

Status: PARTIALLY ACCURATE

What the code says:

- Raw `Agent` supports `transformContext`, not `before_agent_start`. See `node_modules/@mariozechner/pi-agent-core/dist/agent.d.ts:18` and `node_modules/@mariozechner/pi-agent-core/dist/types.d.ts:51`.
- `AgentSession` uses `before_agent_start` only in the `pi-coding-agent` extension layer at `node_modules/@mariozechner/pi-coding-agent/dist/core/agent-session.js:581-603`.

Suggested corrections:

- Under Option A, inject state with `transformContext` or explicit pre-prompt `setSystemPrompt(...)`.
- Under Option B/C, `before_agent_start` is accurate.

##### Step 4: Agent menu bar entry

Status: PARTIALLY ACCURATE

What the code says:

- The app already has menu items to open the Wib&Wob Chat window in `src/core/menu-config.ts:53,99,121`.
- There is no current dedicated Agent operations menu for send/clear/model/tool toggles.

Suggested corrections:

- Reword this as “add a dedicated Agent operations menu,” not “add an Agent menu entry” as if none exists.

##### Step 5: Command registry commands

Status: PARTIALLY ACCURATE

What the code says:

- I did not find a current TS command registry with `wibwob_ask`, `get_chat_history`, `agent_status`, or `agent_clear`.
- This section is mostly forward-looking, not grounded in current implementation.

Suggested corrections:

- Mark this as speculative/future work.
- Tie it explicitly to whatever command-registry surface actually exists when implemented.

##### Step 6: Tool execution display

Status: PARTIALLY ACCURATE

What the code says:

- Current service only updates transient status on `tool_execution_start` / `tool_execution_end` in `src/services/wibwob-chat-service.ts:355-363`.
- Current window only renders `snapshot.messages` through `renderTranscript(...)`; it never renders `snapshot.status` inline in the window body. See `src/windows/wibwob-chat-window.ts:19-23,89-93`.
- `tool_execution_update` exists in the `AgentEvent` type but is not handled by the service. See `node_modules/@mariozechner/pi-agent-core/dist/types.d.ts:152-163` and `src/services/wibwob-chat-service.ts:318-386`.

Suggested corrections:

- Call out that new transcript state is required for tool call/result rows.
- Include `tool_execution_update` if the UI should show streaming tool progress.

##### Step 7: Control API integration

Status: PARTIALLY ACCURATE

What the code says:

- The current control API exposes only `POST /view/wibwob-chat/open` for this surface in `src/services/control-api.ts:145,222-224`.
- There are no current `/agent/send`, `/agent/status`, `/agent/history`, or `/agent/clear` endpoints.

Suggested corrections:

- This is a valid gap, but it should mention that current external control is “open-only,” not nonexistent.

#### Files touched

Status: PARTIALLY ACCURATE

What the code says:

- `src/services/wibwob-chat-service.ts`, `src/windows/wibwob-chat-window.ts`, `src/core/menu-config.ts`, `src/services/control-api.ts`, and `src/core/app-controller.ts` are reasonable target files.
- If the plan really wants “full” chat persistence, it also needs `src/core/workspace-snapshots.ts`. Current save/restore behavior for chat lives there in `src/core/workspace-snapshots.ts:50-57,157-163`.

Suggested corrections:

- Add `src/core/workspace-snapshots.ts` to the file list.

#### Dependencies

Status: PARTIALLY ACCURATE

What the code says:

- Both packages are installed and in use.
- The phrase “`@mariozechner/pi-agent-core` — Agent, tool definitions” is misleading. `pi-agent-core` exposes `AgentTool`; `ToolDefinition` is from `pi-coding-agent`.

Suggested corrections:

- Change this to:
  - `@mariozechner/pi-agent-core` — `Agent`, `AgentTool`, `transformContext`
  - `@mariozechner/pi-coding-agent` — `createAgentSession`, built-in coding tools, `ToolDefinition`, extension API

#### Risks

Status: PARTIALLY ACCURATE

What the code says:

- “If pi-agent-core doesn't support custom tools” is inaccurate. It does support them through `AgentTool[]` and `setTools(...)`. See `node_modules/@mariozechner/pi-agent-core/dist/agent.d.ts:119` and `node_modules/@mariozechner/pi-agent-core/dist/types.d.ts:126-128`.
- The more immediate risk is using the wrong tool type and wrong hook layer.

Suggested corrections:

- Replace the fallback risk with “If raw `Agent` proves too costly to extend cleanly, switch to `createAgentSession`.”

#### Success criteria

Status: PARTIALLY ACCURATE

What the code says:

- These outcomes are directionally sensible.
- “Chat history survives workspace save/load” is already partially true today for `draft` and `messages` in `src/core/workspace-snapshots.ts:50-57,157-163`.
- “Tool executions appear inline in the chat transcript” is not close to current behavior; it needs new transcript state and rendering, not only event subscription.

Suggested corrections:

- Clarify which fields must survive workspace save/load: `messages`, `draft`, `model`, and any tool transcript state.
