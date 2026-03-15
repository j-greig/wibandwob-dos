#!/bin/bash
# F6 Plumb — cross-app pair tests
# Each test opens exactly 2 windows, plumbs, verifies, clears.
set -uo pipefail
source ~/.wibwob
export WIBWOB_INSTANCE=main

SCORE=0
TOTAL=0

check() {
  local label="$1"
  local pts="$2"
  local test="$3"
  TOTAL=$((TOTAL + pts))
  if eval "$test" 2>/dev/null 1>/dev/null; then
    echo "  ✓ $label (+$pts)"
    SCORE=$((SCORE + pts))
  else
    echo "  ✗ $label (0/$pts)"
  fi
}

wid() {
  wibwob state 2>/dev/null | jq "[.windows[] | select(.appType==\"$1\")] | last | .id" 2>/dev/null
}

clear_all() {
  wibwob cmd desktop.clear-all > /dev/null 2>&1 || true
  sleep 1
}

# ── Ensure test instance running ──────────────────────────────
wibwob health > /dev/null 2>&1 || {
  echo "ERROR: main instance not reachable"
  exit 1
}
clear_all

echo "Target: $(wibwob health | jq -r '.instanceLabel // .instanceId') (pid $(wibwob health | jq -r '.pid'))"
echo ""

# ══════════════════════════════════════════════════════════════
# PAIR 1: figlet → figlet (10 pts)
#   Simplest case. Both have write command. ASCII art transfers.
# ══════════════════════════════════════════════════════════════
echo "=== P1: figlet → figlet (10 pts) ==="
wibwob cmd microapp.wibwob.figlet.open --text ALPHA --font doom > /dev/null 2>&1 || true
wibwob cmd microapp.wibwob.figlet.open --text BETA --font doom > /dev/null 2>&1 || true
sleep 2

FIGS=$(wibwob state | jq '[.windows[] | select(.appType=="wibwob.figlet")] | sort_by(.id)')
F1=$(echo "$FIGS" | jq '.[0].id')
F2=$(echo "$FIGS" | jq '.[1].id')

wibwob plumb --from "$F1" --to "$F2" > /dev/null 2>&1 || true
sleep 1

check "plumb dispatched ok" 5 \
  "wibwob plumb --from $F1 --to $F2 2>/dev/null | jq -e '.ok'"

check "BETA replaced with ALPHA's art" 5 \
  "wibwob state 2>/dev/null | jq -r '.windows[] | select(.id=='$F2') | .details.inputText' | grep -vq 'BETA'"

clear_all

# ══════════════════════════════════════════════════════════════
# PAIR 2: contour → figlet (10 pts)
#   Read-only generative source → writable text dest.
#   Contour's ASCII terrain becomes figlet's input text.
# ══════════════════════════════════════════════════════════════
echo ""
echo "=== P2: contour → figlet (10 pts) ==="
wibwob cmd microapp.wibwob.contour.open > /dev/null 2>&1 || true
wibwob cmd microapp.wibwob.figlet.open --text WAITING --font doom > /dev/null 2>&1 || true
sleep 2

CID=$(wid "wibwob.contour")
FID=$(wid "wibwob.figlet")

wibwob plumb --from "$CID" --to "$FID" > /dev/null 2>&1 || true
sleep 1

check "contour text captured" 5 \
  "wibwob read $CID 2>/dev/null > /tmp/ww-contour.txt && [ -s /tmp/ww-contour.txt ]"

check "figlet received contour text" 5 \
  "wibwob state 2>/dev/null | jq -r '.windows[] | select(.id=='$FID') | .details.inputText' | grep -vq 'WAITING'"

clear_all

# ══════════════════════════════════════════════════════════════
# PAIR 3: figlet → journal (10 pts)
#   ASCII art creates a journal entry via create fallback.
# ══════════════════════════════════════════════════════════════
echo ""
echo "=== P3: figlet → journal (10 pts) ==="
wibwob cmd microapp.wibwob.figlet.open --text LOGGED --font doom > /dev/null 2>&1 || true
wibwob cmd microapp.wibwob.journal.open > /dev/null 2>&1 || true
sleep 2

FID=$(wid "wibwob.figlet")
JID=$(wid "wibwob.journal")
JCOUNT=$(wibwob cmd microapp.wibwob.journal.list 2>/dev/null | jq '.entries | length' || echo 0)

wibwob plumb --from "$FID" --to "$JID" > /dev/null 2>&1 || true
sleep 1

check "plumb used create fallback" 5 \
  "wibwob plumb --from $FID --to $JID 2>/dev/null | jq -r '.command' | grep -q 'create'"

check "journal has new entry" 5 \
  "[ \$(wibwob cmd microapp.wibwob.journal.list 2>/dev/null | jq '.entries | length') -gt $JCOUNT ]"

clear_all

