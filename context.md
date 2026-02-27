# MCP Tools Layer Audit - WibWob-DOS

## Executive Summary

The WibWob-DOS embedded Claude Code SDK agent receives **only 2 MCP tools** for TUI control, plus a fixed set of **5 allowed tools** (Read, Write, Grep, WebSearch, WebFetch). The system prompt is built in **three stages**: (1) loaded from markdown file or hardcoded fallback, (2) passed to SDK bridge via C++, (3) enriched with live capabilities from the API. The entire flow is **non-blocking async** with proper session lifecycle management.

---

## Files Retrieved

1. **`app/llm/sdk_bridge/mcp_tools.js`** (lines 1-87) - MCP server definition with 2 tools
2. **`app/llm/sdk_bridge/claude_sdk_bridge.js`** (lines 1-500) - Main SDK bridge: session lifecycle, prompt injection, streaming
3. **`app/llm/providers/claude_code_sdk_provider.cpp`** (lines 1-400 + streaming logic) - C++ side: process forking, command queuing, session start
4. **`app/wibwob_view.cpp`** (lines 658-688) - Initial system prompt loading and engine initialization
5. **`app/llm/base/illm_provider.h`** (lines 1-87) - LLMRequest/Response structures defining system_prompt field

---

## Key Code Artifacts

### 1. The Two MCP Tools (mcp_tools.js)

```javascript
tools: [
    tool(
        "tui_list_commands",
        "Discover ALL available TUI commands with descriptions and parameter hints. Call this FIRST...",
        {},
        async () => {
            const response = await apiClient.get('/commands');
            return mcpResult(JSON.stringify(response.data, null, 2));
        }
    ),

    tool(
        "tui_menu_command",
        "Execute any TUI command by name. Use tui_list_commands first...",
        {
            command: z.string().describe("Command name from tui_list_commands"),
            args: z.record(z.string()).optional().describe("Command arguments as key-value pairs")
        },
        async (params) => {
            const payload = { command: params.command };
            if (params.args && Object.keys(params.args).length > 0) {
                payload.args = params.args;
            }
            const response = await apiClient.post('/menu/command', payload);
            return mcpResult(JSON.stringify(response.data, null, 2));
        }
    ),
]
```

**Key Properties:**
- Both hit **localhost:8089** (FastAPI backend)
- `tui_list_commands` returns the live C++ command registry (no params needed)
- `tui_menu_command` executes any command by name with optional key-value args
- MCP server name: **`tui-control`**
- Version: **`3.0.0`**

### 2. System Prompt Construction Flow

#### Stage 1: Initial Load (wibwob_view.cpp)
```cpp
// Search upward for custom prompt file
const std::vector<std::string> promptCandidates = {
    "modules-private/wibwob-prompts/wibandwob.prompt.md",
    // ... other candidates
};

if (promptFile is found && opens successfully) {
    customPrompt = std::string(
        (std::istreambuf_iterator<char>(promptFile)),
        std::istreambuf_iterator<char>()
    );
    engine->setSystemPrompt(customPrompt);
} else {
    // Hardcoded fallback
    engine->setSystemPrompt(
        "You are wib&wob, a dual-minded artist/scientist AI assistant integrated into a Turbo Vision TUI application. "
        "Respond as both Wib (chaotic, artistic) and Wob (precise, scientific). "
        "Help with TVision framework, C++ development, and creative projects. "
        "Use British English and maintain your distinctive personalities."
    );
}
```

#### Stage 2: Send to SDK Bridge (claude_code_sdk_provider.cpp)
```cpp
// In startStreamingSession():
std::string escapedPrompt = escapeJsonString(customSystemPrompt);

std::ostringstream command;
command << R"({"type":"START_SESSION","data":{"customSystemPrompt":")"
        << escapedPrompt << R"(","maxTurns":)" << maxTurns
        << R"(,"allowedTools":["Read","Write","Grep","WebSearch","WebFetch"],"model":")"
        << configuredModel << R"("}})";

nodeBridge->sendCommand(cmdStr);
```

