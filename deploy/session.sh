#!/bin/bash
# Per-connection session script for ttyd
# Hard 30-min timeout regardless of activity

export TERM=xterm-256color
export HOME=/root
export COLORTERM=truecolor

# Wait for ttyd to receive the browser's terminal dimensions via WebSocket
# before blessed initialises — otherwise it renders at default 80x24 and
# the resize signal arrives too late to reflow correctly on first paint.
sleep 0.5

# unshare creates a new mount/pid/uts namespace — limits filesystem damage
# TODO: replace with proper non-root user + read-only mounts (see deploy/README.md)
exec unshare --mount --pid --fork timeout 1800 bun run /app/src/app.ts
