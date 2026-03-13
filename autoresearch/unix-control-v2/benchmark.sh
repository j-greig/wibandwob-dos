#!/usr/bin/env bash
set -uo pipefail
# Benchmark: CLI vs raw curl for common operations.
# Measures wall-clock time and token cost (character count as proxy).

cd /Users/james/Repos/wibandwob-dos
WIBWOB="bun run src/cli/wibwob.ts"
API="http://127.0.0.1:8099"
ITERATIONS=10

echo "=== wibwob CLI vs curl Benchmark ==="
echo "Iterations per test: $ITERATIONS"
echo ""

# ── Helper ────────────────────────────────────────────────
bench() {
  local label="$1"
  shift
  local start end elapsed
  start=$(date +%s%N 2>/dev/null || python3 -c 'import time; print(int(time.time()*1e9))')
  for i in $(seq 1 $ITERATIONS); do
    eval "$@" >/dev/null 2>&1
  done
  end=$(date +%s%N 2>/dev/null || python3 -c 'import time; print(int(time.time()*1e9))')
  elapsed=$(( (end - start) / 1000000 ))
  printf "  %-40s %6d ms  (%d ms/op)\n" "$label" "$elapsed" "$((elapsed / ITERATIONS))"
}

# ── 1. State fetch ────────────────────────────────────────
echo "--- State fetch ($ITERATIONS iterations) ---"
bench "wibwob state" '$WIBWOB state'
bench "curl /state" 'curl -s $API/state'

# ── 2. Command list ───────────────────────────────────────
echo ""
echo "--- Command list ($ITERATIONS iterations) ---"
bench "wibwob commands" '$WIBWOB commands'
bench "curl /commands/list" 'curl -s $API/commands/list'

# ── 3. Command execution: editor.new + close ──────────────
echo ""
echo "--- Editor open+close ($ITERATIONS iterations) ---"

cli_open_close() {
  local id
  id=$($WIBWOB cmd editor.new 2>/dev/null | jq -r '.result.id // empty')
  [ -n "$id" ] && $WIBWOB window "$id" close >/dev/null 2>&1
}
curl_open_close() {
  local id
  id=$(curl -s -X POST "$API/commands/run" \
    -H 'Content-Type: application/json' \
    -d '{"id":"editor.new"}' | jq -r '.result.id // empty')
  [ -n "$id" ] && curl -s -X POST "$API/commands/run" \
    -H 'Content-Type: application/json' \
    -d "{\"id\":\"window.close\",\"args\":{\"id\":$id}}" >/dev/null
}

bench "wibwob (open+close)" 'cli_open_close'
bench "curl (open+close)" 'curl_open_close'

# ── 4. Token cost comparison ─────────────────────────────
echo ""
echo "--- Token cost (characters to express same intent) ---"
CLI_CHARS=$(echo 'wibwob state' | wc -c | tr -d ' ')
CURL_CHARS=$(echo 'curl -s http://127.0.0.1:8099/state' | wc -c | tr -d ' ')
printf "  %-40s %4d chars\n" "wibwob state" "$CLI_CHARS"
printf "  %-40s %4d chars\n" "curl -s .../state" "$CURL_CHARS"
printf "  %-40s %3.0f%%\n" "CLI savings" "$(echo "scale=0; (1 - $CLI_CHARS / $CURL_CHARS) * 100" | bc)"

CLI_CMD=$(echo 'wibwob window.move --id 3 --x 10 --y 5' | wc -c | tr -d ' ')
CURL_CMD=$(echo 'curl -s -X POST http://127.0.0.1:8099/commands/run -H "Content-Type: application/json" -d "{\"id\":\"window.move\",\"args\":{\"id\":3,\"x\":10,\"y\":5}}"' | wc -c | tr -d ' ')
printf "  %-40s %4d chars\n" "wibwob window.move --id 3 --x 10 --y 5" "$CLI_CMD"
printf "  %-40s %4d chars\n" "curl POST /commands/run {...}" "$CURL_CMD"
printf "  %-40s %3.0f%%\n" "CLI savings" "$(echo "scale=0; (1 - $CLI_CMD / $CURL_CMD) * 100" | bc)"

echo ""
echo "=== Benchmark complete ==="
