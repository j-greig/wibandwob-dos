#!/usr/bin/env bash
# @name    smoke-screenshot-pipeline
# @desc    Smoke test: CGWindowList auto-detect screenshot pipeline
#
# Verifies the full screenshot pipeline works without tmux or display guessing.
# Tests: capture-tui-png (auto), screenshot-window (API text), minimap (API text)
#
# Usage: bash scripts/experimental/smoke-screenshot-pipeline.sh

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
source "$ROOT/scripts/lib/runtime-env.sh"
API="$(ww_api_base)"

PASS=0
FAIL=0
RESULTS=()

check() {
  local name="$1" ok="$2" detail="${3:-}"
  if [[ "$ok" == "1" ]]; then
    RESULTS+=("  ✓ $name${detail:+ — $detail}")
    PASS=$((PASS + 1))
  else
    RESULTS+=("  ✗ $name${detail:+ — $detail}")
    FAIL=$((FAIL + 1))
  fi
}

echo "Screenshot Pipeline Smoke Test"
echo "=============================="
echo ""

# ── 0. App running? ────────────────────────────────────────────────
health=$(curl -s --max-time 2 "$API/health" 2>/dev/null || true)
if ! echo "$health" | grep -q '"ok":true'; then
  echo "✗ App not running on $API — cannot test" >&2
  exit 1
fi
id=$(echo "$health" | grep -o '"instanceId":"[^"]*"' | cut -d'"' -f4)
echo "App running: instance=$id"
echo ""

# ── 1. CGWindowList helper exists or builds ────────────────────────
HELPER="$ROOT/scripts/lib/find-ghostty-window"
if [[ -x "$HELPER" ]]; then
  check "find-ghostty-window binary" 1 "exists"
else
  cc -framework CoreGraphics -framework CoreFoundation \
    "$HELPER.c" -o "$HELPER" 2>/dev/null
  check "find-ghostty-window binary" $([[ -x "$HELPER" ]] && echo 1 || echo 0) "built from source"
fi

# ── 2. CGWindowList finds Ghostty ──────────────────────────────────
WIN_INFO=$("$HELPER" 2>/dev/null | head -1)
WIN_ID=$(echo "$WIN_INFO" | awk '{print $1}')
if [[ -n "$WIN_ID" ]]; then
  check "CGWindowList finds Ghostty" 1 "windowID=$WIN_ID bounds=$(echo $WIN_INFO | awk '{print $2","$3" "$4"x"$5}')"
else
  check "CGWindowList finds Ghostty" 0 "no Ghostty window on screen"
fi

# ── 3. capture-tui-png auto-detect ─────────────────────────────────
OUT="$ROOT/scratch/captures/smoke-test-auto.png"
rm -f "$OUT"
"$ROOT/scripts/capture-tui-png.sh" --out "$OUT" >/dev/null 2>&1
if [[ -s "$OUT" ]] && file "$OUT" | grep -q "PNG image data"; then
  SIZE=$(wc -c < "$OUT" | tr -d ' ')
  DIMS=$(file "$OUT" | grep -o '[0-9]* x [0-9]*')
  check "capture-tui-png (auto)" 1 "${DIMS}, ${SIZE} bytes"
else
  check "capture-tui-png (auto)" 0 "file missing or not PNG"
fi

# ── 4. capture-tui-png --display fallback ──────────────────────────
OUT2="$ROOT/scratch/captures/smoke-test-display.png"
rm -f "$OUT2"
"$ROOT/scripts/capture-tui-png.sh" --display 1 --out "$OUT2" >/dev/null 2>&1
if [[ -s "$OUT2" ]] && file "$OUT2" | grep -q "PNG image data"; then
  check "capture-tui-png (--display 1)" 1 "fallback works"
else
  check "capture-tui-png (--display 1)" 0 "failed"
fi

# ── 5. /screenshot/ansi API ────────────────────────────────────────
ANSI=$(curl -s --max-time 5 "$API/screenshot/ansi" 2>/dev/null)
ANSI_LINES=$(echo "$ANSI" | wc -l | tr -d ' ')
if [[ "$ANSI_LINES" -gt 5 ]]; then
  check "/screenshot/ansi API" 1 "${ANSI_LINES} lines"
else
  check "/screenshot/ansi API" 0 "only $ANSI_LINES lines"
fi

# ── 6. screenshot-window.sh (text crop) ────────────────────────────
# Get first window title from state
FIRST_WIN=$(curl -s "$API/state" | python3 -c "
import sys,json
ws = json.load(sys.stdin).get('windows',[])
if ws: print(ws[0].get('title',''))
" 2>/dev/null)
if [[ -n "$FIRST_WIN" ]]; then
  CROP=$("$ROOT/scripts/screenshot-window.sh" "$FIRST_WIN" 2>/dev/null || true)
  CROP_LINES=$(echo "$CROP" | wc -l | tr -d ' ')
  if [[ "$CROP_LINES" -gt 2 ]]; then
    check "screenshot-window.sh \"$FIRST_WIN\"" 1 "${CROP_LINES} lines"
  else
    check "screenshot-window.sh \"$FIRST_WIN\"" 0 "only $CROP_LINES lines"
  fi
else
  check "screenshot-window.sh" 1 "skipped — no windows open"
fi

# ── 7. minimap.sh ──────────────────────────────────────────────────
MINIMAP=$("$ROOT/scripts/minimap.sh" 2>/dev/null || true)
if echo "$MINIMAP" | grep -q "WibWob-DOS"; then
  WIN_COUNT=$(echo "$MINIMAP" | grep -o '[0-9]* window' | head -1)
  check "minimap.sh" 1 "$WIN_COUNT"
else
  check "minimap.sh" 0 "no output"
fi

# ── Results ────────────────────────────────────────────────────────
echo ""
echo "Results: $PASS passed, $FAIL failed"
echo ""
for r in "${RESULTS[@]}"; do echo "$r"; done

# Cleanup
rm -f "$ROOT/scratch/captures/smoke-test-auto.png" "$ROOT/scratch/captures/smoke-test-display.png"

echo ""
if [[ "$FAIL" -gt 0 ]]; then
  echo "FAIL"
  exit 1
else
  echo "ALL PASS ✓"
fi
