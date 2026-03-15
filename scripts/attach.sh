#!/usr/bin/env bash
# @name    attach
# @desc    Attach to running WibWob-DOS (tmux attach or log tail)
# attach.sh — connect to the running WibWob-DOS instance
#
# Modes:
#   --direct  (default) Show status + tail the log file
#   --tmux              Attach to tmux session (legacy)
#
# Usage:
#   bash scripts/attach.sh                     # direct mode
#   bash scripts/attach.sh --tmux              # tmux attach
#
# Alias:  alias wwdos='bash ~/Repos/wibandwob-dos/scripts/attach.sh'

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
source "$ROOT/scripts/lib/process-manager.sh"
source "$ROOT/scripts/lib/runtime-env.sh"

ww_parse_mode "$@"

# Show current instance info
if ww_is_running; then
  id=$(ww_instance_id)
  dims=$(ww_get_dimensions)
  echo "WibWob-DOS  instance=$id  port=$WW_PORT  mode=$WW_MODE  dims=$dims"
else
  echo "WibWob-DOS  (not running on port $WW_PORT)"
fi

if [[ "$WW_MODE" == "tmux" ]]; then
  # Legacy: tmux attach
  if ! tmux has-session -t "$WW_SESSION" 2>/dev/null; then
    echo "No tmux session '$WW_SESSION'. Starting..."
    bash "$ROOT/scripts/ensure-running.sh" --tmux --session "$WW_SESSION"
  fi
  echo "→ attaching to tmux:$WW_SESSION"
  tmux attach -t "$WW_SESSION"
else
  # Direct mode: tail the log (Ctrl+C to stop watching)
  if [[ -f "$WW_LOG_FILE" ]]; then
    echo "→ tailing log: $WW_LOG_FILE  (Ctrl+C to stop)"
    echo "  (app is running in background with its own PTY)"
    echo "---"
    tail -f "$WW_LOG_FILE"
  elif ww_is_running; then
    echo "→ app is running (started in foreground terminal, no log file)"
    echo "  use the terminal where you ran 'bun run dev:world'"
  else
    echo "→ not running. Start with: bash scripts/ensure-running.sh"
  fi
fi
