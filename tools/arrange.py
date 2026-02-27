#!/usr/bin/env python3
"""Artistic window arrangement presets for WibWob-DOS.

Prototype for arrange_windows command. Uses existing move/resize/snap API.

Usage:
  python3 tools/arrange.py golden
  python3 tools/arrange.py magazine --hero w3
  python3 tools/arrange.py triptych
  python3 tools/arrange.py diagonal
  python3 tools/arrange.py cinema
  python3 tools/arrange.py spotlight --hero w1
"""

import json
import os
import sys
import urllib.request

API = os.environ.get("WIBWOB_API", "http://127.0.0.1:8089")


def api(endpoint, data=None):
    if data:
        req = urllib.request.Request(
            f"{API}/{endpoint}",
            json.dumps(data).encode(),
            {"Content-Type": "application/json"},
        )
    else:
        req = urllib.request.Request(f"{API}/{endpoint}")
    return json.loads(urllib.request.urlopen(req, timeout=5).read())


def cmd(name, args=None):
    return api("menu/command", {"command": name, "args": args or {}})


def get_windows():
    """Get all windows, sorted by z-order (focused first)."""
    state = api("state")
    return state.get("windows", [])


def get_desktop():
    """Return (width, height) of the desktop area."""
    state = api("state")
    ds = state.get("desktop_size", {})
    return ds.get("width", 200), ds.get("height", 50)


def place(wid, x, y, w, h):
    cmd("resize_window", {"id": wid, "w": str(w), "h": str(h)})
    cmd("move_window", {"id": wid, "x": str(x), "y": str(y)})


# ── Layout presets ───────────────────────────────────────

