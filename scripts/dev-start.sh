#!/usr/bin/env bash
# dev-start.sh — start WibWobDOS TUI + API locally (macOS, non-Docker)
#
# Usage:
#   ./scripts/dev-start.sh           # start both with defaults
#   WIBWOB_INSTANCE=2 ./scripts/dev-start.sh  # different instance slot
#
# After running:
#   tmux attach -t wibwob           # see the TUI
#   tmux attach -t wibwob-api       # see API logs (Ctrl+B D to detach)
#   ./scripts/dev-stop.sh           # tear everything down

set -euo pipefail

INSTANCE=${WIBWOB_INSTANCE:-1}
PORT=${WIBWOB_API_PORT:-8089}
BINARY="./build/app/test_pattern"
SOCKET="/tmp/wibwob_${INSTANCE}.sock"
VENV="./tools/api_server/venv/bin/python"
TUI_SESSION="wibwob"
API_SESSION="wibwob-api"

# ── Preflight ────────────────────────────────────────────────────────────────

if [ ! -x "$BINARY" ]; then
  echo "❌  Binary not found: $BINARY"
  echo "    Run: cmake . -B build -DCMAKE_BUILD_TYPE=Release && cmake --build build --target test_pattern -j\$(sysctl -n hw.logicalcpu)"
  exit 1
fi

if [ ! -x "$VENV" ]; then
  echo "❌  Python venv not found: $VENV"
  echo "    Run: cd tools/api_server && python3 -m venv venv && venv/bin/pip install -r requirements.txt"
  exit 1
fi

# Kill stale sessions cleanly
tmux kill-session -t "$TUI_SESSION" 2>/dev/null && echo "🧹  Killed stale $TUI_SESSION session" || true
tmux kill-session -t "$API_SESSION" 2>/dev/null && echo "🧹  Killed stale $API_SESSION session" || true
rm -f "$SOCKET"

# ── TUI ──────────────────────────────────────────────────────────────────────

echo "🖥   Starting TUI (instance=$INSTANCE)..."
# No -x/-y: tmux will inherit your terminal's actual dimensions when you attach.
# Forcing a size (e.g. -x 320 -y 78) makes the canvas bigger than your viewport
# and windows render partially off-screen.
tmux new-session -d -s "$TUI_SESSION" \
  "WIBWOB_INSTANCE=$INSTANCE $BINARY 2>/tmp/wibwob_debug.log; echo '[TUI exited — press any key]'; read"

echo "⏳  Waiting for IPC socket at $SOCKET ..."
for i in $(seq 1 30); do
  [ -S "$SOCKET" ] && break
  sleep 0.3
done

if [ ! -S "$SOCKET" ]; then
  echo "❌  Socket never appeared. TUI log:"
  tail -20 /tmp/wibwob_debug.log 2>/dev/null || echo "(no log)"
  exit 1
fi
echo "✅  TUI ready (socket: $SOCKET)"

# ── API ──────────────────────────────────────────────────────────────────────

echo "🌐  Starting API (port=$PORT)..."
tmux new-session -d -s "$API_SESSION" \
  "WIBWOB_INSTANCE=$INSTANCE $VENV -m tools.api_server.main --port=$PORT 2>&1 | tee /tmp/wibwob_api.log; echo '[API exited — press any key]'; read"

echo "⏳  Waiting for API health ..."
for i in $(seq 1 30); do
  curl -sf "http://127.0.0.1:$PORT/health" > /dev/null 2>&1 && break
  sleep 0.3
done

if ! curl -sf "http://127.0.0.1:$PORT/health" > /dev/null 2>&1; then
  echo "❌  API not healthy. Logs:"
  tail -20 /tmp/wibwob_api.log 2>/dev/null || echo "(no log)"
  exit 1
fi
echo "✅  API ready (http://127.0.0.1:$PORT)"

# ── Done ─────────────────────────────────────────────────────────────────────

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " WibWobDOS running  (instance $INSTANCE)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  TUI  →  tmux attach -t $TUI_SESSION"
echo "  API  →  http://127.0.0.1:$PORT"
echo "  Logs →  tmux attach -t $API_SESSION"
echo "  Stop →  ./scripts/dev-stop.sh"
echo ""
