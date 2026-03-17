#!/usr/bin/env bash
# @name    clean-instances
# @desc    Kill orphan WibWob-DOS processes and remove stale sockets/PIDs
#
# Finds all wibwob-related processes (bun run dev, bun run src/app.ts),
# kills them gracefully, then cleans up scratch/instances/.
#
# Usage:
#   bash scripts/clean-instances.sh           # dry run — show what would die
#   bash scripts/clean-instances.sh --kill    # actually kill + clean
#   bash scripts/clean-instances.sh --force   # SIGKILL if SIGTERM fails
#
# Also available as: wibwob clean [--kill] [--force]

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
INSTANCES_DIR="$ROOT/scratch/instances"
SELF_PID=$$
PARENT_PID=${PPID:-0}

# ── Cross-platform ps command ──────────────────────────────────────
# macOS: ps -p PID -o args=    Linux: ps -p PID -o cmd=
_ps_cmd() {
  local pid="$1"
  if [[ "$(uname -s)" == "Darwin" ]]; then
    ps -p "$pid" -o args= 2>/dev/null || true
  else
    ps -p "$pid" -o cmd= 2>/dev/null || true
  fi
}

# ── Cross-platform cwd check ──────────────────────────────────────
# Returns 0 if the process cwd is inside our repo root
_is_our_process() {
  local pid="$1"
  local cwd=""
  if [[ "$(uname -s)" == "Darwin" ]]; then
    # macOS: lsof -p PID -Fn to get cwd
    cwd=$(lsof -p "$pid" -Fn 2>/dev/null | grep '^n.*wibandwob-dos' | head -1 | sed 's/^n//' || true)
    # Fallback: check if command line contains our repo path
    if [[ -z "$cwd" ]]; then
      local cmd
      cmd=$(_ps_cmd "$pid")
      [[ "$cmd" == *"$ROOT"* ]] && return 0
      return 1
    fi
    return 0
  else
    # Linux: /proc/PID/cwd is a symlink
    if [[ -L "/proc/$pid/cwd" ]]; then
      cwd=$(readlink -f "/proc/$pid/cwd" 2>/dev/null || true)
    fi
    if [[ -n "$cwd" && "$cwd" == "$ROOT"* ]]; then
      return 0
    fi
    # Fallback: check command line
    local cmd
    cmd=$(_ps_cmd "$pid")
    [[ "$cmd" == *"$ROOT"* ]] && return 0
    return 1
  fi
}

# ── Parse flags ────────────────────────────────────────────────────
KILL=0
FORCE=0
for arg in "$@"; do
  case "$arg" in
    --kill)  KILL=1 ;;
    --force) KILL=1; FORCE=1 ;;
  esac
done

# ── Find wibwob processes ─────────────────────────────────────────
# Safety: process must match WibWob patterns AND belong to this repo

PIDS=()
PIDS_CMDS=()