def golden(windows, dw, dh, hero_id=None):
    """Golden ratio: hero window 61.8% left, remaining stacked right."""
    if not windows:
        return
    PHI = 0.618
    gap = 1
    hero_w = int(dw * PHI) - gap
    side_w = dw - hero_w - gap * 2
    side_x = hero_w + gap * 2

    hero = windows[0]
    if hero_id:
        hero = next((w for w in windows if w["id"] == hero_id), windows[0])
    rest = [w for w in windows if w["id"] != hero["id"]]

    place(hero["id"], gap, 1, hero_w, dh - 2)

    if not rest:
        return
    slot_h = max(5, (dh - 2) // len(rest))
    for i, w in enumerate(rest):
        y = 1 + i * slot_h
        h = min(slot_h, dh - 1 - y)
        place(w["id"], side_x, y, side_w - gap, h)


def magazine(windows, dw, dh, hero_id=None):
    """Magazine: large feature top-left, sidebar right, footer bottom."""
    if not windows:
        return
    gap = 1
    # Feature: 2/3 width, 2/3 height
    feat_w = int(dw * 0.65)
    feat_h = int(dh * 0.65)
    side_w = dw - feat_w - gap * 2

    hero = windows[0]
    if hero_id:
        hero = next((w for w in windows if w["id"] == hero_id), windows[0])
    rest = [w for w in windows if w["id"] != hero["id"]]

    place(hero["id"], gap, 1, feat_w, feat_h)

    # Sidebar: stack vertically on right
    sidebar = rest[:3]
    footer = rest[3:]

    if sidebar:
        slot_h = max(5, feat_h // len(sidebar))
        for i, w in enumerate(sidebar):
            place(w["id"], feat_w + gap * 2, 1 + i * slot_h, side_w - gap, slot_h)

    # Footer: horizontal strip below feature
    if footer:
        foot_y = feat_h + gap + 1
        foot_h = max(5, dh - foot_y - 1)
        slot_w = max(10, dw // len(footer))
        for i, w in enumerate(footer):
            x = gap + i * slot_w
            place(w["id"], x, foot_y, slot_w - gap, foot_h)


def cinema(windows, dw, dh, hero_id=None):
    """Cinema: hero window centred 16:9, supporting windows fill the margins.

    The hero gets a cinematic 16:9 frame centred on the desktop.
    Supporting windows fill the four margins (top, bottom, left-side, right-side)
    at generous sizes — as large as the margin allows.
    """
    if not windows:
        return
    gap = 1

    hero = windows[0]
    if hero_id:
        hero = next((w for w in windows if w["id"] == hero_id), windows[0])
    rest = [w for w in windows if w["id"] != hero["id"]]

    # 16:9 in character cells (chars ~2:1 aspect → multiply by cell_aspect)
    cine_h = int(dh * 0.55)
    cine_w = int(cine_h * (16.0 / 9.0) * 2.0)
    if cine_w > dw - 20:
        cine_w = dw - 20
        cine_h = int(cine_w / ((16.0 / 9.0) * 2.0))
    cx = (dw - cine_w) // 2
    cy = (dh - cine_h) // 2

    place(hero["id"], cx, cy, cine_w, cine_h)

    if not rest:
        return

    # Available margin zones around the hero
    # Top strip: full width, above hero
    top_h = cy - gap - 1
    # Bottom strip: full width, below hero
    bot_y = cy + cine_h + gap
    bot_h = dh - bot_y - 1
    # Left wing: beside hero, vertically aligned with it
    left_w = cx - gap * 2
    # Right wing: beside hero, vertically aligned with it
    right_x = cx + cine_w + gap
    right_w = dw - right_x - gap

    # Distribute windows into zones: top, right wing, bottom, left wing
    zones = []
    if top_h >= 5:
        zones.append(("top", gap, 1, dw - gap * 2, top_h))
    if right_w >= 15:
        zones.append(("right", right_x, cy, right_w, cine_h))
    if bot_h >= 5:
        zones.append(("bottom", gap, bot_y, dw - gap * 2, bot_h))
    if left_w >= 15:
        zones.append(("left", gap, cy, left_w, cine_h))

    if not zones:
        # Fallback: stack below
        for i, w in enumerate(rest):
            place(w["id"], gap + i * 30, bot_y, 28, max(5, bot_h))
        return

    # Round-robin windows into zones, subdividing each zone horizontally
    zone_buckets = [[] for _ in zones]
    for i, w in enumerate(rest):
        zone_buckets[i % len(zones)].append(w)

    for (zname, zx, zy, zw, zh), bucket in zip(zones, zone_buckets):
        if not bucket:
            continue
        n = len(bucket)
        if zname in ("top", "bottom"):
            # Horizontal subdivision
            slot_w = max(15, (zw - gap * (n - 1)) // n)
            for j, w in enumerate(bucket):
                x = zx + j * (slot_w + gap)
                place(w["id"], x, zy, slot_w, zh)
        else:
            # Vertical subdivision (left/right wings)
            slot_h = max(5, (zh - gap * (n - 1)) // n)
            for j, w in enumerate(bucket):
                y = zy + j * (slot_h + gap)
                place(w["id"], zx, y, zw, slot_h)


def triptych(windows, dw, dh, hero_id=None):
    """Triptych: three equal columns. First 3 fill them, rest stack below."""
    if not windows:
        return
    gap = 1
    col_w = (dw - gap * 4) // 3
    main_h = int(dh * 0.75)

    for i, w in enumerate(windows[:3]):
        x = gap + i * (col_w + gap)
        place(w["id"], x, 1, col_w, main_h)

    # Remaining: footer row
    rest = windows[3:]
    if rest:
        foot_y = main_h + gap + 1
        foot_h = max(5, dh - foot_y - 1)
        slot_w = max(10, (dw - gap * 2) // len(rest))
        for i, w in enumerate(rest):
            place(w["id"], gap + i * slot_w, foot_y, slot_w - gap, foot_h)


def diagonal(windows, dw, dh, hero_id=None):
    """Diagonal cascade: windows grow larger along a diagonal, bottom-right biggest."""
    if not windows:
        return
    n = len(windows)
    gap = 1
    min_w, min_h = 20, 8
    max_w = int(dw * 0.55)
    max_h = int(dh * 0.55)

    for i, w in enumerate(windows):
        t = i / max(1, n - 1)  # 0..1
        ww = int(min_w + (max_w - min_w) * t)
        wh = int(min_h + (max_h - min_h) * t)
        x = int(gap + t * (dw - ww - gap * 2))
        y = int(1 + t * (dh - wh - 2))
        place(w["id"], x, y, ww, wh)


def spotlight(windows, dw, dh, hero_id=None):
    """Spotlight: hero centred large, others small around edges."""
    if not windows:
        return
    gap = 1

    hero = windows[0]
    if hero_id:
        hero = next((w for w in windows if w["id"] == hero_id), windows[0])
    rest = [w for w in windows if w["id"] != hero["id"]]

    # Hero: 60% of desktop, centred
    hw = int(dw * 0.6)
    hh = int(dh * 0.6)
    hx = (dw - hw) // 2
    hy = (dh - hh) // 2
    place(hero["id"], hx, hy, hw, hh)

    # Others: distribute around the edges
    if not rest:
        return
    small_w = 22
    small_h = 7
    # Top edge
    positions = []
    # Spread evenly along top
    for i in range(min(len(rest), (dw - 4) // (small_w + gap))):
        positions.append((gap + i * (small_w + gap), 1))
    # Left edge
    for i in range(len(positions), min(len(rest), len(positions) + (dh - 10) // (small_h + gap))):
        j = i - len(positions)
        positions.append((gap, 1 + (j + 1) * (small_h + gap)))
    # Bottom edge
    for i in range(len(positions), min(len(rest), len(positions) + (dw - 4) // (small_w + gap))):
        j = i - len(positions)
        positions.append((gap + j * (small_w + gap), dh - small_h - 1))
    # Right edge
    for i in range(len(positions), min(len(rest), len(positions) + (dh - 10) // (small_h + gap))):
        j = i - len(positions)
        positions.append((dw - small_w - gap, 1 + j * (small_h + gap)))

    for i, w in enumerate(rest):
        if i < len(positions):
            x, y = positions[i]
        else:
            x = gap + (i % 5) * (small_w + gap)
            y = dh - small_h - 1
        place(w["id"], x, y, small_w, small_h)


def asymmetric(windows, dw, dh, hero_id=None):
    """Asymmetric Swiss grid: alternating 70/30 split per row."""
    if not windows:
        return
    gap = 1
    n = len(windows)
    rows = max(1, (n + 1) // 2)
    row_h = max(5, (dh - 2) // rows)
    wide = int(dw * 0.68)
    narrow = dw - wide - gap * 2
    idx = 0

    for r in range(rows):
        y = 1 + r * row_h
        h = min(row_h, dh - 1 - y)
        if h < 4:
            break
        if r % 2 == 0:
            # Wide left, narrow right
            if idx < n:
                place(windows[idx]["id"], gap, y, wide, h)
                idx += 1
            if idx < n:
                place(windows[idx]["id"], wide + gap * 2, y, narrow - gap, h)
                idx += 1
        else:
            # Narrow left, wide right
            if idx < n:
                place(windows[idx]["id"], gap, y, narrow, h)
                idx += 1
            if idx < n:
                place(windows[idx]["id"], narrow + gap * 2, y, wide - gap, h)
                idx += 1


PRESETS = {
    "golden": golden,
    "magazine": magazine,
    "cinema": cinema,
    "triptych": triptych,
    "diagonal": diagonal,
    "spotlight": spotlight,
    "asymmetric": asymmetric,
}


def main():
    if len(sys.argv) < 2 or sys.argv[1] in ("-h", "--help"):
        print("Usage: arrange.py <preset> [--hero <id>]")
        print(f"Presets: {', '.join(PRESETS.keys())}")
        sys.exit(0)

    preset = sys.argv[1]
    if preset not in PRESETS:
        print(f"Unknown preset: {preset}")
        print(f"Available: {', '.join(PRESETS.keys())}")
        sys.exit(1)

    hero_id = None
    if "--hero" in sys.argv:
        idx = sys.argv.index("--hero")
        if idx + 1 < len(sys.argv):
            hero_id = sys.argv[idx + 1]

    windows = get_windows()
    if not windows:
        print("No windows open")
        sys.exit(1)

    dw, dh = get_desktop()
    print(f"Desktop: {dw}x{dh}, {len(windows)} windows")
    print(f"Arranging: {preset}" + (f" (hero={hero_id})" if hero_id else ""))

    PRESETS[preset](windows, dw, dh, hero_id)
    print("Done")


if __name__ == "__main__":
    main()
