#!/usr/bin/env bash
# dev-start.sh — start WibWobDOS TUI + API locally (macOS, non-Docker)
#
# Usage:
#   ./scripts/dev-start.sh          # start both
#   WIBWOB_INSTANCE=2 ./scripts/dev-start.sh  # second instance on port 8090
#
# After running:
#   tmux attach -t wibwob           # see TUI (Ctrl-B D to detach)
#   tmux attach -t wibwob-api       # see API log
#   ./scripts/dev-stop.sh           # kill both cleanly

set -euo pipefail

INSTANCE="${WIBWOB_INSTANCE:-1}"
PORT="${WIBWOB_API_PORT:-8089}"
BINARY="./build/app/test_pattern"
SOCKET="/tmp/wibwob_${INSTANCE}.sock"
VENV_UVICORN="./tools/api_server/venv/bin/uvicorn"

# ── Preflight ─────────────────────────────────────────────────────────────────
[ -x "$BINARY" ] || {
  echo "❌ Binary not found: $BINARY"
  echo "   Build first: cmake --build ./build --target test_pattern -j\$(nproc)"
  exit 1
}
[ -x "$VENV_UVICORN" ] || {
  echo "❌ Venv not found: $VENV_UVICORN"
  echo "   Run: cd tools/api_server && python3 -m venv venv && venv/bin/pip install -r requirements.txt"
  exit 1
}

# ── Kill stale sessions ───────────────────────────────────────────────────────
tmux kill-session -t wibwob     2>/dev/null || true
tmux kill-session -t wibwob-api 2>/dev/null || true
rm -f "$SOCKET"

# ── Start TUI (no -x/-y — inherits real terminal on first attach) ─────────────
echo "🖥  Starting TUI (tmux session: wibwob)..."
WIBWOB_INSTANCE="$INSTANCE" tmux new-session -d -s wibwob \
  "$BINARY 2>/tmp/wibwob_debug.log"

# ── Wait for IPC socket ───────────────────────────────────────────────────────
echo "⏳ Waiting for socket $SOCKET..."
for i in $(seq 1 30); do
  [ -S "$SOCKET" ] && break
  sleep 0.5
done
[ -S "$SOCKET" ] || {
  echo "❌ Socket never appeared. Check: cat /tmp/wibwob_debug.log"
  exit 1
}
echo "   Socket ready."

# ── Start API server with --reload ────────────────────────────────────────────
echo "🌐 Starting API (tmux session: wibwob-api, port $PORT)..."
tmux new-session -d -s wibwob-api \
  "WIBWOB_INSTANCE=$INSTANCE $VENV_UVICORN tools.api_server.main:app \
   --host 127.0.0.1 --port $PORT --reload 2>&1 | tee /tmp/wibwob_api.log"

# ── Wait for API health ───────────────────────────────────────────────────────
echo "⏳ Waiting for API health..."
for i in $(seq 1 20); do
  curl -sf "http://127.0.0.1:$PORT/health" >/dev/null 2>&1 && break
  sleep 0.5
done
curl -sf "http://127.0.0.1:$PORT/health" >/dev/null || {
  echo "❌ API not healthy. Check: tmux attach -t wibwob-api"
  exit 1
}

echo ""
echo "✅ WibWobDOS running (instance=$INSTANCE)"
echo ""
echo "   TUI:   tmux attach -t wibwob         (Ctrl-B D to detach)"
echo "   API:   http://127.0.0.1:$PORT"
echo "   Logs:  tmux attach -t wibwob-api     or  cat /tmp/wibwob_api.log"
echo "   Stop:  ./scripts/dev-stop.sh"
echo ""
echo "   ⚠️  Attach to TUI once so canvas locks to your terminal size:"
echo "      tmux attach -t wibwob   # then Ctrl-B D"
