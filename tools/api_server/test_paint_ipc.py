#!/usr/bin/env python3
"""
E010 Paint Canvas Integration — IPC acceptance tests.

Requires a running TUI app. Run:
    uv run tools/api_server/test_paint_ipc.py

AC-1: new_paint_canvas opens a paint window and returns ok
AC-2: paint_cell + paint_export returns a non-empty text grid
AC-3: paint_line and paint_rect return ok
AC-4: No debug colour literals in paint source files
"""

import os
import socket
import sys
import glob
import re


def _sock_path():
    inst = os.environ.get("WIBWOB_INSTANCE")
    if inst:
        return f"/tmp/wibwob_{inst}.sock"
    return "/tmp/test_pattern_app.sock"


def _send(cmd: str) -> str:
    s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    s.connect(_sock_path())
    s.sendall((cmd + "\n").encode())
    chunks = []
    s.settimeout(2.0)
    try:
        while True:
            data = s.recv(4096)
            if not data:
                break
            chunks.append(data)
    except socket.timeout:
        pass
    s.close()
    return b"".join(chunks).decode("utf-8", errors="ignore").strip()


def test_spawn_paint():
    """AC-1: new_paint_canvas registry command returns ok."""
    resp = _send("cmd:exec_command name=new_paint_canvas")
    assert resp == "ok", f"Expected 'ok', got: {resp!r}"
    print("PASS AC-1: new_paint_canvas")


def _spawn_paint_window() -> str:
    """Spawn via create_window to get back a usable window ID."""
    import json
    resp = _send("cmd:create_window type=paint")
    assert resp and not resp.startswith("err"), f"create_window failed: {resp!r}"
    data = json.loads(resp)
    assert data.get("success"), f"create_window not successful: {data}"
    return data["id"]


def test_paint_cell_and_export():
    """AC-2: paint_cell writes a cell; paint_export returns a non-empty grid."""
    wid = _spawn_paint_window()
    resp = _send(f"cmd:paint_cell id={wid} x=0 y=0 fg=15 bg=0")
    assert resp == "ok", f"paint_cell failed: {resp!r}"

    import json as _json
    resp = _send(f"cmd:paint_export id={wid}")
    assert len(resp) > 0, "paint_export returned empty"
    data = _json.loads(resp)
    text = data.get("text", "")
    assert len(text) > 0, "paint_export text field is empty"
    assert "\n" in text, "paint_export text should be a multi-line grid"
    print("PASS AC-2: paint_cell + paint_export")


def test_paint_line_rect():
    """AC-3: paint_line and paint_rect return ok."""
    wid = _spawn_paint_window()
    resp = _send(f"cmd:paint_line id={wid} x0=0 y0=0 x1=5 y1=5")
    assert resp == "ok", f"paint_line failed: {resp!r}"

    resp = _send(f"cmd:paint_rect id={wid} x0=1 y0=1 x1=4 y1=4")
    assert resp == "ok", f"paint_rect failed: {resp!r}"
    print("PASS AC-3: paint_line + paint_rect")


def test_no_debug_colours():
    """AC-4: No debug TColorAttr literals in paint source files."""
    repo_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    paint_files = glob.glob(os.path.join(repo_root, "app/paint/*.cpp")) + \
                  glob.glob(os.path.join(repo_root, "app/paint/*.h"))
    assert paint_files, "No paint source files found"

    debug_pattern = re.compile(r'TColorAttr\s*\{\s*0x(3[Ee]|2[Ee]|1[Ff])\s*\}')
    found = []
    for path in paint_files:
        with open(path) as f:
            for i, line in enumerate(f, 1):
                if debug_pattern.search(line):
                    found.append(f"{os.path.basename(path)}:{i}: {line.rstrip()}")

    assert not found, "Debug colour attributes found:\n" + "\n".join(found)
    print("PASS AC-4: no debug colours")


if __name__ == "__main__":
    # AC-4 runs without the app
    test_no_debug_colours()

    # AC-1..3 require running app
    try:
        test_spawn_paint()
        test_paint_cell_and_export()
        test_paint_line_rect()
        print("\nAll paint IPC tests passed.")
    except ConnectionRefusedError:
        print("\nSKIP: TUI app not running (AC-1..3 require live app)", file=sys.stderr)
        sys.exit(0)
    except Exception as e:
        print(f"\nFAIL: {e}", file=sys.stderr)
        sys.exit(1)
