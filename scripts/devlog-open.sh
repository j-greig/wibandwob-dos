#!/usr/bin/env bash
# devlog-open.sh — show unresolved pain entries from this week's devlog
# Usage:
#   scripts/devlog-open.sh          # current week
#   scripts/devlog-open.sh W12      # specific week
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WEEK="${1:-W$(date +%V)}"
YEAR=$(date +%Y)
FILE="$REPO_ROOT/.pi/reflections/${YEAR}-${WEEK}.md"

if [[ ! -f "$FILE" ]]; then
    echo "No reflection file found for ${YEAR}-${WEEK}"
    exit 0
fi

python3 - "$FILE" << 'PYEOF'
import sys, re

file = sys.argv[1]
lines = open(file).readlines()
DONE = {'done', 'wontfix'}
results = []
i = 0
while i < len(lines):
    line = lines[i].rstrip()
    if re.match(r'^### ', line) and '[id:' in line:
        m = re.search(r'\[status:([^\]]+)\]', line)
        if m:
            status = m.group(1).split(':')[0]
            if status not in DONE:
                heading = re.sub(r' `\[id:[^\]]*\]\[status:[^\]]*\]`', '', line).lstrip('#').strip()
                ideas = []
                j, in_ideas = i + 1, False
                while j < len(lines):
                    l = lines[j].rstrip()
                    if re.match(r'^#### → Ideas', l):   in_ideas = True
                    elif re.match(r'^#{1,4} ', l):       break
                    elif in_ideas and re.match(r'^- ', l):
                        ideas.append(re.sub(r' `\[id:[^\]]*\]\[status:[^\]]*\]`', '', l).strip())
                    j += 1
                results.append((status, heading, ideas))
    i += 1

if not results:
    print("✅ All pains resolved for this week.")
else:
    icons = {'open': '🔵', 'in-progress': '🟡', 'partial': '🟠'}
    for n, (status, heading, ideas) in enumerate(results, 1):
        print(f"{n}. {icons.get(status, '?')} {heading}")
        for idea in ideas:
            print(f"   {idea}")
        print()
PYEOF