**Note:** C++ hardcodes `allowedTools` to `["Read","Write","Grep","WebSearch","WebFetch"]` — **no MCP tools are listed here**. MCP tools are registered separately in the SDK options.

#### Stage 3: Bridge Enriches Prompt (claude_sdk_bridge.js)
```javascript
async _injectCapabilities() {
    try {
        // Retry up to 3 times (API may be starting)
        const resp = await axios.get('http://127.0.0.1:8089/capabilities', { timeout: 5000 });
        const caps = resp.data;
        
        const windowTypes = (caps.window_types || []).map(t => t.name || t).join(', ');
        const commands = (caps.commands || []).map(c => c.name || c).join(', ');
        
        const block = [
            '',
            '## Available TUI Capabilities (auto-derived from C++ registry)',
            '',
            '### Window Types (use with tui_create_window tool)',
            windowTypes || '(none)',
            '',
            '### Commands (available as tui_* tools)',
            commands || '(none)',
            ''
        ].join('\n');
        
        this.systemPrompt = (this.systemPrompt || '') + '\n' + block;
    } catch (err) {
        console.error(`[BRIDGE] Capabilities fetch failed (API may not be running): ${err.message}`);
    }
}
```

This **appends** a markdown section listing all live window types and commands to the system prompt, so the agent knows what's available without scanning.

### 3. System Prompt in SDK Session Start (claude_sdk_bridge.js)

```javascript
async startSession(data) {
    // Accept both old ('customSystemPrompt') and new ('systemPrompt') names
    this.systemPrompt = data.systemPrompt || data.customSystemPrompt;
    
    console.error('DEBUG: Starting session with systemPrompt length:', this.systemPrompt?.length || 0);
    
    // Stage 3: Inject live capabilities from API
    await this._injectCapabilities();
    
    // Store configuration for query use
    this.sessionConfig = {
        systemPrompt: this.systemPrompt,
        maxTurns: data.maxTurns || this.maxTurns,
        allowedTools: data.allowedTools || this.allowedTools,
        model: data.model || 'claude-haiku-4-5'
    };
    
    this.sendResponse('SESSION_STARTED', {
        sessionId: this.sessionId,
        systemPrompt: this.systemPrompt,
        configuration: this.sessionConfig
    });
}
```

### 4. MCP Tools Registration (claude_sdk_bridge.js)

```javascript
async sendQuery(data) {
    // Build allowed tools list — auto-derive MCP tool names from the server
    const baseTools = this.sessionConfig.allowedTools || [];
    let mcpTools = [];
    if (this.mcpServer && this.mcpServer.tools) {
        const toolArray = Array.isArray(this.mcpServer.tools)
            ? this.mcpServer.tools
            : Object.values(this.mcpServer.tools);
        mcpTools = toolArray.map(t => {
            const name = t.name || t.toolName || (typeof t === 'string' ? t : '');
            return `mcp__tui-control__${name}`;
        }).filter(n => n !== 'mcp__tui-control__');
        console.error(`[BRIDGE] Auto-derived ${mcpTools.length} MCP tool names from server`);
    }
    const toolList = [...new Set([...baseTools, ...mcpTools])];
    
    const queryOptions = {
        systemPrompt: this.systemPrompt,
        maxTurns: this.sessionConfig.maxTurns,
        model: modelId,
        allowedTools: toolList,
        permissionMode: 'bypassPermissions',
        allowDangerouslySkipPermissions: true,
        includePartialMessages: true,
        // Only add MCP servers if server was successfully created
        mcpServers: this.mcpServer ? { "tui-control": this.mcpServer } : undefined
    };
}
```

