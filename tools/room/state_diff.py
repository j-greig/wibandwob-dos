"""
State diffing utilities for WibWob-DOS multiplayer sync (E008 F03).

Extracts window state from IPC get_state responses, computes minimal
add/remove/update deltas, and applies remote deltas to a local instance
via IPC commands.

Used by partykit_bridge.py and any future sync transport.
"""

import hashlib
import json
import socket
import os
from typing import Any


IPC_TIMEOUT = 2.0


# ── IPC helpers ───────────────────────────────────────────────────────────────

def ipc_send(sock_path: str, command: str, timeout: float = IPC_TIMEOUT) -> str | None:
    """Send a command line to WibWob IPC, return response or None on error."""
    try:
        s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        s.settimeout(timeout)
        s.connect(sock_path)
        s.sendall((command + "\n").encode())
        chunks = []
        while True:
            chunk = s.recv(65536)
            if not chunk:
                break
            chunks.append(chunk)
            if chunk.endswith(b"\n"):
                break
        s.close()
        return b"".join(chunks).decode().strip()
    except (OSError, TimeoutError):
        return None


def ipc_get_state(sock_path: str) -> dict | None:
    """Fetch full state from WibWob IPC. Returns parsed JSON or None."""
    raw = ipc_send(sock_path, "cmd:get_state")
    if not raw:
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return None


def ipc_command(sock_path: str, cmd: str, params: dict[str, Any]) -> bool:
    """Send a key=value command to WibWob IPC. Returns True on ok."""
    parts = [f"cmd:{cmd}"]
    for k, v in params.items():
        parts.append(f"{k}={v}")
    resp = ipc_send(sock_path, " ".join(parts))
    return resp is not None and resp.startswith("ok")


# ── State extraction ──────────────────────────────────────────────────────────

def windows_from_state(state: dict) -> dict[str, dict]:
    """
    Extract a window_id → window_dict mapping from an IPC get_state response.

    Handles both list-of-windows (IPC shape) and dict-of-windows (PartyKit canonical shape).
    """
    raw = state.get("windows", [])
    if isinstance(raw, dict):
        return dict(raw)
    windows = {}
    for win in raw:
        wid = win.get("id") or win.get("title", "")
        if wid:
            windows[wid] = win
    return windows


def state_hash(windows: dict[str, dict]) -> str:
    """Stable hash of a window map for cheap change detection."""
    serialised = json.dumps(windows, sort_keys=True)
    return hashlib.sha256(serialised.encode()).hexdigest()


# ── Delta computation ─────────────────────────────────────────────────────────

def compute_delta(
    old: dict[str, dict],
    new: dict[str, dict],
) -> dict[str, Any] | None:
    """
    Compute a minimal state delta from old → new window maps.

    Returns None if there is no change, otherwise a dict with at least one of:
      {"add": [...], "remove": [...], "update": [...]}
    """
    old_ids = set(old)
    new_ids = set(new)

    add = [new[wid] for wid in sorted(new_ids - old_ids)]
    remove = sorted(old_ids - new_ids)
    update = [
        new[wid]
        for wid in sorted(old_ids & new_ids)
        if new[wid] != old[wid]
    ]

    if not add and not remove and not update:
        return None

    delta: dict[str, Any] = {}
    if add:
        delta["add"] = add
    if remove:
        delta["remove"] = remove
    if update:
        delta["update"] = update
    return delta


def apply_delta(
    current: dict[str, dict],
    delta: dict[str, Any],
) -> dict[str, dict]:
    """
    Apply a state delta to a window map and return the new map.
    Does not mutate the input.
    """
    result = dict(current)
    for win in delta.get("add", []):
        result[win["id"]] = win
    for wid in delta.get("remove", []):
        result.pop(wid, None)
    for win in delta.get("update", []):
        if win["id"] in result:
            result[win["id"]] = {**result[win["id"]], **win}
        else:
            result[win["id"]] = win
    return result


# ── Apply remote delta to local WibWob via IPC ───────────────────────────────

def _rect(win: dict) -> dict:
    """Extract rect/bounds from a window dict, normalising key names."""
    rect = win.get("rect") or win.get("bounds") or {}
    return rect if isinstance(rect, dict) else {}


def apply_delta_to_ipc(sock_path: str, delta: dict[str, Any]) -> list[str]:
    """
    Apply a remote state_delta to a local WibWob instance via IPC.

    Returns list of applied command strings for logging/testing.
    """
    applied = []

    for win in delta.get("add", []):
        win_type = win.get("type", "test_pattern")
        rect = _rect(win)
        x = rect.get("x", 0)
        y = rect.get("y", 0)
        w = rect.get("w") or rect.get("width", 40)
        h = rect.get("h") or rect.get("height", 20)
        ok = ipc_command(sock_path, "create_window", {
            "type": win_type, "x": x, "y": y, "w": w, "h": h,
        })
        if ok:
            applied.append(f"create_window id={win.get('id')} type={win_type}")

    for wid in delta.get("remove", []):
        ok = ipc_command(sock_path, "close_window", {"id": wid})
        if ok:
            applied.append(f"close_window id={wid}")

    for win in delta.get("update", []):
        wid = win.get("id", "")
        rect = _rect(win)
        if rect and wid:
            ok = ipc_command(sock_path, "move_window", {
                "id": wid,
                "x": rect.get("x", 0),
                "y": rect.get("y", 0),
            })
            if ok:
                applied.append(f"move_window id={wid} x={rect.get('x')} y={rect.get('y')}")

    return applied
