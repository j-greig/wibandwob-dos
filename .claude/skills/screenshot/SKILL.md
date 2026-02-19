---
name: screenshot
description: Capture WibWob-DOS TUI screen buffer as readable text + state JSON. Use when you need to see the TUI, inspect window layout, verify visual output, check what's on screen, or debug rendering. Triggers on /screenshot, "take a screenshot", "what does the TUI look like", "show me the screen".
---

# /screenshot

Capture the Turbo Vision screen buffer and return it as plain text with optional state JSON.

## Quick start

```bash
.claude/skills/screenshot/scripts/capture.sh
```

Returns markdown with the full text dump + state JSON, saves to `tui-screenshot-*.md` in repo root.

## Modes

| Usage | What it does |
|-------|-------------|
| `/screenshot` | Text + state JSON, save to root |
| `/screenshot quick` | Text only, no state, no save |
| `/screenshot full` | Text + state + diff vs previous |
| `/screenshot --log` | Save to `logs/screenshots/` instead of root |
| `/screenshot --diff` | Include diff against previous capture |
| `/screenshot --window Paint` | Crop to named window's rect |
| `/screenshot --no-state` | Skip state JSON |

Flags compose: `/screenshot --log --diff --window Paint` works.

## Pipeline

1. Health-check API server (`GET /health`), auto-start if down
2. Trigger `POST /screenshot` (IPC -> C++ frame_capture -> .txt/.ans files)
3. Read latest `logs/screenshots/tui_*.txt` (full screen buffer as text)
4. Optionally fetch `GET /state` (window list, positions, canvas size)
5. Optionally diff against previous screenshot
6. Optionally crop to window rect
7. Format as markdown, save + return inline

## Auto-recovery

If the API server isn't running, the script runs `start_api_server.sh` and waits up to 10s. If the TUI app isn't running, capture will fail with a clear error.

## Known quirk

`POST /screenshot` returns `screenshot_missing_output` even when files are written (timing bug in controller.py polling loop). The skill bypasses this by reading the .txt file directly from disk.

## Output format

````
# TUI Screenshot 20260219_113503
Source: tui_20260219_113503.txt

```
[full text buffer here]
```

## State
```json
{...}
```
````
