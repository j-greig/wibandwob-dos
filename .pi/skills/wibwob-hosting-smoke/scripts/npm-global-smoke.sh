#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

STAMP="$(date +%Y%m%d-%H%M%S)"
OUT_DIR="$ROOT/scratch/captures/npm-global-smoke-$STAMP"
LOG_MD="$OUT_DIR/report.md"
LOG_TXT="$OUT_DIR/raw.log"
JSONL="$OUT_DIR/checks.jsonl"
PREFIX_DIR="$OUT_DIR/npm-prefix"
PROJECT_DIR="$OUT_DIR/project-under-test"
MICROAPP_DIR="$PROJECT_DIR/.wibwob/microapps/smoke-menu-app"
CRITICAL_FAILS=0
INFO_FAILS=0
PACK_TGZ=""
PACKAGE_NAME=""

mkdir -p "$OUT_DIR" "$PREFIX_DIR" "$MICROAPP_DIR"
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

md "# npm-global Smoke Report — $STAMP"
md ""
md "- adapter: \`npm-global\`"
md "- install prefix: \`$PREFIX_DIR\`"
md "- project under test: \`$PROJECT_DIR\`"
md ""
md "| Check | Status | Exit | Severity | Note |"
md "|---|---:|---:|---|---|"

run_check "npm_installed" "command -v npm" critical
run_check "jq_installed" "command -v jq" critical

PACKAGE_NAME="$(jq -r '.name // empty' package.json)"
if [[ -z "$PACKAGE_NAME" ]]; then
  run_check "package_name_missing" "echo 'package.json missing .name' && exit 1" critical
  exit 1
fi
run_check "package_name_detected" "test -n '$PACKAGE_NAME'" critical

# Build local package tarball (works even before publish)
run_check "npm_pack" "npm pack --silent --pack-destination '$OUT_DIR'" critical
PACK_TGZ="$(ls -t "$OUT_DIR"/*.tgz 2>/dev/null | head -n1 || true)"
if [[ -n "$PACK_TGZ" ]]; then
  run_check "npm_global_install_local_tgz" "npm install -g '$PACK_TGZ' --prefix '$PREFIX_DIR' --ignore-scripts --omit=optional" critical
else
  run_check "npm_pack_output_missing" "echo 'npm pack did not produce .tgz in $OUT_DIR' && exit 1" critical
fi

# Seed external microapp without touching core files
cat > "$MICROAPP_DIR/microapp.json" <<'JSON'
{
  "name": "smoke-menu-app",
  "version": "0.1.0",
  "description": "Smoke test external microapp",
  "type": "microapp",
  "entry": "index.ts",
  "microapp": {
    "id": "wibwob.smoke.menuapp",
    "title": "Smoke Menu App",
    "description": "External microapp for npm-global smoke",
    "multiInstance": false,
    "persist": false,
    "menu": [
      { "category": "applications", "order": 199, "label": "Smoke Menu App" }
    ],
    "palette": { "order": 199, "label": "Open Smoke Menu App" },
    "agent": true,
    "api": true
  }
}
JSON

cat > "$MICROAPP_DIR/index.ts" <<'TS'
import blessed from "blessed";
import type { MicroappHost } from "../../../../src/services/microapp-sdk.js";

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: "Smoke Menu App",
    description: "Open smoke menu app",
    menu: [{ category: "applications", order: 199, label: "Smoke Menu App" }],
    palette: { order: 199, label: "Open Smoke Menu App" },
    action: () => {
      const win = host.createWindow({ title: "Smoke Menu App", width: 44, height: 10 });
      const box = blessed.box({ parent: win.body, top: 0, left: 0, right: 0, bottom: 0, content: "external microapp smoke" });
      win.describeState(() => ({ summary: "smoke external microapp" }));
      win.captureText(() => box.getContent());
      win.onRestyle(() => host.screen.render());
      win.onCleanup(() => undefined);
    },
  });
}
TS

run_check "external_microapp_seeded" "test -f '$MICROAPP_DIR/microapp.json' && test -f '$MICROAPP_DIR/index.ts'" critical

CLI_BIN="$PREFIX_DIR/bin/wibwob"
run_check "wibwob_bin_exists" "test -x '$CLI_BIN'" critical
run_check "bun_runtime_installed" "command -v bun" critical
run_check "wibwob_bin_help" "'$CLI_BIN' help | head -n 20" critical

# If CLI exists in package mode, validate package.json bin contract and no mutable writes in install dir.
run_check "package_bin_contract" "jq -e '.bin.wibwob' package.json" critical
run_check "install_tree_no_runtime_state_yet" "test ! -d '$PREFIX_DIR/lib/node_modules/$PACKAGE_NAME/scratch'" informational

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
md "- npm prefix: \`$PREFIX_DIR\`"
md "- seeded external microapp: \`$MICROAPP_DIR\`"

log "npm-global smoke complete"
log "Report: $LOG_MD"
log "Checks JSONL: $JSONL"

if [[ $CRITICAL_FAILS -gt 0 ]]; then
  exit 1
fi
