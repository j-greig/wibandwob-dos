#!/usr/bin/env bash
# @name    wibwob-record
# @desc    Record asciinema session + audio mix + export to MP4
# wibwob-record — asciinema recording + audio mix + export
#
# Standalone script, NOT part of the CLI (which is a pure HTTP client).
#
# Usage:
#   wibwob-record start [--cols 180] [--rows 51]   Start interactive recording
#   wibwob-record run <script> [args...]            Record a script end-to-end
#   wibwob-record mix <cues.tsv> <output.mp3>       Mix SFX cues → audio track
#   wibwob-record export <file.cast> [--audio <mp3>] Cast → gif, + audio → mp4
#
# Recordings saved to scratch/recordings/

set -e

# Find repo root
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$SCRIPT_DIR/.." && pwd)"
REC_DIR="$REPO/scratch/recordings"
mkdir -p "$REC_DIR"

COLS=180
ROWS=51
TS=$(date +%s)

# Parse global flags
while [[ "$2" =~ ^-- ]]; do
  case "$2" in
    --cols) COLS="$3"; shift 2 ;;
    --rows) ROWS="$3"; shift 2 ;;
    --audio) AUDIO="$3"; shift 2 ;;
    *) shift ;;
  esac
done

usage() {
  cat <<'EOF'
wibwob-record — asciinema recording + audio mix + export

Usage:
  wibwob-record start [--cols 180] [--rows 51]   Start interactive recording
  wibwob-record run <script> [args...]            Record a script end-to-end
  wibwob-record mix <cues.tsv> <output.mp3>       Mix SFX cues → audio track
  wibwob-record export <file.cast> [--audio <mp3>] Cast → gif, + audio → mp4

Recordings saved to scratch/recordings/
EOF
  exit 0
}

