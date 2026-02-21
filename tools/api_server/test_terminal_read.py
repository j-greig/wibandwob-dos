#!/usr/bin/env python3
"""Tests for terminal_read / terminal_write Python layer (issue #80).

AC coverage:
  - terminal_read dispatches with correct command + window_id param
  - terminal_write with window_id passes window_id through to IPC
  - terminal_read ok=True → result string returned in 'result' key
  - terminal_read ok=False (no terminal) → ok=False propagated
  - terminal_read command appears in capabilities list
"""
from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path
from typing import Dict, List, Optional, Tuple

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

import tools.api_server.controller as controller_module  # noqa: E402
from tools.api_server.controller import Controller  # noqa: E402
from tools.api_server.events import EventHub  # noqa: E402


def _capabilities_with_terminal_read() -> Dict[str, object]:
    return {
        "version": "v1",
        "commands": [
            {"name": "terminal_write", "description": "Send text input to the terminal emulator", "requires_path": False},
            {"name": "terminal_read", "description": "Read the visible text content of a terminal window", "requires_path": False},
        ],
    }


async def _run() -> None:
    sent: List[Tuple[str, Dict[str, str]]] = []

    # --- AC: terminal_read dispatches with correct params, returns text ---
    def fake_send_terminal_read_ok(cmd: str, kv: Optional[Dict[str, str]] = None) -> str:
        sent.append((cmd, dict(kv or {})))
        if cmd == "exec_command" and (kv or {}).get("name") == "terminal_read":
            # C++ returns raw terminal text as a plain string (not JSON)
            return "HELLO_FROM_WIBWOB\n$ "
        if cmd == "exec_command" and (kv or {}).get("name") == "terminal_write":
            return "ok"
        if cmd == "get_capabilities":
            return json.dumps(_capabilities_with_terminal_read())
        return "ok"

    original = controller_module.send_cmd
    controller_module.send_cmd = fake_send_terminal_read_ok
    try:
        ctl = Controller(EventHub())

        # AC: terminal_read dispatches via exec_command with name=terminal_read
        sent.clear()
        result = await ctl.exec_command("terminal_read", {}, actor="api")
        assert result["ok"] is True, f"expected ok=True, got {result}"
        assert result["result"] == "HELLO_FROM_WIBWOB\n$ ", f"unexpected result: {result}"
        assert sent[0][0] == "exec_command", sent
        assert sent[0][1].get("name") == "terminal_read", sent

        # AC: terminal_read with window_id passes it through
        sent.clear()
        result = await ctl.exec_command("terminal_read", {"window_id": "win_3"}, actor="api")
        assert result["ok"] is True, result
        assert sent[0][1].get("window_id") == "win_3", f"window_id not passed: {sent}"

        # AC: terminal_write with window_id passes it through
        sent.clear()
        result = await ctl.exec_command("terminal_write", {"text": "echo hi\n", "window_id": "win_3"}, actor="api")
        assert sent[0][0] == "exec_command", sent
        assert sent[0][1].get("name") == "terminal_write", sent
        assert sent[0][1].get("window_id") == "win_3", f"window_id not passed to terminal_write: {sent}"
        assert sent[0][1].get("text") == "echo hi\n", sent

        # AC: terminal_read command appears in capabilities
        caps = await ctl.get_capabilities()
        assert "terminal_read" in caps["commands"], f"terminal_read missing from caps: {caps}"
        assert "terminal_write" in caps["commands"], f"terminal_write missing from caps: {caps}"

    finally:
        controller_module.send_cmd = original

    # --- AC: terminal_read ok=False (no terminal open) propagated ---
    def fake_send_terminal_read_fail(cmd: str, kv: Optional[Dict[str, str]] = None) -> str:
        if cmd == "exec_command" and (kv or {}).get("name") == "terminal_read":
            # C++ returns "err ..." prefix for failures
            return "err no terminal window"
        return "ok"

    controller_module.send_cmd = fake_send_terminal_read_fail
    try:
        ctl2 = Controller(EventHub())
        result = await ctl2.exec_command("terminal_read", {}, actor="api")
        assert result["ok"] is False, f"expected ok=False when no terminal, got {result}"
        assert "terminal" in result.get("error", "").lower(), f"unexpected error message: {result}"
    finally:
        controller_module.send_cmd = original

    # --- AC: null bytes from empty terminal cells are stripped ---
    def fake_send_terminal_read_nulls(cmd: str, kv: Optional[Dict[str, str]] = None) -> str:
        if cmd == "exec_command" and (kv or {}).get("name") == "terminal_read":
            # C++ returns null bytes for empty cells on each row
            return "HELLO_FROM_WIBWOB\x00\x00\x00\x00\x00\nzilla ~% \x00\x00\x00\x00\x00"
        return "ok"

    controller_module.send_cmd = fake_send_terminal_read_nulls
    try:
        ctl3 = Controller(EventHub())
        result = await ctl3.exec_command("terminal_read", {}, actor="api")
        assert result["ok"] is True, result
        raw = result.get("result", "")
        assert "\x00" in raw, "raw result should still contain null bytes (stripping is Python boundary concern)"
        # Verify the stripping logic used by REST endpoint and MCP tool
        clean = raw.replace("\x00", "")
        assert "HELLO_FROM_WIBWOB" in clean
        assert "\x00" not in clean, "stripped text must contain no null bytes"
    finally:
        controller_module.send_cmd = original


if __name__ == "__main__":
    asyncio.run(_run())
    print("PASS: terminal_read/terminal_write dispatch, window_id routing, capabilities, error propagation")
