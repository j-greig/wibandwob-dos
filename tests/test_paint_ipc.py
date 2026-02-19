#!/usr/bin/env python3
"""Automated IPC test for paint canvas integration (E010).

Exercises: create_window type=paint, paint_cell, paint_text,
paint_line, paint_rect, paint_export (inline + file).

Requires a running test_pattern app with IPC socket.
Set WIBWOB_INSTANCE env var to match the running instance.

Usage:
    # With app already running:
    python3 tests/test_paint_ipc.py

    # Or launch app yourself first:
    WIBWOB_INSTANCE=99 ./build/app/test_pattern &
    sleep 2
    WIBWOB_INSTANCE=99 python3 tests/test_paint_ipc.py
"""

import json
import os
import socket
import sys
import tempfile
import time


def _sock_path():
    inst = os.environ.get("WIBWOB_INSTANCE")
    if inst:
        return f"/tmp/wibwob_{inst}.sock"
    return "/tmp/test_pattern_app.sock"


def ipc_send(cmd: str, timeout: float = 5.0) -> str:
    """Send a command to the IPC socket and return the response."""
    sock_path = _sock_path()
    s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    s.settimeout(timeout)
    s.connect(sock_path)
    s.sendall((cmd + "\n").encode("utf-8"))
    chunks = []
    while True:
        try:
            data = s.recv(8192)
            if not data:
                break
            chunks.append(data.decode("utf-8", errors="replace"))
        except socket.timeout:
            break
    s.close()
    return "".join(chunks).strip()


def percent_encode(text: str) -> str:
    """Percent-encode a string for IPC key=value params."""
    out = []
    for ch in text:
        if ch == " ":
            out.append("%20")
        elif ch == "=":
            out.append("%3D")
        elif ch == "\n":
            out.append("%0A")
        elif ch == "%":
            out.append("%25")
        else:
            out.append(ch)
    return "".join(out)


