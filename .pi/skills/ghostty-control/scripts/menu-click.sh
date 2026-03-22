#!/usr/bin/env bash
# @desc  Click a menu bar item, optionally click a menu item within it.
# Uses /menu/list API for positions — no screenshot parsing needed.
#
# Usage:
#   bash menu-click.sh "File"                  # just open the menu
#   bash menu-click.sh "File" "Quit"            # open File, click Quit
#   bash menu-click.sh "Core Apps" "Terminal"    # open Core Apps, click Terminal
set -euo pipefail

MENU_LABEL="${1:?usage: menu-click.sh <menu-label> [item-label]}"
ITEM_LABEL="${2:-}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Calibrate once, export for child click-cell.sh calls
eval "$("${SCRIPT_DIR}/calibrate.sh")"
export CELL_W CELL_H GHOSTTY_WIN_INDEX

# Get menu positions from API
MENU_DATA=$(curl -sf "http://127.0.0.1:${PORT}/menu/list")

# Find menu col
MENU_COL=$(echo "$MENU_DATA" | jq -r --arg label "$MENU_LABEL" '
  .result[] | select(.label == $label) | .col + (.label | length / 2 | floor)
')
if [[ -z "$MENU_COL" || "$MENU_COL" == "null" ]]; then
  echo "menu not found: $MENU_LABEL" >&2; exit 1
fi

# Click the menu bar label (single click opens the menu)
bash "${SCRIPT_DIR}/click-cell.sh" "$MENU_COL" 0 --single

if [[ -z "$ITEM_LABEL" ]]; then
  exit 0
fi

sleep 0.5

# Find item row and col from API data
ITEM_INFO=$(echo "$MENU_DATA" | jq -r --arg menu "$MENU_LABEL" --arg item "$ITEM_LABEL" '
  .result[] | select(.label == $menu) |
  .col as $col |
  .items[] | select(.label == $item) |
  "\($col + 5) \(.row)"
')
if [[ -z "$ITEM_INFO" || "$ITEM_INFO" == "null" ]]; then
  echo "item not found: $ITEM_LABEL in $MENU_LABEL" >&2; exit 1
fi

read -r ITEM_COL ITEM_ROW <<< "$ITEM_INFO"

# Double-click the menu item
bash "${SCRIPT_DIR}/click-cell.sh" "$ITEM_COL" "$ITEM_ROW"
