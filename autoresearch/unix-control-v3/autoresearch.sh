#!/usr/bin/env bash
set -uo pipefail

echo "=== Unix Control v3 — Infra + Creative Tooling ==="

cd /Users/james/Repos/wibandwob-dos
WIBWOB="bun run src/cli/wibwob.ts"
API="http://127.0.0.1:8099"

PASS=0
FAIL=0
TOTAL=10

check() {
  local num="$1"
  local desc="$2"
  local result="$3"
  if [ "$result" = "PASS" ]; then
    PASS=$((PASS + 1))
    echo "  ✓ #$num $desc"
  else
    FAIL=$((FAIL + 1))
    echo "  ✗ #$num $desc — $result"
  fi
}

# ── A1: Full Zod schema coverage ────────────────────────
# Count api:true commands that accept args vs those with params schemas
TOTAL_WITH_ARGS=$($WIBWOB commands 2>/dev/null | jq '[.[] | select(.description != null and (.description | test("Args:|args:"; "i")))] | length' || echo 0)
WITH_PARAMS=$($WIBWOB commands 2>/dev/null | jq '[.[] | select(.params != null)] | length' || echo 0)
if [ "$TOTAL_WITH_ARGS" -gt 0 ]; then
  COVERAGE=$(( WITH_PARAMS * 100 / TOTAL_WITH_ARGS ))
else
  COVERAGE=0
fi
if [ "$COVERAGE" -ge 80 ]; then
  check "A1" "Zod schema coverage ($WITH_PARAMS/$TOTAL_WITH_ARGS = ${COVERAGE}%)" "PASS"
else
  check "A1" "Zod schema coverage ($WITH_PARAMS/$TOTAL_WITH_ARGS = ${COVERAGE}%)" "need >=80%"
fi

# ── A2: Unix socket transport ───────────────────────────
SOCK_PATH="/tmp/wibwob-main.sock"
if [ -S "$SOCK_PATH" ] && $WIBWOB health 2>/dev/null | jq -r '.ok' | grep -q true; then
  check "A2" "Unix socket transport" "PASS"
else
  check "A2" "Unix socket transport" "no socket at $SOCK_PATH"
fi

# ── A3: Virtual filesystem spike ────────────────────────
if mountpoint -q /wibwob 2>/dev/null || [ -d /tmp/wibwob-fuse ] && [ -f /tmp/wibwob-fuse/state ]; then
  check "A3" "FUSE VFS spike" "PASS"
else
  # Check if the FUSE script at least exists
  if [ -f scripts/wibwob-fuse.py ] || [ -f src/cli/wibwob-fuse.ts ]; then
    check "A3" "FUSE VFS spike" "script exists but not mounted"
  else
    check "A3" "FUSE VFS spike" "no FUSE implementation found"
  fi
fi

# ── A4: _apiCall guard full coverage ────────────────────
# Test all commands that have interactive fallbacks
GUARD_PASS=0
GUARD_TOTAL=0

for cmd_id in primer.open editor.open markdown.open figlet.open; do
  GUARD_TOTAL=$((GUARD_TOTAL + 1))
  RESULT=$($WIBWOB cmd "$cmd_id" 2>/dev/null | jq -r '.result.error // .error // empty')
  if echo "$RESULT" | grep -qi 'requires.*arg.*api\|via API'; then
    GUARD_PASS=$((GUARD_PASS + 1))
  fi
done

if [ "$GUARD_PASS" -eq "$GUARD_TOTAL" ]; then
  check "A4" "_apiCall guard ($GUARD_PASS/$GUARD_TOTAL commands)" "PASS"
else
  check "A4" "_apiCall guard ($GUARD_PASS/$GUARD_TOTAL commands)" "missing guards"
fi

# ── B1: breed.py exists and works ───────────────────────
BREED_SCRIPT=""
[ -f scripts/breed.py ] && BREED_SCRIPT="scripts/breed.py"
[ -f scripts/fx/breed ] && BREED_SCRIPT="scripts/fx/breed"
[ -f .pi/skills/vj-timeline/scripts/breed.py ] && BREED_SCRIPT=".pi/skills/vj-timeline/scripts/breed.py"

if [ -n "$BREED_SCRIPT" ]; then
  # Test it with two small files
  echo "AAAA" > /tmp/breed-test-a.txt
  echo "BBBB" > /tmp/breed-test-b.txt
  BREED_OUT=$(python3 "$BREED_SCRIPT" /tmp/breed-test-a.txt /tmp/breed-test-b.txt --out /tmp/breed-test-out.txt 2>&1 || true)
  if [ -f /tmp/breed-test-out.txt ] && [ -s /tmp/breed-test-out.txt ]; then
    check "B1" "breed.py works" "PASS"
  else
    check "B1" "breed.py exists but failed" "$BREED_OUT"
  fi
  rm -f /tmp/breed-test-a.txt /tmp/breed-test-b.txt /tmp/breed-test-out.txt
else
  check "B1" "breed.py" "script not found"
fi

# ── B2: Window-as-pixel mosaic ──────────────────────────
if [ -f scripts/mosaic.sh ] || [ -f scripts/mosaic.py ] || [ -f scripts/fx/mosaic.sh ] || [ -f scripts/fx/zoo.sh ]; then
  check "B2" "Mosaic script exists" "PASS"
else
  check "B2" "Mosaic script" "not found"
fi

# ── B3: Per-window chromeless mode ──────────────────────
# Test by trying the command
CHROME_RESULT=$($WIBWOB commands -q 2>/dev/null | grep -c 'window.set_chrome' || true)
CHROME_RESULT=${CHROME_RESULT:-0}
if [ "$CHROME_RESULT" -ge 1 ]; then
  check "B3" "Per-window chromeless command" "PASS"
else
  check "B3" "Per-window chromeless command" "window.set_chrome not in catalog"
fi

# ── B4: Screenshot region crop ──────────────────────────
REGION_OUT=$($WIBWOB screenshot --region --x 0 --y 0 --w 10 --h 5 2>&1 || true)
if [ -n "$REGION_OUT" ] && ! echo "$REGION_OUT" | grep -qi 'error\|unknown\|usage'; then
  check "B4" "Screenshot region crop" "PASS"
else
  check "B4" "Screenshot region crop" "not implemented"
fi

# ── B5: ascii-fx as commands ────────────────────────────
FX_COUNT=$($WIBWOB commands -q 2>/dev/null | grep -c '^fx\.' || true)
FX_COUNT=${FX_COUNT:-0}
if [ "$FX_COUNT" -ge 3 ]; then
  check "B5" "ascii-fx commands ($FX_COUNT registered)" "PASS"
else
  check "B5" "ascii-fx commands ($FX_COUNT registered)" "need >=3 fx.* commands"
fi

# ── B7: JGSBREEDER pipeline ────────────────────────────
if [ -f scripts/jgsbreeder.sh ] || [ -f scripts/jgsbreeder.py ] || [ -f scripts/fx/jgsbreeder.sh ]; then
  check "B7" "JGSBREEDER pipeline script" "PASS"
else
  check "B7" "JGSBREEDER pipeline script" "not found"
fi

# ── Summary ──────────────────────────────────────────────
echo ""
echo "=== Results: $PASS/$TOTAL items complete ==="
echo "METRIC:completion_count:$PASS"
exit 0