**This derives the full tool list:**
- Base: `["Read", "Write", "Grep", "WebSearch", "WebFetch"]` (from C++)
- MCP auto-derived: `["mcp__tui-control__tui_list_commands", "mcp__tui-control__tui_menu_command"]`
- **Final allowed list:** 7 tools total

---

## Full Flow: User Message → Tool Execution

### Initialization Phase (App Startup)

1. **C++ TUI (wibwob_view.cpp) initializes WibWobEngine:**
   - Attempts to load system prompt from `modules-private/wibwob-prompts/wibandwob.prompt.md` (searched upward)
   - If not found, uses hardcoded wib&wob dual-mind fallback
   - Calls `engine->setSystemPrompt(prompt)`

2. **C++ creates ClaudeCodeSDKProvider instance:**
   - Constructor checks for Node.js and bridge script availability
   - Does **not** spawn bridge yet (lazy init)
   - Initializes fallback provider (Anthropic API)

### User Sends Query (TUI Input → Chat)

3. **C++ receives user input, constructs LLMRequest:**
   ```cpp
   LLMRequest request;
   request.message = userQuery;
   request.system_prompt = engine->getSystemPrompt();  // The 2-3 stage prompt
   request.tools = /* available tools */;
   ```

4. **C++ calls `sdkProvider->sendStreamingQuery()`:**
   - If session not active, calls `startStreamingSession(request.system_prompt)` first

### Session Startup (Non-blocking)

5. **C++ `startStreamingSession()` in background:**
   - Checks if Node.js bridge already running (lazy init)
   - Spawns Node.js bridge if needed (fork + pipe setup)
   - **Escapes system prompt for JSON** (handles quotes, newlines, control chars)
   - Builds START_SESSION command:
     ```json
     {
       "type": "START_SESSION",
       "data": {
         "customSystemPrompt": "...escaped prompt...",
         "maxTurns": 50,
         "allowedTools": ["Read","Write","Grep","WebSearch","WebFetch"],
         "model": "claude-haiku-4-5"
       }
     }
     ```
   - **Sends command non-blocking via pipe** (no wait)
   - Sets `sessionStarting = true`
   - Returns immediately

6. **C++ polls in `poll()` method (game loop):**
   - Reads bridge response line-by-line
   - Waits for `SESSION_STARTED` response (includes sessionId)
   - Extracts `sessionId` from response JSON

7. **Bridge (Node.js) receives START_SESSION:**
   - Parses JSON command
   - Stores `systemPrompt`, `allowedTools`, `model`, `maxTurns`
   - **Calls `_injectCapabilities()`** to enrich prompt:
     - Fetches `/capabilities` from FastAPI (localhost:8089)
     - Appends markdown section listing window types + commands
     - Gracefully skips if API not ready (retries 3x with 2s delays)
   - Sends `SESSION_STARTED` response with enriched systemPrompt + sessionId

### Query Execution

8. **C++ ready to send query (sessionStarting now false, streamingActive = true)**

9. **C++ sends SEND_QUERY command:**
   ```json
   {
     "type": "SEND_QUERY",
     "data": {
       "query": "...escaped user message..."
     }
   }
   ```

10. **Bridge receives SEND_QUERY:**
    - Builds allowed tools list:
      - Base tools: `["Read", "Write", "Grep", "WebSearch", "WebFetch"]`
      - MCP tools: Auto-derived from `mcp_tools.js` → `["mcp__tui-control__tui_list_commands", "mcp__tui-control__tui_menu_command"]`
    - Calls Claude Agent SDK `query()`:
      ```javascript
      for await (const message of this.queryFn({
          prompt: promptStream,  // User message as async generator
          options: {
              systemPrompt: this.systemPrompt,  // 3-stage enriched prompt
              maxTurns: 50,
              model: 'claude-haiku-4-5',
              allowedTools: [all 7 tools],
              mcpServers: { "tui-control": this.mcpServer }
          }
      })) {
          // Handle response messages (streaming)
      }
      ```

