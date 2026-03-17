#!/usr/bin/env bash
# @name    live-api-test-suite
# @desc    Run API endpoint tests against running instance
set -euo pipefail

cd "$(dirname "$0")/.."
source scripts/lib/runtime-env.sh

API_BASE="${WIBWOB_API:-${WW_API:-$(ww_api_base)}}"
TEST_FILES=(
  "src/tests/command-registry.test.ts"
  "src/tests/editor-open.test.ts"
  "src/tests/picker-flow.test.ts"
  "src/tests/workspace-roundtrip.test.ts"
)

clear_desktop() {
  curl -sf -X POST "${API_BASE}/commands/run" \
    -H "Content-Type: application/json" \
    -d '{"id":"desktop.clear-all","args":{"all":true}}' >/dev/null
}

echo "=== Live API Test Suite ==="
echo "api=${API_BASE}"

for test_file in "${TEST_FILES[@]}"; do
  echo "--- ${test_file} ---"
  clear_desktop
  bun test "${test_file}"
done

clear_desktop
echo "=== Live API Test Suite Complete ==="
