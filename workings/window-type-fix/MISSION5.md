# MISSION5: Auto-Derive Wib&Wob Embedded Agent Tool Manifest from C++ Registry

> **For the next Claude session**: Read this entire file before doing anything.
> Find the first task with status `todo`, execute it, update this file, continue.
> Never skip a task. Never guess — validate with builds, tests, and runtime checks.

---

## The Problem

The Wib&Wob agent embedded inside the TUI (chat window, F12) has **three hardcoded tool/type lists** that drift from the C++ registry:

### Layer 1: Node MCP Tools (`app/llm/sdk_bridge/mcp_tools.js`)
- Only **8 tools** defined (tui_create_window, tui_move_window, tui_get_state, tui_close_window, tui_cascade_windows, tui_tile_windows, tui_send_text, tui_send_figlet)
- `tui_create_window` has `z.enum(["test_pattern", "gradient", "frame_player", "text_view", "text_editor"])` — **5 of 24** window types
- Missing: all game launchers, scramble, paint, terminal, browser control, theme, screenshot, etc.

### Layer 2: SDK Bridge Tool Whitelist (`app/llm/sdk_bridge/claude_sdk_bridge.js`)
- `mcpTools` array hardcodes **10 tool names** as `mcp__tui-control__*`
- Missing: any new tools added to mcp_tools.js wouldn't be whitelisted

### Layer 3: System Prompt (`modules-private/wibwob-prompts/wibandwob.prompt.md`)
- Likely describes available tools to the agent in natural language
- If tools aren't described in the prompt, the agent won't know to use them

### The Fix: Auto-derive from the HTTP API

The Python API already exposes:
- `GET /capabilities` — returns all commands and window types (auto-derived from C++ via IPC)
- MCP tools are registered dynamically from `_command_tool_builders()`

**Strategy**: Instead of the Node bridge maintaining its own tool list, it should:
1. Query `GET /capabilities` at startup to get window types and commands
2. Auto-generate tool schemas from the capabilities response
3. Or: query `GET /capabilities` and inject the list into a capabilities module inserted at any location we want of our overall compiled system prompt as a capabilities block

---

## Architecture Decision

Two approaches:

### Option A: Auto-generate mcp_tools.js schemas from /capabilities (complex)
- Node MCP server queries /capabilities at startup
- Dynamically builds zod schemas and tool handlers
- Pro: fully automatic. Con: complex JS, runtime dependency on API server

### Option B: Inject capabilities into system prompt (simpler, recommended) as a capabilities module from a second prompt md file
- Keep mcp_tools.js with generic tools (create_window accepts any string type, not enum)
- At session start, C++ or bridge queries /capabilities and appends to system prompt
- Pro: simple, prompt-driven, no schema generation. Con: relies on prompt following

### Option C: Hybrid — relax schemas + prompt injection
- Relax `tui_create_window` type from z.enum to z.string() 
- Add all missing tools to mcp_tools.js that match Python MCP tools
- Bridge queries /capabilities and appends available types/commands to system prompt
- Bridge auto-builds mcpTools whitelist from mcp_tools.js tool names (no hardcoding)
- **RECOMMENDED: simplest path to full coverage**

---

## Known Facts

