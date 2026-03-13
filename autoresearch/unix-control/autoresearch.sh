#!/usr/bin/env bash
set -uo pipefail
# Note: no set -e — we want all tests to run even if some fail

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

# ── 8. Window resize ─────────────────────────────────────
echo "--- resize ---"
if [ -n "$WID" ] && [ "$WID" != "null" ]; then
  $WW cmd window.resize --id "$WID" --width 40 --height 15 >/dev/null 2>&1
  sleep 0.3
  NEW_W=$(curl -s "$API/state" | jq ".windows[] | select(.id==$WID) | .width")
  check "ww window.resize sets width" \
    "$([ "$NEW_W" = "40" ] && echo PASS || echo "width=$NEW_W expected=40")"
else
  check "ww window.resize sets width" "FAIL no windows"
fi

# ── 9. Theme operations ─────────────────────────────────
echo "--- theme ---"
THEME_RESULT=$($WW cmd theme.set --name flexoki-ink 2>&1 || echo "FAIL")
check "ww cmd theme.set runs" \
  "$(echo "$THEME_RESULT" | jq -r '.ok' 2>/dev/null | grep -q 'true' && echo PASS || echo "result=$THEME_RESULT")"

# ── 10. Pipe composition ────────────────────────────────
echo "--- pipe composition ---"

# Open 2 editors, pipe through jq to count editors, close via pipe
$WW cmd editor.new >/dev/null 2>&1; sleep 0.3
$WW cmd editor.new >/dev/null 2>&1; sleep 0.3

PIPE_COUNT=$($WW windows | jq '[.[] | select(.kind=="editor")] | length')
check "pipe: count editors via jq" \
  "$([ "$PIPE_COUNT" -ge 2 ] && echo PASS || echo "editors=$PIPE_COUNT")"

# Close all editors via pipe
$WW windows | jq -r '.[] | select(.kind=="editor") | .id' | \
  while read -r eid; do $WW cmd window.close --id "$eid" >/dev/null 2>&1; done
sleep 0.5
AFTER_CLOSE=$($WW windows | jq '[.[] | select(.kind=="editor")] | length')
check "pipe: close all editors via jq + xargs pattern" \
  "$([ "$AFTER_CLOSE" = "0" ] && echo PASS || echo "remaining=$AFTER_CLOSE")"

# ── 11. Error handling ──────────────────────────────────
echo "--- error handling ---"

# Bad command should exit non-zero
$WW cmd nonexistent.command >/dev/null 2>&1 && BAD_EXIT=0 || BAD_EXIT=$?
check "bad command exits non-zero" \
  "$([ "$BAD_EXIT" -ne 0 ] && echo PASS || echo "exit=$BAD_EXIT")"

# Error output goes to stderr (stdout should be empty or absent)
ERR_STDOUT=$($WW cmd nonexistent.command 2>/dev/null || true)
check "error output goes to stderr not stdout" \
  "$([ -z "$ERR_STDOUT" ] && echo PASS || echo "stdout=$ERR_STDOUT")"

# ── 12. Help ─────────────────────────────────────────────
echo "--- help ---"
HELP=$($WW help 2>&1 || true)
check "ww help shows usage" \
  "$(echo "$HELP" | grep -q 'Usage' && echo PASS || echo "no Usage in output")"

# No args shows help
NO_ARGS=$($WW 2>&1 || true)
check "ww (no args) shows usage" \
  "$(echo "$NO_ARGS" | grep -q 'Usage' && echo PASS || echo "no Usage")"

# ── 13. Convenience patterns ─────────────────────────────
echo "--- convenience patterns ---"

# Open a window for testing
$WW cmd editor.new >/dev/null 2>&1; sleep 0.3
CID=$($WW windows | jq -r '.[0].id')

# ww window <id> close — positional ID before verb
$WW window "$CID" close >/dev/null 2>&1
sleep 0.3
CLOSED=$($WW windows | jq "[.[] | select(.id==$CID)] | length")
check "ww window <id> close (positional)" \
  "$([ "$CLOSED" = "0" ] && echo PASS || echo "still exists")"

