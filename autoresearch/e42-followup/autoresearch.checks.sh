#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/../.."
bun run typecheck >/dev/null 2>&1
echo "PASS"
