#!/usr/bin/env bash
# @name    process-manager
# @desc    Dual-mode process management: --direct (default) or --tmux
#
# Source this in OPS scripts for unified start/stop/query helpers.
# Direct mode: PID file + PTY via `script` + log file. No tmux dependency.
# Tmux mode:   Named session, send-keys launch. Legacy behavior preserved.
#
# Usage:
#   source scripts/lib/process-manager.sh
#   ww_parse_mode "$@"          # sets WW_MODE, strips --direct/--tmux from args
#   ww_start_app "$CMD"
#   ww_stop_app
#   ww_is_running                # exit 0 if alive
#   ww_send_reset                # reset terminal escape codes
#   ww_get_dimensions            # prints COLSxROWS

# No set -e (kill/tmux fail gracefully). No set -u (empty arrays).
set -o pipefail

# ── Defaults ────────────────────────────────────────────────────────
WW_ROOT="${WW_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
# Auto-detect: use tmux in headless/cloud environments unless explicitly overridden.
# Rationale: --direct mode uses macOS `script` syntax that fails on Linux containers.
# PHILOSOPHY.md: "whatever the human can do, the agent must be able to do."
if [[ -z "${WW_MODE:-}" ]]; then
  if [[ ! -t 0 ]] || [[ "${TERM:-dumb}" == "dumb" ]]; then
    WW_MODE="tmux"
    echo "  (auto-detected headless environment — using tmux mode)" >&2
  else
    WW_MODE="direct"
  fi
fi
WW_SESSION="${TMUX_SESSION:-wibwob}"
WW_PORT="${CONTROL_API_PORT:-8099}"
WW_COLS="${WW_COLS:-${TMUX_COLS:-205}}"
WW_ROWS="${WW_ROWS:-${TMUX_ROWS:-55}}"
WW_WINDOW="${WW_WINDOW:-0}"
WW_PID_FILE="${WW_ROOT}/${SCRATCH_DIR:-scratch}/wibwob.pid"
WW_LOG_FILE="${WW_ROOT}/${SCRATCH_DIR:-scratch}/wibwob.log"
WW_API="http://127.0.0.1:${WW_PORT}"

# ── Mode parser — call before other helpers ─────────────────────────
# Strips --direct/--tmux from the caller's arg list.
# Sets WW_MODE. Remaining args are returned via WW_REMAINING_ARGS.
WW_REMAINING_ARGS=()
ww_parse_mode() {
  WW_REMAINING_ARGS=()
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --direct) WW_MODE="direct"; shift ;;
      --tmux)   WW_MODE="tmux";   shift ;;
      --port)   WW_PORT="$2"; WW_API="http://127.0.0.1:${WW_PORT}"; shift 2 ;;
      --session) WW_SESSION="$2"; shift 2 ;;
      --cols)   WW_COLS="$2"; shift 2 ;;
      --rows)   WW_ROWS="$2"; shift 2 ;;
      *)        WW_REMAINING_ARGS+=("$1"); shift ;;
    esac
  done
}

# ── Health check ────────────────────────────────────────────────────
ww_health_response() {
  curl -s --max-time 2 "${WW_API}/health" 2>/dev/null || true
}

ww_is_running() {
  local health
  health=$(ww_health_response)
  [[ -n "$health" ]] && echo "$health" | grep -q '"ok":true'
}

ww_instance_id() {
  local health
  health=$(ww_health_response)
  echo "$health" | grep -o '"instanceId":"[^"]*"' | cut -d'"' -f4 || true
}

ww_is_port_alive() {
  lsof -ti:"$WW_PORT" >/dev/null 2>&1
}

# ── Get dimensions ──────────────────────────────────────────────────
ww_get_dimensions() {
  if [[ "$WW_MODE" == "tmux" ]] && tmux has-session -t "$WW_SESSION" 2>/dev/null; then
    local w h
    w=$(tmux display-message -t "$WW_SESSION" -p '#{pane_width}' 2>/dev/null || echo "$WW_COLS")
    h=$(tmux display-message -t "$WW_SESSION" -p '#{pane_height}' 2>/dev/null || echo "$WW_ROWS")
    echo "${w}x${h}"
  else
    echo "${WW_COLS}x${WW_ROWS}"
  fi
}

# ── Reset terminal escape codes ────────────────────────────────────
ww_send_reset() {
  local RESET_SEQ
  RESET_SEQ="printf '\\033[?1000l\\033[?1002l\\033[?1003l\\033[?1006l\\033[?25h\\033[0m'"
  if [[ "$WW_MODE" == "tmux" ]]; then
    if tmux has-session -t "$WW_SESSION" 2>/dev/null; then
      tmux send-keys -t "$WW_SESSION:$WW_WINDOW" "$RESET_SEQ" Enter
      sleep 0.3
    fi
  else
    # In direct mode, escape codes reset isn't needed — the PTY is fresh
    # or the old process cleaned up on SIGTERM.
    true
  fi
}

