#!/bin/bash
# Create a new weekly reflection file from template
# Usage: ./new-week.sh                    # creates current week file
#        ./new-week.sh 2026-W13            # creates specific week
#        ./new-week.sh 2026-W13 --check   # just show what would be created
#
# Creates files in: /Users/james/Repos/wibandwob-dos/.agents/reflections/
# Uses template:    /Users/james/Repos/wibandwob-dos/.agents/reflections/TEMPLATE.md
#
# Part of agentic-dev-reflection skill

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SCRIPT_DIR="$(dirname "$SCRIPT_DIR")"  # Go up from scripts/ to skill root

# Target directory for reflection files
REFLECTIONS_DIR="/Users/james/Repos/wibandwob-dos/.agents/reflections"
TEMPLATE="$REFLECTIONS_DIR/TEMPLATE.md"

# Get week number
if [ -n "$1" ] && [ "$1" != "--check" ]; then
    WEEK="$1"
else
    WEEK="$( "$SCRIPT_DIR/scripts/week-num.sh" )"
fi

# Check mode
if [ "$2" = "--check" ] || [ "$1" = "--check" ]; then
    echo "Week: $WEEK"
    echo "Would create: $REFLECTIONS_DIR/${WEEK}.md"
    [ -f "$REFLECTIONS_DIR/${WEEK}.md" ] && echo "Status: EXISTS" || echo "Status: NEW"
    exit 0
fi

# Extract year and week number
YEAR="$(echo "$WEEK" | cut -d'-' -f1)"
WEEK_NUM="$(echo "$WEEK" | cut -d'-' -f2 | tr -d 'W')"

# Calculate the Monday of this week (ISO week starts on Monday)
START_DATE="$(python3 -c "
import datetime
d = datetime.date(int('$YEAR'), 1, 1)
monday = d + datetime.timedelta(days=(7 - d.weekday()) % 7)
target = monday + datetime.timedelta(weeks=int('$WEEK_NUM') - 1)
print(target.strftime('%Y-%m-%d'))
")"

TARGET="$REFLECTIONS_DIR/${WEEK}.md"

if [ -f "$TARGET" ]; then
    echo "File already exists: $TARGET"
    echo "Use --check to see status without creating"
    exit 1
fi

if [ ! -f "$TEMPLATE" ]; then
    echo "Template not found: $TEMPLATE"
    exit 1
fi

# Replace placeholders in template
sed -e "s/YYYY-WNN/$WEEK/" \
    -e "s/WNN/W$WEEK_NUM/" \
    -e "s/YYYY-MM-DD/$START_DATE/" \
    -e "s/themes:.*/themes: #TODO: add themes from this week's sessions/" \
    "$TEMPLATE" > "$TARGET"

echo "Created: $TARGET"
echo "Week: $WEEK (starting $START_DATE)"
