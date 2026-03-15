#!/usr/bin/env bash
# @name    restart
# @desc    Stop → relaunch → verify new instance
# Restart WibWob-DOS without human involvement.
#
# Modes:
#   --direct  (default) PTY via `script`, no tmux dependency
#   --tmux              Legacy tmux session management
#
# Usage:
#   bash scripts/restart.sh                    # direct mode
#   bash scripts/restart.sh --tmux             # tmux mode
#   bash scripts/restart.sh --force            # SIGKILL if needed
#
# Safe pattern: capture old instanceId → stop → reset terminal → launch → verify new id.

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
source "$ROOT/scripts/lib/process-manager.sh"

CMD="${WIBWOB_CMD:-bun run dev:world}"
FORCE=0

# Parse args
ww_parse_mode "$@"
for arg in "${WW_REMAINING_ARGS[@]}"; do
  case "$arg" in
    --force) FORCE=1 ;;
  esac
done
# Extract --cmd with value
for ((i=0; i<${#WW_REMAINING_ARGS[@]}; i++)); do
  case "${WW_REMAINING_ARGS[$i]}" in
    --cmd) CMD="${WW_REMAINING_ARGS[$((i+1))]}"; ((i++)) ;;
  esac
done

# ── If tmux mode but no session, delegate to ensure-running ────────
if [[ "$WW_MODE" == "tmux" ]] && ! ww_tmux_has_session; then
  echo "▶ no tmux session '$WW_SESSION' — delegating to ensure-running.sh"
  exec bash "$ROOT/scripts/ensure-running.sh" --tmux --cmd "$CMD" --port "$WW_PORT" --session "$WW_SESSION"
fi

echo "▶ restart: mode=$WW_MODE port=$WW_PORT force=$FORCE"

# ── Capture old instance id ─────────────────────────────────────────
OLD_ID=$(ww_instance_id)

# ── Stop the running process ────────────────────────────────────────
if [[ "$FORCE" -eq 1 ]]; then
  ww_stop_app --force
else
  ww_stop_app
fi

# ── Reset terminal (tmux mode) + cancel any leftover input ─────────
ww_send_reset
if [[ "$WW_MODE" == "tmux" ]]; then
  ww_tmux_send_keys "" C-c 2>/dev/null || true
  sleep 0.5
fi

# ── Relaunch ────────────────────────────────────────────────────────
ww_start_app "$CMD"

# ── Poll for new API ────────────────────────────────────────────────
if ww_wait_for_api 30; then
  NEW_ID=$(ww_instance_id)
  if [[ -n "$OLD_ID" && -n "$NEW_ID" && "$OLD_ID" == "$NEW_ID" ]]; then
    echo "  ⚠ instanceId unchanged — old process may still be running"
  fi
else
  exit 1
fi
