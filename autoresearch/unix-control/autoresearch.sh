#!/usr/bin/env bash
set -euo pipefail

echo "=== Unix CLI (ww) Parity Benchmark ==="

cd /Users/james/Repos/wibandwob-dos
WW="bun run src/cli/ww.ts"
API="http://127.0.0.1:8099"

PASS=0
FAIL=0
TOTAL=0

check() {
  local desc="$1"
  local result="$2"
  TOTAL=$((TOTAL + 1))
  if [ "$result" = "PASS" ]; then
    PASS=$((PASS + 1))
    echo "  ✓ $desc"
  else
    FAIL=$((FAIL + 1))
    echo "  ✗ $desc — $result"
  fi
}

# ── 1. Basic connectivity ────────────────────────────────
echo "--- connectivity ---"
HEALTH=$($WW health 2>/dev/null | jq -r '.ok' || echo "FAIL")
check "ww health returns ok" "$([ "$HEALTH" = "true" ] && echo PASS || echo "got: $HEALTH")"

# ── 2. Commands parity ───────────────────────────────────
echo "--- commands parity ---"
WW_COUNT=$($WW commands 2>/dev/null | jq 'length' || echo 0)
API_COUNT=$(curl -s "$API/commands/list" | jq '.commands | length' || echo 0)
check "ww commands count matches API ($WW_COUNT vs $API_COUNT)" \
  "$([ "$WW_COUNT" = "$API_COUNT" ] && echo PASS || echo "ww=$WW_COUNT api=$API_COUNT")"

# Compare command IDs
WW_IDS=$($WW commands 2>/dev/null | jq -r '.[].id' | sort)
API_IDS=$(curl -s "$API/commands/list" | jq -r '.commands[].id' | sort)
DIFF=$(diff <(echo "$WW_IDS") <(echo "$API_IDS") || true)
check "ww command IDs match API exactly" \
  "$([ -z "$DIFF" ] && echo PASS || echo "diff found")"

# ── 3. State parity ──────────────────────────────────────
echo "--- state parity ---"
WW_STATE=$($WW state 2>/dev/null | jq -r 'keys | sort | join(",")' || echo "FAIL")
API_STATE=$(curl -s "$API/state" | jq -r 'keys | sort | join(",")' || echo "FAIL")
check "ww state keys match API" \
  "$([ "$WW_STATE" = "$API_STATE" ] && echo PASS || echo "ww=$WW_STATE api=$API_STATE")"

# ── 4. Windows list ──────────────────────────────────────
echo "--- windows ---"
WW_WIN=$($WW windows 2>/dev/null | jq 'type' || echo "FAIL")
check "ww windows returns JSON array" \
  "$([ "$WW_WIN" = '"array"' ] && echo PASS || echo "got: $WW_WIN")"

# ── 5. Command execution ────────────────────────────────
echo "--- command execution ---"

# Open an editor via ww
$WW cmd editor.new >/dev/null 2>&1
sleep 0.5
WIN_COUNT=$($WW windows 2>/dev/null | jq 'length' || echo 0)
check "ww cmd editor.new creates a window" \
  "$([ "$WIN_COUNT" -ge 1 ] && echo PASS || echo "windows=$WIN_COUNT")"

# Dot syntax: ww editor.new
$WW editor.new >/dev/null 2>&1
sleep 0.5
WIN_COUNT2=$($WW windows 2>/dev/null | jq 'length' || echo 0)
check "ww editor.new (dot syntax) creates a window" \
  "$([ "$WIN_COUNT2" -gt "$WIN_COUNT" ] && echo PASS || echo "before=$WIN_COUNT after=$WIN_COUNT2")"

# Noun verb syntax: ww editor new
$WW editor new >/dev/null 2>&1
sleep 0.5
WIN_COUNT3=$($WW windows 2>/dev/null | jq 'length' || echo 0)
check "ww editor new (noun verb) creates a window" \
  "$([ "$WIN_COUNT3" -gt "$WIN_COUNT2" ] && echo PASS || echo "before=$WIN_COUNT2 after=$WIN_COUNT3")"

# ── 6. Flag parsing ─────────────────────────────────────
echo "--- flag parsing ---"

# Get a window ID, then move it
WID=$($WW windows 2>/dev/null | jq -r '.[0].id')
if [ -n "$WID" ] && [ "$WID" != "null" ]; then
  $WW cmd window.move --id "$WID" --x 5 --y 3 >/dev/null 2>&1
  sleep 0.3
  NEW_X=$(curl -s "$API/state" | jq ".windows[] | select(.id==$WID) | .left")
  check "ww cmd window.move --id $WID --x 5 --y 3 moves window" \
    "$([ "$NEW_X" = "5" ] && echo PASS || echo "left=$NEW_X expected=5")"

  # Also test dot syntax with flags
  $WW window.move --id "$WID" --x 20 --y 10 >/dev/null 2>&1
  sleep 0.3
  NEW_X2=$(curl -s "$API/state" | jq ".windows[] | select(.id==$WID) | .left")
  check "ww window.move --flags works" \
    "$([ "$NEW_X2" = "20" ] && echo PASS || echo "left=$NEW_X2 expected=20")"
else
  check "window available for move test" "FAIL no windows"
  check "ww window.move --flags works" "FAIL no windows"
fi

# ── 7. jq pipe ergonomics ───────────────────────────────
echo "--- jq ergonomics ---"

# Can pipe windows through jq to get IDs
IDS=$($WW windows 2>/dev/null | jq -r '.[].id' || echo "FAIL")
check "ww windows | jq -r '.[].id' produces IDs" \
  "$([ -n "$IDS" ] && [ "$IDS" != "FAIL" ] && echo PASS || echo "got: $IDS")"

# Can filter by kind
EDITORS=$($WW windows 2>/dev/null | jq '[.[] | select(.kind=="editor")] | length' || echo 0)
check "ww windows | jq select(.kind==editor) filters" \
  "$([ "$EDITORS" -ge 1 ] && echo PASS || echo "editors=$EDITORS")"

# ── 8. Error handling ───────────────────────────────────
echo "--- error handling ---"

# Bad command should exit non-zero
$WW cmd nonexistent.command >/dev/null 2>&1 && BAD_EXIT=0 || BAD_EXIT=$?
check "bad command exits non-zero" \
  "$([ "$BAD_EXIT" -ne 0 ] && echo PASS || echo "exit=$BAD_EXIT")"

# ── 9. Help ─────────────────────────────────────────────
echo "--- help ---"
HELP=$($WW help 2>&1 || true)
check "ww help shows usage" \
  "$(echo "$HELP" | grep -q 'Usage' && echo PASS || echo "no Usage in output")"

# ── Cleanup: close test windows ──────────────────────────
echo "--- cleanup ---"
for id in $($WW windows 2>/dev/null | jq -r '.[].id'); do
  $WW cmd window.close --id "$id" >/dev/null 2>&1 || true
done
sleep 0.3
REMAINING=$($WW windows 2>/dev/null | jq 'length' || echo "?")
check "cleanup: all test windows closed" \
  "$([ "$REMAINING" = "0" ] && echo PASS || echo "remaining=$REMAINING")"

# ── Score ────────────────────────────────────────────────
echo ""
echo "PASSED: $PASS / $TOTAL"
SCORE=$(echo "scale=1; $PASS * 10 / $TOTAL" | bc)
echo "FINAL_SCORE: $SCORE"