# ══════════════════════════════════════════════════════════════
# PAIR 4: contour → journal (10 pts)
#   Generative ASCII landscape saved as journal entry.
# ══════════════════════════════════════════════════════════════
echo ""
echo "=== P4: contour → journal (10 pts) ==="
wibwob cmd microapp.wibwob.contour.open > /dev/null 2>&1 || true
wibwob cmd microapp.wibwob.journal.open > /dev/null 2>&1 || true
sleep 2

CID=$(wid "wibwob.contour")
JID=$(wid "wibwob.journal")
JCOUNT=$(wibwob cmd microapp.wibwob.journal.list 2>/dev/null | jq '.entries | length' || echo 0)

wibwob plumb --from "$CID" --to "$JID" > /dev/null 2>&1 || true
sleep 1

check "plumb dispatched" 5 \
  "wibwob plumb --from $CID --to $JID 2>/dev/null | jq -e '.ok'"

check "landscape saved as entry" 5 \
  "[ \$(wibwob cmd microapp.wibwob.journal.list 2>/dev/null | jq '.entries | length') -gt $JCOUNT ]"

clear_all

# ══════════════════════════════════════════════════════════════
# PAIR 5: figlet → terminal (10 pts)
#   ASCII art typed into pty via terminal.write.
# ══════════════════════════════════════════════════════════════
echo ""
echo "=== P5: figlet → terminal (10 pts) ==="
wibwob cmd microapp.wibwob.figlet.open --text HI --font doom > /dev/null 2>&1 || true
wibwob cmd microapp.wibwob.terminal.open > /dev/null 2>&1 || true
sleep 3

FID=$(wid "wibwob.figlet")
TID=$(wid "wibwob.terminal")

check "plumb dispatched" 5 \
  "wibwob plumb --from $FID --to $TID 2>/dev/null | jq -e '.ok'"

check "used terminal.write" 5 \
  "wibwob plumb --from $FID --to $TID 2>/dev/null | jq -r '.command' | grep -q 'write'"

clear_all

# ══════════════════════════════════════════════════════════════
# PAIR 6: plasma → figlet (10 pts)
#   ANSI escape art from plasma → figlet input text.
#   Proves even raw escape-code output can be plumbed.
# ══════════════════════════════════════════════════════════════
echo ""
echo "=== P6: plasma → figlet (10 pts) ==="
wibwob cmd microapp.wibwob.plasma.open > /dev/null 2>&1 || true
wibwob cmd microapp.wibwob.figlet.open --text CLEAN --font doom > /dev/null 2>&1 || true
sleep 2

PID=$(wid "wibwob.plasma")
FID=$(wid "wibwob.figlet")

# Plasma is read-only as DESTINATION but readable as SOURCE
check "plasma readable as source" 5 \
  "wibwob read $PID 2>/dev/null > /tmp/ww-plasma.txt && [ -s /tmp/ww-plasma.txt ]"

wibwob plumb --from "$PID" --to "$FID" > /dev/null 2>&1 || true
sleep 1
check "figlet received plasma content" 5 \
  "wibwob state 2>/dev/null | jq -r '.windows[] | select(.id=='$FID') | .details.inputText' | grep -vq 'CLEAN'"

clear_all

# ══════════════════════════════════════════════════════════════
# ERROR CASES (15 pts)
# ══════════════════════════════════════════════════════════════
echo ""
echo "=== Errors (15 pts) ==="

wibwob cmd microapp.wibwob.figlet.open --text ERR --font doom > /dev/null 2>&1 || true
wibwob cmd microapp.wibwob.plasma.open > /dev/null 2>&1 || true
sleep 2
FID=$(wid "wibwob.figlet")
PID=$(wid "wibwob.plasma")

check "plumb to read-only dest fails" 5 \
  "! wibwob plumb --from $FID --to $PID 2>/dev/null"

check "plumb from missing window fails" 5 \
  "! wibwob plumb --from 99999 --to $FID 2>/dev/null"

check "no args shows usage" 5 \
  "wibwob plumb 2>/tmp/ww-plumb-usage.txt; grep -qi 'usage\|from\|to' /tmp/ww-plumb-usage.txt"

clear_all

# ══════════════════════════════════════════════════════════════
# CLI & TYPECHECK (15 pts)
# ══════════════════════════════════════════════════════════════
echo ""
echo "=== CLI & typecheck (15 pts) ==="

wibwob help > /tmp/ww-help-plumb.txt 2>&1 || true
check "help shows plumb" 5 \
  "grep -q 'plumb' /tmp/ww-help-plumb.txt"

check "typecheck passes" 5 \
  "bun run typecheck 2>&1 | tail -1 | grep -vq 'error'"

check "no /plumb API endpoints" 5 \
  "! grep -q '/plumb' src/services/control-api.ts"

# ── Summary ───────────────────────────────────────────────────
echo ""
echo "========================================="
echo "plumb_score: $SCORE / $TOTAL"
echo "========================================="
