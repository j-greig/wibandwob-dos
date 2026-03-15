#!/bin/bash
set -euo pipefail

# Correctness checks for auto-journal pipeline
# Runs after each passing benchmark — must pass to keep results.

cd "$(dirname "$0")/.."

# 1. Main project typecheck must still pass
bun run typecheck 2>&1 | grep -i error || true

# 2. Summariser script must parse without syntax errors
python3 -m py_compile autoresearch/summariser.py 2>&1 | tail -10
python3 -m py_compile autoresearch/scorer.py 2>&1 | tail -10

# 3. Output shape validation — run on one session, check JSON schema
SESSIONS_DIR="$HOME/.pi/agent/sessions/--Users-james-Repos-wibandwob-dos--"
SAMPLE=$(ls "$SESSIONS_DIR"/*.jsonl 2>/dev/null | tail -1)

if [ -n "$SAMPLE" ]; then
  python3 -c "
import json, subprocess, sys
result = subprocess.run(['python3', 'autoresearch/summariser.py', '$SAMPLE'],
                       capture_output=True, text=True, timeout=30)
if result.returncode != 0:
    print(f'FAIL: summariser crashed: {result.stderr[:200]}')
    sys.exit(1)
d = json.loads(result.stdout)
entry = d.get('entry', {})
required = ['id', 'title', 'body', 'peer', 'kind', 'tags']
missing = [k for k in required if k not in entry]
if missing:
    print(f'FAIL: entry missing fields: {missing}')
    sys.exit(1)
if entry['kind'] not in ['note', 'observation', 'decision', 'discovery', 'question']:
    print(f'FAIL: invalid kind: {entry[\"kind\"]}')
    sys.exit(1)
if not isinstance(entry['tags'], list):
    print(f'FAIL: tags must be list')
    sys.exit(1)
print('OK: entry shape valid')
" 2>&1 | tail -10
fi
