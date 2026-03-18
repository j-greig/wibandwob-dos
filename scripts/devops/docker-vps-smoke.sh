#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

STAMP="$(date +%Y%m%d-%H%M%S)"
OUT_DIR="$ROOT/scratch/captures/docker-vps-smoke-$STAMP"
LOG_MD="$OUT_DIR/report.md"
LOG_TXT="$OUT_DIR/raw.log"
JSONL="$OUT_DIR/checks.jsonl"
SSH_KEY="$OUT_DIR/smoke_id_ed25519"
IMAGE_TAG="wibwob-ssh-smoke:$STAMP"
CONTAINER_NAME="wibwob-ssh-smoke-$STAMP"
SSH_PORT=2849
API_PORT=8099
API_FALLBACK_PORT=8100
TUNNEL_PORT=19099
TUNNEL_FALLBACK_PORT=19100
DATA_ROOT_HOST="$OUT_DIR/data-root"
DEVLOG_PATH="$ROOT/.planning/epics/e053-external-config-packaging/SMOKE_DEVLOG.md"
TUNNEL_PID=""
INSTANCE_SELECTOR="smoke"
POST_INSTANCE_SELECTOR="smoke"
CRITICAL_FAILS=0
INFO_FAILS=0
HUMAN_IN_LOOP=0
KEEP_CONTAINER=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --human-loop)
      HUMAN_IN_LOOP=1
      shift
      ;;
    --keep-container)
      KEEP_CONTAINER=1
      shift
      ;;
    *)
      echo "Unknown arg: $1" >&2
      echo "Usage: $0 [--human-loop] [--keep-container]" >&2
      exit 2
      ;;
  esac
done

mkdir -p "$OUT_DIR" "$DATA_ROOT_HOST"
: > "$LOG_TXT"
: > "$JSONL"

log() {
  echo "$*" | tee -a "$LOG_TXT"
}

md() {
  echo "$*" >> "$LOG_MD"
}

escape_md() {
  printf '%s' "$1" | sed 's/|/\\|/g' | tr '\n' ' ' | sed 's/[[:space:]]\+/ /g' | cut -c1-220
}

record_jsonl() {
  local name="$1" status="$2" rc="$3" mode="$4" cmd="$5" note="$6" severity="$7"
  CHECK_NAME="$name" CHECK_STATUS="$status" CHECK_EXIT="$rc" CHECK_MODE="$mode" CHECK_CMD="$cmd" CHECK_NOTE="$note" CHECK_SEVERITY="$severity" \
    python3 - <<'PY' >> "$JSONL"
import json
import os
print(json.dumps({
  "check": os.environ.get("CHECK_NAME", ""),
  "status": os.environ.get("CHECK_STATUS", ""),
  "exit": int(os.environ.get("CHECK_EXIT", "0")),
  "mode": os.environ.get("CHECK_MODE", ""),
  "cmd": os.environ.get("CHECK_CMD", ""),
  "note": os.environ.get("CHECK_NOTE", ""),
  "severity": os.environ.get("CHECK_SEVERITY", "critical"),
}))
PY
}

run_check() {
  local name="$1"
  local cmd="$2"
  local mode="${3:-local}"
  local severity="${4:-critical}"
  local out rc status note snippet

  log "--- CHECK: $name"
  log "CMD: $cmd"

  set +e
  if [[ "$mode" == "ssh" ]]; then
    local escaped
    escaped=$(printf "%q" "$cmd")
    out=$(ssh -i "$SSH_KEY" -p "$SSH_PORT" \
      -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
      wibwob@127.0.0.1 "bash -o pipefail -lc $escaped" 2>&1)
    rc=$?
  else
    out=$(bash -o pipefail -lc "$cmd" 2>&1)
    rc=$?
  fi
  set -e

  echo "$out" >> "$LOG_TXT"

  if [[ $rc -eq 0 ]]; then
    status="PASS"
    note="ok"
  else
    status="FAIL"
    note="exit=$rc"
  fi

  record_jsonl "$name" "$status" "$rc" "$mode" "$cmd" "$note" "$severity"

  if [[ "$status" == "FAIL" ]]; then
    if [[ "$severity" == "critical" ]]; then
      CRITICAL_FAILS=$((CRITICAL_FAILS + 1))
    else
      INFO_FAILS=$((INFO_FAILS + 1))
    fi
    note="$note ($severity)"
  fi

  md "| $name | $status | $rc | $(escape_md "$cmd") | $(escape_md "$note") |"

  snippet=$(CHECK_OUT="$out" python3 - <<'PY'
import os
text = os.environ.get('CHECK_OUT', '')
print('\n'.join(text.splitlines()[:60]))
PY
)
  md ""
  md "<details><summary>$name output</summary>"
  md ""
  md '```text'
  printf '%s\n' "$snippet" >> "$LOG_MD"
  md '```'
  md ""
  md "</details>"
  md ""

  return $rc
}

