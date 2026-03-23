---
description: Show open/partial/in-progress pain entries from this week's devlog
---

Show all unresolved pain entries from the **${1:-current week}** devlog.

```bash
WEEK="${1:-W$(date +%V)}"
YEAR=$(date +%Y)
FILE=".pi/reflections/${YEAR}-${WEEK}.md"

if [[ ! -f "$FILE" ]]; then
  echo "No reflection file found for ${YEAR}-${WEEK}"
  exit 0
fi

# Extract ### headings where status is open, in-progress, or partial
# Then collect → Ideas bullets immediately following each match
python3 - "$FILE" << 'PYEOF'
import sys, re

file = sys.argv[1]
lines = open(file).readlines()

DONE = {'done', 'wontfix'}
results = []
i = 0
while i < len(lines):
    line = lines[i].rstrip()
    # Match ### heading with an id tag
    if re.match(r'^### ', line) and '[id:' in line:
        m = re.search(r'\[status:([^\]]+)\]', line)
        if m:
            status = m.group(1).split(':')[0]  # done:hash → done
            if status not in DONE:
                # Strip the tag from display
                heading = re.sub(r' `\[id:[^\]]*\]\[status:[^\]]*\]`', '', line)
                ideas = []
                # Collect → Ideas bullets immediately following
                j = i + 1
                in_ideas = False
                while j < len(lines):
                    l = lines[j].rstrip()
                    if re.match(r'^#### → Ideas', l):
                        in_ideas = True
                    elif re.match(r'^#{1,4} ', l):
                        break
                    elif in_ideas and re.match(r'^- ', l):
                        idea = re.sub(r' `\[id:[^\]]*\]\[status:[^\]]*\]`', '', l)
                        ideas.append(idea)
                    j += 1
                results.append((status, heading, ideas))
    i += 1

if not results:
    print("✅ All pains resolved for this week.")
else:
    icons = {'open': '🔵', 'in-progress': '🟡', 'partial': '🟠'}
    for n, (status, heading, ideas) in enumerate(results, 1):
        icon = icons.get(status, '?')
        print(f"{n}. {icon} {heading.lstrip('#').strip()}")
        for idea in ideas:
            print(f"   {idea.strip()}")
        print()
PYEOF
```

Run the block above. Present the output as-is — it's already formatted.

If `$1` is provided (e.g. `/reflections W12`), it overrides the week. Otherwise defaults to the current ISO week.
