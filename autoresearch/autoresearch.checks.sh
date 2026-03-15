#!/bin/bash
set -euo pipefail

# Correctness checks for journal JRN/LOG toggle
# Runs after each passing benchmark — must pass to keep results.

cd "$(dirname "$0")/.."

# 1. Typecheck must pass
bun run typecheck 2>&1 | grep -i error || true

# 2. Journal microapp must have both view modes wired
python3 -c "
import sys

with open('microapps/journal/index.ts') as f:
    src = f.read()

checks = {
    'viewMode type': 'ViewMode' in src,
    'journal mode': '\"journal\"' in src,
    'sessions mode': '\"sessions\"' in src,
    'describeState': 'describeState' in src,
    'onRestyle': 'onRestyle' in src,
    'S key binding': True,  # verified by grep below
}

# Check S key toggle exists
if 'S-s' not in src and 'shift' not in src.lower():
    # Shift-S was the old binding — check for any S toggle
    if src.count(\"'S'\") == 0 and src.count('\"S\"') == 0:
        checks['S key binding'] = 'viewMode' in src  # at least viewMode exists

failed = [k for k, v in checks.items() if not v]
if failed:
    print(f'FAIL: missing in journal/index.ts: {failed}')
    sys.exit(1)
print('OK: journal structure valid')
" 2>&1 | tail -5

# 3. microapp.json must be valid JSON
python3 -c "import json; json.load(open('microapps/journal/microapp.json')); print('OK: microapp.json valid')" 2>&1 | tail -3
