---
name: tui-smoke-test
description: Write and run headless integration tests for WibWob-DOS TUI. Covers agent window, slash commands, API errors, session logs, tool registration, and desktop state. Use when adding tests, debugging test failures, or extending the smoke suite.
---

# TUI Smoke Test Skill

Headless integration testing for WibWob-DOS. Launches in tmux, exercises the app
via the control API, asserts on desktop state and session logs.

## Quick run

```bash
./tests/agent-smoke/run.sh
```

Results land in `tests/agent-smoke/results/<timestamp>/`.

## Architecture

The test runs the real app in a headless tmux session, talks to it through the
HTTP control API, and asserts on structured state — never on rendered text.

```
tmux (200x60)
  └─ bun run dev (CONTROL_API_PORT=8098)
       └─ HTTP control API on 127.0.0.1:8098

test script
  ├─ curl POST to open windows, send input, send agent-messages
  ├─ curl GET /state → JSON with window details, messageCount, streaming, model
  ├─ find session JSONL → verify real responses, check for API errors
  └─ pass/fail per test
```

## Port isolation

The smoke suite defaults to port 8098 (`SMOKE_PORT` env var) so it never kills
a live dev instance on 8099. Override: `SMOKE_PORT=8097 ./tests/agent-smoke/run.sh`

The app reads `CONTROL_API_PORT` from env (see `src/core/config.ts`).

## Key principles (learned the hard way)

### 1. Assert on state, not text

BAD: scraping the agent window text for "hello"
GOOD: checking `messageCount >= N`, `streaming == false`, `summary != "Error"`

The control API exposes structured window details via `GET /state`:

```json
{
  "appType": "wibwob-agent",
  "summary": "Ready.",
  "messageCount": 6,
  "streaming": false,
  "model": "anthropic/claude-sonnet-4-6",
  "ready": true
}
```

### 2. Always verify success, not just activity

BAD:
```bash
# This passes even when the API returns an error!
if [ "$COUNT_AFTER" -ge $((COUNT_BEFORE + 2)) ]; then pass; fi
```

A failed API call still creates user + assistant messages (the assistant message
is empty or contains "..."). Check BOTH message count AND error state:

GOOD:
```bash
if [ "$COUNT_AFTER" -ge $((COUNT_BEFORE + 2)) ] \
   && [ "$STREAMING" = "False" ] \
   && ! echo "$SUMMARY" | grep -qi "error"; then
  pass "Got response"
else
  # Check session log for the actual API error
  ERR=$(tail -1 "$SESSION_LOG" | python3 -c "
import sys, json
e = json.loads(sys.stdin.readline())
if e.get('type') == 'message':
  m = e['message']
  if m.get('errorMessage'):
    print(m['errorMessage'][:200])
" 2>/dev/null || echo "")
  fail "Simple prompt" "API error: $ERR"
fi
```

### 3. Check session logs for ground truth

The agent window state can say "Ready." even when every prompt errored.
The session JSONL is the source of truth:

```bash
SESSION_DIR="$HOME/.pi/agent/sessions/--Users-james-Repos-wibandwob-dos--"
LATEST=$(ls -t "$SESSION_DIR"/*.jsonl | head -1)

# Check last message for errors
tail -1 "$LATEST" | python3 -c "
import sys, json
e = json.loads(sys.stdin.readline())
if e.get('type') == 'message':
  m = e['message']
  role = m.get('role')
  err = m.get('errorMessage', '')
  stop = m.get('stopReason', '')
  content = m.get('content', '')
  if isinstance(content, list):
    text = ' '.join(c.get('text','')[:100] for c in content if c.get('type')=='text')
  else:
    text = str(content)[:200]
  print(f'{role} stop={stop} err={err[:100]}')
  print(f'  {text[:150]}')
"
```

### 4. Tool registration conflicts are silent killers

AgentSession loads tools from THREE sources:
- `baseToolsOverride` — jailed coding tools (read, write, edit, bash, grep, find, ls)
- `customTools` — TUI tools (tui_*), session bridge tools
- `.pi/extensions/*.ts` — extension-registered tools (play_music, codex, todo, list_sessions, send_to_session)

Also verify that every tool named in `.pi/APPEND_SYSTEM.md` actually appears in `src/services/agent-tools.ts` — a tool described in the prompt but missing from the implementation causes agents to guess command-registry slugs instead, which fail silently.

If ANY name appears in more than one source, the Anthropic API returns:
`"tools: Tool names must be unique."`

This error is SILENT in the transcript (shows "..." placeholder) unless you
check the session log. To audit:

