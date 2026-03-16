#!/usr/bin/env bash
# diagonal-trail.sh — DVD ghost trail, never clears, diagonal accumulation.
#
# Pure bash + python canvas math + curl API. No bun subprocess per frame.
# Each frame stamps the art at offset (cx,cy), overlays on persistent canvas,
# posts to TUI via HTTP. Spaces are transparent — characters only accumulate.
#
# Usage:
#   bash scripts/fx/diagonal-trail.sh [source.txt] [window_id] [dx] [dy] [steps] [delay]
#
#   source.txt  — ASCII art file (default: random jgs)
#   window_id   — TUI window to write into (default: 8)
#   dx          — horizontal step per frame (default: 4)
#   dy          — vertical step per frame (default: 2)
#   steps       — frames (default: 0 = infinite, Ctrl+C to stop)
#   delay       — seconds between frames (default: 0.08)
#
# Examples:
#   bash scripts/fx/diagonal-trail.sh                               # random jgs, infinite
#   bash scripts/fx/diagonal-trail.sh cat-0000.txt 8 4 2 0 0.08    # cat, infinite
#   bash scripts/fx/diagonal-trail.sh owl.txt 8 2 1 60 0.05        # owl, 60 frames

set -uo pipefail
cd "$(dirname "$0")/../.."

API="${WW_API:-http://127.0.0.1:8099}"
JGS_DIR="/Users/james/Repos/symbient-skills/skills/joan-stark-ascii-art/examples"

SOURCE="${1:-}"
WIN_ID="${2:-8}"
DX="${3:-4}"
DY="${4:-2}"
STEPS="${5:-0}"
DELAY="${6:-0.08}"

# Pick source if not specified
if [ -z "$SOURCE" ]; then
  SOURCE=$(ls "$JGS_DIR"/*.txt | shuf -n1)
elif [ ! -f "$SOURCE" ]; then
  # Try as bare name in jgs dir
  SOURCE="$JGS_DIR/$SOURCE"
fi

echo "=== DIAGONAL TRAIL ===" >&2
echo "  source : $(basename "$SOURCE")" >&2
echo "  window : $WIN_ID   dx=$DX dy=$DY  steps=${STEPS:-∞}  delay=$DELAY" >&2
echo "  api    : $API" >&2

# ── canvas state lives in a tmpfile, updated each frame by python ────────────
CANVAS_FILE=$(mktemp /tmp/diag-canvas-XXXX.txt)
trap "rm -f '$CANVAS_FILE'" EXIT

# Init canvas via python (write empty canvas)
python3 - "$SOURCE" "$CANVAS_FILE" "$DX" "$DY" "$STEPS" "$DELAY" "$WIN_ID" "$API" <<'PYEOF'
import sys, json, time, random, subprocess
from pathlib import Path

source, canvas_file, dx, dy, steps, delay, win_id, api = sys.argv[1:]
dx, dy, steps = int(dx), int(dy), int(steps)
delay = float(delay)
win_id = int(win_id)
infinite = steps == 0

# Load art
lines = [l for l in Path(source).read_text().splitlines() if not l.startswith('#')]
while lines and not lines[-1].strip():
    lines.pop()

art_w = max(len(l) for l in lines) if lines else 0
art_h = len(lines)

# Canvas — sized to fit the window comfortably
CW, CH = 110, 55

canvas = [[' '] * CW for _ in range(CH)]

def overlay(cx, cy):
    for r, line in enumerate(lines):
        cr = (cy + r) % CH
        for col, ch in enumerate(line):
            wcol = (cx + col) % CW
            if ch != ' ':
                canvas[cr][wcol] = ch

def emit():
    return '\n'.join(''.join(row).rstrip() for row in canvas)

def push(text):
    payload = json.dumps({"id": "editor.write", "args": {"text": text, "windowId": win_id}})
    try:
        subprocess.run(
            ['curl', '-s', '-X', 'POST',
             f'{api}/commands/run',
             '-H', 'Content-Type: application/json',
             '-d', payload],
            capture_output=True, timeout=2
        )
    except Exception:
        pass

cx, cy = 0, 0
frame = 0

try:
    while True:
        overlay(cx % CW, cy % CH)
        push(emit())
        time.sleep(delay)
        cx += dx
        cy += dy
        frame += 1
        if not infinite and frame >= steps:
            break
except KeyboardInterrupt:
    pass

print(f"=== done. {frame} frames ===", file=sys.stderr)
PYEOF