11. **Claude processes request with full tool context:**
    - System prompt includes wib&wob persona + live capabilities section
    - Allowed tools: 5 code tools + 2 MCP tools
    - MCP tools can call `tui_list_commands` and `tui_menu_command`

12. **If Claude calls an MCP tool (e.g., `tui_menu_command`):**
    - Bridge's `mcp_tools.js` intercepts via `createSdkMcpServer`
    - Executes tool function:
      ```javascript
      const payload = { command: params.command, args: params.args };
      const response = await apiClient.post('/menu/command', payload);  // → FastAPI
      return mcpResult(JSON.stringify(response.data, null, 2));
      ```
    - Returns result to Claude for next reasoning step

13. **Streaming response back to C++:**
    - Bridge emits deltas as `CONTENT_DELTA` messages
    - C++ `processStreamingThread()` reads from pipe, queues chunks
    - C++ `poll()` delivers chunks to UI callback on main thread
    - Streaming continues until `MESSAGE_COMPLETE` or error

14. **Session End (cleanup):**
    - User closes chat window or session times out
    - C++ calls `endSession()`
    - Bridge cleans up state, NodeBridge remains running for next query
    - Session ID reset for next fresh start

---

## Tool Capabilities Breakdown

### MCP Tools (TUI Control)

| Tool | Params | Backend | Returns |
|------|--------|---------|---------|
| `tui_list_commands` | None | GET `/commands` | JSON: all C++ registry commands with descriptions & hints |
| `tui_menu_command` | `command` (string), `args` (key-value map) | POST `/menu/command` | JSON: command result or error detail |

**Coverage:** Everything in C++ command registry (window management, app launch, text rendering, canvas paint, screenshots, themes, etc.)

### Allowed Code Tools (from C++)

- **Read:** File read (text/image support)
- **Write:** File create/overwrite
- **Grep:** Pattern search in files
- **WebSearch:** Search the internet
- **WebFetch:** Fetch web content

**Note:** `Bash` is **explicitly removed** (was in old config, now omitted)

---

## System Prompt Architecture

### Three-Stage Construction

| Stage | Source | Method | Timing |
|-------|--------|--------|--------|
| **1. Base** | `modules-private/wibwob-prompts/wibandwob.prompt.md` OR hardcoded | File read or fallback string | App startup |
| **2. Transport** | C++ LLMRequest.system_prompt → START_SESSION JSON | Escape & embed in JSON | Before session start |
| **3. Enrichment** | Live API `/capabilities` | Append markdown section | During session startup |

### Final Prompt Composition

```markdown
[Original wib&wob persona OR custom loaded]

## Available TUI Capabilities (auto-derived from C++ registry)

### Window Types (use with tui_create_window tool)
[comma-separated window type names]

### Commands (available as tui_* tools)
[comma-separated command names]
```

**Result:** Agent has full awareness of live capabilities **without parsing code** — just markdown.

---

## Configuration & Model Selection

### Hardcoded in C++ (claude_code_sdk_provider.cpp)

- **maxTurns:** 50
- **allowedTools:** `["Read","Write","Grep","WebSearch","WebFetch"]` (hardcoded, MCP added separately)
- **model:** Defaults to `claude-haiku-4-5` if not specified
  - Bridge normalizes: `opus` → `claude-opus-4-6`, `sonnet` → `claude-sonnet-4-6`, `haiku` → `claude-haiku-4-5`

### Bridge Defaults (if C++ doesn't override)

- **model:** `'claude-haiku-4-5'` (fallback)
- **customSystemPrompt:** Falls back to `"You are a helpful assistant."` if empty

---

## MCP-Related Files in app/llm/

1. **`app/llm/sdk_bridge/mcp_tools.js`** ✅
   - MCP server definition (the 2 tools)
   - Never edit — C++ registry is the source of truth

