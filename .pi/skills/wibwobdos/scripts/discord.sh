#!/usr/bin/env bash
# discord.sh — share WibWob-DOS state to a Discord channel
#
# Usage:
#   bash scripts/discord.sh                     # minimap + PNG (default: both)
#   bash scripts/discord.sh minimap             # ASCII spatial layout only (no deps)
#   bash scripts/discord.sh png                 # PNG image only (requires Pillow)
#   bash scripts/discord.sh png --window-id 3   # single window as PNG
#   bash scripts/discord.sh both                # minimap text + PNG image
#
# Required env:
#   DISCORD_WEBHOOK_URL   — from Discord channel → Integrations → Webhooks
#
# Optional env:
#   DISCORD_MESSAGE       — caption prepended to every post (auto-uses instanceLabel)
#   WIBWOB_API            — default: http://127.0.0.1:8099
#   WIBWOB_TOKEN          — bearer token for API auth
#
# Getting a webhook URL:
#   1. Discord channel → gear icon → Integrations → Webhooks → New Webhook
#   2. Copy URL — treat it like a password (no auth, anyone with it can post)

set -euo pipefail
API="${WIBWOB_API:-http://127.0.0.1:8099}"
TOKEN="${WIBWOB_TOKEN:-}"
SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

MODE="${1:-both}"
WIN_ID=""

shift 2>/dev/null || true
while [[ $# -gt 0 ]]; do
  case "$1" in
    --window-id) WIN_ID="$2"; shift 2 ;;
    *) shift ;;
  esac
done

# ── Validation ────────────────────────────────────────────────────────────────

if [[ -z "${DISCORD_WEBHOOK_URL:-}" ]]; then
  echo "error: DISCORD_WEBHOOK_URL not set" >&2
  echo ""
  echo "Get one from: Discord channel → Integrations → Webhooks → New Webhook" >&2
  echo "Then: export DISCORD_WEBHOOK_URL='https://discord.com/api/webhooks/...'" >&2
  exit 1
fi

# /health is public — no token needed
curl -sf --connect-timeout 3 "$API/health" > /dev/null || {
  echo "error: WibWob-DOS not reachable at $API" >&2
  echo "  run: eval \"\$(bash scripts/connect.sh)\"" >&2
  exit 1
}

# Warn if token not set (needed for /state)
if [[ -z "$TOKEN" ]]; then
  echo "warning: WIBWOB_TOKEN not set — some requests may return 401. Run: eval \"\$(bash scripts/connect.sh)\"" >&2
fi

LABEL=$(curl -sf "$API/health" \
  | python3 -c "import sys,json; d=json.loads(sys.stdin.read()); print(d.get('instanceLabel') or d.get('sessionId','?'))" \
  2>/dev/null || echo "wibwobdos")

CAPTION="${DISCORD_MESSAGE:-WibWob-DOS \`$LABEL\`}"

# ── Minimap helper ────────────────────────────────────────────────────────────

post_minimap() {
  # Try the repo minimap script first (richer output), then inline fallback
  REPO_MINIMAP="$(cd "$SKILL_DIR/../../../" 2>/dev/null && pwd)/scripts/minimap.sh"

  if [[ -f "$REPO_MINIMAP" ]]; then
    MAP=$(WIBWOB_API="$API" WIBWOB_TOKEN="$TOKEN" bash "$REPO_MINIMAP" 2>/dev/null) || MAP=""
  fi

  if [[ -z "${MAP:-}" ]]; then
    # Inline fallback — just list windows (requires token for /state)
    MAP=$(curl -sf \
      -H "Authorization: Bearer $TOKEN" \
      "$API/state" | python3 -c "
import sys, json
d    = json.loads(sys.stdin.read())
wins = d.get('windows', [])
scr  = d.get('screen', {})
app  = d.get('app', {})
print(f\"{scr.get('width','?')}x{scr.get('height','?')}  {app.get('theme','?')}  {len(wins)} windows\")
for w in wins:
  r = w.get('rect', {})
  print(f\"  [{w['id']}] {w.get('title','?'):<30}  {r.get('w','?')}x{r.get('h','?')}  @{r.get('x','?')},{r.get('y','?')}\")
" 2>/dev/null || echo "(state unavailable)")
  fi

  local BODY
  BODY=$(python3 -c "
import json, sys
caption = sys.argv[1]
map_text = sys.argv[2][:1800]  # Discord 2000 char limit
content  = caption + '\n\`\`\`\n' + map_text + '\n\`\`\`'
print(json.dumps({'content': content}))
" "$CAPTION" "$MAP")

  curl -sf -X POST \
    -H "Content-Type: application/json" \
    -d "$BODY" \
    "$DISCORD_WEBHOOK_URL" > /dev/null
  echo "posted: minimap ($LABEL)"
}

# ── PNG helper ────────────────────────────────────────────────────────────────

post_png() {
  if ! python3 -c "from PIL import Image" 2>/dev/null; then
    echo "error: Pillow not installed — run: pip install Pillow" >&2
    return 1
  fi

  local TMP_PNG="/tmp/wibwob-discord-$$.png"
  local PNG_ARGS=(--api "$API" --out "$TMP_PNG" --title "WibWob-DOS · $LABEL")
  [[ -n "$WIN_ID" ]] && PNG_ARGS+=(--window-id "$WIN_ID")
  [[ -n "$TOKEN" ]] && PNG_ARGS+=(--token "$TOKEN")

  python3 "$SKILL_DIR/tui-to-png.py" "${PNG_ARGS[@]}"

  # Escape caption for shell embedding in -F payload_json
  local JSON_CAPTION
  JSON_CAPTION=$(python3 -c "import json, sys; print(json.dumps({'content': sys.argv[1]}))" "$CAPTION")

  curl -sf -X POST \
    -F "payload_json=$JSON_CAPTION" \
    -F "file=@${TMP_PNG};type=image/png;filename=wibwob-tui.png" \
    "$DISCORD_WEBHOOK_URL" > /dev/null

  rm -f "$TMP_PNG"
  echo "posted: PNG ($LABEL)"
}

# ── Main ──────────────────────────────────────────────────────────────────────

case "$MODE" in
  minimap) post_minimap ;;
  png)     post_png     ;;
  both)
    post_minimap
    sleep 0.5
    post_png
    ;;
  *)
    echo "usage: $0 [minimap|png|both] [--window-id N]" >&2
    exit 1
    ;;
esac
