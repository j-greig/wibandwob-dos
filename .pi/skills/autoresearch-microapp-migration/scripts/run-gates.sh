#!/usr/bin/env bash
set -euo pipefail

# Optional instance pinning:
#   WIBWOB_INSTANCE=<label-or-display-id> bash .../run-gates.sh ...
# All wibwob CLI calls in this script will target that instance.
# Optional CLI override:
#   WIBWOB_CLI="bun run src/cli/wibwob.ts" bash .../run-gates.sh ...

TARGET_DIR="${1:-microapps/demo-layout-stress-test}"
COMMAND_ID="${2:-microapp.wibwob.layout-stress-test.open}"
SIGNAL_REGEX="${3:-layout|stress|pi}"
TITLE_REGEX="${4:-Layout Stress Test \\(Pi\\)}"
MODE_FIELD="${5:-mode}"
CRASH_REGEX="${WIBWOB_RUNTIME_CRASH_REGEX:-(TypeError:|ReferenceError:|SyntaxError:|error: script \"dev:world\" exited with code 1|Unable to connect\. Is the computer able to access the url\?|socket connection was closed unexpectedly)}"
WIBWOB_INSTANCE_TARGET="${WIBWOB_INSTANCE:-}"

if [[ -n "${WIBWOB_CLI:-}" ]]; then
  # shellcheck disable=SC2206
  WIBWOB_CLI_CMD=(${WIBWOB_CLI})
elif [[ -f "src/cli/wibwob.ts" ]] && command -v bun >/dev/null 2>&1; then
  WIBWOB_CLI_CMD=(bun run src/cli/wibwob.ts)
else
  WIBWOB_CLI_CMD=(wibwob)
fi

wibwob_cmd() {
  if [[ -n "$WIBWOB_INSTANCE_TARGET" ]]; then
    "${WIBWOB_CLI_CMD[@]}" -i "$WIBWOB_INSTANCE_TARGET" "$@"
  else
    "${WIBWOB_CLI_CMD[@]}" "$@"
  fi
}

if [[ -n "${WIBWOB_API_BASE_URL:-}" ]]; then
  API="$WIBWOB_API_BASE_URL"
else
  PORT=$(wibwob_cmd health --json 2>/dev/null | jq -r '.port // 8099')
  API="http://127.0.0.1:${PORT}"
fi

BASE_LOG_LINES=0
if [[ -f scratch/wibwob.log ]]; then
  BASE_LOG_LINES=$(wc -l < scratch/wibwob.log | tr -d ' ')
fi

dump_debug() {
  echo "\n[debug] gate failed — runtime diagnostics" >&2
  echo "[debug] wibwob health --json" >&2
  wibwob_cmd health --json >&2 || true

  echo "[debug] last 140 tmux lines (session:wibwob)" >&2
  tmux capture-pane -pt wibwob:0 -S -300 2>/dev/null | tail -n 140 >&2 || true

  echo "[debug] recent scratch/wibwob.log tail" >&2
  tail -n 120 scratch/wibwob.log 2>/dev/null >&2 || true
}

on_err() {
  local rc="$?"
  dump_debug
  exit "$rc"
}

runtime_clean() {
  local phase="$1"
  local pane_dump new_log

  pane_dump=$(tmux capture-pane -pt wibwob:0 -S -300 2>/dev/null || true)
  if grep -Eiq "$CRASH_REGEX" <<<"$pane_dump"; then
    echo "runtime crash sentinel tripped in tmux during: $phase" >&2
    return 1
  fi

  if [[ -f scratch/wibwob.log ]]; then
    new_log=$(tail -n "+$((BASE_LOG_LINES + 1))" scratch/wibwob.log 2>/dev/null || true)
    if [[ -n "$new_log" ]] && grep -Eiq "$CRASH_REGEX" <<<"$new_log"; then
      echo "runtime crash sentinel tripped in scratch/wibwob.log during: $phase" >&2
      return 1
    fi
  fi

  wibwob_cmd health --json | jq -e '.ok == true' >/dev/null
}

trap on_err ERR

echo "[0] runtime preflight"
wibwob_cmd health --json | jq -e '.ok == true' >/dev/null
wibwob_cmd health --json | jq -e '(.screen.width // 0) > 1 and (.screen.height // 0) > 1' >/dev/null
runtime_clean "runtime preflight"

echo "[1] typecheck"
bun run typecheck >/dev/null

echo "[2] health"
wibwob_cmd health >/dev/null

echo "[3] command discoverable"
wibwob_cmd commands -q | grep -F "$COMMAND_ID" >/dev/null

echo "[4] command executes"
wibwob_cmd cmd "$COMMAND_ID" >/dev/null
runtime_clean "command executes"

echo "[5] state has windows"
wibwob_cmd state | jq -e '.windows | length > 0' >/dev/null

echo "[6] screenshot signal"
curl -sS "$API/screenshot/text" | grep -Eiq "$SIGNAL_REGEX"
runtime_clean "screenshot signal"

echo "[7] responsive default size"
WIBWOB_INSTANCE="$WIBWOB_INSTANCE_TARGET" bash .pi/skills/autoresearch-microapp-migration/scripts/check-responsive-sizes.sh default "$COMMAND_ID" "$TITLE_REGEX" "$SIGNAL_REGEX" "$MODE_FIELD" >/dev/null
runtime_clean "responsive default size"

echo "[8] responsive medium size"
WIBWOB_INSTANCE="$WIBWOB_INSTANCE_TARGET" bash .pi/skills/autoresearch-microapp-migration/scripts/check-responsive-sizes.sh medium "$COMMAND_ID" "$TITLE_REGEX" "$SIGNAL_REGEX" "$MODE_FIELD" >/dev/null
runtime_clean "responsive medium size"

echo "[9] responsive fullscreen size"
WIBWOB_INSTANCE="$WIBWOB_INSTANCE_TARGET" bash .pi/skills/autoresearch-microapp-migration/scripts/check-responsive-sizes.sh fullscreen "$COMMAND_ID" "$TITLE_REGEX" "$SIGNAL_REGEX" "$MODE_FIELD" >/dev/null
runtime_clean "responsive fullscreen size"

echo "[10] import boundary"
bash .pi/skills/autoresearch-microapp-migration/scripts/check-microapp-imports.sh "$TARGET_DIR" >/dev/null

echo "[11] sdk doc sync"
bash .pi/skills/autoresearch-microapp-migration/scripts/check-sdk-doc-sync.sh >/dev/null
runtime_clean "sdk doc sync"

echo "PASS all gates"
