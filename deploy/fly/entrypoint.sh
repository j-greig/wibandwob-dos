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

  # Wait for windows to open, then arrange by title → geometry mapping
  sleep 3
  echo "arranging windows..."
  API=http://127.0.0.1:8099
  # Build batch ops from live window IDs matched to expected titles
  OPS=$(curl -s $API/state | jq -c '[
    (.windows[] | select(.title | test("WIBWOB")) | {id, left:0, top:0, width:62, height:10}),
    (.windows[] | select(.title | test("DOS"))    | {id, left:64, top:0, width:48, height:10}),
    (.windows[] | select(.title | test("AGENTS")) | {id, left:0, top:11, width:54, height:10}),
    (.windows[] | select(.title | test("FLY"))    | {id, left:56, top:11, width:56, height:7}),
    (.windows[] | select(.title | test("README")) | {id, left:0, top:22, width:70, height:38}),
    (.windows[] | select(.title | test("conscious")) | {id, left:72, top:19, width:40, height:41})
  ]')
  curl -sf -X POST $API/windows/batch \
    -H 'Content-Type: application/json' \
    -d "{\"ops\":$OPS}" || echo "warning: batch arrange failed"
fi

# ttyd — web terminal at :7681 (read-only view of the TUI)
ttyd --port 7681 --readonly --max-clients 10 tmux attach -t wibwob -r &
echo "ttyd web terminal started on :7681 (read-only)"

# Screenshot logger — captures TUI state every 60s to persistent volume
mkdir -p /data/logs/screenshots
(
  while true; do
    sleep 60
    TS=$(date -u +%Y-%m-%dT%H%M%SZ)
    curl -sf http://127.0.0.1:8099/screenshot/text > "/data/logs/screenshots/${TS}.txt" 2>/dev/null
  done
) &
echo "screenshot logger started (every 60s → /data/logs/screenshots/)"

# Keep the container alive — follow tmux session
# If the app crashes, tmux session ends, wait-for unblocks, container exits,
# Fly restarts it automatically.
exec tmux wait-for wibwob-exit
