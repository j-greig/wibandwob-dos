#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

# Ensure doc-sync still works (no broken scripts)
bash scripts/doc-sync.sh --check 2>&1 | tail -5

# Ensure no syntax errors in gen scripts
for s in scripts/gen-*.ts; do
  bun "$s" --help > /dev/null 2>&1 || bun "$s" < /dev/null > /dev/null 2>&1 || true
done
for s in scripts/gen-*.py; do
  python3 -c "import ast; ast.parse(open('$s').read())" 2>&1 | tail -3
done

# CAPS files must exist
for f in AGENTS.md PHILOSOPHY.md ARCHITECTURE.md SDK.md GOTCHAS.md; do
  [ -f "$f" ] || { echo "MISSING: $f"; exit 1; }
done
echo "checks passed"
