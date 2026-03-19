#!/usr/bin/env bash
# @name    theme-rave
# @desc    Open multiple themed figlet windows and cycle through all themes rapidly
#           Each window gets a different word, all themes fire in sequence
#
# Usage:
#   bash scripts/experimental/theme-rave.sh [rounds]
#   # e.g.
#   bash scripts/experimental/theme-rave.sh 4   # 4 complete theme cycles
#   bash scripts/experimental/theme-rave.sh 0   # infinite
#
# Themes cycle: wibwob-dark → wibwob-dark-nord → wibwob-dark-pastel → wibwob-phosphor → wibwob-light

set -uo pipefail
cd "$(dirname "$0")/../.."

API="${WIBWOB_API:-http://127.0.0.1:8100}"
ROUNDS="${1:-4}"
SPEED="${SPEED:-0.25}"

THEMES=("wibwob-dark" "wibwob-dark-nord" "wibwob-dark-pastel" "wibwob-phosphor" "wibwob-light")
WORDS=("RAVE" "PULSE" "BEAT" "GLOW" "SYNC")
FONTS=("banner3" "slant" "doom" "standard" "big")
WINDOW_W=60
WINDOW_H=14

ww_post() {
  curl -sf -X POST "$API$1" -H "Content-Type: application/json" -d "$2" > /dev/null
}

# ── Setup ──────────────────────────────────────────────────────────────
echo "=== THEME RAVE: $ROUNDS rounds @ ${SPEED}s ==="
echo "  themes: ${THEMES[*]}"

# Clear desktop
ww_post /commands/run '{"id":"desktop.clear-all"}'
sleep 0.2

# Open 5 figlet windows in a spread pattern
declare -a WIDS
X_START=5; Y_START=3; DX=40; DY=15

for i in "${!WORDS[@]}"; do
  WW="${WORDS[$i]}"
  FF="${FONTS[$i]}"
  XX=$((X_START + i * DX))
  YY=$((Y_START + i * DY))

  ww_post /commands/run "{\"id\":\"microapp.wibwob.figlet.open\",\"args\":{\"text\":\"$WW\",\"font\":\"$FF\"}}"
  sleep 0.3

  WID=$(ww_post /state 2>/dev/null | python3 -c "
import sys,json
ids=[w['id'] for w in json.load(sys.stdin).get('windows',[]) if 'figlet' in w.get('details',{}).get('appType','')]
print(ids[-1] if ids else '')
" 2>/dev/null || true)

  if [[ -n "$WID" ]]; then
    ww_post /windows/batch "{\"ops\":[{\"id\":$WID,\"width\":$WINDOW_W,\"height\":$WINDOW_H,\"left\":$XX,\"top\":$YY}]}"
    WIDS+=("$WID")
    echo "  [${i}] '$WW' ($FF) at ($XX,$YY) WID=$WID"
  fi
done

sleep 0.5
echo ""

# ── Rave loop ────────────────────────────────────────────────────────
ROUND=0
T=0
cleanup() {
  echo ""
  echo "=== done. $ROUND rounds, $T theme changes ==="
}
trap cleanup INT TERM

echo "  starting... ^C to stop"
echo ""

while true; do
  for i in "${!THEMES[@]}"; do
    THEME="${THEMES[$i]}"
    T=$((T + 1))

    # Set theme
    ww_post /commands/run "{\"id\":\"theme.set\",\"args\":{\"name\":\"$THEME\"}}" &

    # Update word on the i-th window
    if [[ -n "${WIDS[$i]:-}" ]]; then
      NEW_WORD="${WORDS[$((T / ${#WORDS[@]})) % ${#WORDS[@]}])}"
      ww_post /commands/run "{\"id\":\"microapp.wibwob.figlet.write\",\"args\":{\"windowId\":${WIDS[$i]},\"text\":\"$NEW_WORD\"}}"
    fi

    printf "  \033[1;3%dm[%-3d] %-20s \033[0m\r" "$((i+1))" "$T" "$THEME" >&2

    sleep "$SPEED"
  done

  ROUND=$((ROUND + 1))
  if [[ $ROUNDS -gt 0 ]] && [[ $ROUND -ge "$ROUNDS" ]]; then
    break
  fi
done

cleanup
