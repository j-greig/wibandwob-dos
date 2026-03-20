#!/usr/bin/env bash
set -euo pipefail

hours="24"
out=""
open_file="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --hours)
      hours="${2:-}"
      shift 2
      ;;
    --out)
      out="${2:-}"
      shift 2
      ;;
    --open)
      open_file="true"
      shift
      ;;
    -h|--help)
      cat <<'EOF'
Usage: export.sh [--hours N] [--out PATH] [--open]

Export branch-grouped git one-liners:
  # branch
  - <sha> — MM-DD HH:MM — <subject>

Options:
  --hours N   Lookback window in hours (default: 24)
  --out PATH  Output file (default: .tmp/git-branches-<hours>h.txt)
  --open      Open output file (macOS)
EOF
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if [[ -z "$out" ]]; then
  out=".tmp/git-branches-${hours}h.txt"
fi

mkdir -p "$(dirname "$out")"

: > "$out"

git for-each-ref --format='%(refname:short)' refs/heads refs/remotes/origin \
  | grep -v '^origin/HEAD$' \
  | while IFS= read -r ref; do
      log="$(git log "$ref" --since="${hours} hours ago" --pretty=format:'%h%x09%ad%x09%s' --date=format:'%m-%d %H:%M' --no-merges 2>/dev/null || true)"
      [[ -z "$log" ]] && continue

      printf '# %s\n' "$ref" >> "$out"
      while IFS=$'\t' read -r sha adate msg; do
        [[ -z "${sha:-}" ]] && continue
        printf -- '- %s — %s — %s\n' "$sha" "$adate" "$msg" >> "$out"
      done <<< "$log"
      printf '\n' >> "$out"
    done

if [[ "$open_file" == "true" ]]; then
  if command -v open >/dev/null 2>&1; then
    open "$out"
  else
    echo "--open requested, but 'open' is not available on this platform." >&2
  fi
fi

echo "$out"
