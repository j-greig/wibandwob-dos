# MISSION3: Full Stack Smoke Test — Window Types, Commands, Controls

> **For the next Claude session**: Read this entire file before doing anything.
> Find the first task with status `todo`, execute it, update this file, continue.
> Never skip a task. Never guess — validate with API calls and screenshots.
> Use Codex debugger as sidecar for deep analysis if stuck after 2 attempts.

---

## Purpose

Post-refactor verification of the entire API surface. Two passes:

1. **Pass 1 — Spawn & Verify**: Open every window type and run every menu command. Confirm each appears in `/state` with correct type. Screenshot after each batch.
2. **Pass 2 — Controls & Interaction**: For each window type that supports interaction (terminal, text editor, browser, paint, games, scramble), exercise the controls via API and verify the effect.

All results logged to the Findings table at the bottom.

---

## Pre-flight

- TUI running: `./build/app/test_pattern 2>/tmp/wibwob_debug_postrefactor.log`
- API server running: `http://127.0.0.1:8089/health` returns `{"ok":true}`
- Screenshot skill: `.claude/skills/screenshot/scripts/capture.sh`
- State check: `curl -sf http://127.0.0.1:8089/state | python3 -m json.tool`

---

## Task Queue

```json
[
  {
    "id": "M3-T01",
    "title": "PASS 1A — Spawn all window types via /windows endpoint",
    "status": "todo",
    "instructions": [
      "Start with clean desktop: curl -sf -X POST http://127.0.0.1:8089/menu/command -H 'Content-Type: application/json' -d '{\"command\":\"close_all\"}'",
      "For each spawnable type below, POST to /windows and record the response:",
      "  curl -sf -X POST http://127.0.0.1:8089/windows -H 'Content-Type: application/json' -d '{\"type\":\"TYPE\"}'",
      "Types to test (21 spawnable): test_pattern, gradient, frame_player, text_view, text_editor, browser, verse, mycelium, orbit, torus, cube, life, blocks, score, ascii, animated_gradient, monster_cam, monster_verse, monster_portal, paint, micropolis_ascii, terminal",
      "Note: frame_player and text_view need a 'path' prop — use any .txt file or skip with note",
      "After each spawn, GET /state and verify the window appears with correct type",
      "Record results in Findings table: type | spawned? | type in /state correct? | notes",
      "Take screenshot after spawning each batch of 5-6 windows, then close_all before next batch"
    ],
    "expected_output": "All 21 spawnable types attempted. Results table populated."
  },
  {
    "id": "M3-T02",
    "title": "PASS 1B — Run all menu commands via /menu/command",
    "status": "todo",
    "instructions": [
      "Start with clean desktop: close_all",
      "Test each command from the registry (25 commands):",
      "  Simple (no params): cascade, tile, close_all, screenshot, pattern_mode, reset_theme, open_scramble, scramble_expand, scramble_pet, new_paint_canvas, open_micropolis_ascii, open_quadra, open_snake, open_rogue, open_deep_signal, open_apps, open_terminal, terminal_read",
      "  With params: open_workspace (path=workspace.json), set_theme_mode (mode=dark), set_theme_variant (variant=dark_pastel), scramble_say (text=hello), terminal_write (text=ls), chat_receive (sender=test,text=hello)",
      "For each: curl -sf -X POST http://127.0.0.1:8089/menu/command -H 'Content-Type: application/json' -d '{\"command\":\"CMD\",\"args\":{...}}'",
      "Record: command | status code | response ok? | side effect verified?",
      "Take screenshot after opening commands that spawn windows"
    ],
    "expected_output": "All 25 commands exercised. Results table populated."
  },
  {
    "id": "M3-T03",
    "title": "PASS 1C — Verify /state type accuracy for all open windows",
    "status": "todo",
    "instructions": [
      "Open one of each interactive window type: terminal, text_editor, browser, paint, scramble (open_scramble)",
      "Also open one generative: verse, and one game: open_micropolis_ascii",
      "GET /state and verify EVERY window has correct type (not test_pattern)",
      "Cross-reference with screenshot to confirm visual rendering",
      "Record any type mismatches in findings"
    ],
    "expected_output": "All window types report correctly in /state. Screenshot confirms rendering."
  },
  {
    "id": "M3-T04",
    "title": "PASS 2A — Terminal window controls",
    "status": "todo",
    "instructions": [
      "Ensure terminal window is open (open_terminal if needed)",
      "Write text: curl -sf -X POST http://127.0.0.1:8089/menu/command -H 'Content-Type: application/json' -d '{\"command\":\"terminal_write\",\"args\":{\"text\":\"echo hello_wibwob\\n\"}}'",
      "Read output: curl -sf -X POST http://127.0.0.1:8089/menu/command -H 'Content-Type: application/json' -d '{\"command\":\"terminal_read\"}'",
      "Verify response contains 'hello_wibwob'",
      "Take screenshot to confirm terminal shows the command and output",
      "Test terminal_write with window_id parameter (get id from /state first)",
      "Record results"
    ],
    "expected_output": "Terminal write/read round-trip works. Screenshot shows command output."
  },
  {
    "id": "M3-T05",
    "title": "PASS 2B — Text editor controls",
    "status": "todo",
    "instructions": [
      "Ensure text_editor window is open",
      "Get its window ID from /state",
      "Send text: curl -sf -X POST http://127.0.0.1:8089/windows/{id}/send_text -H 'Content-Type: application/json' -d '{\"text\":\"Hello from API test\"}'",
      "Send figlet: curl -sf -X POST http://127.0.0.1:8089/windows/{id}/send_figlet -H 'Content-Type: application/json' -d '{\"text\":\"WIB\",\"font\":\"standard\"}'",
      "Take screenshot — verify text appears in editor",
      "Record results"
    ],
    "expected_output": "Text and figlet injected into editor. Screenshot confirms."
  },
  {
    "id": "M3-T06",
    "title": "PASS 2C — Browser controls",
    "status": "todo",
    "instructions": [
      "Ensure browser window is open",
      "Open a URL: curl -sf -X POST http://127.0.0.1:8089/browser/open -H 'Content-Type: application/json' -d '{\"url\":\"https://example.com\"}'",
      "Wait 3 seconds for fetch",
      "Get browser content: curl -sf -X POST http://127.0.0.1:8089/browser/get_content -H 'Content-Type: application/json' -d '{\"window_id\":\"ID\",\"format\":\"text\"}'",
      "Test back/forward if multiple pages loaded",
      "Take screenshot showing rendered page",
      "Record results"
    ],
    "expected_output": "Browser fetches and renders URL. Navigation works."
  },
  {
    "id": "M3-T07",
    "title": "PASS 2D — Scramble controls",
    "status": "todo",
    "instructions": [
      "Open scramble: open_scramble command",
      "Pet the cat: scramble_pet command — verify response contains a reaction",
      "Send message: scramble_say with text='testing 1 2 3'",
      "Expand scramble: scramble_expand command",
      "Take screenshot after each action",
      "Send chat_receive: sender=test, text='hello from outside'",
      "Record results"
    ],
    "expected_output": "Scramble responds to pet, displays messages, expands/contracts."
  },
  {
    "id": "M3-T08",
    "title": "PASS 2E — Paint canvas controls",
    "status": "todo",
    "instructions": [
      "Ensure paint window is open (new_paint_canvas)",
      "Get window ID from /state",
      "Draw a cell: curl -sf -X POST http://127.0.0.1:8089/paint/cell -H 'Content-Type: application/json' -d '{\"id\":\"ID\",\"x\":5,\"y\":5,\"char\":\"X\",\"fg\":15,\"bg\":1}'",
      "Draw a line: curl -sf -X POST http://127.0.0.1:8089/paint/line -H 'Content-Type: application/json' -d '{\"id\":\"ID\",\"x1\":0,\"y1\":0,\"x2\":10,\"y2\":10,\"char\":\"*\"}'",
      "Export: curl -sf http://127.0.0.1:8089/paint/export/ID",
      "Take screenshot",
      "Record results"
    ],
    "expected_output": "Paint operations render correctly. Export returns text."
  },
  {
    "id": "M3-T09",
    "title": "PASS 2F — Window management commands",
    "status": "todo",
    "instructions": [
      "Open 3-4 windows of different types",
      "Test cascade: curl -sf -X POST http://127.0.0.1:8089/menu/command -H 'Content-Type: application/json' -d '{\"command\":\"cascade\"}'",
      "Screenshot — verify cascaded layout",
      "Test tile: same pattern with 'tile' command",
      "Screenshot — verify tiled layout",
      "Test window move: curl -sf -X POST http://127.0.0.1:8089/windows/{id}/move -H 'Content-Type: application/json' -d '{\"x\":5,\"y\":3,\"w\":40,\"h\":15}'",
      "Test window focus: curl -sf -X POST http://127.0.0.1:8089/windows/{id}/focus",
      "Test window close: curl -sf -X POST http://127.0.0.1:8089/windows/{id}/close",
      "Test close_all",
      "Screenshot after each — verify effects",
      "Record results"
    ],
    "expected_output": "All window management commands work. Screenshots confirm layouts."
  },
  {
    "id": "M3-T10",
    "title": "PASS 2G — Theme commands",
    "status": "todo",
    "instructions": [
      "Open a test_pattern window so theme changes are visible",
      "Set dark mode: set_theme_mode with args mode=dark",
      "Screenshot — verify dark theme applied",
      "Set variant: set_theme_variant with args variant=dark_pastel",
      "Screenshot — verify pastel colours",
      "Reset: reset_theme command",
      "Screenshot — verify default restored",
      "Record results"
    ],
    "expected_output": "Theme switching works end-to-end. Screenshots show visual difference."
  },
  {
    "id": "M3-T11",
    "title": "Compile results and write summary report",
    "status": "todo",
    "instructions": [
      "Collate all findings from M3-T01 through M3-T10",
      "Count: total tested, passed, failed, skipped",
      "List any regressions or bugs found",
      "For each failure: note the exact API call, response, and expected vs actual",
      "Write summary to ## Summary section below",
      "If bugs found: add follow-up tasks M3-T12+ with fix instructions"
    ],
    "expected_output": "Complete smoke test report with pass/fail counts and actionable bug list."
  }
]
```

