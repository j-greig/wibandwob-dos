#!/bin/bash
set -euo pipefail

# WibMux autoresearch benchmark
# Tests each of the 10 core operations and reports capability count + latency

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WIBMUX="$SCRIPT_DIR/wibmux.sh"

if [ ! -f "$WIBMUX" ]; then
  echo "METRIC capability_count=0"
  echo "METRIC latency_ms=0"
  echo "ERROR: wibmux.sh not found — create it first"
  exit 0
fi

PASS=0
TOTAL_MS=0
TESTS=0

# Time a command, return exit code + ms
run_timed() {
  local start_ms=$(python3 -c "import time; print(int(time.time()*1000))")
  "$@" >/dev/null 2>&1
  local rc=$?
  local end_ms=$(python3 -c "import time; print(int(time.time()*1000))")
  local elapsed=$(( end_ms - start_ms ))
  TOTAL_MS=$(( TOTAL_MS + elapsed ))
  TESTS=$(( TESTS + 1 ))
  return $rc
}

# --- SESSION LIFECYCLE ---

# 1. list — should work even with nothing running
if run_timed bash "$WIBMUX" list; then
  PASS=$((PASS + 1)); echo "PASS: list"
else echo "FAIL: list"; fi

# 2. create — open a new Ghostty window with WibWob
if run_timed bash "$WIBMUX" create --label test-wibmux; then
  PASS=$((PASS + 1)); echo "PASS: create"
  sleep 3  # let it start
else echo "FAIL: create"; fi

# 3. focus — switch to the test window
if run_timed bash "$WIBMUX" focus --label test-wibmux; then
  PASS=$((PASS + 1)); echo "PASS: focus"
else echo "FAIL: focus"; fi

# 4. attach — reconnect to instance
if run_timed bash "$WIBMUX" attach --label test-wibmux; then
  PASS=$((PASS + 1)); echo "PASS: attach"
else echo "FAIL: attach"; fi

# --- INPUT & CONTROL ---

# 5. send — input text to the terminal
if run_timed bash "$WIBMUX" send --label test-wibmux --text "echo wibmux-test"; then
  PASS=$((PASS + 1)); echo "PASS: send"
else echo "FAIL: send"; fi

# 6. read — capture content via WibWob API
if run_timed bash "$WIBMUX" read; then
  PASS=$((PASS + 1)); echo "PASS: read"
else echo "FAIL: read"; fi

# --- PROJECT LAYOUTS ---

# 7. layout — apply a layout spec
if [ -d "$SCRIPT_DIR/layouts" ] && ls "$SCRIPT_DIR/layouts/"*.json >/dev/null 2>&1; then
  LAYOUT_FILE=$(ls "$SCRIPT_DIR/layouts/"*.json | head -1)
  if run_timed bash "$WIBMUX" layout --file "$LAYOUT_FILE"; then
    PASS=$((PASS + 1)); echo "PASS: layout"
  else echo "FAIL: layout"; fi
else
  # Try inline layout
  if run_timed bash "$WIBMUX" layout --tabs "test:echo hello"; then
    PASS=$((PASS + 1)); echo "PASS: layout"
  else echo "FAIL: layout"; fi
fi

# --- SHADER CONTROL ---

# 8. shader-list — list available shaders
if run_timed bash "$WIBMUX" shader-list; then
  PASS=$((PASS + 1)); echo "PASS: shader-list"
else echo "FAIL: shader-list"; fi

# 9. shader — hot-swap a shader (use a known shader or skip)
if run_timed bash "$WIBMUX" shader --name none; then
  PASS=$((PASS + 1)); echo "PASS: shader"
else echo "FAIL: shader"; fi

# --- CLEANUP ---

# 10. close — clean shutdown
if run_timed bash "$WIBMUX" close --label test-wibmux; then
  PASS=$((PASS + 1)); echo "PASS: close"
else echo "FAIL: close"; fi

# Calculate average latency
if [ "$TESTS" -gt 0 ]; then
  AVG_MS=$(( TOTAL_MS / TESTS ))
else
  AVG_MS=0
fi

echo "METRIC capability_count=$PASS"
echo "METRIC latency_ms=$AVG_MS"
