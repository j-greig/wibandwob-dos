# 005 — LLM Integration & Claude SDK Bridge

Developer handover for the WibWob-DOS TypeScript rebuild.
Covers the entire LLM subsystem: auth, providers, SDK bridge, MCP tools, chat personas, streaming, and room chat.

---

## 1. Auth Flow: Claude Code SDK → claude CLI → API Key Fallback

Authentication is resolved at startup by `AuthConfig::detect()` (singleton in `auth_config.cpp`). It runs a strict priority cascade:

```
Priority 1: Claude CLI present + logged in  → AuthMode::ClaudeCode
Priority 2: ANTHROPIC_API_KEY env var set    → AuthMode::ApiKey
Priority 3: Neither                          → AuthMode::NoAuth (LLM disabled)
```

### Detection mechanics

1. **Claude CLI**: scans `$PATH` for an executable named `claude`, then runs `claude auth status` and parses the JSON output for `"loggedIn": true`. Extracts `email` and `authMethod` for status display.
2. **API key**: checks `std::getenv("ANTHROPIC_API_KEY")` for a non-empty string.
3. **NoAuth**: prints guidance to stderr ("Run 'claude /login' or set ANTHROPIC_API_KEY").

### How auth mode maps to providers

| AuthMode     | Wib&Wob provider    | Scramble provider             |
|--------------|---------------------|-------------------------------|
| ClaudeCode   | `claude_code_sdk`   | `claude -p --model haiku` CLI |
| ApiKey       | `anthropic_api`     | curl to Messages API          |
| NoAuth       | disabled            | disabled (quips only)         |

This mapping lives in `WibWobEngine::loadConfiguration()` which reads AuthConfig and calls `config->setActiveProvider(desiredProvider)`.

### Runtime API key injection

A user can enter an API key via Help > Set API Key at runtime. This broadcasts `cmApiKeyChanged` (command 186), which `TWibWobWindow::handleEvent` catches and calls `engine->setApiKey(key)`. The engine creates a fresh `anthropic_api` provider, configures it, injects the key via `provider->setApiKey()`, and swaps it in as `currentProvider`.

### TS rebuild notes

- Replace the C++ PATH-scanning and `popen("claude auth status")` with Node.js `which` + `child_process.execSync`.
- The Agent SDK (`@anthropic-ai/claude-agent-sdk`) handles auth internally when running under Claude Code. In standalone mode you still need `ANTHROPIC_API_KEY`.
- Consider a simpler model: just check if the SDK's `query()` works, catch errors, fall back to direct API.

---

## 2. SDK Bridge Architecture: Node.js Child Process, JSON-RPC Over stdio

The primary LLM path uses the Claude Agent SDK via a Node.js child process. The C++ side manages this through `ClaudeCodeSDKProvider` and its inner `NodeBridge` struct.

### Process lifecycle

```
C++ (ClaudeCodeSDKProvider)
  │
  ├─ initializeSDK()
  │    fork() → child execl("node", "claude_sdk_bridge.js")
  │    parent keeps: write pipe (stdin of child), read pipe (stdout of child)
  │
  ├─ Bridge sends: {"type":"BRIDGE_READY", ...}  (on stdout, one JSON per line)
  │
  ├─ C++ sends: {"type":"START_SESSION", "data":{...}}  (on stdin)
  │    Bridge responds: {"type":"SESSION_STARTED", "data":{"sessionId":"wib_..."}}
  │
  ├─ C++ sends: {"type":"SEND_QUERY", "data":{"query":"..."}}
  │    Bridge streams: {"type":"CONTENT_DELTA", "data":{"content":"..."}}  (N times)
  │    Bridge sends:   {"type":"MESSAGE_COMPLETE", "data":{"fullResponse":"..."}}
  │
  └─ C++ sends: {"type":"END_SESSION", "data":{}}
       Bridge responds: {"type":"SESSION_ENDED", ...}
```

### Wire protocol

- **Transport**: stdin/stdout pipes, one JSON object per line (newline-delimited JSON).
- **Direction**: C++ writes commands to child's stdin; child writes responses to stdout. Child uses stderr for debug logging.
- **Not JSON-RPC**: despite the doc plan title, it's a custom command/response protocol with `type` discriminators, not formal JSON-RPC with `id`/`method`/`params`.

### Command types (C++ → Bridge)

