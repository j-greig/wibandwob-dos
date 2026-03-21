#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

# Pre-check: gen scripts exist
ls scripts/gen-*.ts scripts/gen-*.py > /dev/null 2>&1 || { echo "METRIC doc_health=0"; exit 1; }

# Run the health check
bash scripts/doc-health.sh
