#!/usr/bin/env bash
# @name    suite-runner
# @desc    Run experimental scripts with verifiably logged results
# Usage:
#   bash .planning/experiments/suite-runner.sh <script-name|all|fx> [--label <label>] [--instance <id>]
#   # e.g.
#   bash .planning/experiments/suite-runner.sh smoke-screenshot-pipeline --instance mwg
#   bash .planning/experiments/suite-runner.sh fx --label "text-fx-tests"
#   bash .planning/experiments/suite-runner.sh all --label "full-suite"

set -euo pipefail

EXPERIMENTS_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$EXPERIMENTS_DIR/../.." && pwd)"
SCRIPTS_DIR="$ROOT/scripts/experimental"
FX_DIR="$ROOT/scripts/fx"
RUNS_DIR="$EXPERIMENTS_DIR/runs"

# Parse args
TARGET="${1:-all}"
FORCE_INSTANCE=""
LABEL=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --label) LABEL="$2"; shift 2 ;;
    --instance) FORCE_INSTANCE="$2"; shift 2 ;;
    *) shift ;;
  esac
done

# Default to mwg if available
if [[ -z "$FORCE_INSTANCE" ]]; then
  if curl -sf --max-time 0.5 "http://127.0.0.1:8100/health" > /dev/null 2>&1; then
    FORCE_INSTANCE="mwg"
  fi
fi

# ── Detect / verify instance ─────────────────────────────────────────
if [[ -n "$FORCE_INSTANCE" ]]; then
  case "$FORCE_INSTANCE" in
    mwg)  API_PORT=8100 ;;
    main) API_PORT=8099 ;;
    *)    API_PORT=8099 ;;
  esac
  if ! curl -sf --max-time 1 "http://127.0.0.1:${API_PORT}/health" > /dev/null 2>&1; then
    echo "ERROR: instance '$FORCE_INSTANCE' not reachable on port $API_PORT" >&2
    exit 1
  fi
  INSTANCE_ID="$FORCE_INSTANCE"
  echo "Forced instance: $INSTANCE_ID (port $API_PORT)"
else
  INSTANCE_ID="auto"; API_PORT=8099
fi

# Build wibwob wrapper that auto-targets the instance
WRAP_DIR="$ROOT/scratch/wrap-ww"
mkdir -p "$WRAP_DIR"
cat > "$WRAP_DIR/wibwob" << 'WRAP'
#!/usr/bin/env bash
exec bun run src/cli/wibwob.ts -i "$INSTANCE_ID" "$@"
WRAP
chmod +x "$WRAP_DIR/wibwob"

# Prepend wrapper to PATH so ALL wibwob calls in child scripts route correctly
# Prepend wrapper to PATH and write a launcher so child scripts get the env
export PATH="$WRAP_DIR:$PATH"
export WIBWOB_API="http://127.0.0.1:${API_PORT}"

# Launcher: cd to repo root, set env vars, run script via relative path
# Build it in two parts: static header (unquoted heredoc → ${API_PORT} expands)
# then the exec line appended separately so $@ stays literal
LAUNCHER="$WRAP_DIR/launch"
cat > "$LAUNCHER" << 'LAUNCHER_HEAD'
#!/usr/bin/env bash
cd /Users/james/Repos/wibwob-zine-moodboard
export WIBWOB_API="http://127.0.0.1:API_PORT_REPLACEME"
export WW_API="http://127.0.0.1:API_PORT_REPLACEME"
export CONTROL_API_PORT="API_PORT_REPLACEME"
LAUNCHER_HEAD
# Substitute the port value
sed -i '' "s/API_PORT_REPLACEME/${API_PORT}/" "$LAUNCHER"
# Append the exec line (no heredoc needed)
echo 'exec bash "$@"' >> "$LAUNCHER"
chmod +x "$LAUNCHER"

# ── Determine run subdir ─────────────────────────────────────────────
TODAY=$(date +%Y-%m-%d)
RUN_DIR="$RUNS_DIR/$TODAY"
mkdir -p "$RUN_DIR"

