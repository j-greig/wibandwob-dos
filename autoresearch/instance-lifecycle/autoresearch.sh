#!/bin/bash
# E039 Instance Lifecycle — behaviour test harness
#
# Canon: `wibwob` is the command surface. No ww-* aliases, no raw curl
# unless wibwob subcommand doesn't exist yet. When a test needs a missing
# subcommand, that's a signal to add it to src/cli/wibwob.ts first.
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
  echo "ERROR: wibwob health failed — API not reachable"
  exit 1
}

INSTANCE_LABEL=$(wibwob health | jq -r '.instanceLabel // "?"')
INSTANCE_PID=$(wibwob health | jq -r '.pid')
echo "Instance: $INSTANCE_LABEL (pid $INSTANCE_PID)"
echo ""

# ── F2: Microapp Snapshot Parity (30 pts) ─────────────────────
echo "=== F2: Microapp Snapshots (30 pts) ==="

# Clear desktop to prevent accumulation from prior runs
wibwob cmd desktop.clear-all > /dev/null 2>&1
sleep 1

# Open test windows via wibwob command surface
wibwob cmd microapp.wibwob.figlet.open --text LIFECYCLE --font doom > /dev/null 2>&1
wibwob cmd microapp.wibwob.runtime-inspector.open > /dev/null 2>&1
wibwob cmd microapp.wibwob.contour.open > /dev/null 2>&1
sleep 2

# Count windows before save
BEFORE=$(wibwob windows -q | wc -l | tr -d ' ')
TYPES=$(wibwob state | jq -r '[.windows[].appType] | join(" ")')
echo "  before: $BEFORE windows: $TYPES"

# Save workspace
# TODO: replace with `wibwob workspace.save --name lifecycle-test` once added
curl -sf -X POST "http://127.0.0.1:8099/workspace/save" \
  -H 'Content-Type: application/json' \
  -d '{"name":"lifecycle-test"}' > /dev/null 2>&1

# Restart (clears all windows)
bash scripts/restart.sh > /dev/null 2>&1
for i in $(seq 1 15); do
  wibwob health > /dev/null 2>&1 && break
  sleep 1
done
sleep 2

# Load workspace
# TODO: replace with `wibwob workspace.load --name lifecycle-test` once added
curl -sf -X POST "http://127.0.0.1:8099/workspace/load" \
  -H 'Content-Type: application/json' \
  -d '{"name":"lifecycle-test"}' > /dev/null 2>&1
sleep 3

# Check what survived
check "figlet restored" 10 \
  "wibwob state | jq -e '[.windows[] | select(.appType==\"wibwob.figlet\")] | length > 0'"

check "runtime-inspector restored" 10 \
  "wibwob state | jq -e '[.windows[] | select(.appType==\"wibwob.runtime-inspector\")] | length > 0'"

check "contour restored" 10 \
  "wibwob state | jq -e '[.windows[] | select(.appType==\"wibwob.contour\")] | length > 0'"

# ── F1: Clean Death (30 pts) ──────────────────────────────────
echo ""
echo "=== F1: Clean Death (30 pts) ==="

SOCK_PATH="scratch/instances/${INSTANCE_LABEL:-main}.sock"
PID_FILE="scratch/wibwob.pid"

# Get current PID via wibwob
CURRENT_PID=$(wibwob health | jq -r '.pid')

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

# Check --workspace flag implemented in app startup
check "--workspace flag exists" 10 \
  "grep -q 'workspace' src/app.ts 2>/dev/null || grep -q 'WIBWOB_WORKSPACE' src/app.ts 2>/dev/null"

# Restart and check if orphan workspace auto-detected
bash scripts/ensure-running.sh > /dev/null 2>&1 || true
for i in $(seq 1 15); do
  wibwob health > /dev/null 2>&1 && break
  sleep 1
done

check "orphan workspace auto-loaded" 10 \
  "[ \$(wibwob windows -q | wc -l | tr -d ' ') -gt 1 ]"

# ── F4: wibwob attach (20 pts) ────────────────────────────────
echo ""
echo "=== F4: wibwob attach (20 pts) ==="

# These check that the subcommand exists and handles the flow
check "attach subcommand exists" 5 "grep -q 'attach' src/cli/wibwob.ts"
check "detects orphan workspace" 5 "grep -q 'orphan' src/cli/wibwob.ts"
check "kills stale process" 5 "grep -q 'kill\|SIGTERM\|stale' src/cli/wibwob.ts"
check "loads workspace on attach" 5 "grep -q 'workspace.*load\|loadWorkspace' src/cli/wibwob.ts"

# ── Summary ───────────────────────────────────────────────────
echo ""
echo "========================================="
echo "lifecycle_score: $SCORE / $TOTAL"
echo "========================================="
