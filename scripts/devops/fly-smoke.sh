#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

STAMP="$(date +%Y%m%d-%H%M%S)"
OUT_DIR="$ROOT/scratch/captures/fly-smoke-$STAMP"
LOG_MD="$OUT_DIR/report.md"
LOG_TXT="$OUT_DIR/raw.log"
JSONL="$OUT_DIR/checks.jsonl"
APP_NAME="${FLY_APP_NAME:-}"
CRITICAL_FAILS=0
INFO_FAILS=0

mkdir -p "$OUT_DIR"
: > "$LOG_TXT"
: > "$JSONL"

log() { echo "$*" | tee -a "$LOG_TXT"; }
md() { echo "$*" >> "$LOG_MD"; }

record_jsonl() {
  local name="$1" status="$2" rc="$3" mode="$4" cmd="$5" note="$6" severity="$7"
  CHECK_NAME="$name" CHECK_STATUS="$status" CHECK_EXIT="$rc" CHECK_MODE="$mode" CHECK_CMD="$cmd" CHECK_NOTE="$note" CHECK_SEVERITY="$severity" \
    python3 - <<'PY' >> "$JSONL"
import json, os
print(json.dumps({
  "check": os.environ.get("CHECK_NAME", ""),
  "status": os.environ.get("CHECK_STATUS", ""),
  "exit": int(os.environ.get("CHECK_EXIT", "0")),
  "mode": os.environ.get("CHECK_MODE", "local"),
  "cmd": os.environ.get("CHECK_CMD", ""),
  "note": os.environ.get("CHECK_NOTE", ""),
  "severity": os.environ.get("CHECK_SEVERITY", "critical"),
}))
PY
}

run_check() {
  local name="$1" cmd="$2" severity="${3:-critical}"
  local out rc status note

  log "--- CHECK: $name"
  log "CMD: $cmd"

  set +e
  out=$(bash -o pipefail -lc "$cmd" 2>&1)
  rc=$?
  set -e

  echo "$out" >> "$LOG_TXT"

  if [[ $rc -eq 0 ]]; then
    status="PASS"; note="ok"
  else
    status="FAIL"; note="exit=$rc"
    if [[ "$severity" == "critical" ]]; then
      CRITICAL_FAILS=$((CRITICAL_FAILS + 1))
    else
      INFO_FAILS=$((INFO_FAILS + 1))
    fi
  fi

  record_jsonl "$name" "$status" "$rc" "local" "$cmd" "$note" "$severity"
  md "| $name | $status | $rc | $severity | $note |"
}

md "# Fly.io Smoke Report — $STAMP"
md ""
md "- adapter: \`flyio\`"
md "- app: \`${APP_NAME:-unset}\`"
md ""
md "| Check | Status | Exit | Severity | Note |"
md "|---|---:|---:|---|---|"

run_check "flyctl_installed" "command -v flyctl" critical

if [[ -z "$APP_NAME" ]]; then
  run_check "fly_app_name_set" "echo 'Set FLY_APP_NAME env var' && exit 1" critical
else
  run_check "fly_status_json" "flyctl status --app '$APP_NAME' --json | jq -e '.Name,.Status'" critical
  run_check "fly_machine_list" "flyctl machine list --app '$APP_NAME' --json | jq -e 'length >= 1'" critical
  run_check "fly_proxy_hint" "echo 'Use flyctl proxy <local>:8099 plus core API/CLI gates from hosting skill'" informational
fi

PASS_COUNT=$(grep -c '"status": "PASS"' "$JSONL" || true)
FAIL_COUNT=$(grep -c '"status": "FAIL"' "$JSONL" || true)

md ""
md "## Summary"
md ""
md "- pass checks: **$PASS_COUNT**"
md "- fail checks: **$FAIL_COUNT**"
md "- critical fails: **$CRITICAL_FAILS**"
md "- informational fails: **$INFO_FAILS**"
md ""
md "## Artifacts"
md ""
md "- raw log: \`$LOG_TXT\`"
md "- markdown report: \`$LOG_MD\`"
md "- checks jsonl: \`$JSONL\`"

log "Fly smoke complete"
log "Report: $LOG_MD"
log "Checks JSONL: $JSONL"

if [[ $CRITICAL_FAILS -gt 0 ]]; then
  exit 1
fi
