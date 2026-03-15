#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
bun run typecheck 2>&1 | grep -i error || true
