#!/usr/bin/env bash
# attach.sh — attach to the running WibWob-DOS tmux session
# Usage: bash scripts/attach.sh
# Alias:  alias wwdos='bash ~/Repos/wibandwob-dos/scripts/attach.sh'

SESSION="wibwob"

if ! tmux has-session -t "$SESSION" 2>/dev/null; then
  echo "No tmux session '$SESSION' found. Start the app first:"
  echo "  tmux new-session -d -s $SESSION -x 205 -y 55"
  echo "  tmux send-keys -t $SESSION 'cd ~/Repos/wibandwob-dos && bun run dev:world' Enter"
  exit 1
fi

# Show current instance id from API (non-fatal if app not up yet)
INFO=$(curl -s --max-time 1 http://127.0.0.1:8099/health 2>/dev/null)
if [ -n "$INFO" ]; then
  INSTANCE_ID=$(echo "$INFO" | python3 -c "import sys,json; print(json.load(sys.stdin).get('instanceId','?'))" 2>/dev/null)
  echo "WibWob-DOS  instance=$INSTANCE_ID  → attaching to tmux:$SESSION"
else
  echo "WibWob-DOS  (API not responding)  → attaching to tmux:$SESSION"
fi

tmux attach -t "$SESSION"
