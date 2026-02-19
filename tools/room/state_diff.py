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

# Window types that are singleton internal UI — never sync across instances.
_INTERNAL_TYPES: frozenset[str] = frozenset({"wibwob", "scramble"})


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
    resp = ipc_command_raw(sock_path, cmd, params)
    if resp is None:
        return False
    # C++ handlers return either "ok..." (legacy) or {"success":true,...} JSON.
    return resp.startswith("ok") or '"success":true' in resp


def ipc_command_raw(sock_path: str, cmd: str, params: dict[str, Any]) -> str | None:
    """Send a key=value command to WibWob IPC. Returns raw response or None."""
    parts = [f"cmd:{cmd}"]
    for k, v in params.items():
        parts.append(f"{k}={_encode_param(v)}")
    return ipc_send(sock_path, " ".join(parts))


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
                if norm.get("type") not in _INTERNAL_TYPES:
                    windows[wid] = norm
        return windows
    windows = {}
    for win in raw:
        if not isinstance(win, dict):
            continue
        norm = _normalise_win(win)
        if norm.get("type") in _INTERNAL_TYPES:
            continue
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


def apply_delta_to_ipc(
    sock_path: str,
    delta: dict[str, Any],
    id_map: dict[str, str] | None = None,
) -> list[str]:
    """
    Apply a remote state_delta to a local WibWob instance via IPC.

    Returns list of applied command strings for logging/testing.
    """
    applied = []

    def _map_id(remote_id: str) -> str:
        if not remote_id:
            return remote_id
        return id_map.get(remote_id, remote_id) if id_map is not None else remote_id

    for win in delta.get("add", []):
        win_type = win.get("type", "test_pattern")
        rect = _rect(win)
        x = rect.get("x", 0)
        y = rect.get("y", 0)
        w = rect.get("w") or rect.get("width", 40)
        h = rect.get("h") or rect.get("height", 20)
        params: dict = {"type": win_type, "x": x, "y": y, "w": w, "h": h}
        path = win.get("path", "")
        if path:
            params["path"] = path
        remote_id = str(win.get("id", ""))
        resp = ipc_command_raw(sock_path, "create_window", params)
        ok = bool(resp) and (resp.startswith("ok") or '"success":true' in resp)
        local_id = ""
        if ok and resp and id_map is not None and remote_id:
            try:
                payload = json.loads(resp)
                if payload.get("success") is True and isinstance(payload.get("id"), str):
                    local_id = payload["id"]
            except json.JSONDecodeError:
                pass
            if local_id:
                id_map[remote_id] = local_id
        tag = f"create_window id={remote_id} type={win_type}"
        if local_id and local_id != remote_id:
            tag += f" local_id={local_id}"
        applied.append(tag if ok else f"FAIL {tag}")

    for wid in delta.get("remove", []):
        remote_id = str(wid)
        local_id = _map_id(remote_id)
        ok = ipc_command(sock_path, "close_window", {"id": local_id})
        tag = f"close_window id={remote_id}"
        if local_id != remote_id:
            tag += f" local_id={local_id}"
        applied.append(tag if ok else f"FAIL {tag}")
        if id_map is not None:
            id_map.pop(remote_id, None)

    for win in delta.get("update", []):
        remote_id = str(win.get("id", ""))
        wid = _map_id(remote_id)
        if not wid:
            continue
        rect = _rect(win)
        if rect:
            # Only move if both coordinates are explicitly present in the delta.
            # Defaulting to 0 when keys are absent would send spurious move_window
            # x=0 y=0 for size-only updates.
            if "x" in rect and "y" in rect:
                ok = ipc_command(sock_path, "move_window", {
                    "id": wid,
                    "x": rect["x"],
                    "y": rect["y"],
                })
                tag = f"move_window id={remote_id} x={rect['x']} y={rect['y']}"
                if wid != remote_id:
                    tag += f" local_id={wid}"
                applied.append(tag if ok else f"FAIL {tag}")
            # Only resize if both dimensions are explicitly present.
            w = rect["w"] if "w" in rect else rect.get("width")
            h = rect["h"] if "h" in rect else rect.get("height")
            if w is not None and h is not None:
                # C++ IPC handler reads "width"/"height" (not "w"/"h")
                ok = ipc_command(sock_path, "resize_window", {
                    "id": wid, "width": w, "height": h,
                })
                tag = f"resize_window id={remote_id} width={w} height={h}"
                if wid != remote_id:
                    tag += f" local_id={wid}"
                applied.append(tag if ok else f"FAIL {tag}")

    return applied