2. **`app/llm/sdk_bridge/claude_sdk_bridge.js`** ✅
   - Main bridge: session lifecycle, MCP registration, prompt injection
   - Handles all SDK ↔ C++ communication

3. **`app/llm/sdk_bridge/sdk_loader.js`**
   - Loads `@anthropic-ai/claude-agent-sdk` module
   - No MCP-specific logic, just SDK discovery

4. **`app/llm/sdk_bridge/smoke_test.js`**
   - Standalone test of SDK (no MCP, no bridge)
   - Uses hardcoded prompt + message generator

5. **`app/llm/providers/claude_code_sdk_provider.cpp`** ✅
   - C++ side: spawns bridge, manages pipes, session lifecycle
   - Non-blocking async with queue-based streaming

6. **`app/llm/providers/claude_code_sdk_provider.h`**
   - Header: method declarations, stream chunk types
   - NodeBridge struct definition

7. **`app/llm/base/illm_provider.h`** ✅
   - Abstract interface: `LLMRequest` with `system_prompt` field
   - Defines `StreamChunk`, `StreamingCallback`

8. **`app/llm/sdk_bridge/package.json`**
   - Dependencies: `@anthropic-ai/claude-agent-sdk`, `axios`, `zod`, `dotenv`

**No other MCP files found.** The system is minimal: 2 tools, 1 MCP server, everything routed through localhost:8089.

---

## Error Handling & Fallback

### MCP Tool Errors

- MCP tool function catches errors → returns `mcpError()` with message
- Bridge sends back to Claude as tool result (not SDK error)
- Claude can decide to retry or explain failure

### Capabilities Fetch Failure

- If `/capabilities` fails, bridge logs and continues (graceful degradation)
- System prompt is still valid, just without the markdown section
- Agent must use `tui_list_commands` at runtime instead of reading the prompt

### Session Start Failure

- If `SESSION_STARTED` not received after START_SESSION:
  - C++ detects error in `poll()`
  - Delivers `ERROR_OCCURRED` chunk to callback
  - Falls back to legacy Anthropic API provider
- Bridge stays running for next query attempt

### SDK/Bridge Unavailable

- C++ checks `isAvailable()` (Node.js + script path)
- If unavailable, immediately uses fallback provider (anthropic_api_provider.cpp)
- No delay, no spinning

---

## Key Design Patterns

1. **Non-blocking async:** C++ spawns bridge once, polls for responses in game loop
2. **Lazy initialization:** Node.js bridge not spawned until first query
3. **Session persistence:** Bridge keeps state across queries (same sessionId)
4. **Live registry mapping:** C++ command registry → MCP tools on-the-fly
5. **Prompt as config:** System prompt is primary "capabilities document"
6. **Graceful enrichment:** Live capabilities appended to prompt, skips if API unavailable
7. **Tool auto-discovery:** MCP tool names derived from server.tools, no hardcoded list

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  WibWob TUI (tvision C++)                                       │
│  ┌────────────────┐  ┌────────────────────────────────────────┐ │
│  │ WibWobView     │  │ WibWobEngine                           │ │
│  │ + user input   │→ │ + system_prompt (loaded/fallback)      │ │
│  └────────────────┘  │ + sendQuery(LLMRequest)                │ │
│                      └────────────────────────────────────────┘ │
│                                    ↓                             │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ ClaudeCodeSDKProvider (streaming mode)                    │ │
│  │ + startStreamingSession(customSystemPrompt)               │ │
│  │ + sendStreamingQuery(query, callback, systemPrompt)       │ │
│  │ + poll() — detect SESSION_STARTED, queue responses        │ │
│  │ + processStreamingThread() — read from NodeBridge pipe    │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                           ↓ (spawn + pipe)
┌─────────────────────────────────────────────────────────────────┐
│  Node.js Bridge (claude_sdk_bridge.js)                         │
│  ┌─────────────────────────────────────────────────────────────┤
│  │ START_SESSION                                             │ │
│  │  ├→ Store systemPrompt                                    │ │
│  │  ├→ _injectCapabilities() [GET /capabilities]            │ │
│  │  └→ Emit SESSION_STARTED (enriched prompt + sessionId)    │ │
│  │                                                            │ │
│  │ SEND_QUERY                                                │ │
│  │  ├→ Build toolList (Code + MCP)                           │ │
│  │  ├→ Call SDK query({prompt, options: {systemPrompt, ...}})│ │
│  │  └→ Stream CONTENT_DELTA / MESSAGE_COMPLETE / ERROR       │ │
│  └─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┤
│  │ MCP Server (tui-control)                                   │ │
│  │  ├─ tui_list_commands  → GET /commands (C++ registry)     │ │
│  │  └─ tui_menu_command   → POST /menu/command (execute)     │ │
│  └─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┤
│  │ Claude Agent SDK                                           │ │
│  │  ├─ Reasoning with systemPrompt + 7 allowed tools         │ │
│  │  ├─ Tool call → route to Code tools OR MCP tools          │ │
│  │  └─ Stream text/tool-use messages                         │ │
│  └─────────────────────────────────────────────────────────────┘
└─────────────────────────────────────────────────────────────────┘
           ↓ (MCP intercept)
