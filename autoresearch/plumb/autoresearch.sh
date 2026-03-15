#!/bin/bash
# F6 Plumb — behaviour test harness
set -uo pipefail
source ~/.wibwob

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

# ── 0. Ensure app is running + clear ─────────────────────────
bash scripts/ensure-running.sh > /dev/null 2>&1 || true
for i in $(seq 1 15); do
  wibwob health > /dev/null 2>&1 && break
  sleep 1
done
wibwob health > /dev/null 2>&1 || { echo "ERROR: health failed"; exit 1; }

wibwob cmd desktop.clear-all > /dev/null 2>&1 || true
sleep 1

echo "Instance: $(wibwob health | jq -r '.instanceLabel') (pid $(wibwob health | jq -r '.pid'))"
echo ""

# ── CLI Entry (15 pts) ───────────────────────────────────────
echo "=== CLI Entry (15 pts) ==="

check "plumb in CLI_COMMANDS" 5 \
  "grep -q '\"plumb\"' src/cli/wibwob.ts"

wibwob help > /tmp/ww-help-plumb.txt 2>&1 || true
check "shows in help" 5 \
  "grep -q 'plumb' /tmp/ww-help-plumb.txt"

check "no new API endpoints" 5 \
  "! grep -q '/plumb' src/services/control-api.ts"

# ── Cross-App Routing (30 pts) ───────────────────────────────
echo ""
echo "=== Cross-App Routing (30 pts) ==="

# Set up: two figlet windows
wibwob cmd microapp.wibwob.figlet.open --text SOURCE --font doom > /dev/null 2>&1 || true
sleep 1
wibwob cmd microapp.wibwob.figlet.open --text TARGET --font doom > /dev/null 2>&1 || true
sleep 1

FIGLETS=$(wibwob state | jq '[.windows[] | select(.appType=="wibwob.figlet")] | sort_by(.id)')
FIG1=$(echo "$FIGLETS" | jq '.[0].id')
FIG2=$(echo "$FIGLETS" | jq '.[1].id')

# Plumb fig1 → fig2: fig2 should get fig1's ASCII art as text
wibwob plumb --from "$FIG1" --to "$FIG2" > /dev/null 2>&1 || true
sleep 1

# fig2's text should have changed (no longer "TARGET")
check "figlet→figlet text transfers" 15 \
  "wibwob state 2>/dev/null | jq -e '.windows[] | select(.id=='$FIG2') | .details.inputText' | grep -vq 'TARGET'"

# Open contour, plumb to figlet
wibwob cmd microapp.wibwob.contour.open > /dev/null 2>&1 || true
sleep 2
CONTOUR_ID=$(wibwob state | jq '[.windows[] | select(.appType=="wibwob.contour")] | last | .id' 2>/dev/null || echo "")

wibwob plumb --from "$CONTOUR_ID" --to "$FIG1" > /dev/null 2>&1 || true
sleep 1

check "contour→figlet cross-appType" 15 \
  "wibwob state 2>/dev/null | jq -e '.windows[] | select(.id=='$FIG1') | .details.inputText' | grep -vq 'SOURCE'"

# ── Error Handling (25 pts) ──────────────────────────────────
echo ""
echo "=== Error Handling (25 pts) ==="

check "missing flags shows usage" 5 \
  "wibwob plumb 2>/tmp/ww-plumb-err.txt; grep -qi 'usage\|from\|to' /tmp/ww-plumb-err.txt"

check "invalid --from errors" 5 \
  "! wibwob plumb --from 99999 --to $FIG1 2>/dev/null"

check "invalid --to errors" 5 \
  "! wibwob plumb --from $FIG1 --to 99999 2>/dev/null"

# Open a contour (read-only) as destination
check "non-writable dest errors cleanly" 10 \
  "! wibwob plumb --from $FIG1 --to $CONTOUR_ID 2>/dev/null"

# ── Edge Cases (15 pts) ──────────────────────────────────────
echo ""
echo "=== Edge Cases (15 pts) ==="

# Open a fresh figlet with empty text
wibwob cmd microapp.wibwob.figlet.open --text "" --font doom > /dev/null 2>&1 || true
sleep 1
EMPTY_FIG=$(wibwob state | jq '[.windows[] | select(.appType=="wibwob.figlet")] | last | .id' 2>/dev/null || echo "")

check "empty source passes through" 5 \
  "wibwob plumb --from $EMPTY_FIG --to $FIG2 2>/dev/null; [ \$? -le 1 ]"

check "same window from/to works" 5 \
  "wibwob plumb --from $FIG1 --to $FIG1 2>/dev/null; [ \$? -le 1 ]"

check "source is read-only app" 5 \
  "wibwob plumb --from $CONTOUR_ID --to $FIG2 2>/dev/null; [ \$? -eq 0 ]"

# ── Typecheck (15 pts) ───────────────────────────────────────
echo ""
echo "=== Typecheck (15 pts) ==="

check "bun run typecheck passes" 15 \
  "bun run typecheck 2>&1 | tail -1 | grep -vq 'error'"

# ── Summary ───────────────────────────────────────────────────
echo ""
echo "========================================="
echo "plumb_score: $SCORE / $TOTAL"
echo "========================================="
