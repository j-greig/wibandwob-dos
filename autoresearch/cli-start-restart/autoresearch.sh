#!/bin/bash
# F8 wibwob start/restart — behaviour test harness
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

# ── 0. Ensure app is running ──────────────────────────────────
bash scripts/ensure-running.sh > /dev/null 2>&1 || true
for i in $(seq 1 15); do
  wibwob health > /dev/null 2>&1 && break
  sleep 1
done
wibwob health > /dev/null 2>&1 || {
  echo "ERROR: wibwob health failed"
  exit 1
}

# Clear desktop
wibwob cmd desktop.clear-all > /dev/null 2>&1 || true
sleep 1

echo "Instance: $(wibwob health | jq -r '.instanceLabel') (pid $(wibwob health | jq -r '.pid'))"
echo ""

# ── CLI Table Entries (10 pts) ────────────────────────────────
echo "=== CLI Table Entries (10 pts) ==="

check "start in CLI_COMMANDS" 5 \
  "grep -q '\"start\"' src/cli/wibwob.ts && grep 'CLI_COMMANDS' src/cli/wibwob.ts | head -1 > /dev/null"

check "restart in CLI_COMMANDS" 5 \
  "grep -q '\"restart\"' src/cli/wibwob.ts"

# ── Help Shows Them (10 pts) ─────────────────────────────────
echo ""
echo "=== Help Shows Them (10 pts) ==="

# Pre-capture help output (outside check's eval)
wibwob help > /tmp/ww-help-f8.txt 2>&1 || true

check "help includes start" 5 \
  "grep -q 'wibwob start' /tmp/ww-help-f8.txt"

check "help includes restart" 5 \
  "grep -q 'wibwob restart' /tmp/ww-help-f8.txt"

# ── Start Works (25 pts) ─────────────────────────────────────
echo ""
echo "=== Start Works (25 pts) ==="

# Already running — start should be idempotent
OLD_PID=$(wibwob health | jq -r '.pid')

# Pre-capture start output
wibwob start > /tmp/ww-start-out.txt 2>&1 || true

check "start idempotent when running" 5 \
  "wibwob health > /dev/null 2>&1"

check "start says already running" 10 \
  "grep -qi 'already\|running\|alive\|ready' /tmp/ww-start-out.txt"

check "health responds after start" 10 \
  "wibwob health > /dev/null 2>&1"

# ── Restart Works (25 pts) ───────────────────────────────────
echo ""
echo "=== Restart Works (25 pts) ==="

check "restart command runs" 10 \
  "wibwob restart 2>&1 > /tmp/ww-restart-out.txt; [ \$? -eq 0 ]"

# Wait for new instance
for i in $(seq 1 15); do
  wibwob health > /dev/null 2>&1 && break
  sleep 1
done

check "new PID after restart" 10 \
  "NEW_PID=\$(wibwob health 2>/dev/null | jq -r '.pid'); [ \"\$NEW_PID\" != \"$OLD_PID\" ]"

check "health responds after restart" 5 \
  "wibwob health > /dev/null 2>&1"

# ── Scripts Still Work (10 pts) ──────────────────────────────
echo ""
echo "=== Scripts Still Work (10 pts) ==="

check "ensure-running.sh still works" 5 \
  "bash scripts/ensure-running.sh > /dev/null 2>&1"

check "restart.sh still works" 5 \
  "bash scripts/restart.sh > /dev/null 2>&1; sleep 2; wibwob health > /dev/null 2>&1"

# Wait for instance after restart.sh
for i in $(seq 1 10); do
  wibwob health > /dev/null 2>&1 && break
  sleep 1
done

# ── Process Cleanup (20 pts) ─────────────────────────────────
echo ""
echo "=== Process Cleanup (20 pts) ==="

# Wait for PID file to be written after last restart
sleep 2
check "PID file exists" 5 \
  "[ -f scratch/wibwob.pid ]"

LABEL=$(wibwob health 2>/dev/null | jq -r '.instanceLabel // "main"')
check "socket exists after start" 5 \
  "ls scratch/instances/*.sock > /dev/null 2>&1"

# Restart should cleanly stop old process
OLD_PID2=$(wibwob health | jq -r '.pid')
wibwob restart > /dev/null 2>&1 || true
for i in $(seq 1 15); do
  wibwob health > /dev/null 2>&1 && break
  sleep 1
done

check "old process gone after restart" 10 \
  "! kill -0 $OLD_PID2 2>/dev/null"

# ── Summary ───────────────────────────────────────────────────
echo ""
echo "========================================="
echo "start_score: $SCORE / $TOTAL"
echo "========================================="
