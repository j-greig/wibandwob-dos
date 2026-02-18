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
import json
import os
import sys
import time
from typing import Any

from state_diff import (
    windows_from_state,
    compute_delta,
    apply_delta,
    apply_delta_to_ipc,
    ipc_get_state,
    ipc_command,
)

# websockets imported lazily in run() so pure functions remain importable in tests.

POLL_INTERVAL = 5.0        # slow heartbeat; real-time sync driven by IPC events
RECONNECT_DELAY = 3        # seconds before WS reconnect attempt
IPC_TIMEOUT = 2.0          # seconds for IPC socket calls
EVENT_RETRY_DELAY = 1.0    # seconds before re-subscribing to IPC events after drop


def ipc_sock_path(instance_id: str) -> str:
    return f"/tmp/wibwob_{instance_id}.sock"


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
        self.last_chat_seq: int = 0
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

    async def push_chat(self, sender: str, text: str) -> None:
        if self._ws is None:
            return
        msg = json.dumps({"type": "chat_msg", "sender": sender, "text": text,
                          "instance": self.instance_id})
        try:
            await self._ws.send(msg)
        except Exception as e:
            self.log(f"send error (chat): {e}")
            self._ws = None

    async def _sync_state_now(self, trigger: str = "poll") -> None:
        """Fetch local IPC state, diff against baseline, push delta if changed."""
        state = ipc_get_state(self.sock_path)
        if not state:
            return
        new_windows = windows_from_state(state)
        delta = compute_delta(self.last_windows, new_windows)
        if delta:
            self.log(f"[{trigger}] state change, pushing delta")
            await self.push_delta(delta)
            self.last_windows = new_windows

    async def event_subscribe_loop(self) -> None:
        """Open a persistent IPC connection and react to push events immediately."""
        while True:
            try:
                reader, writer = await asyncio.open_unix_connection(self.sock_path)
                writer.write(b"cmd:subscribe_events\n")
                await writer.drain()
                self.log("IPC event subscription active")
                while True:
                    line = await reader.readline()
                    if not line:
                        break  # server closed connection
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        event = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    # Acknowledgement from server — ignore
                    if event.get("type") == "subscribed":
                        continue
                    if event.get("type") == "event":
                        event_name = event.get("event", "")
                        if event_name in ("state_changed", "window_closed"):
                            await self._sync_state_now(f"event:{event_name}")
                writer.close()
            except (OSError, ConnectionRefusedError, EOFError) as e:
                self.log(f"event subscribe dropped ({e}), retrying in {EVENT_RETRY_DELAY}s")
            await asyncio.sleep(EVENT_RETRY_DELAY)

    async def poll_loop(self) -> None:
        """Slow heartbeat poll — catches anything missed by event subscription."""
        while True:
            await self._sync_state_now("heartbeat")
            state = ipc_get_state(self.sock_path)
            if state:
                # Forward new local chat messages to PartyKit
                for entry in state.get("chat_log", []):
                    seq = entry.get("seq", 0)
                    if seq > self.last_chat_seq:
                        sender = entry.get("sender", "you")
                        text = entry.get("text", "")
                        if text:
                            self.log(f"forwarding chat seq={seq}: {text[:40]}")
                            await self.push_chat(sender, text)
                        self.last_chat_seq = seq
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
                        # Re-read actual local state as baseline — C++ assigns its
                        # own window IDs, so we must not track remote IDs or the
                        # poll loop will see a mismatch and re-broadcast forever.
                        actual = ipc_get_state(self.sock_path)
                        self.last_windows = windows_from_state(actual) if actual else new_windows

            elif mtype == "state_delta":
                delta = msg.get("delta", {})
                if delta:
                    applied = apply_delta_to_ipc(self.sock_path, delta)
                    for cmd in applied:
                        self.log(f"  {'✓' if not cmd.startswith('FAIL') else '✗'} {cmd}")
                    # Re-read actual local state as baseline to prevent re-broadcast loop.
                    actual = ipc_get_state(self.sock_path)
                    if actual:
                        self.last_windows = windows_from_state(actual)

            elif mtype == "chat_msg":
                sender = msg.get("sender", "remote")
                text = msg.get("text", "")
                origin_instance = msg.get("instance", "")
                # Only apply messages from other instances (skip our own echo)
                if text and origin_instance != self.instance_id:
                    self.log(f"chat from {sender}: {text[:60]}")
                    ipc_command(self.sock_path, "chat_receive", {"sender": sender, "text": text})

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
                        self.event_subscribe_loop(),
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
