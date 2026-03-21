#!/usr/bin/env bash
# check-watches.sh — compares declared @watches against actual file reads in gen scripts
#
# Parses readFileSync/readFile/open() calls from each gen script.
# Warns if declared @watches diverges from derived deps.
# Warning only — does not block. Run periodically or wire into doc-health.
#
# Usage: bash scripts/check-watches.sh

set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

ISSUES=0

for script in scripts/gen-*.ts scripts/gen-*.py; do
  [[ -f "$script" ]] || continue

  declared=$(grep -E "^(//|#) @watches" "$script" | sed 's|.*@watches ||' | tr ' ' '\n' | sort)

  # Derive: extract file paths from readFileSync / readFile / open() calls
  if [[ "$script" == *.ts ]]; then
    derived=$(grep -oE "readFileSync\([^)]+\)|readFile\([^)]+\)" "$script" \
      | grep -oE '"[^"]*"|`[^`]*`' | tr -d '"` ' \
      | grep -v '^\$\|^utf\|^utf8' \
      | sed "s|resolve(ROOT, '||;s|')||;s|path\.join(ROOT, '||" \
      | grep -v '^\s*$' | sort -u 2>/dev/null || true)
  else
    derived=$(grep -oE "open\([^)]+\)|read_text\(\)|safeReadFile\([^)]+\)" "$script" \
      | grep -oE '"[^"]*"|'\'[^\']*\'' ' | tr -d "\"' " \
      | grep -v '^\s*$' | sort -u 2>/dev/null || true)
  fi

  [[ -z "$derived" ]] && continue

  # Report mismatches
  while IFS= read -r dep; do
    [[ -z "$dep" ]] && continue
    if ! echo "$declared" | grep -q "$(basename "$dep")"; then
      echo "  warn: $script reads '$dep' — not reflected in @watches"
      ISSUES=$((ISSUES + 1))
    fi
  done <<< "$derived"
done

[[ $ISSUES -eq 0 ]] && echo "✓ @watches declarations match derived deps" || echo "  $ISSUES potential @watches drift(s) — review above"
