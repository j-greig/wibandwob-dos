#!/usr/bin/env bash
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
    CMD="bash $SCRIPT $*"
    echo "Recording → $CAST"
    echo "Running: $CMD"
    asciinema rec "$CAST" --cols "$COLS" --rows "$ROWS" -c "$CMD"
    echo "Saved: $CAST"

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
    agg "$CAST" "$GIF" --cols "$COLS" --rows "$ROWS"

    if [ -n "$AUDIO" ] && [ -f "$AUDIO" ]; then
      echo "Compositing $GIF + $AUDIO → $MP4"
      ffmpeg -y -i "$GIF" -i "$AUDIO" \
        -c:v libx264 -pix_fmt yuv420p -crf 23 \
        -c:a aac -b:a 192k -shortest \
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