case "${1:-help}" in
  start)
    CAST="$REC_DIR/rec-$TS.cast"
    echo "Recording → $CAST"
    echo "Run 'exit' to finish."
    asciinema rec "$CAST" --cols "$COLS" --rows "$ROWS"
    echo "Saved: $CAST"
    ;;

  run)
    SCRIPT="$2"
    [ -z "$SCRIPT" ] && { echo "Usage: wibwob-record run <script> [args...]"; exit 1; }
    shift 2
    CAST="$REC_DIR/rec-$TS.cast"
    TMUX_SESSION="${TMUX_TARGET:-wibwob}"

    # Strategy: capture the tmux pane where WibWob-DOS is running,
    # not the script's stdout. The script talks to the API — the
    # visuals are in the tmux pane.
    echo "Recording tmux pane '$TMUX_SESSION' → $CAST"
    echo "Running: bash $SCRIPT $*"

    # Detect actual tmux pane dimensions
    PANE_W=$(tmux display-message -t "$TMUX_SESSION" -p '#{pane_width}' 2>/dev/null || echo "$COLS")
    PANE_H=$(tmux display-message -t "$TMUX_SESSION" -p '#{pane_height}' 2>/dev/null || echo "$ROWS")
    echo "Pane size: ${PANE_W}x${PANE_H}"

    # Write asciicast v2 header with actual dimensions
    echo "{\"version\":2,\"width\":$PANE_W,\"height\":$PANE_H,\"timestamp\":$(date +%s)}" > "$CAST"

    # Sentinel file — create BEFORE starting capture loop
    SENTINEL="$REC_DIR/.recording-$TS"
    touch "$SENTINEL"

    # Start background capture loop — uses /screenshot/ansi API endpoint
    # which gives clean ANSI output without ACS issues
    WW_API="${WW_API:-http://127.0.0.1:8099}"
    START_S=$(python3 -c "import time; print(time.time())")
    # Export epoch ms for scripts to use as shared t=0 (syncs cues.tsv with cast)
    export WIBWOB_RECORD_START_MS=$(python3 -c "import time; print(int(time.time()*1000))")
    (
      PREV=""
      while [ -f "$SENTINEL" ]; do
        NOW=$(python3 -c "import time; print(f'{time.time() - $START_S:.3f}')")
        # Capture via API — clean ANSI, no ACS translation needed
        FRAME=$(curl -s "$WW_API/screenshot/ansi" 2>/dev/null || true)
        if [ -n "$FRAME" ] && [ "$FRAME" != "$PREV" ]; then
          # Build terminal output: clear screen + cursor position each line
          POSITIONED=$(python3 -c "
import sys, json
frame = sys.stdin.read()
lines = frame.split('\n')
out = '\x1b[2J\x1b[H'
for i, line in enumerate(lines):
    if i > 0:
        out += f'\x1b[{i+1};1H'
    out += line
print(json.dumps(out))
" <<< "$FRAME")
          echo "[$NOW, \"o\", $POSITIONED]" >> "$CAST"
          PREV="$FRAME"
        fi
        sleep 0.1
      done
    ) &
    CAPTURE_PID=$!
    sleep 0.2  # let capture loop start

    # Run the actual script
    bash "$SCRIPT" "$@" || true

    # Stop capture
    rm -f "$SENTINEL"
    wait $CAPTURE_PID 2>/dev/null || true

    echo "Saved: $CAST ($(wc -l < "$CAST" | tr -d ' ') frames)"

    # Auto-mix audio if cues.tsv exists in latest capture dir
    LATEST=$(ls -dt "$REPO/scratch/captures/wordbomb-sfx-"* "$REPO/scratch/captures/portrait-"* 2>/dev/null | head -1)
    if [ -n "$LATEST" ] && [ -f "$LATEST/cues.tsv" ]; then
      MP3="$REC_DIR/rec-$TS-audio.mp3"
      echo "Mixing audio from $LATEST/cues.tsv"
      cd "$REPO" && uv run scratch/cli-experiments/mix-sfx-track.py "$LATEST/cues.tsv" "$MP3"
      echo "Audio: $MP3"
    fi
    ;;

  mix)
    CUES="$2"; OUT="$3"
    [ -z "$CUES" ] || [ -z "$OUT" ] && { echo "Usage: wibwob-record mix <cues.tsv> <output.mp3>"; exit 1; }
    echo "Mixing $CUES → $OUT"
    cd "$REPO" && uv run scratch/cli-experiments/mix-sfx-track.py "$CUES" "$OUT"
    ;;

  export)
    CAST="$2"
    [ -z "$CAST" ] && { echo "Usage: wibwob-record export <file.cast> [--audio <mp3>]"; exit 1; }
    # Parse --audio flag after positional
    AUDIO=""
    shift 2
    while [ $# -gt 0 ]; do
      case "$1" in
        --audio) AUDIO="$2"; shift 2 ;;
        *) shift ;;
      esac
    done

    GIF="${CAST%.cast}.gif"
    MP4="${CAST%.cast}.mp4"

    echo "Rendering $CAST → $GIF"
    agg "$CAST" "$GIF" --font-size 32 --line-height 1.1 --theme github-dark

    if [ -n "$AUDIO" ] && [ -f "$AUDIO" ]; then
      # Get cast duration from last frame timestamp
      CAST_DUR=$(tail -1 "$CAST" | python3 -c "import sys,json; print(json.loads(sys.stdin.read())[0])")
      echo "Compositing $GIF + $AUDIO → $MP4 (duration: ${CAST_DUR}s)"
      ffmpeg -y -i "$GIF" -i "$AUDIO" \
        -t "$CAST_DUR" \
        -c:v libx264 -pix_fmt yuv420p -crf 23 \
        -c:a aac -b:a 192k -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" \
        -movflags +faststart \
        "$MP4" 2>/dev/null
      echo "→ $MP4"
    else
      echo "→ $GIF (no --audio provided, skipping mp4)"
    fi
    ;;

  help|--help|-h)
    usage
    ;;

  *)
    echo "Unknown subcommand: $1"
    usage
    ;;
esac
