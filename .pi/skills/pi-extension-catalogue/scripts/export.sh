#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
cd "$ROOT_DIR"

python3 .pi/skills/pi-extension-catalogue/scripts/export-extension-catalogue.py "$@"
