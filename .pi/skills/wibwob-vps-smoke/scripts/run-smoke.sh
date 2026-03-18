#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
cd "$ROOT"

echo "[DEPRECATED] .pi/skills/wibwob-vps-smoke is a compatibility shim."
echo "[DEPRECATED] Delegating to .pi/skills/wibwob-hosting-smoke (adapter: docker-vps)."

bash .pi/skills/wibwob-hosting-smoke/scripts/run-smoke.sh docker-vps