# ── Start app ───────────────────────────────────────────────────────
# Usage: ww_start_app "bun run dev:world"
ww_start_app() {
  local cmd="${1:?Usage: ww_start_app CMD}"

  if [[ "$WW_MODE" == "tmux" ]]; then
    # Ensure tmux session exists
    if ! tmux has-session -t "$WW_SESSION" 2>/dev/null; then
      echo "  creating tmux session: $WW_SESSION (${WW_COLS}x${WW_ROWS})"
      tmux new-session -d -s "$WW_SESSION" -x "$WW_COLS" -y "$WW_ROWS"
      sleep 0.5
    fi
    ww_send_reset
    echo "  launching in tmux: $cmd"
    tmux send-keys -t "$WW_SESSION:$WW_WINDOW" "cd $WW_ROOT && $cmd" Enter
  else
    # Direct mode: allocate a PTY via `script`, run in background
    mkdir -p "$(dirname "$WW_LOG_FILE")"
    echo "  launching (direct mode): $cmd"
    echo "  log: $WW_LOG_FILE"

    # Use `script` to provide a real PTY for blessed.
    # macOS: script -q /dev/null bash -c "CMD"
    # Linux: script -qfc "CMD" /dev/null  (different flag convention)
    local script_cmd
    if [[ "$(uname)" == "Darwin" ]]; then
      script_cmd="script -q /dev/null bash -c 'cd $WW_ROOT && $cmd'"
    else
      script_cmd="script -qfc 'bash -c \"cd $WW_ROOT && $cmd\"' /dev/null"
    fi
    COLUMNS="$WW_COLS" LINES="$WW_ROWS" \
      nohup bash -c "$script_cmd" \
      > "$WW_LOG_FILE" 2>&1 &
    local bg_pid=$!
    # The actual bun process is a child of script; we'll rely on PID file
    # written by the app itself, or port-based detection.
    disown "$bg_pid" 2>/dev/null || true
  fi
}

# ── Stop app ────────────────────────────────────────────────────────
# Usage: ww_stop_app [--force]
ww_stop_app() {
  local force=0
  [[ "${1:-}" == "--force" ]] && force=1

  if [[ "$force" -eq 1 ]]; then
    if ww_is_port_alive; then
      echo "  SIGKILL → port $WW_PORT"
      kill -9 "$(lsof -ti:"$WW_PORT")" 2>/dev/null || true
    fi
    pkill -9 -f "wibwob-dos" 2>/dev/null || true
    sleep 2
    return
  fi

  # Graceful: SIGTERM via PID file or port
  if [[ -f "$WW_PID_FILE" ]]; then
    local pid
    pid=$(cat "$WW_PID_FILE")
    echo "  SIGTERM → pid $pid"
    kill "$pid" 2>/dev/null || true
  elif ww_is_port_alive; then
    echo "  SIGTERM → port $WW_PORT"
    kill "$(lsof -ti:"$WW_PORT")" 2>/dev/null || true
  else
    echo "  nothing running on port $WW_PORT"
    return
  fi

  # Wait for clean exit
  for _ in $(seq 1 5); do
    ww_is_port_alive || return
    sleep 1
  done

  # Escalate
  echo "  still alive after SIGTERM — escalating to SIGKILL"
  ww_stop_app --force
}

# ── Wait for API ────────────────────────────────────────────────────
# Usage: ww_wait_for_api [timeout_seconds]
ww_wait_for_api() {
  local timeout="${1:-30}"
  echo -n "  waiting for API"
  for _ in $(seq 1 "$timeout"); do
    sleep 1
    if ww_is_running; then
      local id
      id=$(ww_instance_id)
      echo ""
      echo "✓ ready  instance=$id  port=$WW_PORT  mode=$WW_MODE"
      return 0
    fi
    echo -n "."
  done
  echo ""
  echo "✗ timed out waiting for API on port $WW_PORT" >&2
  return 1
}

# ── Tmux-specific helpers (no-op in direct mode) ───────────────────
ww_tmux_send_keys() {
  if [[ "$WW_MODE" == "tmux" ]]; then
    tmux send-keys -t "$WW_SESSION:$WW_WINDOW" "$@"
  fi
}

ww_tmux_has_session() {
  [[ "$WW_MODE" == "tmux" ]] && tmux has-session -t "$WW_SESSION" 2>/dev/null
}
