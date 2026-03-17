#!/bin/bash
set -euo pipefail

export TERM=xterm-256color
export COLORTERM=truecolor
export HOME=/root

# Bind control API to 0.0.0.0 inside the Fly machine so the
# Fly proxy can reach it. Fly's network is private — the machine
# is not exposed to the public internet unless fly.toml says so.
export WIBWOB_CONTROL_HOST=0.0.0.0
export CONTROL_API_PORT=8099
export WIBWOB_INSTANCE_LABEL="${WIBWOB_INSTANCE_LABEL:-fly-disposable}"

# Start WibWob-DOS inside a tmux session (blessed needs a PTY)
tmux new-session -d -s wibwob -x 288 -y 80 "bun run /app/src/app.ts"

echo "tmux session started, waiting for control API..."

# Wait for the control API to be ready (up to 30s)
for i in $(seq 1 30); do
  if curl -sf http://127.0.0.1:8099/health > /dev/null 2>&1; then
    echo "control API ready on :8099"
    break
  fi
  sleep 1
done

# Health check result
curl -s http://127.0.0.1:8099/health | jq . 2>/dev/null || echo "warning: health check failed"

# Load pre-seeded workspace (agent-welcome layout with figlets + cheatsheet)
if [ -f /app/scratch/workspaces/agent-welcome.json ]; then
  echo "loading agent-welcome workspace..."
  curl -sf -X POST http://127.0.0.1:8099/workspace/load \
    -H 'Content-Type: application/json' \
    -d '{"name":"agent-welcome"}' || echo "warning: workspace load failed"
fi

# Keep the container alive — follow tmux session
# If the app crashes, tmux session ends, wait-for unblocks, container exits,
# Fly restarts it automatically.
exec tmux wait-for wibwob-exit
