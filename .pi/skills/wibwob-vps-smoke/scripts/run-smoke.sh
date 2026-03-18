#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
cd "$ROOT"

bash scripts/devops/docker-vps-smoke.sh
python3 .pi/skills/wibwob-vps-smoke/scripts/summarize-latest-smoke.py
