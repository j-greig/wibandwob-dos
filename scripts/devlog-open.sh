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
OPEN = {'open', 'in-progress', 'partial'}
icons = {'open': '🔵', 'in-progress': '🟡', 'partial': '🟠'}

strip_tags = lambda s: re.sub(r' `?\[id:[^\]]*\]\[status:[^\]]*\]`?', '', s).strip()

# Pass 1: unresolved pains (### headings with open/partial status)
pains = []
i = 0
while i < len(lines):
    line = lines[i].rstrip()
    if re.match(r'^### ', line) and '[id:' in line:
        m = re.search(r'\[status:([^\]]+)\]', line)
        if m:
            status = m.group(1).split(':')[0]
            if status not in DONE:
                heading = strip_tags(line.lstrip('#'))
                ideas = []
                j, in_ideas = i + 1, False
                while j < len(lines):
                    l = lines[j].rstrip()
                    if re.match(r'^#### → Ideas', l):   in_ideas = True
                    elif re.match(r'^#{1,4} ', l):       break
                    elif in_ideas and re.match(r'^- ', l):
                        ideas.append(strip_tags(l))
                    j += 1
                pains.append((status, heading, ideas))
    i += 1

# Pass 2: orphan open ideas (under done headings — invisible in pass 1)
orphan_ideas = []
parent_status = None
for line in lines:
    l = line.rstrip()
    m = re.match(r'^### .+\[status:([^\]]+)\]', l)
    if m:
        parent_status = m.group(1).split(':')[0]
    if parent_status in DONE and re.match(r'^- ', l) and '[status:' in l:
        im = re.search(r'\[status:([^\]]+)\]', l)
        if im and im.group(1).split(':')[0] in OPEN:
            orphan_ideas.append((im.group(1).split(':')[0], strip_tags(l.lstrip('- '))))

# Output
n = 0
if pains:
    print("── Unresolved pains ──")
    print()
    for status, heading, ideas in pains:
        n += 1
        print(f"{n}. {icons.get(status, '?')} {heading}")
        for idea in ideas:
            print(f"   {idea}")
        print()

if orphan_ideas:
    print("── Open ideas (under resolved pains) ──")
    print()
    for status, text in orphan_ideas:
        n += 1
        print(f"{n}. {icons.get(status, '?')} {text}")
    print()

if not pains and not orphan_ideas:
    print("✅ All pains and ideas resolved for this week.")
PYEOF