# Source 1: PID files from scratch/instances/
if [[ -d "$INSTANCES_DIR" ]]; then
  for pidfile in "$INSTANCES_DIR"/*.pid; do
    [[ -f "$pidfile" ]] || continue
    pid="$(cat "$pidfile" 2>/dev/null)" || continue
    [[ -z "$pid" || "$pid" == "$SELF_PID" || "$pid" == "$PARENT_PID" ]] && continue
    if kill -0 "$pid" 2>/dev/null; then
      cmd=$(_ps_cmd "$pid")
      if [[ -n "$cmd" ]]; then
        PIDS+=("$pid")
        PIDS_CMDS+=("$cmd")
      fi
    fi
  done
fi

# Source 2: process scan for bun processes matching our patterns
while IFS= read -r line; do
  [[ -z "$line" ]] && continue
  pid=$(echo "$line" | awk '{print $1}')
  [[ "$pid" == "$SELF_PID" || "$pid" == "$PARENT_PID" ]] && continue

  # Skip if already found via PID file
  local_skip=0
  for existing in "${PIDS[@]+"${PIDS[@]}"}"; do
    [[ "$existing" == "$pid" ]] && local_skip=1 && break
  done
  [[ "$local_skip" == "1" ]] && continue

  # Verify process belongs to this repo (cwd check)
  if _is_our_process "$pid"; then
    cmd=$(_ps_cmd "$pid")
    PIDS+=("$pid")
    PIDS_CMDS+=("${cmd:-<unknown>}")
  fi
done < <(
  if [[ "$(uname -s)" == "Darwin" ]]; then
    ps -eo pid,args 2>/dev/null | grep -E 'bun.*(dev:world|dev:alt|dev:world:alt|src/app\.ts)' | grep -v grep || true
  else
    ps -eo pid,cmd 2>/dev/null | grep -E 'bun.*(dev:world|dev:alt|dev:world:alt|src/app\.ts)' | grep -v grep || true
  fi
)

# ── Find stale instance files ─────────────────────────────────────

STALE_SOCKS=()
STALE_PIDS=()
if [[ -d "$INSTANCES_DIR" ]]; then
  for pidfile in "$INSTANCES_DIR"/*.pid; do
    [[ -f "$pidfile" ]] || continue
    label="$(basename "$pidfile" .pid)"
    pid="$(cat "$pidfile" 2>/dev/null)" || continue
    sock="$INSTANCES_DIR/${label}.sock"
    if ! kill -0 "$pid" 2>/dev/null; then
      STALE_PIDS+=("$pidfile")
      [[ -e "$sock" ]] && STALE_SOCKS+=("$sock")
    fi
  done
  # Orphan sockets with no matching PID file
  for sockfile in "$INSTANCES_DIR"/*.sock; do
    [[ -S "$sockfile" ]] || continue
    label="$(basename "$sockfile" .sock)"
    pidfile="$INSTANCES_DIR/${label}.pid"
    if [[ ! -f "$pidfile" ]]; then
      STALE_SOCKS+=("$sockfile")
    fi
  done
fi

# Also check legacy scratch/wibwob.pid
LEGACY_PID=""
if [[ -f "$ROOT/scratch/wibwob.pid" ]]; then
  lpid="$(cat "$ROOT/scratch/wibwob.pid" 2>/dev/null)"
  if [[ -n "$lpid" ]] && ! kill -0 "$lpid" 2>/dev/null; then
    LEGACY_PID="$ROOT/scratch/wibwob.pid"
  fi
fi

# ── Report ─────────────────────────────────────────────────────────

echo "WibWob-DOS Instance Cleanup"
echo "==========================="
echo ""

if [[ ${#PIDS[@]} -eq 0 && ${#STALE_PIDS[@]} -eq 0 && ${#STALE_SOCKS[@]} -eq 0 && -z "$LEGACY_PID" ]]; then
  echo "Clean — no orphans, no stale files."
  exit 0
fi

if [[ ${#PIDS[@]} -gt 0 ]]; then
  echo "Live processes (${#PIDS[@]}):"
  for i in "${!PIDS[@]}"; do
    echo "  PID ${PIDS[$i]}  ${PIDS_CMDS[$i]}"
  done
  echo ""
fi

if [[ ${#STALE_PIDS[@]} -gt 0 || ${#STALE_SOCKS[@]} -gt 0 ]]; then
  echo "Stale files:"
  for f in "${STALE_PIDS[@]+"${STALE_PIDS[@]}"}" "${STALE_SOCKS[@]+"${STALE_SOCKS[@]}"}"; do
    [[ -n "$f" ]] && echo "  $f"
  done
  [[ -n "$LEGACY_PID" ]] && echo "  $LEGACY_PID (legacy)"
  echo ""
fi

if [[ $KILL -eq 0 ]]; then
  echo "Dry run — pass --kill to clean up, --force to SIGKILL."
  exit 0
fi

# ── Kill processes ─────────────────────────────────────────────────

if [[ ${#PIDS[@]} -gt 0 ]]; then
  echo "Sending SIGTERM to ${#PIDS[@]} processes..."
  for pid in "${PIDS[@]}"; do
    echo "  SIGTERM → PID $pid"
    kill "$pid" 2>/dev/null || true
  done
  sleep 2

  if [[ $FORCE -eq 1 ]]; then
    for pid in "${PIDS[@]}"; do
      if kill -0 "$pid" 2>/dev/null; then
        echo "  PID $pid still alive — SIGKILL"
        kill -9 "$pid" 2>/dev/null || true
      fi
    done
  else
    # Check for survivors
    for pid in "${PIDS[@]}"; do
      if kill -0 "$pid" 2>/dev/null; then
        echo "  ⚠ PID $pid still alive — use --force to SIGKILL"
      fi
    done
  fi
fi

# ── Clean stale files ─────────────────────────────────────────────

for f in "${STALE_PIDS[@]+"${STALE_PIDS[@]}"}" "${STALE_SOCKS[@]+"${STALE_SOCKS[@]}"}"; do
  [[ -n "$f" ]] && rm -f "$f" 2>/dev/null && echo "  Removed $f"
done
[[ -n "$LEGACY_PID" ]] && rm -f "$LEGACY_PID" && echo "  Removed $LEGACY_PID"

echo ""
echo "Done."
