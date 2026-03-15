#!/bin/bash
# E039 Instance Lifecycle — behaviour test harness
set -euo pipefail

API="http://127.0.0.1:8099"
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
  curl -sf "$API/health" > /dev/null 2>&1 && break
  sleep 1
done
curl -sf "$API/health" > /dev/null 2>&1 || {
  echo "ERROR: API not reachable"
  exit 1
}

INSTANCE_ID=$(curl -sf "$API/health" | python3 -c "import sys,json; print(json.load(sys.stdin).get('instanceId','?'))")
INSTANCE_LABEL=$(curl -sf "$API/health" | python3 -c "import sys,json; print(json.load(sys.stdin).get('instanceLabel','?'))")
echo "Instance: $INSTANCE_LABEL · $INSTANCE_ID"
echo ""

# ── F2: Microapp Snapshot Parity (30 pts) ─────────────────────
echo "=== F2: Microapp Snapshots (30 pts) ==="

# Open test windows
curl -sf -X POST "$API/commands/run" -H 'Content-Type: application/json' \
  -d '{"id":"microapp.wibwob.figlet.open","args":{"text":"LIFECYCLE","font":"doom"}}' > /dev/null 2>&1
curl -sf -X POST "$API/commands/run" -H 'Content-Type: application/json' \
  -d '{"id":"microapp.wibwob.runtime-inspector.open"}' > /dev/null 2>&1
curl -sf -X POST "$API/commands/run" -H 'Content-Type: application/json' \
  -d '{"id":"microapp.wibwob.contour.open"}' > /dev/null 2>&1
sleep 2

# Count windows before save
BEFORE=$(curl -sf "$API/state" | python3 -c "
import sys,json
ws = json.load(sys.stdin)['windows']
types = [w.get('appType','') for w in ws]
print(f'{len(ws)} windows: {\" \".join(types)}')
")
echo "  before: $BEFORE"

# Save workspace
curl -sf -X POST "$API/workspace/save" -H 'Content-Type: application/json' \
  -d '{"name":"lifecycle-test"}' > /dev/null 2>&1

# Restart (clears all windows)
bash scripts/restart.sh > /dev/null 2>&1
for i in $(seq 1 15); do
  curl -sf "$API/health" > /dev/null 2>&1 && break
  sleep 1
done
sleep 2

# Load workspace
curl -sf -X POST "$API/workspace/load" -H 'Content-Type: application/json' \
  -d '{"name":"lifecycle-test"}' > /dev/null 2>&1
sleep 3

# Check what survived
check "figlet restored" 10 \
  "curl -sf '$API/state' | python3 -c \"import sys,json; ws=json.load(sys.stdin)['windows']; assert any(w.get('appType')=='wibwob.figlet' for w in ws)\""

check "runtime-inspector restored" 10 \
  "curl -sf '$API/state' | python3 -c \"import sys,json; ws=json.load(sys.stdin)['windows']; assert any(w.get('appType')=='wibwob.runtime-inspector' for w in ws)\""

check "contour restored" 10 \
  "curl -sf '$API/state' | python3 -c \"import sys,json; ws=json.load(sys.stdin)['windows']; assert any(w.get('appType')=='wibwob.contour' for w in ws)\""

# ── F1: Clean Death (30 pts) ──────────────────────────────────
echo ""
echo "=== F1: Clean Death (30 pts) ==="

SOCK_PATH="scratch/instances/${INSTANCE_LABEL:-main}.sock"
PID_FILE="scratch/wibwob.pid"

# Get current PID
CURRENT_PID=$(curl -sf "$API/health" | python3 -c "import sys,json; print(json.load(sys.stdin)['pid'])")

check "socket exists before kill" 5 "[ -S '$SOCK_PATH' ]"

# Send SIGHUP (terminal disconnect simulation)
kill -HUP "$CURRENT_PID" 2>/dev/null || true
sleep 3

check "socket cleaned after SIGHUP" 5 "[ ! -S '$SOCK_PATH' ]"
check "PID file cleaned after SIGHUP" 5 "[ ! -f '$PID_FILE' ]"
check "process dead after SIGHUP" 5 "! kill -0 '$CURRENT_PID' 2>/dev/null"
check "orphan workspace saved" 10 "[ -f 'scratch/workspaces/orphan-${INSTANCE_LABEL:-main}.json' ]"

# ── F3: Boot Workspace Selection (20 pts) ─────────────────────
echo ""
echo "=== F3: Boot Workspace (20 pts) ==="

# Start with --workspace flag (if implemented)
check "--workspace flag exists" 10 \
  "grep -q 'workspace' src/core/cli.ts 2>/dev/null || grep -q 'WIBWOB_WORKSPACE' src/app.ts 2>/dev/null"

# Restart normally, check if orphan workspace auto-detected
bash scripts/ensure-running.sh > /dev/null 2>&1 || true
for i in $(seq 1 15); do
  curl -sf "$API/health" > /dev/null 2>&1 && break
  sleep 1
done

check "orphan workspace auto-loaded" 10 \
  "curl -sf '$API/state' | python3 -c \"import sys,json; assert len(json.load(sys.stdin)['windows']) > 1\""

# ── F4: wibwob attach (20 pts) ────────────────────────────────
echo ""
echo "=== F4: wibwob attach (20 pts) ==="

check "attach subcommand exists" 5 "grep -q 'attach' src/cli/wibwob.ts"
check "detects orphan workspace" 5 "grep -q 'orphan' src/cli/wibwob.ts"
check "kills stale process" 5 "grep -q 'kill\|SIGTERM\|stale' src/cli/wibwob.ts"
check "loads workspace on attach" 5 "grep -q 'workspace.*load\|loadWorkspace' src/cli/wibwob.ts"

# ── Summary ───────────────────────────────────────────────────
echo ""
echo "========================================="
echo "lifecycle_score: $SCORE / $TOTAL"
echo "========================================="