┌─────────────────────────────────────────────────────────────────┐
│  FastAPI Backend (localhost:8089)                              │
│  ├─ GET /commands         → JSON array of C++ commands        │
│  ├─ GET /capabilities     → JSON {window_types, commands}     │
│  └─ POST /menu/command    → Execute command, return result    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Security Notes

- **MCP tools only hit localhost:8089** (no network exposure)
- **allowDangerouslySkipPermissions=true** used because MCP is localhost-only and trusted
- **Code tools (Read, Grep) can access repo files** — no sandboxing, but by design
- **No file write restrictions** on Write tool
- **Bash tool explicitly removed** for safety (now omitted from allowedTools)

---

## Testing & Verification

To verify the full flow:

1. **Check bridge startup:**
   ```bash
   cd app/llm/sdk_bridge
   node claude_sdk_bridge.js  # Should emit "BRIDGE_READY"
   ```

2. **Check MCP server:**
   ```bash
   # In another terminal, send START_SESSION then SEND_QUERY
   echo '{"type":"START_SESSION","data":{"customSystemPrompt":"test"}}' | \
     node claude_sdk_bridge.js
   ```

3. **Check capabilities injection:**
   - Start WibWob TUI with API running
   - Open chat, check logs for "[BRIDGE] Injected capabilities: X types, Y commands"

4. **Verify MCP tool registration:**
   - Bridge logs "Auto-derived N MCP tool names from server"
   - Should show 2 tools with `mcp__tui-control__` prefix

---

## Known Limitations & TODOs

1. **Capabilities append-only:** Once injected, prompt cannot be updated with new commands (session is sticky)
2. **JSON parsing fragile:** Simple string extraction for bridge responses, no formal parser
3. **No MCP server versioning:** Only one `tui-control` instance, no versioning on tool definitions
4. **Haiku model default:** May not be powerful enough for complex code tasks (user must override in config)
5. **No tool rate limiting:** MCP tools can be called unlimited times (C++ registry doesn't enforce)
6. **Session resumption not fully tested:** `resume` option passed to SDK but not validated

---

## Conclusion

The MCP layer in WibWob-DOS is **intentionally minimal**: 2 tools, 1 server, all localhost. The design prioritizes:
- **Simplicity:** No complex tool registry, no nested MCP hierarchies
- **Dynamism:** Tools auto-discover from C++ registry, not hardcoded
- **Non-blocking:** Entire flow is async, no game loop stalls
- **Extensibility:** New C++ commands are instantly available via `tui_menu_command`

The system prompt is the **primary capability document**, enriched in real-time with live registry info. This reduces the agent's need to introspect and allows for cleaner reasoning.
