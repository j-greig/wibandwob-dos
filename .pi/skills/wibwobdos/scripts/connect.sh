#!/usr/bin/env bash
# connect.sh — establish SSH tunnel to WibWob-DOS and verify health
#
# Usage:
#   eval "$(bash scripts/connect.sh)"          # sets WIBWOB_API in current shell
#   bash scripts/connect.sh                    # prints export line only
#
# Env vars (set before running, or pass as args):
#   WIBWOB_HOST       SSH host (required unless already tunneled)
#   WIBWOB_PORT       SSH port (default: 2849)
#   WIBWOB_SSH_KEY    path to your agent SSH key (required for tunnel)
#   WIBWOB_LOCAL_PORT local port for the tunnel (default: 19099)
#   WIBWOB_API        if already set + healthy, skips tunnel setup
#
# If WIBWOB_API is already set and responding, connect.sh just re-verifies it.
# Useful when running on the same machine as the app (no tunnel needed).

set -euo pipefail

LOCAL_PORT="${WIBWOB_LOCAL_PORT:-19099}"
SSH_PORT="${WIBWOB_PORT:-2849}"
SSH_USER="wibwob"

# ── Already connected? ────────────────────────────────────────────────────────

try_api() {
  local api="$1"
  if curl -sf --connect-timeout 2 "$api/health" > /dev/null 2>&1; then
    local label
    label=$(curl -sf --connect-timeout 3 "$api/health" \
      | python3 -c "import sys,json; d=json.loads(sys.stdin.read()); print(d.get('instanceLabel','?'))" 2>/dev/null || echo "?")
    echo "export WIBWOB_API=$api" >&2
    echo "# connected: $api  instance=$label" >&2
    echo "export WIBWOB_API=$api"
    return 0
  fi
  return 1
}

# If WIBWOB_API is already set and healthy — done
if [[ -n "${WIBWOB_API:-}" ]]; then
  if try_api "$WIBWOB_API"; then exit 0; fi
fi

# If local port is already tunneled and healthy — done
if try_api "http://127.0.0.1:$LOCAL_PORT" 2>/dev/null; then exit 0; fi

# ── Validate SSH params ───────────────────────────────────────────────────────

if [[ -z "${WIBWOB_HOST:-}" ]]; then
  echo "error: WIBWOB_HOST not set" >&2
  echo "  export WIBWOB_HOST=your.host.or.ip" >&2
  exit 1
fi

if [[ -z "${WIBWOB_SSH_KEY:-}" ]]; then
  echo "error: WIBWOB_SSH_KEY not set" >&2
  echo "  export WIBWOB_SSH_KEY=~/.ssh/your_agent_key" >&2
  exit 1
fi

if [[ ! -f "$WIBWOB_SSH_KEY" ]]; then
  echo "error: key file not found: $WIBWOB_SSH_KEY" >&2
  exit 1
fi

# ── Kill any stale tunnel on LOCAL_PORT ───────────────────────────────────────

pkill -f "${LOCAL_PORT}:127.0.0.1:8099" 2>/dev/null || true
sleep 0.5

# ── Open tunnel ───────────────────────────────────────────────────────────────

echo "connecting to $SSH_USER@$WIBWOB_HOST:$SSH_PORT ..." >&2

ssh -fN \
  -i "$WIBWOB_SSH_KEY" \
  -p "$SSH_PORT" \
  -o StrictHostKeyChecking=no \
  -o BatchMode=yes \
  -o ConnectTimeout=10 \
  -L "${LOCAL_PORT}:127.0.0.1:8099" \
  "${SSH_USER}@${WIBWOB_HOST}" || {
    echo "error: SSH connection failed" >&2
    echo "  check WIBWOB_HOST, WIBWOB_PORT, WIBWOB_SSH_KEY" >&2
    exit 1
  }

# ── Wait for health ───────────────────────────────────────────────────────────

TARGET="http://127.0.0.1:$LOCAL_PORT"
echo "waiting for API ..." >&2

for i in $(seq 1 20); do
  if curl -sf --connect-timeout 1 "$TARGET/health" > /dev/null 2>&1; then
    LABEL=$(curl -sf "$TARGET/health" \
      | python3 -c "import sys,json; d=json.loads(sys.stdin.read()); print(d.get('instanceLabel','?'))" 2>/dev/null || echo "?")
    echo "ready: $TARGET  instance=$LABEL" >&2
    echo "export WIBWOB_API=$TARGET"
    exit 0
  fi
  sleep 0.5
done

echo "error: API did not respond on $TARGET after 10s" >&2
echo "  check that WibWob-DOS is running in the remote tmux session:" >&2
echo "  ssh -i \$WIBWOB_SSH_KEY -p $SSH_PORT $SSH_USER@\$WIBWOB_HOST 'tmux has-session -t wibwob'" >&2
exit 1
