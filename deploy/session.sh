#!/bin/bash
# Per-connection session script for ttyd
# Hard 30-min timeout regardless of activity

export TERM=xterm-256color
export HOME=/app
export COLORTERM=truecolor

echo "WibWob-DOS — session starting..."
echo "This session will expire in 30 minutes."
echo ""

# timeout kills the process after 1800s (30 min)
exec timeout 1800 bun run /app/src/app.ts