---

## Findings

### PASS 1A — Window Type Spawn Results

| # | Type | API Call | Spawned? | Type in /state | Screenshot | Notes |
|---|------|---------|----------|----------------|------------|-------|
| 1 | test_pattern | POST /windows | | | | |
| 2 | gradient | POST /windows | | | | |
| 3 | text_editor | POST /windows | | | | |
| 4 | browser | POST /windows | | | | |
| 5 | verse | POST /windows | | | | |
| 6 | mycelium | POST /windows | | | | |
| 7 | orbit | POST /windows | | | | |
| 8 | torus | POST /windows | | | | |
| 9 | cube | POST /windows | | | | |
| 10 | life | POST /windows | | | | |
| 11 | blocks | POST /windows | | | | |
| 12 | score | POST /windows | | | | |
| 13 | ascii | POST /windows | | | | |
| 14 | animated_gradient | POST /windows | | | | |
| 15 | monster_cam | POST /windows | | | | |
| 16 | monster_verse | POST /windows | | | | |
| 17 | monster_portal | POST /windows | | | | |
| 18 | paint | POST /windows | | | | |
| 19 | micropolis_ascii | POST /windows | | | | |
| 20 | terminal | POST /windows | | | | |
| 21 | frame_player | POST /windows (needs path) | | | | |
| 22 | text_view | POST /windows (needs path) | | | | |