```bash
# Extension tools
rg "name:" .pi/extensions/*.ts | grep '"'

# Custom tools
rg 'name: "' src/services/agent-tools.ts
rg 'name: "' src/services/wibwob-agent-session.ts | grep -v "case\|format"

# Must be zero overlap between the three sets
```

### 5. Wait for idle, don't guess timings

```bash
wait_idle() {
  local id="$1" max_wait="${2:-30}" elapsed=0
  while [ $elapsed -lt $max_wait ]; do
    local streaming
    streaming=$(curl -sf "$API/state" | python3 -c "
import sys, json
state = json.load(sys.stdin)
for w in state.get('windows', []):
  if w['id'] == $id:
    print('true' if w.get('describeState', {}).get('streaming') else 'false')
    break
" 2>/dev/null || echo "false")
    [ "$streaming" = "false" ] && return 0
    sleep 1; elapsed=$((elapsed + 1))
  done
  return 1
}
```

### 6. Port isolation prevents friendly fire

The smoke suite MUST use a different port from the dev instance. The old suite
used 8099 and its cleanup step (`lsof -ti:8099 | xargs kill -9`) murdered the
human's running TUI.

Pattern:
```bash
API_PORT="${SMOKE_PORT:-8098}"
# Launch with: CONTROL_API_PORT=${API_PORT} bun run dev
# Kill with:   lsof -ti:${API_PORT} | xargs kill -9
```

## Existing test cases

| # | Test | Asserts on |
|---|------|-----------|
| 1 | Agent window opens | window ID in /state |
| 2 | /help | messageCount increases |
| 3 | /session | messageCount increases, model field present |
| 4 | /tools | messageCount increases |
| 5 | /model | messageCount increases, model name non-empty |
| 6 | Simple prompt | count +2, not streaming, no error in summary or session log |
| 7 | /clear | messageCount drops to 0-1 |
| 8 | Sender label | agent-message API increases count |
| 9 | /new | messageCount resets |
| 10 | Session log | JSONL exists with >0 lines |
| 11 | /stop abort | streaming=false after abort |

## Adding a new test

Pattern:

```bash
log "Test N: Description"
COUNT_BEFORE=$(agent_msg_count "$(get_state 'pre-label')" "$AGENT_ID")

# Do the thing
agent_send "$AGENT_ID" "your input" 3
# or: api_post "/some/endpoint" '{"key":"value"}'

# Wait if needed
wait_idle "$AGENT_ID" 30 || true

# Assert
STATE=$(get_state "NN-label")
COUNT_AFTER=$(agent_msg_count "$STATE" "$AGENT_ID")

if [ "$COUNT_AFTER" -gt "$COUNT_BEFORE" ]; then
  pass "Description (count: $COUNT_BEFORE → $COUNT_AFTER)"
else
  fail "Description" "details about what went wrong"
fi
```

## Helpers available in run.sh

| Helper | Purpose |
|--------|---------|
| `api_get "/path"` | GET, returns body or `{}` |
| `api_post "/path" '{"json":true}'` | POST, returns body or `{"ok":false}` |
| `get_state "label"` | GET /state, save snapshot, return JSON |
| `agent_send ID "text" WAIT` | Send input + wait N seconds |
| `agent_message ID "text" "sender"` | Send via agent-message API |
| `agent_text ID` | GET /windows/text for window |
| `find_agent_id STATE` | Extract agent window ID from state JSON |
| `agent_details STATE ID` | Extract window details object |
| `agent_msg_count STATE ID` | Extract messageCount integer |
| `wait_idle ID [MAX]` | Poll until streaming=false |
| `find_session_log` | Path to latest session JSONL |

## Files

| File | Purpose |
|------|---------|
| `tests/agent-smoke/run.sh` | Main test script (bash) |
| `tests/agent-smoke/README.md` | Human-readable overview |
| `tests/agent-smoke/.gitignore` | Ignores results/ directory |
| `tests/agent-smoke/results/` | Timestamped output per run |

## Future test ideas

- Prompt-tool parity: extract tool names from APPEND_SYSTEM.md, diff against /tools output, fail on any gap
- Tool use verification: send a prompt that triggers a specific tool, verify tool_use in session log
- Compaction: fill context until auto_compaction fires, verify session continues
- /resume: create session, /new, /resume back, verify messageCount restored
- Extension tool presence: verify codex, todo, play_music appear in /tools output
- Error recovery: trigger a 429/500, verify auto_retry event in session log
- Multi-window: open primer + editor + agent, verify all in /state
- Theme persistence: set theme, /new workspace, reload, verify theme
