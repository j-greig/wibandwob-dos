#!/usr/bin/env bash
# @desc  Click a menu bar item, optionally click a menu item within it.
# Uses /menu/list API for positions — no screenshot parsing needed.
# Auto-detects running wibwob instance.
#
# Usage:
#   bash menu-click.sh "File"                  # just open the menu
#   bash menu-click.sh "File" "Quit"            # open File, click Quit
#   bash menu-click.sh "Core Apps" "Terminal"    # open Core Apps, click Terminal
set -euo pipefail

MENU_LABEL="${1:?usage: menu-click.sh <menu-label> [item-label]}"
ITEM_LABEL="${2:-}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Auto-detect port
PORT=$(wibwob health 2>&1 | awk '/^port:/{print $2}')
if [[ -z "$PORT" ]]; then
  echo "ERROR: no running wibwob instance found" >&2
  exit 1
fi

# Get menu positions from API
MENU_DATA=$(curl -sf "http://127.0.0.1:${PORT}/menu/list")

# Find menu col (middle of the label text)
MENU_COL=$(echo "$MENU_DATA" | python3 -c "
import json, sys
data = json.load(sys.stdin)['result']
label = '$MENU_LABEL'
for menu in data:
    if menu['label'] == label:
        print(menu['col'] + len(label) // 2)
        sys.exit(0)
print(f'menu not found: {label}', file=sys.stderr)
sys.exit(1)
")

# Click the menu bar label (single click opens the menu)
bash "${SCRIPT_DIR}/click-cell.sh" "$MENU_COL" 0 --single

if [[ -z "$ITEM_LABEL" ]]; then
  exit 0
fi

sleep 0.5

# Find item row and col from API data
read -r ITEM_COL ITEM_ROW < <(echo "$MENU_DATA" | python3 -c "
import json, sys
data = json.load(sys.stdin)['result']
menu_label = '$MENU_LABEL'
item_label = '$ITEM_LABEL'
for menu in data:
    if menu['label'] == menu_label:
        for item in menu['items']:
            if item['label'] == item_label:
                print(menu['col'] + 5, item['row'])
                sys.exit(0)
        print(f'item not found: {item_label} in {menu_label}', file=sys.stderr)
        sys.exit(1)
print(f'menu not found: {menu_label}', file=sys.stderr)
sys.exit(1)
")

# Double-click the menu item
bash "${SCRIPT_DIR}/click-cell.sh" "$ITEM_COL" "$ITEM_ROW"