### PASS 1B — Menu Command Results

| # | Command | Params | Response OK? | Side Effect | Notes |
|---|---------|--------|-------------|-------------|-------|
| 1 | cascade | — | | | |
| 2 | tile | — | | | |
| 3 | close_all | — | | | |
| 4 | save_workspace | — | | | |
| 5 | open_workspace | path=... | | | |
| 6 | screenshot | — | | | |
| 7 | pattern_mode | mode=continuous | | | |
| 8 | set_theme_mode | mode=dark | | | |
| 9 | set_theme_variant | variant=dark_pastel | | | |
| 10 | reset_theme | — | | | |
| 11 | open_scramble | — | | | |
| 12 | scramble_expand | — | | | |
| 13 | scramble_say | text=hello | | | |
| 14 | scramble_pet | — | | | |
| 15 | new_paint_canvas | — | | | |
| 16 | open_micropolis_ascii | — | | | |
| 17 | open_quadra | — | | | |
| 18 | open_snake | — | | | |
| 19 | open_rogue | — | | | |
| 20 | open_deep_signal | — | | | |
| 21 | open_apps | — | | | |
| 22 | open_terminal | — | | | |
| 23 | terminal_write | text=echo hi | | | |
| 24 | terminal_read | — | | | |
| 25 | chat_receive | sender=t,text=hi | | | |

