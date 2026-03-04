#!/bin/bash
# Simple music player for pi sessions.
# Usage:
#   play.sh <file>           — play from start
#   play.sh <file> <offset>  — play from offset seconds
#   play.sh stop             — kill any running player
#   play.sh status           — show what's playing
#
# Manages a single afplay process via a PID file.

PIDFILE="/tmp/wibwob-player.pid"
METAFILE="/tmp/wibwob-player.meta"

case "${1:-}" in
  stop)
    if [ -f "$PIDFILE" ]; then
      kill "$(cat "$PIDFILE")" 2>/dev/null
      rm -f "$PIDFILE" "$METAFILE"
      echo "Stopped."
    else
      echo "Nothing playing."
    fi
    ;;
  pause)
    if [ -f "$PIDFILE" ]; then
      kill -STOP "$(cat "$PIDFILE")" 2>/dev/null
      echo "Paused."
    else
      echo "Nothing playing."
    fi
    ;;
  resume)
    if [ -f "$PIDFILE" ]; then
      kill -CONT "$(cat "$PIDFILE")" 2>/dev/null
      echo "Resumed."
    else
      echo "Nothing playing."
    fi
    ;;
  status)
    if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
      cat "$METAFILE" 2>/dev/null
      echo "PID: $(cat "$PIDFILE")"
    else
      rm -f "$PIDFILE" "$METAFILE"
      echo "Nothing playing."
    fi
    ;;
  "")
    echo "Usage: play.sh <file> [offset_secs]"
    echo "       play.sh stop|pause|resume|status"
    ;;
  *)
    FILE="$1"
    OFFSET="${2:-0}"
    
    # Kill existing
    if [ -f "$PIDFILE" ]; then
      kill "$(cat "$PIDFILE")" 2>/dev/null
      rm -f "$PIDFILE" "$METAFILE"
    fi
    
    # Get duration
    DUR=$(afinfo "$FILE" 2>/dev/null | grep "estimated duration" | awk '{print $NF}')
    DUR_FMT=$(printf "%d:%02d" $((${DUR%.*}/60)) $((${DUR%.*}%60)))
    
    # Play
    if [ "$OFFSET" != "0" ]; then
      REMAIN=$(echo "$DUR - $OFFSET" | bc 2>/dev/null || echo "$DUR")
      afplay -t "$REMAIN" "$FILE" &
    else
      afplay "$FILE" &
    fi
    PID=$!
    echo "$PID" > "$PIDFILE"
    echo "File: $(basename "$FILE")" > "$METAFILE"
    echo "Path: $FILE" >> "$METAFILE"
    echo "Duration: ${DUR_FMT} (${DUR%.*}s)" >> "$METAFILE"
    echo "Started: $(date +%H:%M:%S)" >> "$METAFILE"
    
    echo "▶ $(basename "$FILE")  ${DUR_FMT}  [PID $PID]"
    ;;
esac
