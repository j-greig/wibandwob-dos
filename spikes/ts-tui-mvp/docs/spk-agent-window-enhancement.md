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
