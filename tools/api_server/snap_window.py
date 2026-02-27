#!/usr/bin/env python3
"""snap_window — zone-based window placement over IPC.

Usage:
    python3 -m tools.api_server.snap_window <window_id> <zone> [--margin N]

Zones:
    tl, tr, bl, br   — quarters
    left, right       — vertical halves
    top, bottom       — horizontal halves
    full              — maximise
    center            — centered at half size

Margin (default 0) adds padding between zone edges.
"""

from __future__ import annotations

import json
import sys
from typing import Tuple

from .ipc_client import send_cmd


# Desktop geometry: menu bar at y=0 takes 1 row, status bar at bottom takes 1 row.
# So usable desktop is y=1..H-2 where H is total screen height.
# But get_state reports window coords already in desktop-relative space where
# the tile command fills y=0..69 (based on observed output). So we just use
# the full extent reported.

ZONES = {
    "tl":     (0.0, 0.0, 0.5, 0.5),   # top-left quarter
    "tr":     (0.5, 0.0, 1.0, 0.5),   # top-right quarter
    "bl":     (0.0, 0.5, 0.5, 1.0),   # bottom-left quarter
    "br":     (0.5, 0.5, 1.0, 1.0),   # bottom-right quarter
    "left":   (0.0, 0.0, 0.5, 1.0),   # left half
    "right":  (0.5, 0.0, 1.0, 1.0),   # right half
    "top":    (0.0, 0.0, 1.0, 0.5),   # top half
    "bottom": (0.0, 0.5, 1.0, 1.0),   # bottom half
    "full":   (0.0, 0.0, 1.0, 1.0),   # maximise
    "center": (0.25, 0.25, 0.75, 0.75),  # centered half
}


def get_desktop_size() -> Tuple[int, int]:
    """Get desktop width and height from current window state."""
    state = json.loads(send_cmd("get_state"))
    windows = state.get("windows", [])
    if not windows:
        return (284, 70)  # fallback
    # Desktop extent = max right/bottom edge across all tiled windows
    # But more reliably, if we tile first we know. For now, use the extent
    # from windows that were tiled (they fill the desktop).
    max_r = max((w["x"] + w["w"]) for w in windows)
    max_b = max((w["y"] + w["h"]) for w in windows)
    return (max_r, max_b)


def snap_window(window_id: str, zone: str, margin: int = 0) -> str:
    """Snap a window to a named zone. Returns 'ok' or error string."""
    zone = zone.lower().strip()
    if zone not in ZONES:
        return f"err unknown zone '{zone}' — valid: {', '.join(sorted(ZONES))}"

    dw, dh = get_desktop_size()
    fx0, fy0, fx1, fy1 = ZONES[zone]

    x = int(fx0 * dw) + margin
    y = int(fy0 * dh) + margin
    w = int((fx1 - fx0) * dw) - margin * 2
    h = int((fy1 - fy0) * dh) - margin * 2

    # Clamp minimums
    w = max(w, 10)
    h = max(h, 5)

    r1 = send_cmd("resize_window", {"id": window_id, "width": str(w), "height": str(h)})
    if r1.startswith("err"):
        return r1
    r2 = send_cmd("move_window", {"id": window_id, "x": str(x), "y": str(y)})
    if r2.startswith("err"):
        return r2

    return f"ok snapped {window_id} to {zone} ({x},{y} {w}x{h})"


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Snap a window to a zone")
    parser.add_argument("window_id", help="Window ID (e.g. w13)")
    parser.add_argument("zone", help="Zone name: tl, tr, bl, br, left, right, top, bottom, full, center")
    parser.add_argument("--margin", "-m", type=int, default=0, help="Margin/padding in cells (default 0)")
    args = parser.parse_args()
    result = snap_window(args.window_id, args.zone, args.margin)
    print(result)


if __name__ == "__main__":
    main()
