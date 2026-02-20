#!/usr/bin/env bash
# run.sh — run a Codex task as a background subagent with log capture
#
# Usage:
#   scripts/run.sh "diagnose the race condition in app/engine.cpp"
#   scripts/run.sh --impl "refactor the tick loop in app/engine.cpp"
#   scripts/run.sh --impl --topic auth-fix "fix the login bug"
#
# Env var overrides (all optional):
#   CODEX_LOG_DIR   where logs go (default: <repo-root>/.codex-logs)
#   CODEX_REPO      repo codex operates in (default: git repo root or $PWD)
#   CODEX_MODEL     model override, e.g. o4-mini (default: codex picks)

set -uo pipefail

IMPL=false
TOPIC=""
PROMPT=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --impl)  IMPL=true; shift ;;
    --topic) TOPIC="$2"; shift 2 ;;
    -h|--help)
      sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    -*) echo "Unknown flag: $1" >&2; exit 2 ;;
    *)  PROMPT="$1"; shift ;;
  esac
done

if [[ -z "$PROMPT" ]]; then
  echo "Error: prompt required" >&2
  echo "Usage: $0 [--impl] [--topic SLUG] \"your task description\"" >&2
  exit 2
fi

if ! command -v codex &>/dev/null; then
  echo "Error: codex CLI not found — install from https://github.com/openai/codex" >&2
  exit 1
fi

# Resolve defaults
_REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo "$PWD")
CODEX_REPO="${CODEX_REPO:-$_REPO_ROOT}"
CODEX_LOG_DIR="${CODEX_LOG_DIR:-$_REPO_ROOT/.codex-logs}"

# Auto-slug topic from prompt if not set
if [[ -z "$TOPIC" ]]; then
  TOPIC=$(echo "$PROMPT" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9' '-' | cut -c1-30 | sed 's/-$//')
fi

LOG="$CODEX_LOG_DIR/$(date +%F)/codex-${TOPIC}-$(date +%Y%m%d-%H%M%S).log"
mkdir -p "$(dirname "$LOG")"

# Build codex command
CMD=(codex)
[[ -n "${CODEX_MODEL:-}" ]] && CMD+=(-m "$CODEX_MODEL")
if $IMPL; then
  CMD+=(-s workspace-write -a never)
fi
CMD+=(exec -C "$CODEX_REPO" "$PROMPT")

# Run in background with full log capture
"${CMD[@]}" 2>&1 | tee "$LOG" &
PID=$!

echo "Log:     $LOG"
echo "PID:     $PID"
echo "Monitor: tail -f $LOG"
if $IMPL; then
  echo "Mode:    implementation (workspace-write)"
else
  echo "Mode:    analysis (read-only)"
fi
