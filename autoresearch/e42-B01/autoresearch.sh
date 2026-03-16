#!/bin/bash
set -euo pipefail

# E042-B01 Dead Code + Cycles — Autoresearch Benchmark

cd "$(dirname "$0")/../.."

# ── Primary: circular_deps (target: 0) ──
circular_deps=$(npx madge --circular --extensions ts src/ 2>/dev/null | grep -c "^[0-9])" || true)
circular_deps=${circular_deps:-0}
echo "METRIC circular_deps=$circular_deps"

# ── Secondary: knip findings (known to include false positives from SDK re-exports) ──
knip_output=$(npx knip --no-progress --include exports,types 2>&1 || true)
unused_exports=$(echo "$knip_output" | sed -n 's/^Unused exports (\([0-9]*\))$/\1/p')
unused_types=$(echo "$knip_output" | sed -n 's/^Unused exported types (\([0-9]*\))$/\1/p')
unused_exports=${unused_exports:-0}
unused_types=${unused_types:-0}
echo "METRIC unused_exports=$unused_exports"
echo "METRIC unused_types=$unused_types"

# Typecheck time
tc_start=$(python3 -c 'import time; print(int(time.time()*1000))')
bun run typecheck >/dev/null 2>&1
tc_end=$(python3 -c 'import time; print(int(time.time()*1000))')
echo "METRIC typecheck_seconds=$(echo "scale=2; ($tc_end - $tc_start) / 1000" | bc)"
