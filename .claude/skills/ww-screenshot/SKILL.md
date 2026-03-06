---
name: ww-screenshot
description: >-
  Capture a plain-text crop of a single WibWob-DOS window for visual debugging.
  Use instead of full /screenshot/text dumps — those are 50KB+ and destroy context fast.
  Triggers on: "screenshot window", "capture window", "what does window look like",
  "show me window", "crop window".
---

# Skill: ww-screenshot

Capture a plain-text crop of a single WibWob-DOS window for visual debugging.
Use instead of full `/screenshot/text` dumps — those are 50KB+ and destroy context fast.

## When to use

- Verifying layout or content of a specific window without a full screenshot
- Debugging rendering issues in a targeted window
- Handing a window snapshot to codex-analyst without context overhead
- Any time you want to see what a window looks like right now

## Prerequisites

App must be running with control API on port 8099.
If not running, load the `tmux-launch` skill first.

## Usage

```bash
# By window id (integer)
./scripts/screenshot-window.sh 2

# By title substring (case-insensitive, first match wins)
./scripts/screenshot-window.sh "poetry"
./scripts/screenshot-window.sh "scramble"
./scripts/screenshot-window.sh "hello"
```

If the title substring matches nothing, the script lists all open windows with their ids as a hint.

## What it returns

Plain-text crop of the window's rect — no ANSI escape codes, no chrome outside the window bounds. Small enough to paste anywhere or hand to codex-analyst.

## How it works

1. Resolves window id via `GET /state` if a title string is given
2. Calls `GET /screenshot/text?id=N` — control API crops server-side to window rect using `frame.left/top/width/height`
3. Client-side `sed` strips any residual ANSI escape codes

## Environment

```bash
WIBWOB_API=http://127.0.0.1:8099  # default, override if running on a different port
```

## Example workflow

```bash
# Launch the app
# (load tmux-launch skill if needed)

# See what windows are open
curl -s http://127.0.0.1:8099/state | python3 -c "
import sys,json; d=json.load(sys.stdin)
[print(f\"{w['id']:3}  {w.get('title','?')}\") for w in d['windows']]
"

# Grab a specific window
./scripts/screenshot-window.sh "Poetry Clock"

# Hand to codex-analyst
# Paste the output directly into your codex-analyst prompt
```

## Script location

`/Users/james/Repos/wibandwob-dos/scripts/screenshot-window.sh`
