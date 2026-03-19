#!/usr/bin/env bash
# @name    heartbeat
# @desc    Pulse a figlet window like a heartbeat.
#           Clears desktop first, then beats with theme cycling and word swaps.
#
# Usage:
#   bash scripts/experimental/heartbeat.sh [word] [beats]
#   bash scripts/experimental/heartbeat.sh DOOM  12   # 12 beats
#   bash scripts/experimental/heartbeat.sh WIBWOB 0    # infinite
#
# Env: SPEED WIN_W WIN_H AMP_W AMP_H CX CY

set -uo pipefail
cd "$(dirname "$0")/../.."

API="${WIBWOB_API:-http://127.0.0.1:8100}"
WORD="${1:-WIBWOB}"
FONT="banner3"
BEATS="${2:-0}"           # 0 = infinite
SPEED="${SPEED:-0.08}"
AMP_W="${AMP_W:-30}"
AMP_H="${AMP_H:-12}"
CX="${CX:-60}"
CY="${CY:-20}"
WIN_W="${WIN_W:-50}"
WIN_H="${WIN_H:-14}"

WORDS=("WIB" "WOB" "WIBWOB" "DOOM" "YES" "NO" "ECHO" "LOOP" "SYNC" "DRIFT")
WORD_I=0

# Pass words as space-separated string, decode in Python
WORDS_STR="${WORDS[*]}"

ww_post() {
  curl -sf -X POST "$API$1" -H "Content-Type: application/json" -d "$2" > /dev/null
}

# ── Setup ──────────────────────────────────────────────────────────────
echo "=== HEARTBEAT: $WORD -- $BEATS beats @ ${SPEED}s ==="
echo "  amp: ${AMP_W}x${AMP_H}  centre: ($CX,$CY)"

ww_post /commands/run '{"id":"desktop.clear-all"}'
sleep 0.3

ww_post /commands/run "{\"id\":\"figlet.open\",\"args\":{\"text\":\"$WORD\",\"font\":\"$FONT\"}}"
sleep 0.6

FID=$(curl -sf "$API/state" | python3 -c "
import sys,json
ids=[w['id'] for w in json.load(sys.stdin).get('windows',[])
       if 'figlet' in (w.get('details',{}) or {}).get('appType','').lower()
          or 'figlet' in w.get('title','').lower()]
print(ids[-1] if ids else '')
" 2>/dev/null)

if [[ -z "$FID" ]]; then
  echo "ERROR: no figlet window" >&2
  exit 1
fi

ww_post /windows/batch "{\"ops\":[{\"id\":$FID,\"width\":$WIN_W,\"height\":$WIN_H}]}"
echo "  WID=$FID"
sleep 0.2

# ── Beat loop — Python drives everything ────────────────────────────────
echo "  starting... ^C to stop"
echo ""

python3 - "${BEATS}" "${SPEED}" "${AMP_W}" "${AMP_H}" "${CX}" "${CY}" "${WIN_W}" "${WIN_H}" "${API}" "${FID}" "${WORDS_STR}" << 'PYSCRIPT'
import sys, math, subprocess, json, time

BEATS  = int(sys.argv[1])
SPEED  = float(sys.argv[2])
AMP_W  = float(sys.argv[3])
AMP_H  = float(sys.argv[4])
CX     = float(sys.argv[5])
CY     = float(sys.argv[6])
WIN_W  = int(sys.argv[7])
WIN_H  = int(sys.argv[8])
API    = sys.argv[9]
FID    = int(sys.argv[10])
WORDS  = sys.argv[11].split()
WORD_I = 0

def post(path, body):
    subprocess.run(
        ['curl', '-sf', '-X', 'POST', API + path,
         '-H', 'Content-Type: application/json',
         '-d', body],
        capture_output=True)

phase = 0.0
beat  = 0
last_bucket = int(phase / math.pi)

try:
    while True:
        x = int(CX + AMP_W * math.sin(phase))
        y = int(CY + AMP_H * math.cos(phase))
        post('/windows/move', json.dumps({'id': FID, 'left': x, 'top': y}))

        # Beat on sine half-period crossing
        bucket = int(phase / math.pi)
        if bucket != last_bucket:
            last_bucket = bucket
            beat += 1
            post('/commands/run', '{"id":"theme.cycle"}')
            if beat % 4 == 0:
                WORD_I = (WORD_I + 1) % len(WORDS)
                post('/commands/run',
                     json.dumps({'id': 'figlet.write',
                                 'args': {'windowId': FID, 'text': WORDS[WORD_I]}}))
            print(f"  ♡ beat {beat}  word={WORDS[WORD_I]}  pos=({x},{y})", flush=True)

        phase += 0.15
        time.sleep(SPEED)
        if BEATS > 0 and beat >= BEATS:
            break
except KeyboardInterrupt:
    pass

print(f"done. {beat} beats")
PYSCRIPT
