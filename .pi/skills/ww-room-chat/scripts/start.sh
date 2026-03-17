#!/usr/bin/env bash
# ww-room-chat/scripts/start.sh
# Spin up two WibWob-DOS instances sharing a fresh PartyKit room.
# Usage: ./start.sh [room-name]
#   room-name defaults to rchat-HHMMSS

set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

ROOM="${1:-rchat-$(date +%H%M%S)}"

echo "━━━ ww-room-chat ━━━"
echo "Room:  $ROOM"
echo "TUI 1: tmux attach -t wibwob1"
echo "TUI 2: tmux attach -t wibwob2"
echo ""

# ── Teardown any stale sessions ───────────────────────────────────────────────
tmux kill-server 2>/dev/null || true
sleep 0.3
rm -f /tmp/wibwob_*.sock /tmp/b1.log /tmp/b2.log

# ── Build (fast — only relinks if nothing changed) ───────────────────────────
echo "▸ build..."
cmake --build ./build --target test_pattern 2>&1 | grep -E "error:|Built target|Linking" | grep -v "^--" || true

# ── TUI instances ─────────────────────────────────────────────────────────────
echo "▸ TUIs..."
tmux new-session -d -s wibwob1 "WIBWOB_INSTANCE=1 ./build/app/test_pattern 2>/tmp/wibwob_1_debug.log"
tmux new-session -d -s wibwob2 "WIBWOB_INSTANCE=2 ./build/app/test_pattern 2>/tmp/wibwob_2_debug.log"

echo -n "  sockets"
for i in $(seq 1 40); do
  [[ -S /tmp/wibwob_1.sock && -S /tmp/wibwob_2.sock ]] && echo " ✓" && break
  echo -n "."; sleep 0.4
done

# ── API servers ───────────────────────────────────────────────────────────────
echo "▸ APIs..."
tmux new-session -d -s api1 "WIBWOB_INSTANCE=1 ./tools/api_server/venv/bin/uvicorn tools.api_server.main:app --host 127.0.0.1 --port 8089 2>&1"
tmux new-session -d -s api2 "WIBWOB_INSTANCE=2 ./tools/api_server/venv/bin/uvicorn tools.api_server.main:app --host 127.0.0.1 --port 8090 2>&1"

echo -n "  health"
for i in $(seq 1 30); do
  curl -sf http://127.0.0.1:8089/health &>/dev/null && \
  curl -sf http://127.0.0.1:8090/health &>/dev/null && echo " ✓" && break
  echo -n "."; sleep 0.5
done

# ── PartyKit bridges ──────────────────────────────────────────────────────────
echo "▸ bridges → $ROOM..."
tmux new-session -d -s bridge1 "WIBWOB_INSTANCE=1 \
  WIBWOB_PARTYKIT_URL=https://wibwob-rooms.j-greig.partykit.dev \
  WIBWOB_PARTYKIT_ROOM=$ROOM \
  uv run tools/room/partykit_bridge.py 2>&1 | tee /tmp/b1.log"

tmux new-session -d -s bridge2 "WIBWOB_INSTANCE=2 \
  WIBWOB_PARTYKIT_URL=https://wibwob-rooms.j-greig.partykit.dev \
  WIBWOB_PARTYKIT_ROOM=$ROOM \
  uv run tools/room/partykit_bridge.py 2>&1 | tee /tmp/b2.log"

echo -n "  connected"
for i in $(seq 1 20); do
  grep -q "connected" /tmp/b1.log 2>/dev/null && \
  grep -q "connected" /tmp/b2.log 2>/dev/null && echo " ✓" && break
  echo -n "."; sleep 0.5
done

# ── Open RoomChatView on both ─────────────────────────────────────────────────
echo "▸ opening room_chat windows..."
sleep 1
curl -s http://127.0.0.1:8089/windows -X POST -H "Content-Type: application/json" -d '{"type":"room_chat"}' > /dev/null
curl -s http://127.0.0.1:8090/windows -X POST -H "Content-Type: application/json" -d '{"type":"room_chat"}' > /dev/null

sleep 5

# ── Final state check ─────────────────────────────────────────────────────────
echo ""
echo "━━━ state ━━━"
for s in wibwob1 wibwob2; do
  echo "[$s]"
  tmux capture-pane -t $s -p 2>/dev/null \
    | sed 's/\x1b\[[0-9;]*m//g' \
    | grep -E "║.*•|║.*in room|╟" | head -5
done

echo ""
echo "━━━ ready ━━━"
echo "  tmux attach -t wibwob1"
echo "  tmux attach -t wibwob2"
echo "  Ctrl-B D to detach"
