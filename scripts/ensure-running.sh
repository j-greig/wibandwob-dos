#!/usr/bin/env bash
# @name    ensure-running
# @desc    Idempotent start — handles not running, dead app, already alive
# ensure-running.sh — Idempotent: make sure WibWob-DOS is alive.
#
# Modes:
#   --direct  (default) PTY via `script`, no tmux dependency
#   --tmux              Legacy tmux session management
#
# Usage:
#   bash scripts/ensure-running.sh                         # direct mode
#   bash scripts/ensure-running.sh --tmux                  # tmux mode
#   bash scripts/ensure-running.sh --cmd "bun run dev:world"
#   bash scripts/ensure-running.sh --port 8098 --session wibwob-alt
#
# Safe for multiple agents/humans to call concurrently — the first wins,
# the rest see "already running" and exit 0.

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
source "$ROOT/scripts/lib/process-manager.sh"

CMD="${WIBWOB_CMD:-bun run dev:world}"

# Parse args (process-manager handles --direct/--tmux/--port/--session/--cols/--rows)
ww_parse_mode "$@"
# Extract --cmd from remaining args
ARGS=()
for ((i=0; i<${#WW_REMAINING_ARGS[@]}; i++)); do
  case "${WW_REMAINING_ARGS[$i]}" in
    --cmd) CMD="${WW_REMAINING_ARGS[$((i+1))]}"; ((i++)) ;;
    *)     ARGS+=("${WW_REMAINING_ARGS[$i]}") ;;
  esac
done

# ── Check if already alive ──────────────────────────────────────────
if ww_is_running; then
  id=$(ww_instance_id)
  echo "✓ already running  instance=$id  port=$WW_PORT  mode=$WW_MODE"
  exit 0
fi

# ── Check if something is already starting on this port ─────────────
if ww_is_port_alive; then
  echo "  port $WW_PORT in use but API not responding — waiting..."
  for _ in $(seq 1 15); do
    sleep 1
    if ww_is_running; then
      id=$(ww_instance_id)
      echo "✓ came alive  instance=$id  port=$WW_PORT"
      exit 0
    fi
  done
  echo "  port $WW_PORT stuck — killing stale process"
  kill -9 "$(lsof -ti:"$WW_PORT")" 2>/dev/null || true
  sleep 1
fi

# ── Reset terminal (tmux mode only) ────────────────────────────────
ww_send_reset

# ── Launch ──────────────────────────────────────────────────────────
echo "▶ ensure-running: mode=$WW_MODE port=$WW_PORT"
ww_start_app "$CMD"

# ── Poll for API ────────────────────────────────────────────────────
ww_wait_for_api 30 || exit 1