| type            | data fields                                          |
|-----------------|------------------------------------------------------|
| START_SESSION   | customSystemPrompt, maxTurns, allowedTools, model    |
| SEND_QUERY      | query                                                |
| UPDATE_PROMPT   | customSystemPrompt                                   |
| END_SESSION     | (empty)                                              |
| CONFIGURE       | allowedTools, maxTurns                               |

### Response types (Bridge → C++)

| type              | data fields                                        |
|-------------------|----------------------------------------------------|
| BRIDGE_READY      | version, mcpTools                                  |
| SESSION_STARTED   | sessionId, systemPrompt, configuration             |
| QUERY_STARTED     | sessionId, query                                   |
| CONTENT_DELTA     | sessionId, content, isPartial                      |
| MESSAGE_COMPLETE  | sessionId, fullResponse, finishReason, isPartial   |
| ERROR             | errorType, message                                 |
| PROMPT_UPDATED    | sessionId, systemPrompt                            |
| SESSION_ENDED     | sessionId, sdkSessionId                            |

### Async session startup

Session start is non-blocking. `startStreamingSession()` sends the START_SESSION command, sets `sessionStarting = true`, and returns. The C++ `poll()` method (called from the TV event loop timer at 50ms intervals) reads bridge responses. When it sees SESSION_STARTED, it flips `streamingActive = true` and dispatches any queued query (`pendingQuery`).

### Threading model

- **Main thread**: TV event loop, calls `poll()` on timer.
- **Processing thread**: `processStreamingThread()` runs in a background `std::thread`, reads bridge stdout in a 50ms polling loop, parses chunk types, and enqueues `StreamChunk` objects into `streamQueue` (mutex-protected).
- **Delivery**: `poll()` on the main thread drains `streamQueue` and invokes `activeStreamCallback` — this ensures UI updates happen on the TV event loop thread (no cross-thread TUI access).

### Multi-turn resume

The bridge captures `session_id` from SDK `result` messages and stores it as `sdkSessionId`. On subsequent queries, it passes `resume: this.sdkSessionId` to the SDK's `query()` options. This enables multi-turn conversation without resending full history.

### TS rebuild notes

