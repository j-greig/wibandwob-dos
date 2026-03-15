#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/../.."

# Quiet checks — only show errors
bun run test 2>&1 | tail -3
bun run typecheck 2>&1 | grep -i "error" || true
bun run check-coat 2>&1 | tail -3
