#!/usr/bin/env bash
set -euo pipefail

ROOT="/Users/james/Repos/wibandwob-dos"
SESSION="ts-tui-command-registry-smoke"
PORT="${CONTROL_API_PORT:-8116}"
STATE_FILE="$ROOT/scratch/app-state.json"
CAPTURE_DIR="$ROOT/scratch/captures"

mkdir -p "$CAPTURE_DIR"

if tmux has-session -t "$SESSION" 2>/dev/null; then
  tmux kill-session -t "$SESSION"
fi

tmux new-session -d -s "$SESSION" "cd '$ROOT' && CONTROL_API_PORT=$PORT bun run start"

for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:$PORT/health" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! curl -fsS "http://127.0.0.1:$PORT/health" >/dev/null 2>&1; then
  echo "control API did not start on port $PORT" >&2
  tmux capture-pane -pt "$SESSION" || true
  exit 1
fi

curl -fsS "http://127.0.0.1:$PORT/commands/list?surface=agent" > "$CAPTURE_DIR/command-registry-agent-list.json"

if ! grep -q '"id":"browser.open_chrome"' "$CAPTURE_DIR/command-registry-agent-list.json"; then
  echo "browser.open_chrome not exposed to agent surface" >&2
  exit 1
fi

if ! grep -q '"id":"window.tile"' "$CAPTURE_DIR/command-registry-agent-list.json"; then
  echo "window.tile not exposed to agent surface" >&2
  exit 1
fi

curl -fsS -X POST "http://127.0.0.1:$PORT/commands/run" \
  -H 'content-type: application/json' \
  -d '{"id":"browser.open_chrome"}' >/dev/null

curl -fsS -X POST "http://127.0.0.1:$PORT/commands/run" \
  -H 'content-type: application/json' \
  -d '{"id":"window.tile"}' >/dev/null

sleep 4

curl -fsS "http://127.0.0.1:$PORT/state" > "$STATE_FILE"
tmux capture-pane -pt "$SESSION" > "$CAPTURE_DIR/command-registry-smoke-pane.txt"

if ! bun -e 'const fs=require("node:fs");const state=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));const hasChrome=state.windows.some((w)=>w.appType==="chrome-browser");if(!hasChrome) process.exit(1);' "$STATE_FILE"; then
  echo "chrome browser did not open via registry command" >&2
  exit 1
fi

echo "command registry smoke ok"
echo "state: $STATE_FILE"
echo "agent command list: $CAPTURE_DIR/command-registry-agent-list.json"
echo "tmux capture: $CAPTURE_DIR/command-registry-smoke-pane.txt"
