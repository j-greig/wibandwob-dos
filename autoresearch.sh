#!/usr/bin/env bash
# Ghostty TUI Control — agent-as-human reliability benchmark
# Runs 15 binary tests, outputs METRIC tui_score=N
set -uo pipefail

SCRIPTS=".pi/skills/ghostty-control/scripts"
SCORE=0
TOTAL=15

pass() { SCORE=$((SCORE + 1)); echo "  ✓ $1"; }
fail() { echo "  ✗ $1"; }
wf() { bash "${SCRIPTS}/wait-for.sh" "$@" 2>/dev/null; }
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
wf text "Open Primer" --timeout 3 || true
SHOT=$(wibwob screenshot 2>/dev/null)
if echo "$SHOT" | grep -q "Open Primer\|Open Text\|Quit"; then
  pass "menu-click File opens menu"
else
  fail "menu-click File: menu not visible"
fi

# 4. menu.close closes it via API
wibwob cmd menu.close 2>/dev/null
sleep 0.3
SHOT2=$(wibwob screenshot 2>/dev/null)
if echo "$SHOT2" | grep -q "Open Primer\.\.\.\|Open Text File\.\.\.\|Open Markdown"; then
  fail "menu.close: menu still open"
else
  pass "menu.close closes menu"
fi

# 5. menu-click Core Apps > Figlet Banner opens overlay
bash "${SCRIPTS}/menu-click.sh" "Core Apps" "Figlet Banner" 2>/dev/null
wf overlay --timeout 5
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

# 8. API confirm overlay → window appears
curl -sf -X POST "http://127.0.0.1:${PORT}/overlay/confirm" >/dev/null 2>&1
wf no-overlay --timeout 5
WINS=$(wibwob windows 2>/dev/null | jq 'length')
OV_GONE=$(curl -sf "http://127.0.0.1:${PORT}/overlay/info" | jq -r '.result.active' 2>/dev/null)
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

# 6. menu-click File > Quit exits app
bash "${SCRIPTS}/menu-click.sh" "File" "Quit" 2>/dev/null
wf no-health --timeout 8
if curl -sf "http://127.0.0.1:${PORT}/health" >/dev/null 2>&1; then
  fail "menu-click File > Quit: instance still alive"
else
  pass "menu-click File > Quit exits app"
fi

# 11. send-to-terminal restarts app
bash "${SCRIPTS}/send-to-terminal.sh" wibandwob-dos "bun run dev" 2>/dev/null
wf health --timeout 15
NEW_PORT=$(port)
if wibwob health 2>&1 | grep -q "^port:"; then
  pass "send-to-terminal restarts app"
else
  fail "send-to-terminal: app didn't start"
fi

# 12. Full cycle verification
if [[ -n "$NEW_PORT" ]] && curl -sf "http://127.0.0.1:${NEW_PORT}/health" | jq -e '.ok' >/dev/null 2>&1; then
  pass "full cycle: health OK after restart"
else
  fail "full cycle: health check failed"
fi

# ── Multi-app + new features ──
echo ""
echo "Multi-app + clickables:"

# 13. Open two apps, verify window count (isolated setup — doesn't depend on earlier state)
curl -sf -X POST "http://127.0.0.1:${NEW_PORT}/view/figlet/open" \
  -H 'Content-Type: application/json' -d '{"text":"A","font":"banner"}' >/dev/null
wf windows-count 1 --timeout 5
bash "${SCRIPTS}/menu-click.sh" "Demos" "Hello World" 2>/dev/null
wf windows-count 2 --timeout 5
WIN_COUNT=$(wibwob windows 2>/dev/null | jq 'length')
if [[ "${WIN_COUNT:-0}" -ge 2 ]]; then
  pass "two apps open simultaneously (${WIN_COUNT} windows)"
else
  fail "two apps: only ${WIN_COUNT} windows"
fi

# 14. window.click triggers [F] Font on figlet via API (no mouse, headless)
FIGLET_ID=$(wibwob windows 2>/dev/null | jq '[.[] | select(.appType=="wibwob.figlet")] | .[0].id')
if [[ "$FIGLET_ID" != "null" && -n "$FIGLET_ID" ]]; then
  CLICK_RESULT=$(curl -sf -X POST "http://127.0.0.1:${NEW_PORT}/windows/click" \
    -H 'Content-Type: application/json' -d "{\"id\": ${FIGLET_ID}, \"label\": \"[F] Font\"}")
  if echo "$CLICK_RESULT" | jq -e '.ok == true' >/dev/null 2>&1; then
    pass "window.click [F] Font opens picker headlessly"
  else
    fail "window.click: $(echo "$CLICK_RESULT" | jq -r '.error // "unknown"')"
  fi
else
  fail "window.click: no figlet window found"
fi

# 15. Close all windows via API, verify clean desktop
wibwob windows 2>/dev/null | jq -r '.[].id' | while read -r wid; do
  curl -sf -X POST "http://127.0.0.1:${NEW_PORT}/windows/close" \
    -H 'Content-Type: application/json' -d "{\"id\": ${wid}}" >/dev/null 2>&1 || true
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