SESSION=1
while [[ -d "$RUN_DIR" ]] && [[ $(ls -A "$RUN_DIR"/*.json 2>/dev/null | wc -l) -gt 0 ]]; do
  SESSION=$((SESSION + 1))
  RUN_DIR="$RUNS_DIR/${TODAY}-s${SESSION}"
  mkdir -p "$RUN_DIR"
done

if [[ -n "$LABEL" ]]; then
  RUN_DIR="${RUN_DIR}-${LABEL}"
  mkdir -p "$RUN_DIR"
fi

echo "Run dir : $RUN_DIR"
echo "Instance: $INSTANCE_ID (port $API_PORT)"

# ── Script sets ───────────────────────────────────────────────────────
EXP_SCRIPTS=(smoke-screenshot-pipeline desktop-compose desktop-save dvd-screensaver dvd-screensaver-v2 dvd-screensaver-v3 dvd-wib-to-wob)
FX_SCRIPTS=(breed crop diagonal-trail flip glitch jgsbreeder kaleidoscope lava-lamp liquid-shear mirror pinball repeat shear tui-acid upside-down zoo)

case "$TARGET" in
  all) SCRIPTS_TO_RUN=("${EXP_SCRIPTS[@]}") ;;
  fx)  SCRIPTS_TO_RUN=("${FX_SCRIPTS[@]}"); SCRIPTS_DIR="$FX_DIR" ;;
  *)   SCRIPTS_TO_RUN=("$TARGET") ;;
esac

# ── Log to file + stdout ──────────────────────────────────────────────
SUITE_LOG="$RUN_DIR/run.log"
exec >> "$SUITE_LOG" 2>&1

# Also duplicate to stdout via a fd
eval "exec 3>&1"

log() {
  echo "$@" | tee -a "$SUITE_LOG" >&3
}

echo "========================================"
echo "Suite run: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "Scripts: ${SCRIPTS_TO_RUN[*]}"
echo "Instance: $INSTANCE_ID:$API_PORT"
echo "Output: $RUN_DIR"
echo "========================================"
echo ""

# ── Run scripts ───────────────────────────────────────────────────────
declare PASS_COUNT=0 FAIL_COUNT=0 SKIP_COUNT=0
SCRIPT_RESULTS=()

for SCRIPT in "${SCRIPTS_TO_RUN[@]}"; do
  # Resolve path: experimental/, fx/, then bare (e.g. breed)
  if [[ -f "$SCRIPTS_DIR/${SCRIPT}.sh" ]]; then
    SCRIPT_PATH="$SCRIPTS_DIR/${SCRIPT}.sh"
  elif [[ -f "$FX_DIR/${SCRIPT}.sh" ]]; then
    SCRIPT_PATH="$FX_DIR/${SCRIPT}.sh"
  elif [[ -f "$FX_DIR/${SCRIPT}" ]]; then
    SCRIPT_PATH="$FX_DIR/${SCRIPT}"
  else
    echo "--- $SCRIPT ---"
    echo "SKIP: ${SCRIPT} not found"
    SKIP_COUNT=$((SKIP_COUNT + 1))
    continue
  fi

  RESULT_JSON="$RUN_DIR/${SCRIPT}.json"
  OUTPUT_TXT="$RUN_DIR/${SCRIPT}-output.txt"

  echo "--- $SCRIPT ---"

  START_MS=$(python3 -c "import time; print(int(time.time() * 1000))")
  START_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ)

  # Run via launcher: use relative path so $0 works for ROOT detection
  SCRIPT_REL="scripts/experimental/${SCRIPT}.sh"
  [[ ! -f "$SCRIPT_REL" ]] && SCRIPT_REL="scripts/fx/${SCRIPT}.sh"
  [[ ! -f "$SCRIPT_REL" ]] && SCRIPT_REL="scripts/fx/${SCRIPT}"   # bare name (breed, etc.)
  bash "$LAUNCHER" "$SCRIPT_REL" > "$OUTPUT_TXT" 2>&1; EXIT_CODE=$?

  END_MS=$(python3 -c "import time; print(int(time.time() * 1000))")
  DURATION_MS=$((END_MS - START_MS))

  # Parse summary
  SUMMARY="exit=$EXIT_CODE"
  if grep -q "passed, [0-9]* failed" "$OUTPUT_TXT" 2>/dev/null; then
    RAW=$(grep "passed, [0-9]* failed" "$OUTPUT_TXT" | tail -1)
    PASS_P=$(echo "$RAW" | grep -o '[0-9]* passed' | grep -o '[0-9]*')
    FAIL_P=$(echo "$RAW" | grep -o '[0-9]* failed' | grep -o '[0-9]*')
    PASS_COUNT=$((PASS_COUNT + PASS_P))
    FAIL_COUNT=$((FAIL_COUNT + FAIL_P))
    SUMMARY="${PASS_P}/${((PASS_P + FAIL_P))} checks pass"
  elif [[ "$EXIT_CODE" -eq 0 ]]; then
    SUMMARY="exit=0 ok"
  fi

  # Extract individual check results
  CHECKS=$(python3 - "$OUTPUT_TXT" <<'PYEOF'
import json, sys
lines = open(sys.argv[1]).readlines()
checks = {}
for line in lines:
    line = line.rstrip()
    if line.startswith('  \u2713 ') or line.startswith('  OK ') or line.startswith('  PASS '):
        name = line[4:].split(' \u2014 ')[0].split(' — ')[0].strip()
        checks[name] = 'PASS'
    elif line.startswith('  \u2717 ') or line.startswith('  FAIL ') or line.startswith('  \u2715 '):
        name = line[4:].split(' \u2014 ')[0].split(' — ')[0].strip()
        checks[name] = 'FAIL'
print(json.dumps(checks))
PYEOF
)

  python3 - "$RESULT_JSON" "$START_TIME" "$INSTANCE_ID" "$API_PORT" "$EXIT_CODE" "$DURATION_MS" "$SUMMARY" "$CHECKS" "$SCRIPT" <<'PYEOF'
import json, sys
try:
    checks = json.loads(sys.argv[7])
except:
    checks = {}
with open(sys.argv[1], 'w') as f:
    json.dump({
        "script": sys.argv[8],
        "ran_at": sys.argv[2],
        "instance": sys.argv[3],
        "api_port": int(sys.argv[4]),
        "exit_code": int(sys.argv[5]),
        "duration_ms": int(sys.argv[6]),
        "summary": sys.argv[7],
        "checks": checks,
    }, f, indent=2)
PYEOF

  SCRIPT_RESULTS+=("$SCRIPT:$EXIT_CODE")
  echo "  -> exit=$EXIT_CODE, ${DURATION_MS}ms, $SUMMARY"
  echo ""
done

# ── Suite summary ─────────────────────────────────────────────────────
python3 - "$RUN_DIR/summary.json" "$TODAY" "$INSTANCE_ID" "$API_PORT" "$PASS_COUNT" "$FAIL_COUNT" "$SKIP_COUNT" "${SCRIPT_RESULTS[*]}" <<'PYEOF'
import json, sys
scripts = [{"script": x.split(':')[0], "exit": int(x.split(':')[1])}
           for x in sys.argv[7].split() if ':' in x]
with open(sys.argv[1], 'w') as f:
    json.dump({
        "ran_at": sys.argv[1],
        "instance": sys.argv[2],
        "api_port": int(sys.argv[3]),
        "checks_passed": int(sys.argv[4]),
        "checks_failed": int(sys.argv[5]),
        "scripts_skipped": int(sys.argv[6]),
        "scripts": scripts,
        "outcome": "PASS" if int(sys.argv[5]) == 0 else "FAIL",
    }, f, indent=2)
PYEOF

echo "========================================"
echo "Suite complete: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "Checks: $PASS_COUNT pass, $FAIL_COUNT fail, $SKIP_COUNT skipped"
echo "Results: $RUN_DIR"
echo "========================================"
