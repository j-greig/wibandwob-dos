#!/usr/bin/env bash
# tmux-setup.sh
# Enable mouse and rename windows in the wibwob tmux session to meaningful labels.
# Safe to re-run — just updates names and options, does not kill or restart anything.
#
# Usage: bash scripts/tmux-setup.sh [session]
# Default session: wibwob

SESSION="${1:-wibwob}"

if ! tmux has-session -t "$SESSION" 2>/dev/null; then
  echo "No tmux session '$SESSION' found. Start the app first (bash scripts/restart.sh)."
  exit 1
fi

# Enable mouse (click tabs, resize panes, scroll)
tmux set -t "$SESSION" mouse on
echo "mouse on"

# Rename windows based on what's running in them
tmux list-windows -t "$SESSION" -F "#{window_index}" | while read -r idx; do
  cmd=$(tmux display-message -t "$SESSION:$idx" -p "#{pane_current_command}" 2>/dev/null)
  path=$(tmux display-message -t "$SESSION:$idx" -p "#{pane_current_path}" 2>/dev/null)
  dir=$(basename "$path")

  if [[ "$cmd" == "bun" ]]; then
    label="$dir-app"
  elif [[ "$cmd" == "zsh" || "$cmd" == "bash" ]]; then
    label="$dir-shell"
  else
    label="$dir-$cmd"
  fi

  tmux rename-window -t "$SESSION:$idx" "$label"
  echo "window $idx → $label"
done

echo ""
echo "Done. Use PREFIX w or click the status bar tabs to switch."
tmux list-windows -t "$SESSION" -F "  #{window_index}: #{window_name}"
