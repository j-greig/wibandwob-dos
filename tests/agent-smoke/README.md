# Agent Smoke Test Suite

Autonomous integration tests for the WibWob TUI agent.
Launches the app in tmux, exercises the agent via control API, checks session logs.

## Quick run

```bash
./tests/agent-smoke/run.sh
```

This will:
1. Kill any existing wibwob-test tmux session
2. Launch WibWob-DOS in a fresh tmux session (headless)
3. Wait for the control API on port 8099
4. Open the agent window
5. Run all test cases via the control API
6. Collect results + session logs
7. Print pass/fail summary
8. Kill the tmux session

## Test cases

| # | Test | What it checks |
|---|------|---------------|
| 1 | Agent window opens | POST /view/wibwob-agent/open → state has wibwob-agent window |
| 2 | /help | Send /help, verify status message appears with command list |
| 3 | /session | Send /session, verify model + message count in output |
| 4 | /tools | Send /tools, verify tool list appears |
| 5 | /model | Send /model, verify model name in output |
| 6 | /clear | Send /clear, verify transcript cleared |
| 7 | Simple prompt | Send "say hello", verify assistant response (non-empty) |
| 8 | /stop mid-stream | Send long prompt, immediately /stop, verify abort |
| 9 | /new | Send /new, verify session reset |
| 10 | Error surfacing | (manual) Verify API errors show in transcript not "..." |
| 11 | Session log check | Verify JSONL log exists and has entries |
| 12 | Sender label | Send via agent-message API with sender, verify label in state |

## Output

Results written to `tests/agent-smoke/results/` (gitignored).
Each run creates a timestamped directory with:
- `summary.txt` — pass/fail per test
- `state-*.json` — desktop state snapshots at each step
- `session-log.jsonl` — copy of agent session log
- `transcript.txt` — agent window text capture

## Re-running

The test is idempotent — kills and recreates everything. Safe to re-run.
