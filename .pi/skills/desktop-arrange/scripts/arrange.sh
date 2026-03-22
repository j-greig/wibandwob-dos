#!/usr/bin/env bash
# @desc  Arrange open WibWob-DOS windows into a named layout preset.
#
# Usage:
#   bash arrange.sh <preset> [--hero <window-id>]
#   bash arrange.sh --list
#
# Presets: golden  magazine  cinema  triptych  diagonal  spotlight  asymmetric
set -euo pipefail

PRESETS="golden magazine cinema triptych diagonal spotlight asymmetric"

usage() {
  echo "Usage: arrange.sh <preset> [--hero <id>]"
  echo "       arrange.sh --list"
  echo ""
  echo "Presets: $PRESETS"
  exit "${1:-0}"
}

[[ $# -eq 0 ]] && usage 1

if [[ "$1" == "--list" ]]; then
  PORT=$(wibwob health 2>&1 | awk '/^port:/{print $2}')
  echo "Presets: $PRESETS"
  echo ""
  echo "Open windows:"
  wibwob windows 2>/dev/null | jq -r '.[] | "  \(.id)  \(.title)  \(.left),\(.top) \(.width)×\(.height)"'
  exit 0
fi

PRESET="$1"; shift
HERO_ID=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --hero) HERO_ID="$2"; shift 2 ;;
    --help|-h) usage 0 ;;
    *) echo "unknown arg: $1" >&2; usage 1 ;;
  esac
done

# Validate preset
if ! echo "$PRESETS" | grep -qw "$PRESET"; then
  echo "Unknown preset: $PRESET" >&2
  echo "Available: $PRESETS" >&2
  exit 1
fi

# Get port, desktop size, windows
PORT=$(wibwob health 2>&1 | awk '/^port:/{print $2}')
if [[ -z "$PORT" ]]; then
  echo "ERROR: no running wibwob instance. Run: bun run dev" >&2
  exit 1
fi

read -r DW DH < <(
  curl -sf "http://127.0.0.1:${PORT}/health" \
  | jq -r '.screen | "\(.width) \(.height)"'
)

WINDOWS_JSON=$(curl -sf "http://127.0.0.1:${PORT}/state" | jq '.windows')
WIN_COUNT=$(echo "$WINDOWS_JSON" | jq 'length')

if [[ "$WIN_COUNT" -lt 2 ]]; then
  echo "Need ≥ 2 open windows (found ${WIN_COUNT}). Open some apps first." >&2
  exit 1
fi

