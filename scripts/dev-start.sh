#!/usr/bin/env bash
# dev-start.sh — start WibWobDOS TUI + API locally (macOS, non-Docker)
#
# Usage:
#   ./scripts/dev-start.sh          # start both
#   WIBWOB_INSTANCE=2 ./scripts/dev-start.sh  # second instance on port 8090
#
# After running:
#   tmux attach -t $TUI_SESSION           # see TUI (Ctrl-B D to detach)
#   tmux attach -t "$API_SESSION"       # see API log
#   ./scripts/dev-stop.sh           # kill both cleanly

set -euo pipefail

INSTANCE="${WIBWOB_INSTANCE:-1}"
PORT="${WIBWOB_API_PORT:-8089}"
BINARY="./build/app/wwdos"
SOCKET="/tmp/wibwob_${INSTANCE}.sock"
VENV_UVICORN="./tools/api_server/venv/bin/uvicorn"
# Session names are instance-scoped so multiple instances coexist
TUI_SESSION="wibwob${INSTANCE}"
API_SESSION="wibwob${INSTANCE}-api"
[ "$INSTANCE" = "1" ] && TUI_SESSION="wibwob" && API_SESSION="wibwob-api"

# ── Preflight ─────────────────────────────────────────────────────────────────
[ -x "$BINARY" ] || {
  echo "❌ Binary not found: $BINARY"
  echo "   Build first: cmake --build ./build --target wwdos -j\$(nproc)"
  exit 1
}
[ -x "$VENV_UVICORN" ] || {
  echo "❌ Venv not found: $VENV_UVICORN"
  echo "   Run: cd tools/api_server && python3 -m venv venv && venv/bin/pip install -r requirements.txt"
  exit 1
}

# ── Kill stale API session only ───────────────────────────────────────────────
tmux kill-session -t "$API_SESSION" 2>/dev/null || true
rm -f "$SOCKET"

# ── Start TUI ─────────────────────────────────────────────────────────────────
echo "🖥  Starting TUI (tmux session: wibwob)..."
if tmux has-session -t "$TUI_SESSION" 2>/dev/null; then
  # Session exists (monitor layout intact) — restart TUI in pane 0
  echo "   (reusing existing wibwob session, monitor layout preserved)"
  tmux send-keys -t $TUI_SESSION:0.0 "" C-c 2>/dev/null || true
  sleep 0.3
  tmux send-keys -t $TUI_SESSION:0.0 \
    "WIBWOB_INSTANCE=$INSTANCE $BINARY 2>/tmp/wibwob_${INSTANCE}_debug.log" Enter
else
  # Fresh start
  tmux new-session -d -s "$TUI_SESSION" \
    "WIBWOB_INSTANCE=$INSTANCE $BINARY 2>/tmp/wibwob_${INSTANCE}_debug.log"
fi

# ── Wait for IPC socket ───────────────────────────────────────────────────────
echo "⏳ Waiting for socket $SOCKET..."
for i in $(seq 1 30); do
  [ -S "$SOCKET" ] && break
  sleep 0.5
done
[ -S "$SOCKET" ] || {
  echo "❌ Socket never appeared. Check: cat /tmp/wibwob_${INSTANCE}_debug.log"
  exit 1
}
echo "   Socket ready."

# ── Start API server with --reload ────────────────────────────────────────────
echo "🌐 Starting API (tmux session: wibwob-api, port $PORT)..."
tmux new-session -d -s "$API_SESSION" \
  "WIBWOB_INSTANCE=$INSTANCE $VENV_UVICORN tools.api_server.main:app \
   --host 127.0.0.1 --port $PORT --reload 2>&1 | tee /tmp/wibwob__api.log"

# ── Wait for API health ───────────────────────────────────────────────────────
echo "⏳ Waiting for API health..."
for i in $(seq 1 20); do
  curl -sf "http://127.0.0.1:$PORT/health" >/dev/null 2>&1 && break
  sleep 0.5
done
curl -sf "http://127.0.0.1:$PORT/health" >/dev/null || {
  echo "❌ API not healthy. Check: tmux attach -t "$API_SESSION""
  exit 1
}

echo ""
echo "✅ WibWobDOS running (instance=$INSTANCE)"
echo ""
echo "   TUI:   tmux attach -t $TUI_SESSION         (Ctrl-B D to detach)"
echo "   API:   http://127.0.0.1:$PORT"
echo "   Logs:  tmux attach -t "$API_SESSION"     or  cat /tmp/wibwob_api.log"
echo "   Stop:  ./scripts/dev-stop.sh"
echo ""
echo "   ⚠️  Attach to TUI once so canvas locks to your terminal size:"
echo "      tmux attach -t $TUI_SESSION   # then Ctrl-B D"
