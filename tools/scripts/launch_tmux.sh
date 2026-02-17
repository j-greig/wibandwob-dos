#!/bin/bash
# Launch N WibWob-DOS instances in tmux with monitoring sidebar.
# Usage: ./tools/scripts/launch_tmux.sh [N]   (default: 4)
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
N=${1:-4}
SESSION="wibwob"
BINARY="$REPO_ROOT/build/app/test_pattern"

if [ ! -f "$BINARY" ]; then
    echo "Binary not found: $BINARY"
    echo "Run: cmake --build ./build"
    exit 1
fi

# Kill existing session if any
tmux kill-session -t "$SESSION" 2>/dev/null || true

# Create session with first instance pane
tmux new-session -d -s "$SESSION" -x 200 -y 50 \
    "cd $REPO_ROOT && WIBWOB_INSTANCE=1 $BINARY 2>/tmp/wibwob_1.log"

# Add remaining instance panes
for i in $(seq 2 "$N"); do
    tmux split-window -t "$SESSION" -h \
        "cd $REPO_ROOT && WIBWOB_INSTANCE=$i $BINARY 2>/tmp/wibwob_$i.log"
done

# Even out the layout
tmux select-layout -t "$SESSION" tiled

# Add monitor sidebar (narrow right pane)
tmux split-window -t "$SESSION" -h -l 42 \
    "cd $REPO_ROOT && python3 tools/monitor/instance_monitor.py 2"

# Attach
tmux attach-session -t "$SESSION"
