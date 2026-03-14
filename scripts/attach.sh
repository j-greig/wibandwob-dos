#!/usr/bin/env bash
# attach.sh — attach to the running WibWob-DOS tmux session
# Usage: bash scripts/attach.sh
# Alias:  alias wwdos='bash ~/Repos/wibandwob-dos/scripts/attach.sh'

SESSION="wibwob"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
source "$ROOT/scripts/lib/runtime-env.sh"

if ! tmux has-session -t "$SESSION" 2>/dev/null; then
  echo "No tmux session '$SESSION'. Starting..."
  bash "$ROOT/scripts/ensure-running.sh" --session "$SESSION"
fi

# Show current instance id from API (non-fatal if app not up yet)
INFO=$(curl -s --max-time 1 "$(ww_api_base)/health" 2>/dev/null)
if [ -n "$INFO" ]; then
  INSTANCE_ID=$(echo "$INFO" | python3 -c "import sys,json; print(json.load(sys.stdin).get('instanceId','?'))" 2>/dev/null)
  echo "WibWob-DOS  instance=$INSTANCE_ID  → attaching to tmux:$SESSION"
else
  echo "WibWob-DOS  (API not responding)  → attaching to tmux:$SESSION"
fi

tmux attach -t "$SESSION"