### PASS 1C — Type Accuracy Check

*Filled after M3-T03*

### PASS 2 — Interaction Results

| Window Type | Control Tested | API Call | Result | Screenshot | Notes |
|-------------|---------------|---------|--------|------------|-------|
| terminal | write text | terminal_write | | | |
| terminal | read output | terminal_read | | | |
| text_editor | send_text | /windows/{id}/send_text | | | |
| text_editor | send_figlet | /windows/{id}/send_figlet | | | |
| browser | open URL | /browser/open | | | |
| browser | get content | /browser/get_content | | | |
| browser | back/forward | /browser/{id}/back | | | |
| scramble | pet | scramble_pet | | | |
| scramble | say | scramble_say | | | |
| scramble | expand | scramble_expand | | | |
| paint | draw cell | /paint/cell | | | |
| paint | draw line | /paint/line | | | |
| paint | export | /paint/export/{id} | | | |
| windows | cascade | cascade | | | |
| windows | tile | tile | | | |
| windows | move | /windows/{id}/move | | | |
| windows | focus | /windows/{id}/focus | | | |
| windows | close | /windows/{id}/close | | | |
| theme | dark mode | set_theme_mode | | | |
| theme | variant | set_theme_variant | | | |
| theme | reset | reset_theme | | | |

---

## Summary

*Filled after M3-T11*

**Total tested**: —  
**Passed**: —  
**Failed**: —  
**Skipped**: —  

### Bugs Found

*List here*

### Follow-up Tasks

*Add M3-T12+ here if bugs found*

---

## HOW TO CONTINUE THIS MISSION (for new Claude sessions)

1. Read this file completely
2. Find first task with `"status": "todo"` in the Task Queue JSON
3. Follow its `instructions` array step by step
4. After completing, update the task's `"status"` to `"done"` in the JSON
5. Write findings to the appropriate Findings table
6. Move to next todo task
7. If stuck after 2 attempts: launch Codex debugger as sidecar for analysis
8. If a command fails: log the exact curl, response, and stderr, then continue to next item
9. Screenshot command: `bash .claude/skills/screenshot/scripts/capture.sh`

**Repo**: `/Users/james/repos/wibandwob-dos`
**API**: `http://127.0.0.1:8089`
**Build**: `cmake --build /Users/james/repos/wibandwob-dos/build`
**Tests**: `uv run --with pytest pytest tests/contract/ -q`
**State**: `curl -sf http://127.0.0.1:8089/state | python3 -m json.tool`
**Screenshot**: `bash .claude/skills/screenshot/scripts/capture.sh`
**Debug log**: `/tmp/wibwob_debug_postrefactor.log`