# Run the preset math via awk (pure arithmetic, no python)
# Each preset outputs lines: id left top width height
batch_ops() {
  echo "$WINDOWS_JSON" | jq -r '.[] | "\(.id)"' | tr '\n' ' ' | read -r IDS || true
  
  # Pass windows as id:left:top:w:h tuples and desktop size to awk
  WIN_TUPLES=$(echo "$WINDOWS_JSON" | jq -r '.[] | "\(.id):\(.left):\(.top):\(.width):\(.height)"')
  
  awk -v preset="$PRESET" -v dw="$DW" -v dh="$DH" -v hero_id="$HERO_ID" \
      -v win_data="$(echo "$WIN_TUPLES" | tr '\n' '|')" '
  BEGIN {
    # Parse windows into arrays
    n = split(win_data, wins, "|")
    wcount = 0
    hero_idx = 0
    for (i = 1; i <= n; i++) {
      if (wins[i] == "") continue
      split(wins[i], f, ":")
      id[wcount] = f[1]+0
      if (hero_id != "" && id[wcount] == hero_id+0) hero_idx = wcount
      wcount++
    }
    if (wcount == 0) exit 1

    gap = 1

    if (preset == "golden") {
      PHI = 0.618
      hw = int(dw * PHI) - gap
      sw = dw - hw - gap * 2
      sx = hw + gap * 2
      hi = hero_idx
      print id[hi], gap, 1, hw, dh-2
      j = 0
      for (i = 0; i < wcount; i++) {
        if (i == hi) continue
        slot_h = int((dh - 2) / (wcount - 1))
        if (slot_h < 5) slot_h = 5
        y = 1 + j * slot_h
        h = dh - 1 - y
        if (h < 5) h = 5
        if (h > slot_h) h = slot_h
        print id[i], sx, y, sw - gap, h
        j++
      }
    }

    else if (preset == "magazine") {
      fw = int(dw * 0.65)
      fh = int(dh * 0.65)
      sw = dw - fw - gap * 2
      hi = hero_idx
      print id[hi], gap, 1, fw, fh
      j = 0
      side_count = 0
      for (i = 0; i < wcount; i++) { if (i != hi) side_count++ }
      sidebar_n = side_count <= 3 ? side_count : 3
      foot_start = sidebar_n
      k = 0
      for (i = 0; i < wcount; i++) {
        if (i == hi) continue
        if (k < sidebar_n) {
          slot_h = int(fh / sidebar_n)
          if (slot_h < 5) slot_h = 5
          print id[i], fw + gap*2, 1 + k * slot_h, sw - gap, slot_h
        } else {
          j2 = k - foot_start
          foot_y = fh + gap + 1
          foot_h = dh - foot_y - 1
          if (foot_h < 5) foot_h = 5
          foot_n = side_count - sidebar_n
          slot_w = int((dw - gap*2) / foot_n)
          if (slot_w < 10) slot_w = 10
          print id[i], gap + j2 * slot_w, foot_y, slot_w - gap, foot_h
        }
        k++
      }
    }

    else if (preset == "cinema") {
      cine_h = int(dh * 0.55)
      cine_w = int(cine_h * (16.0 / 9.0) * 2.0)
      if (cine_w > dw - 20) {
        cine_w = dw - 20
        cine_h = int(cine_w / ((16.0 / 9.0) * 2.0))
      }
      cx = int((dw - cine_w) / 2)
      cy = int((dh - cine_h) / 2)
      hi = hero_idx
      print id[hi], cx, cy, cine_w, cine_h
      # Margins
      top_h = cy - gap - 1
      bot_y = cy + cine_h + gap
      bot_h = dh - bot_y - 1
      left_w = cx - gap * 2
      right_x = cx + cine_w + gap
      right_w = dw - right_x - gap
      # Collect rest
      rest_n = wcount - 1
      if (rest_n == 0) next
      j = 0
      for (i = 0; i < wcount; i++) {
        if (i == hi) continue
        zone = j % 4
        if (zone == 0 && top_h >= 5)    print id[i], gap, 1, dw - gap*2, top_h
        else if (zone == 1 && right_w >= 12) print id[i], right_x, cy, right_w, cine_h
        else if (zone == 2 && bot_h >= 5)   print id[i], gap, bot_y, dw - gap*2, bot_h
        else if (zone == 3 && left_w >= 12)  print id[i], gap, cy, left_w, cine_h
        else print id[i], gap, bot_y, 28, (bot_h > 5 ? bot_h : 5)
        j++
      }
    }

    else if (preset == "triptych") {
      col_w = int((dw - gap*4) / 3)
      main_h = int(dh * 0.75)
      for (i = 0; i < wcount && i < 3; i++) {
        x = gap + i * (col_w + gap)
        print id[i], x, 1, col_w, main_h
      }
      if (wcount > 3) {
        foot_y = main_h + gap + 1
        foot_h = dh - foot_y - 1
        if (foot_h < 5) foot_h = 5
        rest_n = wcount - 3
        slot_w = int((dw - gap*2) / rest_n)
        if (slot_w < 10) slot_w = 10
        j = 0
        for (i = 3; i < wcount; i++) {
          print id[i], gap + j * slot_w, foot_y, slot_w - gap, foot_h
          j++
        }
      }
    }

    else if (preset == "diagonal") {
      min_w = 20; min_h = 8
      max_w = int(dw * 0.55); max_h = int(dh * 0.55)
      for (i = 0; i < wcount; i++) {
        t = (wcount > 1) ? i / (wcount - 1) : 0
        ww = int(min_w + (max_w - min_w) * t)
        wh = int(min_h + (max_h - min_h) * t)
        x = int(gap + t * (dw - ww - gap*2))
        y = int(1 + t * (dh - wh - 2))
        print id[i], x, y, ww, wh
      }
    }

    else if (preset == "spotlight") {
      hw2 = int(dw * 0.6); hh2 = int(dh * 0.6)
      hx = int((dw - hw2) / 2); hy = int((dh - hh2) / 2)
      hi = hero_idx
      print id[hi], hx, hy, hw2, hh2
      sw2 = 22; sh2 = 7
      j = 0
      for (i = 0; i < wcount; i++) {
        if (i == hi) continue
        if (j < int((dw - 4) / (sw2 + gap))) {
          print id[i], gap + j*(sw2+gap), 1, sw2, sh2
        } else {
          j2 = j - int((dw-4)/(sw2+gap))
          print id[i], gap, 1 + (j2+1)*(sh2+gap), sw2, sh2
        }
        j++
      }
    }

    else if (preset == "asymmetric") {
      rows = int((wcount + 1) / 2)
      if (rows < 1) rows = 1
      row_h = int((dh - 2) / rows)
      if (row_h < 5) row_h = 5
      wide = int(dw * 0.68)
      narrow = dw - wide - gap*2
      idx2 = 0
      for (r = 0; r < rows; r++) {
        y = 1 + r * row_h
        h = row_h
        if (y + h > dh - 1) h = dh - 1 - y
        if (h < 4) break
        if (r % 2 == 0) {
          if (idx2 < wcount) { print id[idx2], gap, y, wide, h; idx2++ }
          if (idx2 < wcount) { print id[idx2], wide+gap*2, y, narrow-gap, h; idx2++ }
        } else {
          if (idx2 < wcount) { print id[idx2], gap, y, narrow, h; idx2++ }
          if (idx2 < wcount) { print id[idx2], narrow+gap*2, y, wide-gap, h; idx2++ }
        }
      }
    }
  }
  '
}

# Build JSON batch ops
OPS=$(batch_ops | awk '{printf "%s{\"id\":%s,\"left\":%s,\"top\":%s,\"width\":%s,\"height\":%s}", \
  (NR>1?",":""), $1, $2, $3, $4, $5}')

if [[ -z "$OPS" ]]; then
  echo "Preset produced no ops — check window count and preset name." >&2
  exit 1
fi

echo "Applying preset: $PRESET (${WIN_COUNT} windows, desktop ${DW}×${DH})"

curl -sf -X POST "http://127.0.0.1:${PORT}/windows/batch" \
  -H 'Content-Type: application/json' \
  -d "{\"ops\": [${OPS}]}" | jq .

echo "Done. Verify: wibwob windows | jq -r '.[] | \"\(.id) \(.title) \(.left),\(.top) \(.width)×\(.height)\"'"
