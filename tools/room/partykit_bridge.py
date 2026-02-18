#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = ["websockets>=12"]
# ///
"""
PartyKit bridge for WibWob-DOS multiplayer rooms (E008 F02).

Runs as a sidecar alongside a WibWob instance. Polls local IPC state,
diffs it, and pushes state_delta messages to PartyKit. Also receives
remote deltas from PartyKit and applies them to the local instance via IPC.

Usage (spawned by orchestrator):
    uv run tools/room/partykit_bridge.py

Environment:
    WIBWOB_INSTANCE      — instance ID (e.g. "1"), drives /tmp/wibwob_1.sock
    WIBWOB_PARTYKIT_URL  — PartyKit server URL (e.g. https://wibwob.user.partykit.dev)
    WIBWOB_PARTYKIT_ROOM — PartyKit room/Durable Object key (e.g. "wibwob-shared")
    WIBWOB_AUTH_SECRET   — shared HMAC secret for IPC auth (optional)
"""

import asyncio
import hashlib
import hmac
import json
import os
import socket
import sys
import time
from typing import Any

# websockets imported lazily in main() so pure functions remain importable in tests.

POLL_INTERVAL = 0.5        # seconds between IPC state polls
RECONNECT_DELAY = 3        # seconds before WS reconnect attempt
IPC_TIMEOUT = 2.0          # seconds for IPC socket calls


# ── IPC helpers ───────────────────────────────────────────────────────────────

def ipc_sock_path(instance_id: str) -> str:
    return f"/tmp/wibwob_{instance_id}.sock"


def ipc_send(sock_path: str, command: str, timeout: float = IPC_TIMEOUT) -> str | None:
    """Send a command to WibWob IPC, return response string or None on error."""
    try:
        s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        s.settimeout(timeout)
        s.connect(sock_path)
        auth_secret = os.environ.get("WIBWOB_AUTH_SECRET", "")
        if auth_secret:
            challenge_raw = s.recv(1024)
            try:
                challenge = json.loads(challenge_raw.decode())
                nonce = challenge.get("nonce", "")
                mac = hmac.new(auth_secret.encode(), nonce.encode(), hashlib.sha256).hexdigest()
                auth_msg = json.dumps({"type": "auth", "hmac": mac}) + "\n"
                s.sendall(auth_msg.encode())
                result = s.recv(64).decode().strip()
                if result != "ok":
                    s.close()
                    return None
            except (json.JSONDecodeError, KeyError):
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


def get_state(sock_path: str) -> dict | None:
    """Fetch current window state from WibWob IPC."""
    raw = ipc_send(sock_path, "cmd:get_state")
    if not raw:
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return None


def apply_ipc_command(sock_path: str, cmd: str, params: dict[str, Any]) -> bool:
    """Send a command to WibWob IPC. Returns True on success."""
    parts = [f"cmd:{cmd}"]
    for k, v in params.items():
        parts.append(f"{k}={v}")
    resp = ipc_send(sock_path, " ".join(parts))
    return resp is not None and resp.startswith("ok")


# ── State diffing ─────────────────────────────────────────────────────────────

def windows_from_state(state: dict) -> dict[str, dict]:
    """Extract window dict from IPC get_state response."""
    windows = {}
    for win in state.get("windows", []):
        wid = win.get("id") or win.get("title", "")
        if wid:
            windows[wid] = win
    return windows