find_api_base() {
  if curl -sf "http://127.0.0.1:${TUNNEL_PORT}/health" >/dev/null 2>&1; then
    echo "http://127.0.0.1:${TUNNEL_PORT}"
    return 0
  fi
  if curl -sf "http://127.0.0.1:${TUNNEL_FALLBACK_PORT}/health" >/dev/null 2>&1; then
    echo "http://127.0.0.1:${TUNNEL_FALLBACK_PORT}"
    return 0
  fi
  return 1
}

start_tunnel() {
  if [[ -n "$TUNNEL_PID" ]]; then
    kill "$TUNNEL_PID" >/dev/null 2>&1 || true
    TUNNEL_PID=""
  fi
  ssh -i "$SSH_KEY" -p "$SSH_PORT" \
    -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
    -N -L "${TUNNEL_PORT}:127.0.0.1:${API_PORT}" \
    -L "${TUNNEL_FALLBACK_PORT}:127.0.0.1:${API_FALLBACK_PORT}" \
    wibwob@127.0.0.1 &
  TUNNEL_PID=$!
}

cleanup() {
  if [[ -n "$TUNNEL_PID" ]]; then
    kill "$TUNNEL_PID" >/dev/null 2>&1 || true
  fi
  if [[ "$KEEP_CONTAINER" -eq 1 ]]; then
    log "Keeping container for manual inspection: $CONTAINER_NAME"
    return
  fi
  log "Cleaning up container $CONTAINER_NAME"
  docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

md "# Docker VPS Smoke Report — $STAMP"
md ""
md "- image: \`$IMAGE_TAG\`"
md "- container: \`$CONTAINER_NAME\`"
md "- ssh: \`127.0.0.1:$SSH_PORT\`"
md "- mounted data root: \`$DATA_ROOT_HOST\`"
md "- human loop: \`$HUMAN_IN_LOOP\`"
md "- keep container: \`$KEEP_CONTAINER\`"
md ""
md "## Checks"
md ""
md "| Check | Status | Exit | Command | Note |"
md "|---|---:|---:|---|---|"

log "Generating ephemeral SSH key"
ssh-keygen -t ed25519 -N '' -f "$SSH_KEY" >/dev/null
PUBKEY="$(cat "$SSH_KEY.pub")"

run_check "docker_build" "docker build -t $IMAGE_TAG -f deploy/Dockerfile.ssh-smoke --build-arg SSH_PUBKEY='$PUBKEY' ." local

run_check "docker_run" "docker run -d --name $CONTAINER_NAME -p 127.0.0.1:$SSH_PORT:22 -p 127.0.0.1:${API_PORT}:${API_PORT} -p 127.0.0.1:${API_FALLBACK_PORT}:${API_FALLBACK_PORT} -v '$DATA_ROOT_HOST:/home/wibwob/.wibwob' $IMAGE_TAG" local

log "Waiting for SSH readiness"
READY=0
for _ in $(seq 1 80); do
  if ssh -i "$SSH_KEY" -p "$SSH_PORT" -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null wibwob@127.0.0.1 "echo ssh-ok" >/dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 1
done
if [[ $READY -ne 1 ]]; then
  md "| ssh_ready | FAIL | 1 | wait for ssh | timeout |"
  record_jsonl "ssh_ready" "FAIL" 1 "local" "wait for ssh" "timeout" "critical"
  run_check "container_logs_on_ssh_failure" "docker logs --tail 200 $CONTAINER_NAME" local || true
  log "SSH did not become ready"
  exit 1
else
  md "| ssh_ready | PASS | 0 | wait for ssh | ok |"
  record_jsonl "ssh_ready" "PASS" 0 "local" "wait for ssh" "ok" "critical"
fi

log "Establishing SSH API tunnel"
start_tunnel
sleep 1

log "Waiting for API readiness"
API_BASE=""
for _ in $(seq 1 80); do
  API_BASE="$(find_api_base || true)"
  if [[ -n "$API_BASE" ]]; then
    break
  fi
  sleep 1
done
if [[ -z "$API_BASE" ]]; then
  md "| api_ready | FAIL | 1 | wait for /health | timeout |"
  record_jsonl "api_ready" "FAIL" 1 "local" "wait for /health" "timeout" "critical"
  run_check "container_logs_on_api_failure" "docker logs --tail 240 $CONTAINER_NAME" local || true
  exit 1
else
  md "| api_ready | PASS | 0 | wait for /health | $API_BASE |"
  record_jsonl "api_ready" "PASS" 0 "local" "wait for /health" "$API_BASE" "critical"
fi

INSTANCE_SELECTOR=$(curl -sf "$API_BASE/health" | jq -r '.instanceId // .instanceLabel // "smoke"')
md "| instance_selector | PASS | 0 | from /health | $INSTANCE_SELECTOR |"
record_jsonl "instance_selector" "PASS" 0 "local" "derive instance selector" "$INSTANCE_SELECTOR" "critical"

if [[ "$HUMAN_IN_LOOP" -eq 1 ]]; then
  log ""
  log "=== HUMAN-IN-LOOP PAUSE ==="
  log "Open TUI in tmux via SSH:"
  log "ssh -i '$SSH_KEY' -p '$SSH_PORT' -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -t wibwob@127.0.0.1 'tmux attach -t wibwob'"
  log "Or shell into container and run: tmux attach -t wibwob"
  log "Press Enter here when you're done observing the TUI and want smoke checks to continue."
  read -r
fi

run_check "cli_instances_presence" "cd /opt/wibwob-dos && bun run src/cli/wibwob.ts instances | jq -e 'length >= 1'" ssh || true
run_check "cli_instances_duplicates_note" "cd /opt/wibwob-dos && bun run src/cli/wibwob.ts instances | jq '{count: length, uniqueInstanceIds: ([.[].instanceId] | map(select(. != null)) | unique | length)}'" ssh informational || true

# SSH-side CLI checks
run_check "cli_health" "cd /opt/wibwob-dos && bun run src/cli/wibwob.ts -i $INSTANCE_SELECTOR health" ssh || true
run_check "cli_state" "cd /opt/wibwob-dos && bun run src/cli/wibwob.ts -i $INSTANCE_SELECTOR state | jq -e '.app.instanceId,.screen.openWindowCount'" ssh || true
run_check "cli_commands" "cd /opt/wibwob-dos && bun run src/cli/wibwob.ts -i $INSTANCE_SELECTOR commands -q | head -n 20" ssh || true
run_check "cli_instances" "cd /opt/wibwob-dos && bun run src/cli/wibwob.ts instances" ssh informational || true
run_check "cli_figlet_fonts" "cd /opt/wibwob-dos && bun run src/cli/wibwob.ts -i $INSTANCE_SELECTOR cmd figlet.fonts | jq -e '.ok, (.result.fonts|length // 0)'" ssh || true
run_check "cli_cmd_figlet_open" "cd /opt/wibwob-dos && bun run src/cli/wibwob.ts -i $INSTANCE_SELECTOR cmd figlet.open --text 'DOCKER SMOKE'" ssh || true
run_check "cli_map" "cd /opt/wibwob-dos && bun run src/cli/wibwob.ts -i $INSTANCE_SELECTOR map" ssh || true
run_check "cli_screenshot_text" "cd /opt/wibwob-dos && bun run src/cli/wibwob.ts -i $INSTANCE_SELECTOR screenshot | head -n 35" ssh || true

# API checks from host
run_check "api_health" "curl -sf $API_BASE/health | jq '.ok,.instanceId,.port'" local || true
run_check "api_state" "curl -sf $API_BASE/state | jq '.app.instanceId,.screen.openWindowCount'" local || true
run_check "api_commands_list" "curl -sf $API_BASE/commands/list | jq '.ok,(.commands|length)'" local || true
run_check "api_runtime_inspection" "curl -sf $API_BASE/runtime/inspection | jq '.ok,.snapshot.rateLimit.enabled,.snapshot.rateLimit.accepted'" local || true
run_check "api_commands_run_figlet" "curl -sf -X POST $API_BASE/commands/run -H 'content-type: application/json' -d '{\"id\":\"figlet.open\",\"args\":{\"text\":\"API SMOKE\"}}' | jq '.ok'" local || true
run_check "api_screenshot_text" "curl -sf $API_BASE/screenshot/text | head -n 45" local || true
run_check "api_screenshot_ansi" "python3 - <<'PY'
import urllib.request
url = '$API_BASE/screenshot/ansi'
with urllib.request.urlopen(url, timeout=3) as resp:
    body = resp.read().decode('utf-8', errors='replace')
if len(body.strip()) == 0:
    raise SystemExit(1)
if '\\x1b[' not in body:
    raise SystemExit(2)
print(body.splitlines()[:20])
PY" local || true
run_check "api_screenshot_contains_docker_smoke" "curl -sf $API_BASE/screenshot/text | grep -Eq 'DOCKER|SMOKE'" local || true

# Basic ingress pressure sample (expects some 429 once bucket drained)
run_check "api_rate_limit_probe" "python3 - <<'PY'
import json
import urllib.request
import urllib.error

url = '$API_BASE/runtime/inspection'
ok = 0
limited = 0
err = 0
for _ in range(220):
    try:
        with urllib.request.urlopen(url, timeout=1) as resp:
            if resp.status == 200:
                ok += 1
            else:
                err += 1
    except urllib.error.HTTPError as e:
        if e.code == 429:
            limited += 1
        else:
            err += 1
    except Exception:
        err += 1

print(json.dumps({"ok": ok, "limited": limited, "err": err}))
raise SystemExit(0 if limited > 0 else 1)
PY" local informational || true

# Persistence smoke: create stateful artifact, restart container, verify data root retains instance files
run_check "persist_pre_list_data_root" "find '$DATA_ROOT_HOST' -maxdepth 4 -type f | sort | head -n 80" local informational || true
run_check "persist_write_workspace" "ssh -i '$SSH_KEY' -p '$SSH_PORT' -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null wibwob@127.0.0.1 'cd /opt/wibwob-dos && bun run src/cli/wibwob.ts -i $INSTANCE_SELECTOR cmd workspace.save_as --name docker-persist'" local || true
run_check "persist_restart_container" "docker restart $CONTAINER_NAME" local || true
sleep 4
start_tunnel
sleep 2
run_check "persist_post_health" "API_BASE=\$( (curl -sf http://127.0.0.1:${TUNNEL_PORT}/health >/dev/null && echo http://127.0.0.1:${TUNNEL_PORT}) || (curl -sf http://127.0.0.1:${TUNNEL_FALLBACK_PORT}/health >/dev/null && echo http://127.0.0.1:${TUNNEL_FALLBACK_PORT}) ); test -n \"$API_BASE\" && curl -sf \"$API_BASE/health\" | jq -e '.ok,.instanceId'" local || true
POST_API_BASE="$(find_api_base || true)"
if [[ -n "$POST_API_BASE" ]]; then
  POST_INSTANCE_SELECTOR=$(curl -sf "$POST_API_BASE/health" | jq -r '.instanceId // .instanceLabel // "smoke"')
  md "| persist_post_instance_selector | PASS | 0 | from /health | $POST_INSTANCE_SELECTOR |"
  record_jsonl "persist_post_instance_selector" "PASS" 0 "local" "derive instance selector after restart" "$POST_INSTANCE_SELECTOR" "critical"
else
  md "| persist_post_instance_selector | FAIL | 1 | from /health | api base unavailable |"
  record_jsonl "persist_post_instance_selector" "FAIL" 1 "local" "derive instance selector after restart" "api base unavailable" "critical"
  CRITICAL_FAILS=$((CRITICAL_FAILS + 1))
fi
run_check "persist_post_workspace_load" "cd /opt/wibwob-dos && bun run src/cli/wibwob.ts -i $POST_INSTANCE_SELECTOR cmd workspace.load --name docker-persist | jq -e '.ok'" ssh || true
run_check "persist_post_list_data_root" "find '$DATA_ROOT_HOST' -maxdepth 5 -type f | sort | head -n 120" local informational || true
run_check "persist_expect_state_file" "find '$DATA_ROOT_HOST' -type f -name state.json | grep -q state.json" local || true

run_check "container_logs_tail" "docker logs --tail 180 $CONTAINER_NAME" local informational || true

# Summary block
PASS_COUNT=$(grep -c '"status": "PASS"' "$JSONL" || true)
FAIL_COUNT=$(grep -c '"status": "FAIL"' "$JSONL" || true)

md ""
md "## Summary"
md ""
md "- pass checks: **$PASS_COUNT**"
md "- fail checks: **$FAIL_COUNT**"
md "- critical fail checks: **$CRITICAL_FAILS**"
md "- informational fail checks: **$INFO_FAILS**"
md ""
md "## Artifacts"
md ""
md "- raw log: \`$LOG_TXT\`"
md "- markdown report: \`$LOG_MD\`"
md "- checks jsonl: \`$JSONL\`"
md "- mounted data root: \`$DATA_ROOT_HOST\`"

# Append concise devlog/changelog entry for e053
mkdir -p "$(dirname "$DEVLOG_PATH")"
{
  echo "## $STAMP — docker-vps-smoke"
  echo "- report: $LOG_MD"
  echo "- jsonl: $JSONL"
  echo "- pass: $PASS_COUNT, fail: $FAIL_COUNT"
  echo "- critical_fail: $CRITICAL_FAILS, informational_fail: $INFO_FAILS"
  echo "- note: figlet font inventory check included (known VPS gotcha)"
  echo
} >> "$DEVLOG_PATH"

if [[ $CRITICAL_FAILS -gt 0 ]]; then
  log "Smoke run completed with critical failures: $CRITICAL_FAILS"
  log "Report: $LOG_MD"
  log "Checks JSONL: $JSONL"
  exit 1
fi

log "Smoke run complete (all critical checks passed)"
log "Report: $LOG_MD"
log "Checks JSONL: $JSONL"
