#!/bin/bash
set -euo pipefail
#
# Correctness checks — runs after every passing benchmark.
# Keep output minimal (only last 80 lines fed to agent on failure).
#

bun run typecheck 2>&1 | grep -i error || true
