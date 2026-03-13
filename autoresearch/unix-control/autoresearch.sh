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

# ── 20. Agent workflow: find + act ────────────────────────
echo "--- agent workflow ---"

# Open 2 editors and 1 art window
$WW cmd editor.new >/dev/null 2>&1; sleep 0.2
$WW cmd editor.new >/dev/null 2>&1; sleep 0.2
$WW cmd art.open >/dev/null 2>&1; sleep 0.2

# Agent pattern: find editors, get their IDs, close only editors
EDITOR_COUNT_BEFORE=$($WW windows | jq '[.[] | select(.kind=="editor")] | length')
$WW windows | jq -r '.[] | select(.kind=="editor") | .id' | \
  while read -r eid; do $WW window "$eid" close >/dev/null 2>&1; done
sleep 0.5
EDITOR_COUNT_AFTER=$($WW windows | jq '[.[] | select(.kind=="editor")] | length')
ART_STILL=$($WW windows | jq '[.[] | select(.kind=="art")] | length')
check "agent: close editors but keep art windows" \
  "$([ "$EDITOR_COUNT_AFTER" = "0" ] && [ "$ART_STILL" -ge 1 ] && echo PASS || echo "editors=$EDITOR_COUNT_AFTER art=$ART_STILL")"

# ── 21. Focused window default ───────────────────────────
echo "--- focused window ---"

# The art window should be focused (it's the only one left)
FOCUSED=$($WW state | jq -r '.focus.windowId // .focus.focusedWindowId // empty')
check "focused window ID available in state" \
  "$([ -n "$FOCUSED" ] && [ "$FOCUSED" != "null" ] && echo PASS || echo "focused=$FOCUSED")"

# ── 22. Tile windows ────────────────────────────────────
echo "--- layout ---"
$WW cmd editor.new >/dev/null 2>&1; sleep 0.2
$WW cmd editor.new >/dev/null 2>&1; sleep 0.2
$WW cmd window.tile >/dev/null 2>&1; sleep 0.3

# After tiling, windows should not all be at 0,0
POSITIONS=$($WW windows | jq '[.[].left] | unique | length')
check "ww cmd window.tile arranges windows" \
  "$([ "$POSITIONS" -ge 2 ] && echo PASS || echo "unique_x=$POSITIONS")"

# Clean up
$WW windows -q | xargs -I{} $WW window {} close >/dev/null 2>&1
sleep 0.3

# ── 23. Boolean and JSON flags ───────────────────────────
echo "--- special flag types ---"

# Open editor with a path (string arg)
$WW cmd document.open --filePath /tmp/test-ww.txt >/dev/null 2>&1 || true
sleep 0.3
DOC_WIN=$($WW windows | jq '[.[] | select(.title | test("test-ww"; "i"))] | length' 2>/dev/null || echo 0)
check "string flag: document.open --path works" \
  "$([ "$DOC_WIN" -ge 1 ] && echo PASS || echo "matching_windows=$DOC_WIN")"

# Clean up
$WW windows -q | xargs -I{} $WW window {} close >/dev/null 2>&1
sleep 0.3

# ── 24. Full parity: commands -q sorted matches API sorted ──
echo "--- full parity ---"
WW_SORTED=$($WW commands -q | sort)
API_SORTED=$(curl -s "$API/commands/list" | jq -r '.commands[].id' | sort)
PARITY_DIFF=$(diff <(echo "$WW_SORTED") <(echo "$API_SORTED") || true)
check "full parity: ww commands -q sorted == API sorted" \
  "$([ -z "$PARITY_DIFF" ] && echo PASS || echo "diff found")"

# ── 25. Figlet banner ───────────────────────────────────
echo "--- figlet ---"
$WW cmd figlet.open --text "HI" >/dev/null 2>&1; sleep 0.5
FIG_WIN=$($WW windows | jq '[.[] | select(.kind=="figlet")] | length')
check "ww cmd figlet.open --text HI creates figlet window" \
  "$([ "$FIG_WIN" -ge 1 ] && echo PASS || echo "figlet_windows=$FIG_WIN")"
# Close it
$WW windows | jq -r '.[] | select(.kind=="figlet") | .id' | \
  while read -r fid; do $WW window "$fid" close >/dev/null 2>&1; done
sleep 0.3

# ── 26. State deep parity ───────────────────────────────
echo "--- state deep parity ---"
# Open a window, verify its properties match between ww and curl
$WW cmd editor.new >/dev/null 2>&1; sleep 0.3
$WW cmd window.move --id "$($WW windows | jq -r '.[0].id')" --x 15 --y 8 >/dev/null 2>&1
sleep 0.3

WW_WIN_JSON=$($WW windows | jq '.[0] | {id, kind, left, top}')
API_WIN_JSON=$(curl -s "$API/state" | jq '.windows[0] | {id, kind, left, top}')
check "state deep parity: ww windows == curl /state windows" \
  "$([ "$WW_WIN_JSON" = "$API_WIN_JSON" ] && echo PASS || echo "mismatch")"

# Clean up
$WW windows -q | xargs -I{} $WW window {} close >/dev/null 2>&1
sleep 0.3

# ── 27. Exit codes ──────────────────────────────────────
echo "--- exit codes ---"
$WW health >/dev/null 2>&1; GOOD_EXIT=$?
check "success exit code is 0" "$([ "$GOOD_EXIT" = "0" ] && echo PASS || echo "exit=$GOOD_EXIT")"

$WW cmd bad.command >/dev/null 2>&1; BAD_EXIT2=$?
check "failure exit code is non-zero" "$([ "$BAD_EXIT2" -ne 0 ] && echo PASS || echo "exit=$BAD_EXIT2")"

