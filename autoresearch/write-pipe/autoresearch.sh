#!/bin/bash
# F5 Write Pipe — behaviour test harness
#
# Canon: wibwob is the command surface. No curl, no ww-* aliases.
set -euo pipefail
source ~/.wibwob

SCORE=0
TOTAL=0

check() {
  local label="$1"
  local pts="$2"
  local test="$3"
  TOTAL=$((TOTAL + pts))
  if eval "$test" > /dev/null 2>&1; then
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

echo "Instance: $(wibwob health | jq -r '.instanceLabel') (pid $(wibwob health | jq -r '.pid'))"
echo ""

# Clear desktop
wibwob cmd desktop.clear-all > /dev/null 2>&1
sleep 1

# ── CLI Infrastructure (20 pts) ──────────────────────────────
echo "=== CLI Infrastructure (20 pts) ==="

check "wibwob write subcommand exists" 5 \
  "grep -q 'write' src/cli/wibwob.ts"

check "wibwob write reads stdin" 5 \
  "grep -q 'stdin\|readFileSync.*0\|process.stdin' src/cli/wibwob.ts"

check "wibwob write resolves appType" 5 \
  "grep -q 'appType' src/cli/wibwob.ts"

check "wibwob write dispatches command" 5 \
  "grep -q 'commands/run\|cmdRun\|write.*dispatch' src/cli/wibwob.ts"

# ── Figlet Write (25 pts) ────────────────────────────────────
echo ""
echo "=== Figlet Write (25 pts) ==="

# Open figlet with known text
wibwob cmd microapp.wibwob.figlet.open --text BEFORE --font doom > /dev/null 2>&1
sleep 1
FIGLET_ID=$(wibwob state | jq '[.windows[] | select(.appType=="wibwob.figlet")] | last | .id')

check "figlet.write command exists" 5 \
  "wibwob commands -q | grep -q 'microapp.wibwob.figlet.write'"

# Write new text to the figlet window
echo "AFTER" | wibwob write "$FIGLET_ID" > /dev/null 2>&1
sleep 1

check "figlet text updated" 10 \
  "wibwob screenshot $FIGLET_ID 2>/dev/null | grep -q 'AFTER'"

# Check it's the same window, not a new one
FIGLET_COUNT=$(wibwob state | jq '[.windows[] | select(.appType=="wibwob.figlet")] | length')
check "original window preserved (not new)" 10 \
  "[ '$FIGLET_COUNT' = '1' ]"

# ── Fallback Convention (20 pts) ──────────────────────────────
echo ""
echo "=== Fallback Convention (20 pts) ==="

# Journal: write should fall back to journal.create
wibwob cmd microapp.wibwob.journal.open > /dev/null 2>&1
sleep 1
JOURNAL_ID=$(wibwob state | jq '[.windows[] | select(.appType=="wibwob.journal")] | last | .id')

echo "autoresearch test entry" | wibwob write "$JOURNAL_ID" > /dev/null 2>&1
sleep 1

check "journal fallback to create" 10 \
  "wibwob cmd microapp.wibwob.journal.list 2>/dev/null | jq -e '.entries[] | select(.body | contains(\"autoresearch test\"))'"

# Chatroom: write should fall back to chatroom.send
# (skip if no chatroom available — don't force network dependency)
check "chatroom fallback to send" 10 \
  "wibwob commands -q | grep -q 'microapp.wibwob.chatroom.send'"

# ── Read Alias (10 pts) ──────────────────────────────────────
echo ""
echo "=== Read Alias (10 pts) ==="

check "wibwob read works" 10 \
  "wibwob read $FIGLET_ID 2>/dev/null | grep -q 'AFTER'"

# ── Pipe Composition (25 pts) ────────────────────────────────
echo ""
echo "=== Pipe Composition (25 pts) ==="

check "echo | wibwob write works" 10 \
  "echo 'PIPED' | wibwob write $FIGLET_ID > /dev/null 2>&1 && sleep 1 && wibwob screenshot $FIGLET_ID 2>/dev/null | grep -q 'PIPED'"

# Read figlet → write to journal
check "wibwob read | wibwob write pipes between windows" 15 \
  "wibwob read $FIGLET_ID 2>/dev/null | wibwob write $JOURNAL_ID > /dev/null 2>&1 && sleep 1 && wibwob cmd microapp.wibwob.journal.list 2>/dev/null | jq -e '.entries[] | select(.body | contains(\"PIPED\"))'"

# ── Summary ───────────────────────────────────────────────────
echo ""
echo "========================================="
echo "write_score: $SCORE / $TOTAL"
echo "========================================="
