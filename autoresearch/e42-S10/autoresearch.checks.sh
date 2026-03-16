#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/../.."
bun run health 2>&1 | grep -i "error\|fail\|❌" || true