def compute_delta(old: dict[str, dict], new: dict[str, dict]) -> dict | None:
    """Compute minimal add/remove/update delta between two window snapshots."""
    old_ids = set(old)
    new_ids = set(new)

    add = [new[wid] for wid in new_ids - old_ids]
    remove = list(old_ids - new_ids)
    update = [
        new[wid]
        for wid in old_ids & new_ids
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


def apply_delta_to_ipc(sock_path: str, delta: dict) -> None:
    """Apply a remote state_delta to the local WibWob instance via IPC."""
    for win in delta.get("add", []):
        win_type = win.get("type", "test_pattern")
        rect = win.get("rect") or win.get("bounds", {})
        x = rect.get("x", 0) if isinstance(rect, dict) else 0
        y = rect.get("y", 0) if isinstance(rect, dict) else 0
        w = (rect.get("w") or rect.get("width", 40)) if isinstance(rect, dict) else 40
        h = (rect.get("h") or rect.get("height", 20)) if isinstance(rect, dict) else 20
        apply_ipc_command(sock_path, "create_window", {
            "type": win_type, "x": x, "y": y, "w": w, "h": h,
        })

    for wid in delta.get("remove", []):
        apply_ipc_command(sock_path, "close_window", {"id": wid})

    for win in delta.get("update", []):
        wid = win.get("id", "")
        rect = win.get("rect") or win.get("bounds", {})
        if rect and wid and isinstance(rect, dict):
            apply_ipc_command(sock_path, "move_window", {
                "id": wid,
                "x": rect.get("x", 0),
                "y": rect.get("y", 0),
            })


# ── Bridge ────────────────────────────────────────────────────────────────────

def build_ws_url(partykit_url: str, room: str) -> str:
    """Convert PartyKit HTTP URL to WebSocket party URL."""
    base = partykit_url.rstrip("/")
    if base.startswith("https://"):
        ws_base = "wss://" + base[8:]
    elif base.startswith("http://"):
        ws_base = "ws://" + base[7:]
    else:
        ws_base = "ws://" + base
    return f"{ws_base}/party/{room}"


class PartyKitBridge:
    def __init__(self, instance_id: str, partykit_url: str, room: str):
        self.sock_path = ipc_sock_path(instance_id)
        self.ws_url = build_ws_url(partykit_url, room)
        self.instance_id = instance_id
        self.last_windows: dict[str, dict] = {}
        self._ws = None

    def log(self, msg: str) -> None:
        ts = time.strftime("%H:%M:%S")
        print(f"[{ts}] [bridge:{self.instance_id}] {msg}", flush=True)

    async def push_delta(self, delta: dict) -> None:
        if self._ws is None:
            return
        msg = json.dumps({"type": "state_delta", "delta": delta})
        try:
            await self._ws.send(msg)
        except Exception as e:
            self.log(f"send error: {e}")
            self._ws = None

    async def poll_loop(self) -> None:
        while True:
            state = get_state(self.sock_path)
            if state:
                new_windows = windows_from_state(state)
                delta = compute_delta(self.last_windows, new_windows)
                if delta:
                    self.log(f"state change detected, pushing delta")
                    await self.push_delta(delta)
                    self.last_windows = new_windows
            await asyncio.sleep(POLL_INTERVAL)

    async def receive_loop(self, ws) -> None:
        async for raw in ws:
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue

            mtype = msg.get("type")
            if mtype == "state_sync":
                canonical = msg.get("state", {})
                windows = canonical.get("windows", {})
                if windows:
                    new_windows = dict(windows)
                    delta = compute_delta(self.last_windows, new_windows)
                    if delta:
                        self.log(f"applying state_sync delta")
                        apply_delta_to_ipc(self.sock_path, delta)
                        self.last_windows = new_windows

            elif mtype == "state_delta":
                delta = msg.get("delta", {})
                if delta:
                    self.log(f"applying remote state_delta")
                    apply_delta_to_ipc(self.sock_path, delta)
                    new_windows = dict(self.last_windows)
                    for win in delta.get("add", []):
                        if isinstance(win, dict) and "id" in win:
                            new_windows[win["id"]] = win
                    for wid in delta.get("remove", []):
                        new_windows.pop(wid, None)
                    for win in delta.get("update", []):
                        if isinstance(win, dict) and win.get("id") in new_windows:
                            new_windows[win["id"]].update(win)
                    self.last_windows = new_windows

            elif mtype == "chat_msg":
                self.log(f"chat from {msg.get('sender', '?')}: {msg.get('text', '')[:60]}")

    async def run(self) -> None:
        try:
            import websockets.asyncio.client as ws_client
        except ImportError:
            print("ERROR: websockets not installed. Run: uv run tools/room/partykit_bridge.py", file=sys.stderr)
            return
        self.log(f"connecting to {self.ws_url}")
        while True:
            try:
                async with ws_client.connect(self.ws_url) as ws:
                    self._ws = ws
                    self.log("connected")
                    await asyncio.gather(
                        self.poll_loop(),
                        self.receive_loop(ws),
                    )
            except Exception as e:
                self._ws = None
                self.log(f"disconnected ({e}), reconnecting in {RECONNECT_DELAY}s")
                await asyncio.sleep(RECONNECT_DELAY)


# ── Entry point ───────────────────────────────────────────────────────────────

def main() -> int:
    instance_id = os.environ.get("WIBWOB_INSTANCE", "")
    partykit_url = os.environ.get("WIBWOB_PARTYKIT_URL", "")
    room = os.environ.get("WIBWOB_PARTYKIT_ROOM", "")

    if not instance_id:
        print("ERROR: WIBWOB_INSTANCE not set", file=sys.stderr)
        return 1
    if not partykit_url:
        print("ERROR: WIBWOB_PARTYKIT_URL not set", file=sys.stderr)
        return 1
    if not room:
        print("ERROR: WIBWOB_PARTYKIT_ROOM not set", file=sys.stderr)
        return 1

    bridge = PartyKitBridge(instance_id, partykit_url, room)
    try:
        asyncio.run(bridge.run())
    except KeyboardInterrupt:
        pass
    return 0


if __name__ == "__main__":
    sys.exit(main())
