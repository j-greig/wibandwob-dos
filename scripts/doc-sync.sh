#!/usr/bin/env bash
# doc-sync.sh — staleness gate for generated files
#
# Some files in this repo are produced by scripts, not written by hand.
# Each gen script declares what source files it reads (@watches), what it
# produces (@output), and how to run it (@run) — all in comment headers.
#
# This script reads those headers, diffs against git, and either re-runs
# stale generators or blocks a commit that would land with outdated output.
# New gen scripts self-register — add the three headers and they're picked up.
#
# bash scripts/doc-sync.sh          # regen stale outputs
# bash scripts/doc-sync.sh --all    # force-run everything
# bash scripts/doc-sync.sh --check  # exit 1 if anything stale (pre-commit)
# bash scripts/doc-sync.sh --list   # print the watch manifest

set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

MODE="${1:-}"

# ── --list: print the watch manifest and exit ──
if [[ "$MODE" == "--list" ]]; then
  for script in scripts/gen-*.ts scripts/gen-*.py; do
    [[ -f "$script" ]] || continue
    name=$(basename "$script")
    watches=$(grep -E '^(//|#) @watches' "$script" | sed 's|.*@watches ||')
    output=$(grep -E '^(//|#) @output'  "$script" | sed 's|.*@output ||')
    [[ -z "$watches" || -z "$output" ]] && continue
    printf "  %-28s %s → %s\n" "$name" "$watches" "$output"
  done
  exit 0
fi

if [[ "$MODE" == "--check" ]]; then
  CHANGED=$(git diff --name-only --cached 2>/dev/null | sort -u)
else
  CHANGED=$({ git diff --name-only --cached; git diff --name-only; } 2>/dev/null | sort -u)
fi
RAN=0
STALE=()

for script in scripts/gen-*.ts scripts/gen-*.py; do
  [[ -f "$script" ]] || continue

  watches=$(grep -E '^(//|#) @watches' "$script" | sed 's|.*@watches[[:space:]]*||' | xargs)
  output=$(grep -E '^(//|#) @output'  "$script" | sed 's|.*@output[[:space:]]*||'  | xargs)
  run=$(grep -E '^(//|#) @run'        "$script" | sed 's|.*@run[[:space:]]*||'     | xargs)

  [[ -z "$watches" || -z "$output" || -z "$run" ]] && continue

  needs_run=false
  if [[ "$MODE" == "--all" ]]; then
    needs_run=true
  else
    while IFS= read -r watch; do
      [[ -z "$watch" ]] && continue
      watch_re=$(echo "${watch%/}" | sed 's|\.|\\.|g; s|\*\*|.*|g; s|\*|[^/]*|g')
      if echo "$CHANGED" | grep -qE "^${watch_re}"; then
        needs_run=true; break
      fi
    done <<< "$(echo "$watches" | tr ' ' '\n')"
  fi

  # In --check mode, skip if output is already newer than all watched sources
  if [[ "$needs_run" == true && "$MODE" == "--check" && -f "$output" ]]; then
    out_mtime=$(stat -f %m "$output" 2>/dev/null || stat -c %Y "$output" 2>/dev/null)
    newer=false
    while IFS= read -r watch_glob; do
      [[ -z "$watch_glob" ]] && continue
      for f in $watch_glob; do
        [[ -f "$f" ]] || continue
        src_mtime=$(stat -f %m "$f" 2>/dev/null || stat -c %Y "$f" 2>/dev/null)
        [[ "$src_mtime" -gt "$out_mtime" ]] && newer=true && break 2
      done
    done <<< "$(echo "$watches" | tr ' ' '\n')"
    [[ "$newer" == false ]] && needs_run=false
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