# ww window <id> move --x --y — positional ID
$WW cmd editor.new >/dev/null 2>&1; sleep 0.3
MID=$($WW windows | jq -r '.[0].id')
$WW window "$MID" move --x 30 --y 15 >/dev/null 2>&1
sleep 0.3
MX=$(curl -s "$API/state" | jq ".windows[] | select(.id==$MID) | .left")
check "ww window <id> move (positional)" \
  "$([ "$MX" = "30" ] && echo PASS || echo "left=$MX expected=30")"

# ── 14. Quiet mode ──────────────────────────────────────
echo "--- quiet mode ---"

# ww windows -q should output just IDs one per line
QUIET_OUT=$($WW windows -q 2>/dev/null || $WW windows --quiet 2>/dev/null || echo "UNSUPPORTED")
if [ "$QUIET_OUT" = "UNSUPPORTED" ]; then
  check "ww windows -q outputs IDs" "FAIL: -q flag not supported"
else
  # Should be just numbers, one per line
  QLINES=$(echo "$QUIET_OUT" | wc -l | tr -d ' ')
  QVALID=$(echo "$QUIET_OUT" | grep -cE '^[0-9]+$' || echo 0)
  check "ww windows -q outputs IDs one per line" \
    "$([ "$QLINES" = "$QVALID" ] && [ "$QLINES" -ge 1 ] && echo PASS || echo "lines=$QLINES valid=$QVALID")"
fi

# ── 15. Screenshot ──────────────────────────────────────
echo "--- screenshot ---"

SHOT=$($WW screenshot 2>/dev/null || echo "UNSUPPORTED")
check "ww screenshot returns content" \
  "$([ "$SHOT" != "UNSUPPORTED" ] && [ -n "$SHOT" ] && echo PASS || echo "not implemented")"

# Clean up the test window
$WW cmd window.close --id "$MID" >/dev/null 2>&1 || true
sleep 0.3

# ── 16. String flag values ───────────────────────────────
echo "--- string flags ---"
$WW cmd editor.new >/dev/null 2>&1; sleep 0.3

# Theme set with string arg
$WW theme set --name flexoki-ink >/dev/null 2>&1
sleep 0.3
THEME=$(curl -s "$API/state" | jq -r '.app.theme')
check "ww theme set --name flexoki-ink" \
  "$(echo "$THEME" | grep -qi 'flexoki' && echo PASS || echo "theme=$THEME")"

# ── 17. Quiet mode on commands ───────────────────────────
echo "--- quiet commands ---"
CMD_Q=$($WW commands -q 2>/dev/null || echo "UNSUPPORTED")
if [ "$CMD_Q" = "UNSUPPORTED" ]; then
  check "ww commands -q outputs IDs" "FAIL: -q not supported for commands"
else
  CMD_LINES=$(echo "$CMD_Q" | wc -l | tr -d ' ')
  check "ww commands -q outputs command IDs" \
    "$([ "$CMD_LINES" -ge 50 ] && echo PASS || echo "lines=$CMD_LINES")"
fi

# ── 18. Multi-window workflow ────────────────────────────
echo "--- multi-window workflow ---"

# Open 3 different window types, verify all exist, close all
$WW cmd editor.new >/dev/null 2>&1; sleep 0.2
$WW cmd art.open >/dev/null 2>&1; sleep 0.2
KINDS=$($WW windows | jq -r '[.[].kind] | unique | sort | join(",")')
check "multi-window: different kinds created" \
  "$(echo "$KINDS" | grep -q 'editor' && echo PASS || echo "kinds=$KINDS")"

# Close all via quiet + xargs
$WW windows -q | xargs -I{} $WW window {} close >/dev/null 2>&1
sleep 0.5
LEFT=$($WW windows | jq 'length')
check "multi-window: close all via -q + xargs" \
  "$([ "$LEFT" = "0" ] && echo PASS || echo "remaining=$LEFT")"

# ── 19. WW_API env override ──────────────────────────────
echo "--- env override ---"
BAD_API=$(WW_API=http://127.0.0.1:9999 $WW health 2>/dev/null && echo "WRONGLY_SUCCEEDED" || echo "CORRECTLY_FAILED")
check "WW_API env var respected (bad port fails)" \
  "$([ "$BAD_API" = "CORRECTLY_FAILED" ] && echo PASS || echo "$BAD_API")"

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
