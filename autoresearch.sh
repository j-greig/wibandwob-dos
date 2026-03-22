#!/usr/bin/env bash
# Ghostty TUI Control — agent-as-human reliability benchmark
# Runs 12 binary tests, outputs METRIC tui_score=N
set -uo pipefail

SCRIPTS=".pi/skills/ghostty-control/scripts"
SCORE=0
TOTAL=15

pass() { SCORE=$((SCORE + 1)); echo "  ✓ $1"; }
fail() { echo "  ✗ $1"; }

port() { wibwob health 2>&1 | awk '/^port:/{print $2}'; }

echo "=== Ghostty TUI Control Benchmark ==="
echo ""

# ── Infrastructure ──
echo "Infrastructure:"

# 1. calibrate.sh returns valid vars
CALIB=$(bash "${SCRIPTS}/calibrate.sh" 2>/dev/null) || true
if echo "$CALIB" | grep -q "CELL_W=" && echo "$CALIB" | grep -q "PORT="; then
  eval "$CALIB"
  export CELL_W CELL_H GHOSTTY_WIN_INDEX PORT
  pass "calibrate.sh returns valid vars"
else
  fail "calibrate.sh failed"
  echo "METRIC tui_score=0"
  exit 0
fi

# 2. ghostty-windows.sh finds wibandwob-dos
GW=$(bash "${SCRIPTS}/ghostty-windows.sh" 2>&1)
if echo "$GW" | grep -q "wibandwob-dos"; then
  pass "ghostty-windows.sh finds wibandwob-dos"
else
  fail "ghostty-windows.sh: no wibandwob-dos window"
fi

# ── Menu interaction ──
echo ""
echo "Menu interaction:"

# 3. menu-click opens File menu
bash "${SCRIPTS}/menu-click.sh" "File" 2>/dev/null
sleep 0.8
SHOT=$(wibwob screenshot 2>/dev/null)
if echo "$SHOT" | grep -q "Open Primer\|Open Text\|Quit"; then
  pass "menu-click File opens menu"
else
  fail "menu-click File: menu not visible"
fi

# 4. Close menu — click empty area (blessed menus close on click-away)
bash "${SCRIPTS}/click-cell.sh" 80 30 --single 2>/dev/null
sleep 0.5
SHOT2=$(wibwob screenshot 2>/dev/null)
if echo "$SHOT2" | grep -q "Open Primer\.\.\.\|Open Text File\.\.\.\|Open Markdown"; then
  fail "click-away: menu still open"
else
  pass "click-away closes menu"
fi

# 5. menu-click Core Apps > Figlet Banner opens overlay
bash "${SCRIPTS}/menu-click.sh" "Core Apps" "Figlet Banner" 2>/dev/null
sleep 1
OV=$(curl -sf "http://127.0.0.1:${PORT}/overlay/info")
if echo "$OV" | jq -e '.result.active == true and .result.type == "value"' >/dev/null 2>&1; then
  pass "menu-click Core Apps > Figlet Banner opens overlay"
else
  fail "Figlet Banner: no overlay appeared"
fi

# ── Overlay interaction ──
echo ""
echo "Overlay interaction:"

# 7. set-text changes overlay value
curl -sf -X POST "http://127.0.0.1:${PORT}/overlay/set-text" \
  -H 'Content-Type: application/json' -d '{"text": "TEST123"}' >/dev/null
OV2=$(curl -sf "http://127.0.0.1:${PORT}/overlay/info")
if echo "$OV2" | jq -e '.result.value == "TEST123"' >/dev/null 2>&1; then
  pass "overlay/set-text changes value"
else
  fail "overlay/set-text: value not updated"
fi

# 8. API confirm overlay → window appears (COAT: API is the reliable path)
curl -sf -X POST "http://127.0.0.1:${PORT}/overlay/confirm" >/dev/null 2>&1
sleep 1
OV3=$(curl -sf "http://127.0.0.1:${PORT}/overlay/info")
WINS=$(wibwob windows 2>/dev/null | jq 'length')
OV_GONE=$(echo "$OV3" | jq -r '.result.active' 2>/dev/null)
if [[ "$OV_GONE" == "false" && "${WINS:-0}" -ge 1 ]]; then
  pass "overlay/confirm dismisses overlay, window appeared"
