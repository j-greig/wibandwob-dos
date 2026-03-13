#!/bin/bash
set -euo pipefail

# Antopolis autoresearch benchmark script
# Restarts app, opens Antopolis, captures screenshot, archives it.

# When symlinked from repo root, pwd is already correct.
# When run directly, caller must cd to repo root first.
REPO_ROOT="$(pwd)"

SCREENSHOT_PATH="autoresearch/antopolis/screenshot.png"
SHOTS_DIR="autoresearch/antopolis/shots"
DISPLAY_NUM="${DISPLAY_NUM:-2}"

# ── 1. Restart the app ───────────────────────────────────────────────
tmux resize-window -t wibwob -x 211 -y 56 2>/dev/null || true
bash scripts/restart.sh

# ── 2. Wait for health ───────────────────────────────────────────────
for i in $(seq 1 30); do
  if curl -sf http://127.0.0.1:8099/health > /dev/null 2>&1; then
    break
  fi
  sleep 1
done

curl -sf http://127.0.0.1:8099/health > /dev/null 2>&1 || {
  echo "ERROR: API not healthy after 30s"
  exit 1
}

# ── 3. Close existing windows, open Antopolis ────────────────────────
curl -sf http://127.0.0.1:8099/commands/run \
  -X POST -H 'Content-Type: application/json' \
  -d '{"command":"desktop.clear-all"}' > /dev/null 2>&1 || true

sleep 1

curl -sf http://127.0.0.1:8099/commands/run \
  -X POST -H 'Content-Type: application/json' \
  -d '{"command":"microapp.wibwob.terrarium.open"}' > /dev/null 2>&1 || true

# Let the simulation run a few ticks so there are particles and events
sleep 5

# ── 4. Capture screenshot ────────────────────────────────────────────
mkdir -p "$(dirname "$SCREENSHOT_PATH")"
./scripts/capture-tui-png.sh --display "$DISPLAY_NUM" --out "$SCREENSHOT_PATH"

# ── 5. Archive with unique name ──────────────────────────────────────
mkdir -p "$SHOTS_DIR"
NEXT_NUM=$(printf "%03d" "$(( $(ls "$SHOTS_DIR"/*.png 2>/dev/null | wc -l) + 1 ))")
STAMP=$(date +%H%M%S)
ARCHIVE_PATH="$SHOTS_DIR/${NEXT_NUM}-${STAMP}.png"
cp "$SCREENSHOT_PATH" "$ARCHIVE_PATH"

echo "Screenshot saved to $SCREENSHOT_PATH"
echo "Archived to $ARCHIVE_PATH"
echo "Agent should Read this file and score it against the rubric."
