#!/usr/bin/env bash
# doc-sync.sh — diff-aware doc regeneration
#
# Reads @watches and @output headers from every scripts/gen-* file.
# Checks if any watched path changed. Reruns only affected scripts.
# Self-registering: add a gen-* script with @watches/@output/@run headers
# and it participates automatically — no other files to update.
#
# Usage:
#   bash scripts/doc-sync.sh          # regenerate stale outputs
#   bash scripts/doc-sync.sh --all    # force-run all gen scripts
#   bash scripts/doc-sync.sh --check  # report stale, exit 1 if any

set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

MODE="${1:-}"
CHANGED=$({ git diff --name-only HEAD; git diff --name-only --cached; } 2>/dev/null | sort -u)
RAN=0
STALE=()

for script in scripts/gen-*.ts scripts/gen-*.py; do
  [[ -f "$script" ]] || continue

  watches=$(grep -E '^(//|#) @watches' "$script" | sed 's|.*@watches ||')
  output=$(grep -E '^(//|#) @output'  "$script" | sed 's|.*@output ||')
  run=$(grep -E '^(//|#) @run'        "$script" | sed 's|.*@run ||')

  [[ -z "$watches" || -z "$output" || -z "$run" ]] && continue

  needs_run=false
  if [[ "$MODE" == "--all" ]]; then
    needs_run=true
  else
    for watch in $watches; do
      if echo "$CHANGED" | grep -q "^${watch%/}"; then
        needs_run=true; break
      fi
    done
  fi

  if [[ "$needs_run" == true ]]; then
    if [[ "$MODE" == "--check" ]]; then
      echo "  stale: $output"
      STALE+=("$output")
    else
      echo "  syncing: $run"
      eval "$run"
      RAN=$((RAN + 1))
    fi
  fi
done

if [[ "$MODE" == "--check" ]]; then
  [[ ${#STALE[@]} -gt 0 ]] \
    && echo "doc-sync: ${#STALE[@]} output(s) stale — run: bash scripts/doc-sync.sh" && exit 1 \
    || echo "doc-sync: all outputs current"
  exit 0
fi

[[ $RAN -eq 0 ]] && echo "doc-sync: nothing to regenerate" || echo "doc-sync: regenerated $RAN output(s)"
