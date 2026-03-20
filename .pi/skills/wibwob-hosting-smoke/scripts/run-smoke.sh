#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
cd "$ROOT"

ADAPTER="${1:-docker-vps}"
RC=0

set +e
case "$ADAPTER" in
  docker-vps)
    bash scripts/devops/docker-vps-smoke.sh
    RC=$?
    ;;
  flyio)
    bash scripts/devops/fly-smoke.sh
    RC=$?
    ;;
  npm-global)
    bash scripts/devops/npm-global-smoke.sh
    RC=$?
    ;;
  *)
    echo "Unknown adapter: $ADAPTER" >&2
    echo "Usage: $0 [docker-vps|flyio|npm-global]" >&2
    set -e
    exit 2
    ;;
esac
set -e

python3 .pi/skills/wibwob-hosting-smoke/scripts/summarize-latest-smoke.py || true
exit "$RC"