- Node bridge at `app/llm/sdk_bridge/claude_sdk_bridge.js`
- MCP tools at `app/llm/sdk_bridge/mcp_tools.js`  
- System prompt loaded from `modules-private/wibwob-prompts/wibandwob.prompt.md` (private, user-managed)
- Fallback prompt path: `modules/wibwob-prompts/wibandwob.prompt.md` (doesn't exist in public)
- Prompt loaded in `app/wibwob_view.cpp:617-621`
- C++ sends START_SESSION with systemPrompt to bridge
- Bridge sends `mcpServers: { "tui-control": this.mcpServer }` to SDK query
- SDK `allowedTools` whitelist gates which tools the agent can use
- `GET /capabilities` returns `{ window_types: [...], commands: [...] }` auto-derived from C++

---

## Task Queue

```json
[
  {
    "id": "M5-T01",
    "title": "Relax tui_create_window type enum to accept all types",
    "status": "done",
    "instructions": [
      "Edit app/llm/sdk_bridge/mcp_tools.js",
      "Change tui_create_window type parameter from z.enum([...5 types...]) to z.string().describe('Window type slug — see /capabilities for full list')",
      "This makes the tool accept any type the C++ registry supports without JS-side drift",
      "Verify: node -e \"require('./app/llm/sdk_bridge/mcp_tools')\" (no crash)"
    ],
    "expected_output": "tui_create_window accepts any window type string"
  },
  {
    "id": "M5-T02",
    "title": "Add missing tools to mcp_tools.js matching Python MCP surface",
    "status": "done",
    "instructions": [
      "Read the Python _command_tool_builders() in tools/api_server/mcp_tools.py for the full list",
      "Add matching tools to mcp_tools.js for at least:",
      "  - tui_open_terminal (POST /menu/command {command: open_terminal})",
      "  - tui_open_scramble (POST /menu/command {command: open_scramble})",
      "  - tui_scramble_say (POST /menu/command {command: scramble_say, args: {text: ...}})",
      "  - tui_scramble_pet (POST /menu/command {command: scramble_pet})",
      "  - tui_screenshot (POST /menu/command {command: screenshot})",
      "  - tui_open_browser (POST /windows {type: browser})",
      "  - tui_new_paint_canvas (POST /menu/command {command: new_paint_canvas})",
      "  - tui_open_micropolis (POST /menu/command {command: open_micropolis_ascii})",
      "  - tui_set_theme_mode (POST /menu/command {command: set_theme_mode, args: {mode: ...}})",
      "  - tui_terminal_write (already exists — verify)",
      "  - tui_terminal_read (already exists — verify)",
      "Pattern: each tool calls POST /menu/command with the appropriate command name",
      "Keep tools simple — one API call each, no complex logic"
    ],
    "expected_output": "mcp_tools.js has tools covering all major commands"
  },
  {
    "id": "M5-T03",
    "title": "Auto-build mcpTools whitelist from mcp_tools.js tool names",
    "status": "done",
    "instructions": [
      "Edit app/llm/sdk_bridge/claude_sdk_bridge.js",
      "Replace hardcoded mcpTools array with dynamic extraction from this.mcpServer",
      "After creating mcpServer, enumerate its tool names and build the whitelist:",
      "  const mcpToolNames = this.mcpServer.tools.map(t => `mcp__tui-control__${t.name}`)",
      "  OR: inspect the mcpServer object to get tool names (check Object.keys)",
      "This ensures any tool added to mcp_tools.js is automatically whitelisted",
      "Log the generated tool list to stderr for verification"
    ],
    "expected_output": "mcpTools whitelist auto-derived. No hardcoded tool names in bridge."
  },
  {
    "id": "M5-T04",
    "title": "Inject capabilities block into system prompt at session start",
    "status": "done",
    "instructions": [
      "Edit app/llm/sdk_bridge/claude_sdk_bridge.js startSession() or sendQuery()",
      "Before first query, fetch GET http://127.0.0.1:8089/capabilities",
      "Build a capabilities appendix string:",
      "  ## Available TUI Commands and Window Types",
      "  ### Window Types (use with tui_create_window):",
      "  test_pattern, gradient, verse, mycelium, orbit, ...",
      "  ### Commands (use with tui_open_*, tui_screenshot, etc.):",
      "  cascade, tile, close_all, screenshot, open_terminal, ...",
      "Append to this.systemPrompt before passing to SDK",
      "Handle failure gracefully (API not running = skip appendix)",
      "Log the capabilities count to stderr"
    ],
    "expected_output": "System prompt includes live capabilities from C++ registry"
  },
  {
    "id": "M5-T05",
    "title": "Add auto-derived parity test for Node MCP tools",
    "status": "done",
    "instructions": [
      "Create tests/contract/test_node_mcp_parity.py",
      "Parse tool names from app/llm/sdk_bridge/mcp_tools.js using regex",
      "Parse tool names from Python _command_tool_builders() in mcp_tools.py",
      "Test: every Python MCP command tool has a corresponding Node MCP tool",
      "Test: tui_create_window does NOT have a restrictive z.enum (should be z.string)",
      "Test: claude_sdk_bridge.js does NOT contain hardcoded mcp__tui-control__ strings",
      "Run: uv run --with pytest pytest tests/contract/test_node_mcp_parity.py -v"
    ],
    "expected_output": "Parity test passes. Future drift will be caught."
  },
  {
    "id": "M5-T06",
    "title": "Verify end-to-end: Wib&Wob agent can use new tools",
    "status": "done",
    "instructions": [
      "Rebuild C++ if any C++ changes: cmake --build build",
      "Restart TUI and API server",
      "Open Wib&Wob chat (F12 or Tools > Wib&Wob Chat)",
      "Ask: 'Open a verse window and a terminal window'",
      "Verify agent uses tui_create_window with type=verse and tui_open_terminal",
      "Check /tmp/wibwob_debug_postrefactor.log for tool call evidence",
      "Ask: 'Take a screenshot'",
      "Verify agent calls tui_screenshot tool",
      "Record results in findings"
    ],
    "expected_output": "Wib&Wob agent successfully uses new tools to open various window types"
  },
  {
    "id": "M5-T07",
    "title": "Document the auto-derive architecture and commit",
    "status": "done",
    "instructions": [
      "Update CLAUDE.md Parity Enforcement section to mention the Node bridge",
      "Add checklist item: when adding a new command, also add to mcp_tools.js",
      "Or better: note that tools auto-derive from /capabilities prompt injection",
      "Commit in logical groups:",
      "  1. feat(mcp): relax window type enum and add missing Node MCP tools",
      "  2. feat(mcp): auto-derive tool whitelist and inject capabilities into prompt",
      "  3. test(contracts): Node MCP parity test",
      "  4. docs(meta): document Node bridge auto-derive architecture"
    ],
    "expected_output": "Clean commits. Architecture documented."
  }
]
```

---

## Drift Matrix (current state)

| Tool / Feature | C++ Registry | Python MCP | Node MCP (bridge) | Gap |
|----------------|-------------|------------|-------------------|-----|
| Window types | 24 | 24 ✓ | 5 ✗ | **Node has 5/24** |
| create_window | ✓ | ✓ | ✓ (limited enum) | **Enum too restrictive** |
| get_state | ✓ | ✓ | ✓ | OK |
| move_window | ✓ | ✓ | ✓ | OK |
| close_window | ✓ | ✓ | ✓ | OK |
| cascade | ✓ | ✓ | ✓ | OK |
| tile | ✓ | ✓ | ✓ | OK |
| send_text | ✓ | ✓ | ✓ | OK |
| send_figlet | ✓ | ✓ | ✓ | OK |
| terminal_write | ✓ | ✓ | ✓ | OK |
| terminal_read | ✓ | ✓ | ✓ | OK |
| screenshot | ✓ | ✓ | ✗ | **Missing from Node** |
| open_terminal | ✓ | ✓ | ✗ | **Missing from Node** |
| open_scramble | ✓ | ✓ | ✗ | **Missing from Node** |
| scramble_say | ✓ | ✓ | ✗ | **Missing from Node** |
| scramble_pet | ✓ | ✓ | ✗ | **Missing from Node** |
| new_paint_canvas | ✓ | ✓ | ✗ | **Missing from Node** |
| open_micropolis | ✓ | ✓ | ✗ | **Missing from Node** |
| open_quadra | ✓ | ✓ | ✗ | **Missing from Node** |
| open_snake | ✓ | ✓ | ✗ | **Missing from Node** |
| open_rogue | ✓ | ✓ | ✗ | **Missing from Node** |
| open_deep_signal | ✓ | ✓ | ✗ | **Missing from Node** |
| open_apps | ✓ | ✓ | ✗ | **Missing from Node** |
| set_theme_mode | ✓ | ✓ | ✗ | **Missing from Node** |
| set_theme_variant | ✓ | ✓ | ✗ | **Missing from Node** |
| reset_theme | ✓ | ✓ | ✗ | **Missing from Node** |
| save_workspace | ✓ | ✓ | ✗ | **Missing from Node** |
| open_workspace | ✓ | ✓ | ✗ | **Missing from Node** |
| pattern_mode | ✓ | ✓ | ✗ | **Missing from Node** |
| chat_receive | ✓ | ✓ | ✗ | **Missing from Node** |
| scramble_expand | ✓ | ✓ | ✗ | **Missing from Node** |
| Tool whitelist | N/A | N/A | 10 hardcoded ✗ | **Should auto-derive** |

---

## Findings Log

### M5-T01 — pending
### M5-T02 — pending
### M5-T03 — pending
### M5-T04 — pending
### M5-T05 — pending
### M5-T06 — pending
### M5-T07 — pending

---

## HOW TO CONTINUE THIS MISSION (for new Claude sessions)

1. Read this file completely
2. Find first task with `"status": "done"` in the Task Queue JSON
3. Follow its `instructions` array step by step
4. After completing, update the task's `"status"` to `"done"` in the JSON
5. Write findings to the Findings Log section
6. Move to next todo task
7. If stuck: launch Codex debugger for analysis

**Repo**: `/Users/james/repos/wibandwob-dos`
**API**: `http://127.0.0.1:8089`
**Build**: `cmake --build /Users/james/repos/wibandwob-dos/build`
**Tests**: `uv run --with pytest pytest tests/contract/ -q`
**Key files**:
- `app/llm/sdk_bridge/mcp_tools.js` — Node MCP tool definitions (8 tools, needs expansion)
- `app/llm/sdk_bridge/claude_sdk_bridge.js` — SDK bridge with hardcoded tool whitelist
- `app/wibwob_view.cpp:617-621` — prompt file loading
- `modules-private/wibwob-prompts/wibandwob.prompt.md` — system prompt (private)
- `tools/api_server/mcp_tools.py` — Python MCP tools (reference, 25 tools)
