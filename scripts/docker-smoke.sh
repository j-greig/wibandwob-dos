#!/usr/bin/env bash
# docker-smoke.sh — validate startup works in a Linux container (simulates CCC environment)
#
# Runs ensure-running.sh --tmux inside ubuntu:22.04 + tmux + bun,
# then curls /health to confirm the API came up.
#
# Usage: bash scripts/docker-smoke.sh
# Requires: Docker running locally

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "▶ docker-smoke: testing Linux startup (ubuntu:22.04 + tmux + bun)"
echo "  This simulates the Claude Code Cloud environment."
echo ""

docker run --rm \
  -v "$ROOT:/app" \
  -w /app \
  -e TERM=dumb \
  -e CONTROL_API_PORT=8099 \
  ubuntu:22.04 \
  bash -c '
    set -euo pipefail
    echo "  [docker] installing tmux + curl..."
    apt-get update -qq && apt-get install -qq -y tmux curl unzip 2>/dev/null

    echo "  [docker] installing bun..."
    curl -fsSL https://bun.sh/install | bash 2>/dev/null
    export PATH="$HOME/.bun/bin:$PATH"

    echo "  [docker] bun install --ignore-scripts..."
    bun install --ignore-scripts 2>&1 | tail -3

    echo "  [docker] starting WibWob-DOS via --tmux..."
    bash scripts/ensure-running.sh --tmux

    echo "  [docker] health check..."
    curl -sf --max-time 5 http://127.0.0.1:8099/health && echo ""

    echo ""
    echo "✓ docker-smoke PASSED — Linux startup works"
  '
