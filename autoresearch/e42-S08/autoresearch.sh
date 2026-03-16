#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/../.."

# Primary: Handle components in SDK
handle_component_count=$(grep -oE "export function create[A-Z][a-zA-Z]+" src/sdk/composition-helpers.ts | wc -l | tr -d ' ')
echo "METRIC handle_component_count=$handle_component_count"

# Secondary: documented examples
doc_examples=$(grep -cE "^## \`create" docs/sdk-primitives.md 2>/dev/null || echo 0)
echo "METRIC doc_examples=$doc_examples"

tc_start=$(python3 -c 'import time; print(int(time.time()*1000))')
bun run typecheck >/dev/null 2>&1
tc_end=$(python3 -c 'import time; print(int(time.time()*1000))')
echo "METRIC typecheck_seconds=$(echo "scale=2; ($tc_end - $tc_start) / 1000" | bc)"