else
  fail "overlay/confirm: active=$OV_GONE wins=$WINS"
fi

# ── Window verification ──
echo ""
echo "Window verification:"

# 9. Window has correct title and appType
WIN_INFO=$(wibwob windows 2>/dev/null | jq -r '.[-1] | "\(.title) \(.appType // .details.appType // "unknown")"')
if echo "$WIN_INFO" | grep -qi "TEST123\|figlet"; then
  pass "window has correct title/appType"
else
  fail "window title/appType: got '$WIN_INFO'"
fi

# 10. screenshot/text returns content
WIN_ID=$(wibwob windows 2>/dev/null | jq '.[-1].id')
CONTENT=$(wibwob screenshot "$WIN_ID" 2>/dev/null)
CONTENT_LEN=${#CONTENT}
if [[ $CONTENT_LEN -gt 10 ]]; then
  pass "screenshot/text returns content (${CONTENT_LEN} chars)"
else
  fail "screenshot/text: empty or too short (${CONTENT_LEN} chars)"
fi

# ── Lifecycle ──
echo ""
echo "Lifecycle:"

# 6. menu-click File > Quit exits app (deferred here to not break earlier tests)
bash "${SCRIPTS}/menu-click.sh" "File" "Quit" 2>/dev/null
sleep 2
if curl -sf "http://127.0.0.1:${PORT}/health" >/dev/null 2>&1; then
  fail "menu-click File > Quit: instance still alive"
else
  pass "menu-click File > Quit exits app"
fi

# 11. send-to-terminal restarts app
sleep 2  # let shell return to prompt after app exits
bash "${SCRIPTS}/send-to-terminal.sh" wibandwob-dos "bun run dev" 2>/dev/null
STARTED=false
for i in 1 2 3 4 5 6 7 8 9 10; do
  sleep 1
  if wibwob health 2>&1 | grep -q "^port:"; then
    STARTED=true
    break
  fi
done
if $STARTED; then
  pass "send-to-terminal restarts app (${i}s)"
else
  fail "send-to-terminal: app didn't start within 8s"
fi

# 12. Full cycle verification — health OK after restart
NEW_PORT=$(port)
if [[ -n "$NEW_PORT" ]] && curl -sf "http://127.0.0.1:${NEW_PORT}/health" | jq -e '.ok' >/dev/null 2>&1; then
  pass "full cycle: health OK after restart"
else
  fail "full cycle: health check failed"
fi

# ── Multi-app interaction (real agent workflow) ──
echo ""
echo "Multi-app interaction:"

# 13. Open a second app via menu while first is still open
bash "${SCRIPTS}/menu-click.sh" "Demos" "Hello World" 2>/dev/null
sleep 1
WIN_COUNT=$(wibwob windows 2>/dev/null | jq 'length')
if [[ "${WIN_COUNT:-0}" -ge 2 ]]; then
  pass "open second app while first exists (${WIN_COUNT} windows)"
else
  fail "second app: only ${WIN_COUNT} windows"
fi

# 14. click-text finds text and clicks it (on-screen button/label)
# Use the figlet banner's [F] Font button
bash "${SCRIPTS}/click-text.sh" "[F] Font" --single 2>/dev/null
sleep 0.5
SHOT_FONT=$(wibwob screenshot 2>/dev/null)
if echo "$SHOT_FONT" | grep -q "Fonts\|Preview\|Bloody\|bolger"; then
  pass "click-text finds and clicks [F] Font"
else
  fail "click-text [F] Font: picker not visible"
fi

# 15. Close all windows via API, verify clean desktop
CLOSE_IDS=$(wibwob windows 2>/dev/null | jq -r '.[].id')
for wid in $CLOSE_IDS; do
  curl -sf -X POST "http://127.0.0.1:${NEW_PORT:-${PORT}}/windows/close" \
    -H 'Content-Type: application/json' -d "{\"id\": ${wid}}" >/dev/null 2>&1
done
sleep 0.3
REMAINING=$(wibwob windows 2>/dev/null | jq 'length')
if [[ "${REMAINING:-1}" -eq 0 ]]; then
  pass "close all windows: clean desktop"
else
  fail "close all windows: ${REMAINING} remain"
fi

echo ""
echo "=== Score: ${SCORE}/${TOTAL} ==="
echo "METRIC tui_score=${SCORE}"
