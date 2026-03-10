#!/usr/bin/env bash
# kill-cam.sh — kill any lingering webcam processes left behind when the TUI exits
# Run this after quitting Ghostty or if the camera light stays on.

killed=0

# monster_cam_worker.py — wibandwob-dos Python camera worker
pids=$(pgrep -f "monster_cam_worker.py" 2>/dev/null)
if [ -n "$pids" ]; then
  echo "killing monster_cam_worker.py: $pids"
  kill $pids 2>/dev/null
  killed=$((killed + $(echo "$pids" | wc -w | tr -d ' ')))
fi

# Granola video capture helper — lingers after meetings
pids=$(pgrep -f "Granola Helper (Plugin)" 2>/dev/null)
if [ -n "$pids" ]; then
  echo "killing Granola video capture helper: $pids"
  kill $pids 2>/dev/null
  killed=$((killed + $(echo "$pids" | wc -w | tr -d ' ')))
fi

# Any other wibandwob-dos bun processes (optional — comment out if too aggressive)
# pids=$(pgrep -f "wibwob-dos" 2>/dev/null)
# if [ -n "$pids" ]; then
#   echo "killing wibwob-dos processes: $pids"
#   kill $pids 2>/dev/null
#   killed=$((killed + $(echo "$pids" | wc -w | tr -d ' ')))
# fi

if [ "$killed" -eq 0 ]; then
  echo "nothing to kill — camera already clear"
else
  echo "killed $killed process(es)"
fi