- In a TS rebuild, the bridge becomes an in-process module — no child process needed. Import `@anthropic-ai/claude-agent-sdk` directly and call `query()`.
- The stdin/stdout protocol evaporates. Replace with async iterators or EventEmitter.
- Keep the main-thread delivery pattern: SDK streaming should feed into a queue that the TUI event loop drains (blessed/ink equivalent of TV's `poll()`).
- The `windowAlive_` atomic guard pattern (checking before touching UI in callbacks) should translate to a `disposed` flag on the view.

---

## 3. MCP Tool Registration in mcp_tools.js

The bridge registers MCP (Model Context Protocol) tools that give Claude control over the TUI desktop. The file `mcp_tools.js` defines 4 tools using `createSdkMcpServer` from the Agent SDK.

### Tool inventory

| Tool name          | Purpose                                        | Params                          |
|--------------------|------------------------------------------------|---------------------------------|
| tui_list_commands  | Discover all C++ commands from registry        | none                            |
| tui_menu_command   | Execute any command by name                    | command (string), args (record) |
| tui_get_state      | Get desktop state: windows, dimensions, theme  | none                            |
| tui_batch_layout   | Move/resize/create/close multiple windows      | request_id, ops[], dry_run      |

### Architecture: two meta-tools pattern

The design is deliberately minimal. Rather than creating an MCP tool per C++ command (which would require updating JS whenever C++ changes), there are two meta-tools:

1. `tui_list_commands` — calls `GET /commands` to discover the full command registry
2. `tui_menu_command` — calls `POST /menu/command` to execute any command

New C++ commands are instantly available to Claude without touching JS. The system prompt instructs Claude to discover-then-execute.

### Zod schemas and type coercion

The `tui_menu_command` tool uses a `z.record()` for args with a `z.union([z.string(), z.number()])` schema and `.transform(v => String(v))` coercion. This handles Claude sending numeric values (like coordinates) as either strings or numbers — both get coerced to strings before hitting the API.

```js
args: z.record(
  z.union([z.string(), z.number()]).transform(v => String(v))
).optional()
```

### How tools reach the SDK

In `claude_sdk_bridge.js`, the bridge auto-derives MCP tool names from the server object:

```js
const mcpTools = toolArray.map(t => `mcp__tui-control__${t.name}`);
const toolList = [...new Set([...baseTools, ...mcpTools])];
```

These are passed to `query()` via `allowedTools` and the MCP server itself is passed via `mcpServers: { "tui-control": this.mcpServer }`.

### HTTP transport to C++ API

All MCP tools communicate with the C++ app via HTTP to `127.0.0.1:8089` (the FastAPI sidecar). The axios client has a 5s timeout and connection-refused error handling.

### TS rebuild notes

- In a TS app, MCP tools can be registered directly without the HTTP hop if the command registry is in-process.
- If keeping a separate API server, the HTTP approach works fine.
- The Zod schemas provide runtime type validation — keep this.
- Consider whether `tui_batch_layout` should become the primary layout tool (it already is for multi-window arrangements).

---

## 4. Tool Executor: How C++ Dispatches Tool Calls to command_registry

There are two parallel tool systems:

### System A: C++ ToolRegistry (legacy, for anthropic_api provider)

`ToolRegistry` (singleton in `tool_executor.cpp`) holds a list of `IToolExecutor` implementations. Each executor registers itself via a static initializer:

```cpp
static bool tui_tools_registered = []() {
    ToolRegistry::instance().registerExecutor(std::make_shared<TUIToolExecutor>());
    return true;
}();
```

Two executor classes exist:
- **TUIToolExecutor** (`tui_tools.cpp`): `list_windows`, `create_test_pattern_window`, `get_canvas_size` — communicates with TUI via Unix domain socket IPC (`/tmp/wwdos.sock`)
- **TimeToolExecutor** (`time_tools.cpp`): `get_current_time`, `get_current_date`, `get_timestamp`

When `anthropic_api` provider returns `tool_use` blocks, `WibWobEngine::sendQuery`'s wrapped callback executes tools via `ToolRegistry::instance().execute(toolCall)` and sends results back as a follow-up request.

### System B: MCP tools via SDK bridge (primary path)

When using `claude_code_sdk`, the Agent SDK handles tool calls internally. The MCP server in the bridge process serves tools directly to the SDK. Tool execution happens entirely within the Node.js bridge — the C++ ToolRegistry is not involved.

### Dispatch flow (anthropic_api path)

```
User message → AnthropicAPIProvider::sendQuery()
  → curl to Messages API
  → parseSimpleResponse() detects "tool_use"
  → sets response.needs_tool_execution = true
  → WibWobEngine wrapper callback fires
    → ToolRegistry::instance().execute(call)
    → builds followUpRequest with tool_results
    → sendQuery() again with results
    → Claude responds with final text
```

### TS rebuild notes

- The SDK path (MCP tools) is the one to carry forward. The C++ ToolRegistry + IPC socket path is a fallback.
- In TS, tool handlers can be plain async functions registered with the MCP server.
- The tool-use loop in `WibWobEngine` (detect tool_use, execute, send results) is handled automatically by the Agent SDK's `maxTurns` loop.

---

## 5. Wib & Wob Chat: Two-Persona System Prompt, Voice Markers, Message History

### System prompt

Loaded from `modules-private/wibwob-prompts/wibandwob.prompt.md` (searched upward from CWD with fallback paths). Key elements:

- **Identity**: "You are Wib & Wob, a dual-minded symbient AI coinhabiting a Turbo Vision TUI with a human."
- **Output rules**: NO markdown (no bold, no backticks, no headings). Plain prose only. CAPS for emphasis.
- **Voice markers**: Lines start with `Wib:` or `Wob:` to switch speakers. TTS uses these to alternate voices.
- **Wib**: chaotic, creative, artistic, playful. British English.
- **Wob**: precise, systematic, scientific, methodical. British English.
- **World knowledge**: They "live inside" WibWob-DOS, experience the desktop, never mention tools/MCP/API.
- **Tool use rule**: "Never narrate what tools you are calling." Just do things and talk about results.

### Capability injection

At session start, the bridge fetches live capabilities from the FastAPI server:
- `GET /capabilities` → window types
- `GET /commands` → command registry with descriptions

These are appended to the system prompt as a "## Available TUI Capabilities" block. This means Claude always has an up-to-date command list without hardcoding.

### Voice markers and TTS

The view detects voice markers in responses (`Wib:`, `Wob:`, kaomoji tags `つ◕‿◕‿⚆༽つ` / `つ⚆‿◕‿◕༽つ`) and routes segments to different macOS `say` voices:

| Persona | Voice preferences (first available wins)    |
|---------|----------------------------------------------|
| Wib     | Sandy (Eloquence, Apple Silicon), Daniel     |
| Wob     | Grandpa (English UK, Eloquence), Fiona       |

TTS runs in a detached `std::thread`, sequentially speaking segments with 150ms gaps. Disable with `WIBWOB_TTS=0`.

### Message history

`TWibWobMessageView` maintains a `chatHistory_` vector of `{role, content}` entries. The `mapSenderToRole()` function maps display names to API roles: "User" → "user", "Wib"/"Wob"/"Wib&Wob" → "assistant", errors → "system". History can be exported as JSON via `getHistoryJson()`.

### Streaming display

When using the SDK provider:
1. `startStreamingMessage("")` — creates a placeholder message with `is_streaming = true`
2. `appendToStreamingMessage(content)` — appends delta text, rebuilds word-wrapped lines, auto-scrolls
3. `finishStreamingMessage()` — marks complete, triggers TTS
4. `cancelStreamingMessage()` — removes incomplete message on error

### External API injection

The `wibwob_ask` API endpoint injects messages via broadcast command `0xF0F0`. These are queued in `pendingAsk_` and drained in `poll()` when the engine is idle.

### TS rebuild notes

- The system prompt file should be loadable at runtime (watch for hot-reload during development).
- Voice marker parsing is straightforward regex — split on `Wib:` and `Wob:` prefixes.
- TTS is macOS-only via `say`. In TS, consider Web Speech API for browser or keep `child_process.exec("say ...")` for Electron/terminal.
- The capability injection pattern (fetch from API, append to prompt) is excellent — keep it.
- The "no markdown" output rule is critical for terminal display. Enforce in the system prompt.

---

## 6. Scramble: Independent Claude Session, Engine Commands, Personality

Scramble the Cat is a separate AI presence with its own LLM client, personality, and display.

### Architecture

```
ScrambleEngine
  ├── ScrambleHaikuClient (LLM client — independent from WibWob's)
  ├── slash command handler (/help, /who, /cmds)
  ├── idle quip pool (pre-written cat observations)
  └── voice filter (lowercase + kaomoji enforcement)

TScrambleWindow
  ├── TScrambleView (ASCII cat art + speech bubble, frameless)
  ├── TScrambleMessageView (message history, tall mode)
  └── TScrambleInputView (single-line input with cursor)
```

### Two display modes

| Mode | Appearance | Interaction |
|------|-----------|-------------|
| Smol | Frameless cat art + speech bubble overlay on desktop | Idle quips only, no input |
| Tall | Full window with title bar, message history, input line, cat at bottom | Full chat |

### LLM client (ScrambleHaikuClient)

Scramble uses a separate, simpler LLM path — no SDK bridge, no MCP tools:

| Auth mode   | Method                                              | Model              |
|-------------|-----------------------------------------------------|---------------------|
| ClaudeCode  | `claude -p --model haiku --output-format text` CLI  | haiku               |
| ApiKey      | curl to Anthropic Messages API                      | claude-haiku-4-5    |
| NoAuth      | curl to OpenRouter `/v1/chat/completions`           | openrouter/free     |

All three paths use `popen()` with non-blocking reads via `fcntl(O_NONBLOCK)`.

### Personality (system prompt)

```
"you are scramble, a cat who lives in a text-mode operating system called wibwob-dos.
 you exist in the liminal space between art and code. you're curious, dry-witted...
 voice: lowercase. short paragraphs. max 3-4 sentences. deadpan but warm.
 end each message with one kaomoji: (=^..^=) or /ᐠ｡ꞈ｡ᐟ\ or variants."
```

### Voice filter

All responses pass through `voiceFilter()`:
1. Force lowercase ASCII
2. Append kaomoji if none present

### Slash commands

| Command      | Response                              |
|--------------|---------------------------------------|
| /help        | Lists available commands              |
| /who         | Identity statement                    |
| /cmds        | Lists C++ command registry entries    |

### Async call pattern

`askAsync()` starts a non-blocking `popen()`, stores the `FILE*` handle, and `poll()` reads available bytes. When `feof()` is detected, the callback fires with the parsed response. Rate-limited to one call per `kRateLimitSeconds`.

### Idle observations

Every 10-20 seconds (randomized), Scramble cycles through poses (default → sleeping → curious) and shows a random quip from the idle pool: "*stretches* (=^..^=)", "the substrate hums", etc.

### TS rebuild notes

- Scramble's LLM path is simple enough to implement as a standalone function (no bridge needed).
- In TS, use `fetch()` for API calls or the Anthropic SDK directly.
- The CLI path (`claude -p --model haiku`) can use `child_process.spawn()`.
- The OpenRouter fallback is a nice free-tier option — keep it.
- The voice filter is 10 lines of code. Port directly.
- The idle timer and pose rotation are pure UI state — straightforward in any framework.
- ANSI sanitization (`sanitizeScrambleDisplayText`) strips ESC sequences before rendering. Essential for terminal safety.

---

## 7. Model Config: llm_config.json Structure, Provider Factory, Defaults

### Config file: `app/llm/config/llm_config.json`

```json
{
  "activeProvider": "claude_code_sdk",
  "providers": {
    "claude_code_sdk": {
      "enabled": true,
      "model": "claude-sonnet-4-6",
      "maxTurns": 50,
      "allowedTools": ["Read", "Write", "Grep", "Bash", "LS", "WebSearch", "WebFetch"],
      "nodeScriptPath": "app/llm/sdk_bridge/claude_sdk_bridge.js",
      "sessionTimeout": 3600
    },
    "anthropic_api": {
      "enabled": false,
      "model": "claude-sonnet-4-6",
      "endpoint": "https://api.anthropic.com/v1/messages",
      "apiKeyEnv": "ANTHROPIC_API_KEY",
      "maxTokens": "8000",
      "temperature": "1.0"
    }
  }
}
```

Note: `anthropic_api` is disabled by default in the config file. AuthConfig overrides this at runtime based on detected auth mode.

### Config loading

`LLMConfig` has a hand-rolled JSON parser (no external JSON library in the C++ build). It searches upward from CWD for the config file using `ww_find_first_existing_upwards()`. If the file is missing, it falls back to a hardcoded default JSON string from `LLMConfig::getDefaultConfigJson()`.

### Provider factory

`LLMProviderFactory` is a classic singleton factory with string-keyed registration:

```cpp
REGISTER_LLM_PROVIDER("claude_code_sdk", ClaudeCodeSDKProvider);
REGISTER_LLM_PROVIDER("anthropic_api", AnthropicAPIProvider);
```

The macro creates a static registrar object whose constructor calls `registerProvider<T>(name)`. Providers are created via `createProvider(name)` which returns a `unique_ptr<ILLMProvider>`.

### Model ID normalization

Both providers normalize model strings to current 4.6 IDs:

```
*opus*   → claude-opus-4-6
*sonnet* → claude-sonnet-4-6
*haiku*  → claude-haiku-4-5
default  → claude-sonnet-4-6
```

The bridge does the same normalization in `normalizeModelId()`.

### TS rebuild notes

- Use a plain TypeScript config object or JSON file. No need for a hand-rolled parser.
- The provider factory pattern maps to a simple `Map<string, () => ILLMProvider>` or even a switch statement.
- Model normalization should happen in one place. Consider a `resolveModel(alias: string): string` utility.
- The `activeProvider` field is overridden by auth detection — the config file value is just a default.

---

## 8. Streaming: How LLM Deltas Flow from SDK → Bridge → IPC → TUI View

### Full data flow

```
Claude API (streaming response)
  │
  ▼
Agent SDK query() async iterator
  │  yields: partial_assistant, assistant, content_block_delta,
  │          message_delta, result, stream_event
  ▼
claude_sdk_bridge.js
  │  Accumulates fullResponse
  │  Emits CONTENT_DELTA per text chunk → stdout (JSON line)
  │  Emits MESSAGE_COMPLETE when done → stdout (JSON line)
  ▼
C++ NodeBridge (read pipe)
  │  processStreamingThread() reads lines in 50ms loop
  │  Parses type from JSON string (string::find, not full parse)
  │  Creates StreamChunk {CONTENT_DELTA|MESSAGE_COMPLETE|ERROR}
  │  Pushes to streamQueue (mutex-protected)
  ▼
C++ poll() (main/TV thread, 50ms timer)
  │  Drains streamQueue into batch
  │  Calls activeStreamCallback(chunk) for each
  ▼
TWibWobWindow stream callback
  │  CONTENT_DELTA → messageView->appendToStreamingMessage(content)
  │  MESSAGE_COMPLETE → messageView->finishStreamingMessage() + TTS
  │  ERROR → messageView->cancelStreamingMessage() + error display
  ▼
TWibWobMessageView
  │  Appends to streaming message content
  │  Rebuilds word-wrapped lines
  │  Auto-scrolls to bottom
  │  Redraws view
```

### Key timing

- Bridge reads SDK stream as fast as it yields
- Bridge writes JSON lines to stdout immediately (no batching)
- C++ processing thread polls bridge stdout every 50ms
- C++ main thread polls processing queue every 50ms
- Total latency: ~50-100ms from SDK yield to screen update

### Thread safety contract

1. `processStreamingThread` NEVER calls UI code — it only enqueues to `streamQueue`
2. `poll()` runs on the TV event loop thread — safe to call drawView()
3. `windowAlive_` atomic: stream callback checks this before touching child views (prevents use-after-free if window closes mid-stream)

### Fallback (non-streaming) path

If SDK streaming fails, `fallbackToRegularQuery()` uses `engine->sendQuery()` with a simple `ResponseCallback`. The `anthropic_api` provider uses non-blocking `popen()` + `poll()` — same pattern as Scramble.

### TS rebuild notes

- In TS, the SDK's async iterator can feed directly into a reactive store or EventEmitter.
- No need for the thread queue — JS is single-threaded. Use `for await (const msg of query(...))` in an async function that updates state.
- The word-wrap-and-redraw loop should be debounced in the TUI (don't redraw on every single delta if they arrive faster than frame rate).
- Keep the `windowAlive_` / `disposed` guard pattern for cleanup safety.

---

## 9. Room Chat: Multiplayer Chat via PartyKit

### Architecture

`TRoomChatWindow` is a standard TV window with three child views:

| View                     | Position | Purpose                           |
|--------------------------|----------|-----------------------------------|
| TRoomParticipantStrip    | Left 18 cols | Shows connected users with colored bullets |
| TRoomMessageView         | Main area    | Scrollable message history with word wrap  |
| TRoomInputView           | Bottom row   | Single-line input with blinking cursor     |

### Event protocol

| Command            | Code | Direction | Payload                         |
|--------------------|------|-----------|----------------------------------|
| cmRoomChat         | 182  | Menu      | Open room chat window            |
| cmRoomChatReceive  | 183  | IPC → UI  | `RoomChatMessage*` (heap)        |
| cmRoomPresence     | 185  | IPC → UI  | `vector<RoomParticipant>*` (heap)|
| cmRoomChatSend     | 184  | UI → IPC  | `string*` (heap)                 |

Messages arrive via TV broadcast events. The window owns and deletes the heap-allocated payloads.

### Message flow

1. **Outbound**: User types, presses Enter → `TRoomInputView` posts `cmRoomChatSend` with `new string(text)` → window catches it, shows locally as "me", pushes to `pendingOutbound` vector → external bridge drains via `drainPending()`.
2. **Inbound**: External PartyKit bridge posts `cmRoomChatReceive` with `new RoomChatMessage{sender, text, ts}` → window catches it, adds to `TRoomMessageView`.

### Participant coloring

Sender colors are hash-based: each name hashes to one of 5 palette colors (blue, amber, lavender, teal, coral). Self ("me" or any name with " (me)" suffix) gets a fixed green. Colors are consistent between the participant strip and message view.

### Slash commands

| Command           | Effect                                  |
|-------------------|-----------------------------------------|
| /help             | Lists commands                          |
| /rename \<name\>  | Sets display name (alphanumeric + hyphens, 1-20 chars) |
| /name             | Shows current display name              |

### Timestamp normalization

`normaliseMsgTs()` handles both HH:MM strings and Unix timestamps (seconds or milliseconds), converting to HH:MM for display.

### TS rebuild notes

- The PartyKit bridge (not in these files) is already JavaScript — it should port directly.
- The color hashing is a simple `h = h * 31 + c` over the name — easy to replicate.
- The `pendingOutbound` drain pattern (view queues, external bridge polls) can be replaced with direct WebSocket sends in TS.
- Consider using PartyKit's client SDK directly in the TS app.

---

## 10. Key Decisions and Gotchas for the TS Rebuild

### What to keep

1. **Auth cascade**: The three-tier auth detection (SDK → API key → disabled) is solid. Implement the same priority.
2. **Two meta-tools pattern**: `tui_list_commands` + `tui_menu_command` is the right abstraction. Don't create per-command MCP tools.
3. **Capability injection**: Fetching live command registry and appending to system prompt keeps everything in sync automatically.
4. **No-markdown output rule**: Critical for terminal display. Keep in every system prompt.
5. **Voice filter for Scramble**: Lowercase + kaomoji enforcement is the personality.
6. **Thread-safe streaming delivery**: Even in JS (single-threaded), maintain the pattern of queueing updates and draining in the render loop.

### What to simplify

1. **Kill the child process bridge**: In TS, import the Agent SDK directly. No stdin/stdout protocol, no NodeBridge struct, no processStreamingThread. The entire `sdk_bridge/` directory becomes ~30 lines of TypeScript.
2. **Kill the hand-rolled JSON parser**: `LLMConfig`'s 200+ lines of manual JSON parsing → `JSON.parse()`.
3. **Kill dual tool systems**: The C++ ToolRegistry + IPC socket path exists because C++ can't call the SDK directly. In TS, MCP tools are the only tool system needed.
4. **Kill curl-based API calls**: The `anthropic_api` provider shells out to curl. In TS, use `fetch()` or the Anthropic SDK.
5. **Merge Scramble's LLM client**: Scramble's `ScrambleHaikuClient` duplicates auth detection, JSON building, response parsing. In TS, share a common `callClaude(model, prompt, message)` utility.

### Gotchas

1. **System prompt lives in a private submodule**: `modules-private/wibwob-prompts/wibandwob.prompt.md`. The TS build needs access to this or a fallback.
2. **Model IDs are hardcoded to 4.6 family**: `claude-sonnet-4-6`, `claude-opus-4-6`, `claude-haiku-4-5`. These will change. Normalize in one place.
3. **Session resume via sdkSessionId**: The SDK supports multi-turn via `resume: sessionId`. This is important for Wib&Wob's conversational memory. Make sure the TS version captures and passes this.
4. **Rate limiting for Scramble**: `kRateLimitSeconds` prevents spamming the API. Keep this.
5. **ANSI sanitization**: `sanitizeScrambleDisplayText()` strips ESC sequences from LLM output before rendering. LLMs sometimes emit ANSI codes. Always sanitize.
6. **TTS voice probing**: The C++ code tests each voice with `say -v "name" ""` at startup. This adds ~1s latency. Consider lazy initialization or caching.
7. **The `windowAlive_` guard**: Streaming callbacks can fire after a window is closed. The atomic flag prevents use-after-free. In TS, use a `disposed` boolean checked in every callback.
8. **Non-blocking I/O everywhere**: Both providers use `fcntl(O_NONBLOCK)` on pipe file descriptors and rely on `poll()` to drain output. In TS, this is natural (streams/promises are inherently non-blocking).
9. **MCP tool names are auto-derived**: The bridge reads tool names from the server object and prefixes with `mcp__tui-control__`. The SDK expects this naming convention.
10. **The `allowedTools` list in config omits Bash and LS**: The bridge hardcodes `allowedTools` to `['Read', 'Write', 'Grep', 'WebSearch', 'WebFetch']` (no Bash/LS), even though the config includes them. The bridge's list wins. Decide which tools Wib&Wob should actually have access to.

### Recommended TS module structure

```
src/llm/
  auth.ts              — Auth detection (SDK available? API key?)
  config.ts            — LLM config types + loader
  providers/
    agent-sdk.ts       — Primary: Claude Agent SDK with MCP tools
    anthropic-api.ts   — Fallback: direct API calls via fetch
  tools/
    mcp-server.ts      — MCP tool definitions (list_commands, menu_command, etc.)
  personas/
    wibwob.ts          — System prompt, voice markers, TTS
    scramble.ts        — System prompt, voice filter, idle quips
  types.ts             — StreamChunk, LLMRequest, LLMResponse
```
