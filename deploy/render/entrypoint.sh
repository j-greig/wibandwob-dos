#!/bin/bash
set -euo pipefail

export TERM="${TERM:-xterm-256color}"
export COLORTERM="${COLORTERM:-truecolor}"
export HOME=/root

# Render expects app to bind to $PORT (typically 10000)
export CONTROL_API_PORT="${PORT:-${CONTROL_API_PORT:-8099}}"
export WIBWOB_CONTROL_HOST="${WIBWOB_CONTROL_HOST:-0.0.0.0}"
export WIBWOB_INSTANCE_LABEL="${WIBWOB_INSTANCE_LABEL:-render-disposable}"

# Optional persistent disk on Render
if [ -n "${RENDER_DISK_MOUNT_PATH:-}" ]; then
  export WIBWOB_DATA_DIR="${WIBWOB_DATA_DIR:-${RENDER_DISK_MOUNT_PATH}/.wibwob}"
  mkdir -p "$WIBWOB_DATA_DIR"
fi

# Start WibWob in tmux (blessed needs PTY)
tmux new-session -d -s wibwob -x 288 -y 80 "bun run /app/src/app.ts"

echo "tmux session started, waiting for control API on :$CONTROL_API_PORT ..."

API="http://127.0.0.1:${CONTROL_API_PORT}"
API_READY=0
for i in $(seq 1 90); do
  if curl -sf "$API/health" >/dev/null 2>&1; then
    API_READY=1
    echo "control API ready"
    break
  fi
  sleep 1
done

if [ "$API_READY" -eq 1 ]; then
  curl -s "$API/health" | jq . 2>/dev/null || true

  # Seed workspace into instance-scoped path then load it
  SEED="/app/scratch/workspaces/agent-welcome.json"
  INSTANCE_ROOT="$(curl -sf "$API/health" | jq -r '.instanceRoot // empty' || true)"
  if [ -f "$SEED" ] && [ -n "$INSTANCE_ROOT" ]; then
    mkdir -p "$INSTANCE_ROOT/workspaces"
    cp "$SEED" "$INSTANCE_ROOT/workspaces/agent-welcome.json"
    curl -sf -X POST "$API/workspace/load" \
      -H 'Content-Type: application/json' \
      -d '{"name":"agent-welcome"}' || echo "warning: workspace load failed"
  fi
else
  echo "warning: control API not ready after timeout"
fi

# Optional screenshot logger when disk path exists
if [ -n "${RENDER_DISK_MOUNT_PATH:-}" ]; then
  mkdir -p "${RENDER_DISK_MOUNT_PATH}/logs/screenshots"
  (
    while true; do
      sleep 60
      TS=$(date -u +%Y-%m-%dT%H%M%SZ)
      curl -sf "$API/screenshot/text" > "${RENDER_DISK_MOUNT_PATH}/logs/screenshots/${TS}.txt" 2>/dev/null || true
    done
  ) &
  echo "screenshot logger started"
fi

# Keep container alive while tmux session exists
while tmux has-session -t wibwob 2>/dev/null; do
  sleep 5
done

echo "wibwob tmux session ended"
exit 1
