#!/bin/bash
set -euo pipefail

# WibMux autoresearch benchmark
# Tests each of the 8 core operations and reports capability count + latency

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

# 1. list — should work even with nothing running
if run_timed bash "$WIBMUX" list; then
  PASS=$((PASS + 1))
  echo "PASS: list"
else
  echo "FAIL: list"
fi

# 2. create — open a new Ghostty window with WibWob
if run_timed bash "$WIBMUX" create --label test-wibmux; then
  PASS=$((PASS + 1))
  echo "PASS: create"
  sleep 3  # let it start
else
  echo "FAIL: create"
fi

# 3. focus — switch to the test window
if run_timed bash "$WIBMUX" focus --label test-wibmux; then
  PASS=$((PASS + 1))
  echo "PASS: focus"
else
  echo "FAIL: focus"
fi

# 4. send — input text to the terminal
if run_timed bash "$WIBMUX" send --label test-wibmux --text "echo wibmux-test"; then
  PASS=$((PASS + 1))
  echo "PASS: send"
else
  echo "FAIL: send"
fi

# 5. split — create a split pane
if run_timed bash "$WIBMUX" split --label test-wibmux --direction right; then
  PASS=$((PASS + 1))
  echo "PASS: split"
else
  echo "FAIL: split"
fi

# 6. read — capture content via WibWob API (not osascript)
if run_timed bash "$WIBMUX" read; then
  PASS=$((PASS + 1))
  echo "PASS: read"
else
  echo "FAIL: read"
fi

# 7. attach — reconnect to instance
if run_timed bash "$WIBMUX" attach --label test-wibmux; then
  PASS=$((PASS + 1))
  echo "PASS: attach"
else
  echo "FAIL: attach"
fi

# 8. close — clean shutdown
if run_timed bash "$WIBMUX" close --label test-wibmux; then
  PASS=$((PASS + 1))
  echo "PASS: close"
else
  echo "FAIL: close"
fi

# Calculate average latency
if [ "$TESTS" -gt 0 ]; then
  AVG_MS=$(( TOTAL_MS / TESTS ))
else
  AVG_MS=0
fi

echo "METRIC capability_count=$PASS"
echo "METRIC latency_ms=$AVG_MS"
