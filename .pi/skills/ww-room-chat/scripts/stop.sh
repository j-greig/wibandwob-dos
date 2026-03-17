#!/usr/bin/env bash
# ww-room-chat/scripts/stop.sh
# Kill all room chat sessions cleanly.
tmux kill-server 2>/dev/null && echo "sessions killed" || echo "nothing running"
rm -f /tmp/wibwob_*.sock /tmp/b1.log /tmp/b2.log
echo "done"