class PaintIPCTests:
    """Test suite for paint canvas IPC commands."""

    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.window_id = None

    def assert_true(self, condition: bool, msg: str):
        if condition:
            self.passed += 1
            print(f"  PASS: {msg}")
        else:
            self.failed += 1
            print(f"  FAIL: {msg}")

    def assert_contains(self, haystack: str, needle: str, msg: str):
        self.assert_true(needle in haystack, f"{msg} (looking for '{needle}')")

    def assert_startswith(self, text: str, prefix: str, msg: str):
        self.assert_true(text.startswith(prefix), f"{msg} (expected prefix '{prefix}', got '{text[:60]}')")

    def test_connection(self):
        """AC: IPC socket is reachable."""
        print("\n[1] Test IPC connection")
        resp = ipc_send("cmd:get_state")
        self.assert_true(len(resp) > 0, "get_state returns non-empty response")
        self.assert_contains(resp, "windows", "get_state contains windows key")

    def test_create_paint_window(self):
        """AC: create_window type=paint creates a paint window."""
        print("\n[2] Create paint window via IPC")
        resp = ipc_send("cmd:create_window type=paint")
        print(f"     Response: {resp}")
        self.assert_true("ok" in resp.lower() or "success" in resp.lower(),
                         "create_window type=paint succeeds")

        # Get state to find the paint window
        state_resp = ipc_send("cmd:get_state")
        state = json.loads(state_resp)
        windows = state.get("windows", [])

        # Find paint window (newest, title contains "Paint")
        paint_wins = [w for w in windows if "paint" in w.get("title", "").lower()
                      or "paint" in w.get("type", "").lower()]
        self.assert_true(len(paint_wins) > 0, "Paint window appears in get_state")

        if paint_wins:
            self.window_id = paint_wins[-1].get("id")
            print(f"     Paint window ID: {self.window_id}")

    def test_paint_cell(self):
        """AC: paint_cell sets a pixel at position."""
        print("\n[3] Paint cell")
        if not self.window_id:
            print("  SKIP: no paint window ID")
            return
        resp = ipc_send(f"cmd:paint_cell id={self.window_id} x=5 y=5 fg=14 bg=1")
        self.assert_startswith(resp, "ok", "paint_cell returns ok")

    def test_paint_line(self):
        """AC: paint_line draws a Bresenham line."""
        print("\n[4] Paint line")
        if not self.window_id:
            print("  SKIP: no paint window ID")
            return
        resp = ipc_send(f"cmd:paint_line id={self.window_id} x0=0 y0=0 x1=10 y1=10")
        self.assert_startswith(resp, "ok", "paint_line returns ok")

    def test_paint_rect(self):
        """AC: paint_rect draws a rectangle outline."""
        print("\n[5] Paint rect")
        if not self.window_id:
            print("  SKIP: no paint window ID")
            return
        resp = ipc_send(f"cmd:paint_rect id={self.window_id} x0=2 y0=2 x1=12 y1=8")
        self.assert_startswith(resp, "ok", "paint_rect returns ok")

    def test_paint_text(self):
        """AC: paint_text writes a string at position."""
        print("\n[6] Paint text")
        if not self.window_id:
            print("  SKIP: no paint window ID")
            return
        text_encoded = percent_encode("HELLO")
        resp = ipc_send(f"cmd:paint_text id={self.window_id} x=3 y=3 text={text_encoded} fg=15 bg=0")
        self.assert_startswith(resp, "ok", "paint_text returns ok")

    def test_paint_export_inline(self):
        """AC: paint_export returns canvas content as JSON."""
        print("\n[7] Paint export (inline)")
        if not self.window_id:
            print("  SKIP: no paint window ID")
            return
        resp = ipc_send(f"cmd:paint_export id={self.window_id}")
        print(f"     Response length: {len(resp)}")
        self.assert_contains(resp, "text", "paint_export returns JSON with text key")
        self.assert_contains(resp, "HELLO", "exported text contains HELLO from paint_text")

    def test_paint_export_file(self):
        """AC: paint_export path=... writes canvas to file."""
        print("\n[8] Paint export (file)")
        if not self.window_id:
            print("  SKIP: no paint window ID")
            return
        tmp = tempfile.mktemp(suffix=".txt", prefix="paint_export_")
        resp = ipc_send(f"cmd:paint_export id={self.window_id} path={tmp}")
        self.assert_startswith(resp, "ok", "paint_export to file returns ok")

        if os.path.exists(tmp):
            with open(tmp) as f:
                content = f.read()
            self.assert_contains(content, "HELLO", "exported file contains HELLO")
            os.unlink(tmp)
            print(f"     Cleaned up {tmp}")
        else:
            self.assert_true(False, f"Export file {tmp} was created")

    def test_paint_error_handling(self):
        """AC: paint commands return errors for missing/invalid params."""
        print("\n[9] Error handling")
        resp = ipc_send("cmd:paint_cell x=0 y=0")
        self.assert_contains(resp, "err", "paint_cell without id returns error")

        resp = ipc_send(f"cmd:paint_cell id=nonexistent_id x=0 y=0")
        self.assert_contains(resp, "err", "paint_cell with bad id returns error")

        resp = ipc_send("cmd:paint_text id=x")
        self.assert_contains(resp, "err", "paint_text with missing params returns error")

    def test_command_registry(self):
        """AC: new_paint_canvas appears in command capabilities."""
        print("\n[10] Command registry")
        resp = ipc_send("cmd:get_capabilities")
        self.assert_contains(resp, "new_paint_canvas",
                             "new_paint_canvas in capabilities")

    def run_all(self):
        print("=" * 60)
        print("Paint Canvas IPC Test Suite (E010)")
        print(f"Socket: {_sock_path()}")
        print("=" * 60)

        self.test_connection()
        self.test_create_paint_window()
        self.test_paint_cell()
        self.test_paint_line()
        self.test_paint_rect()
        self.test_paint_text()
        self.test_paint_export_inline()
        self.test_paint_export_file()
        self.test_paint_error_handling()
        self.test_command_registry()

        print("\n" + "=" * 60)
        total = self.passed + self.failed
        print(f"Results: {self.passed}/{total} passed, {self.failed} failed")
        print("=" * 60)
        return self.failed == 0


if __name__ == "__main__":
    # Check socket exists
    sock = _sock_path()
    if not os.path.exists(sock):
        print(f"ERROR: Socket {sock} not found.")
        print("Start the app first: ./build/app/test_pattern")
        print("Or set WIBWOB_INSTANCE to match a running instance.")
        sys.exit(1)

    tests = PaintIPCTests()
    success = tests.run_all()
    sys.exit(0 if success else 1)
