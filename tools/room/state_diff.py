"""
State diffing utilities for WibWob-DOS multiplayer sync (E008 F03).

Extracts window state from IPC get_state responses, computes minimal
add/remove/update deltas, and applies remote deltas to a local instance
via IPC commands.

Used by partykit_bridge.py and any future sync transport.
"""

import hashlib
import hmac as _hmac
import json
import socket
import os
from typing import Any
from urllib.parse import quote as _urlencode


IPC_TIMEOUT = 2.0

# Shared HMAC secret — read once from env at import time.
_AUTH_SECRET: str = os.environ.get("WIBWOB_AUTH_SECRET", "")


# ── IPC helpers ───────────────────────────────────────────────────────────────

def _ipc_auth_handshake(s: socket.socket) -> bool:
    """Complete HMAC challenge-response if WIBWOB_AUTH_SECRET is set.

    Protocol (server-initiated):
      1. Server sends: {"type":"challenge","nonce":"<hex>"}\\n
      2. Client sends: {"type":"auth","hmac":"<hmac>"}\\n
      3. Server sends: {"type":"auth_ok"}\\n  (or closes on failure)

    Returns True on success or when auth is not required.
    """
    if not _AUTH_SECRET:
        return True
    try:
        # Read challenge
        raw = b""
        while not raw.endswith(b"\n"):
            chunk = s.recv(512)
            if not chunk:
                return False
            raw += chunk
        msg = json.loads(raw.strip())
        if msg.get("type") != "challenge":
            return False
        nonce = msg["nonce"]
        # Compute HMAC-SHA256(secret, nonce), hex-encoded
        mac = _hmac.new(_AUTH_SECRET.encode(), nonce.encode(), "sha256").hexdigest()
        auth_resp = json.dumps({"type": "auth", "hmac": mac}) + "\n"
        s.sendall(auth_resp.encode())
        # Read auth_ok
        raw = b""
        while not raw.endswith(b"\n"):
            chunk = s.recv(512)
            if not chunk:
                return False
            raw += chunk
        ack = json.loads(raw.strip())
        return ack.get("type") == "auth_ok"
    except (OSError, json.JSONDecodeError, KeyError):
        return False


def ipc_send(sock_path: str, command: str, timeout: float = IPC_TIMEOUT) -> str | None:
    """Send a command line to WibWob IPC, return response or None on error.

    Handles HMAC auth handshake when WIBWOB_AUTH_SECRET is set.
    """
    try:
        s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        s.settimeout(timeout)
        s.connect(sock_path)
        if not _ipc_auth_handshake(s):
            s.close()
            return None
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


def _encode_param(v: Any) -> str:
    """Encode a single IPC key=value param value.

    The IPC server tokenises on spaces (app/api_ipc.cpp), so any value
    containing spaces must be percent-encoded to avoid truncation.
    """
    return _urlencode(str(v), safe="")


def ipc_command(sock_path: str, cmd: str, params: dict[str, Any]) -> bool:
    """Send a key=value command to WibWob IPC. Returns True on ok."""
    parts = [f"cmd:{cmd}"]
    for k, v in params.items():
        parts.append(f"{k}={_encode_param(v)}")
    resp = ipc_send(sock_path, " ".join(parts))
    return resp is not None and resp.startswith("ok")


# ── State extraction ──────────────────────────────────────────────────────────

def _normalise_win(win: dict) -> dict:
    """Normalise width/height → w/h so compute_delta comparisons are stable.

    api_get_state emits w/h (after the fix), but PartyKit canonical state or
    older snapshots may still carry width/height.  Always canonicalise to w/h.
    """
    out = dict(win)
    if "w" not in out and "width" in out:
        out["w"] = out.pop("width")
    elif "width" in out:
        out.pop("width")
    if "h" not in out and "height" in out:
        out["h"] = out.pop("height")
    elif "height" in out:
        out.pop("height")
    return out


def windows_from_state(state: dict) -> dict[str, dict]:
    """
    Extract a window_id → window_dict mapping from an IPC get_state response.

    Handles both list-of-windows (IPC shape) and dict-of-windows (PartyKit
    canonical shape). Normalises width/height → w/h so compute_delta works
    correctly when comparing local state against remotely-received deltas.
    """
    raw = state.get("windows", [])
    if isinstance(raw, dict):
        windows: dict[str, dict] = {}
        for wid, win in raw.items():
            if isinstance(win, dict):
                norm = _normalise_win(win)
                norm.setdefault("id", wid)
                windows[wid] = norm
        return windows
    windows = {}
    for win in raw:
        if not isinstance(win, dict):
            continue
        norm = _normalise_win(win)
        wid = norm.get("id") or norm.get("title", "")
        if wid:
            windows[wid] = norm
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
    """Extract rect/bounds from a window dict, normalising key names.

    Handles both sub-dict form ({rect: {x,y,w,h}}) and flat form ({x,y,w,h}).
    """
    rect = win.get("rect") or win.get("bounds")
    if isinstance(rect, dict):
        return rect
    # Fall back to top-level x/y/w/h keys (IPC / delta flat format)
    if any(k in win for k in ("x", "y", "w", "h", "width", "height")):
        return win
    return {}


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
        tag = f"create_window id={win.get('id')} type={win_type}"
        applied.append(tag if ok else f"FAIL {tag}")

    for wid in delta.get("remove", []):
        ok = ipc_command(sock_path, "close_window", {"id": wid})
        tag = f"close_window id={wid}"
        applied.append(tag if ok else f"FAIL {tag}")

    for win in delta.get("update", []):
        wid = win.get("id", "")
        if not wid:
            continue
        rect = _rect(win)
        if rect:
            # Always sync position
            ok = ipc_command(sock_path, "move_window", {
                "id": wid,
                "x": rect.get("x", 0),
                "y": rect.get("y", 0),
            })
            tag = f"move_window id={wid} x={rect.get('x')} y={rect.get('y')}"
            applied.append(tag if ok else f"FAIL {tag}")
            # Also sync dimensions when they changed
            w = rect.get("w") or rect.get("width")
            h = rect.get("h") or rect.get("height")
            if w and h:
                ok = ipc_command(sock_path, "resize_window", {
                    "id": wid, "w": w, "h": h,
                })
                tag = f"resize_window id={wid} w={w} h={h}"
                applied.append(tag if ok else f"FAIL {tag}")

    return applied