# ── 28. Rapid fire: open + close cycle ───────────────────
echo "--- rapid fire ---"
for i in 1 2 3 4 5; do
  $WW cmd editor.new >/dev/null 2>&1
done
sleep 0.5
RAPID_COUNT=$($WW windows | jq 'length')
check "rapid fire: 5 editor.new creates 5 windows" \
  "$([ "$RAPID_COUNT" -ge 5 ] && echo PASS || echo "count=$RAPID_COUNT")"

# Close all in one pipe
$WW windows -q | xargs -I{} $WW window {} close >/dev/null 2>&1
sleep 0.5
RAPID_AFTER=$($WW windows | jq 'length')
check "rapid fire: close all via pipe" \
  "$([ "$RAPID_AFTER" = "0" ] && echo PASS || echo "remaining=$RAPID_AFTER")"

# ── 29. bun run ww shortcut ─────────────────────────────
echo "--- bun run ww ---"
BUN_WW=$(cd /Users/james/Repos/wibandwob-dos && bun run ww health 2>/dev/null | jq -r '.ok' || echo "FAIL")
check "bun run ww health works" \
  "$([ "$BUN_WW" = "true" ] && echo PASS || echo "got=$BUN_WW")"

# ── 30. JSON validity on all outputs ─────────────────────
echo "--- json validity ---"
# Every ww subcommand that returns data should produce valid JSON
for subcmd in state windows commands health; do
  VALID=$($WW $subcmd 2>/dev/null | jq empty 2>&1 && echo "valid" || echo "invalid")
  check "ww $subcmd outputs valid JSON" \
    "$([ "$VALID" = "valid" ] && echo PASS || echo "$VALID")"
done

# cmd result should also be valid JSON
$WW cmd editor.new 2>/dev/null | jq empty 2>&1 && CMD_VALID="valid" || CMD_VALID="invalid"
check "ww cmd result is valid JSON" \
  "$([ "$CMD_VALID" = "valid" ] && echo PASS || echo "$CMD_VALID")"
$WW windows -q | xargs -I{} $WW window {} close >/dev/null 2>&1; sleep 0.3

# ── 31. Microapp commands visible ────────────────────────
echo "--- microapp parity ---"
MICRO_COUNT=$($WW commands -q | grep -c '^microapp\.' || echo 0)
API_MICRO=$(curl -s "$API/commands/list" | jq '[.commands[] | select(.id | startswith("microapp."))] | length')
check "microapp commands visible via ww" \
  "$([ "$MICRO_COUNT" = "$API_MICRO" ] && echo PASS || echo "ww=$MICRO_COUNT api=$API_MICRO")"

# ── 32. Cascading operations ─────────────────────────────
echo "--- cascade ---"
$WW cmd editor.new >/dev/null 2>&1; sleep 0.2
$WW cmd editor.new >/dev/null 2>&1; sleep 0.2
$WW cmd art.open >/dev/null 2>&1; sleep 0.2
$WW cmd window.cascade >/dev/null 2>&1; sleep 0.3

# After cascading, windows should have staggered positions
POSITIONS_X=$($WW windows | jq '[.[].left] | unique | length')
check "ww cmd window.cascade staggers windows" \
  "$([ "$POSITIONS_X" -ge 2 ] && echo PASS || echo "unique_x=$POSITIONS_X")"

$WW windows -q | xargs -I{} $WW window {} close >/dev/null 2>&1; sleep 0.3

# ── 33. Desktop clear ───────────────────────────────────
echo "--- desktop clear ---"
$WW cmd editor.new >/dev/null 2>&1; sleep 0.2
$WW cmd editor.new >/dev/null 2>&1; sleep 0.2
$WW cmd desktop.clear-all >/dev/null 2>&1; sleep 0.5
CLEARED=$($WW windows | jq 'length')
check "ww cmd desktop.clear-all closes all windows" \
  "$([ "$CLEARED" = "0" ] && echo PASS || echo "remaining=$CLEARED")"

# ── 34. Mini music video choreography ────────────────────
echo "--- choreography (E040 proof) ---"

# This test proves the CLI can drive a visual sequence:
# 1. Set theme
# 2. Open figlet title
# 3. Open 2 editors
# 4. Tile
# 5. Move windows to specific positions
# 6. Verify layout matches intent
# 7. Clear all

$WW theme set --name flexoki-ink >/dev/null 2>&1
$WW cmd figlet.open --text "WW" >/dev/null 2>&1; sleep 0.3
$WW cmd editor.new >/dev/null 2>&1; sleep 0.2
$WW cmd editor.new >/dev/null 2>&1; sleep 0.2
$WW cmd window.tile >/dev/null 2>&1; sleep 0.3

CHOREO_WINS=$($WW windows | jq 'length')
CHOREO_KINDS=$($WW windows | jq -r '[.[].kind] | unique | sort | join(",")')
check "choreography: 3 windows of mixed types created" \
  "$([ "$CHOREO_WINS" -ge 3 ] && echo PASS || echo "wins=$CHOREO_WINS kinds=$CHOREO_KINDS")"

# Move first window to exact position
FIRST_ID=$($WW windows | jq -r '.[0].id')
$WW window "$FIRST_ID" move --x 0 --y 0 >/dev/null 2>&1; sleep 0.2
FINAL_POS=$($WW windows | jq ".[] | select(.id==$FIRST_ID) | .left")
check "choreography: precise window placement" \
  "$([ "$FINAL_POS" = "0" ] && echo PASS || echo "left=$FINAL_POS")"

$WW cmd desktop.clear-all >/dev/null 2>&1; sleep 0.3
CHOREO_CLEAN=$($WW windows | jq 'length')
check "choreography: clean teardown" \
  "$([ "$CHOREO_CLEAN" = "0" ] && echo PASS || echo "remaining=$CHOREO_CLEAN")"

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
