# Claude Code Configuration for Test-TUI

## Two Separate Claude Instances

There are **two different Claude Code instances** when working with test-tui:

1. **External Claude Code** (your IDE/terminal session)
   - Uses project-level config: `/Users/james/Repos/tvision/test-tui/.claude/settings.json`
   - Controlled by your IDE or CLI invocations

2. **Embedded Chat Window** (inside the TVision app)
   - Uses the same config: `/Users/james/Repos/tvision/test-tui/.claude/settings.json`
   - Configured via: `llm/config/llm_config.json`
   - Launched by C++ provider: `llm/providers/claude_code_provider.cpp`

## How the Embedded Chat Works

When you open "Wib&Wob Chat" inside the test_pattern app:

1. **Config loaded**: `llm/config/llm_config.json` (line 12-16)
   ```json
   "claude_code": {
     "enabled": true,
     "command": "claude",
     "args": ["-p", "--model", "sonnet", "--mcp-config", ".claude/settings.json", ...]
   }
   ```

2. **Claude CLI invoked**: `claude_code_provider.cpp:334` builds command:
   ```bash
   claude -p --model sonnet --mcp-config .claude/settings.json --output-format json "<user message>"
   ```

3. **Settings loaded**: `.claude/settings.json` (relative to `test-tui/` working directory)
   - Enables MCP servers: `tui-control`, `symbient-brain`
   - Pre-approves all tui-control tool calls
   - Uses Sonnet 4.5 model

4. **System prompt loaded**: `claude_code_provider.cpp:358` checks for:
   - `wibandwob.prompt.md` in current directory (test-tui/)
   - Gives the chat its dual Wib&Wob personality

## Key Files

| File | Purpose |
|------|---------|
| `llm/config/llm_config.json` | LLM provider configuration (which command to run) |
| `.claude/settings.json` | Claude Code MCP servers + permissions |
| `wibandwob.prompt.md` | System prompt for chat personality |
| `llm/providers/claude_code_provider.cpp` | C++ code that invokes Claude CLI |

## Important Notes

- **Both instances share the same settings file** (`.claude/settings.json`)
- The embedded chat runs from `test-tui/` working directory, so all relative paths resolve from there
- MCP servers must be running for the chat to access tui-control tools:
  ```bash
  ./start_api_server.sh  # Starts tui-control MCP server on port 8089
  ```
- Chat sessions persist via `--resume <session_id>` for conversation continuity

## Testing Configuration

To verify the embedded chat has MCP access:

1. Start API server: `./start_api_server.sh`
2. Run test_pattern: `./build/test_pattern`
3. Open: Tools → Wib&Wob Chat
4. Ask: "create a test pattern window"
5. Should see MCP tool use in chat logs: `test-tui/logs/chat_*.log`
