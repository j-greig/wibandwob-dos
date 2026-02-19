#!/usr/bin/env python3
"""
E010 Paint Canvas Integration — IPC acceptance tests.

Requires a running TUI app. Run:
    uv run tools/api_server/test_paint_ipc.py

AC-1: new_paint_canvas opens a paint window and returns ok
AC-2: paint_cell + paint_export returns a non-empty text grid
AC-3: paint_line and paint_rect return ok
AC-4: No debug colour literals in paint source files
AC-6: changeBounds is implemented in paint_canvas.cpp
AC-7: Palette FG/BG chip code is present in paint_palette.cpp
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


def test_canvas_resize_implemented():
    """AC-6: changeBounds override exists in paint_canvas.cpp."""
    repo_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    src = open(os.path.join(repo_root, "app/paint/paint_canvas.cpp")).read()
    assert "changeBounds" in src, "changeBounds not found in paint_canvas.cpp"
    assert "TPaintCanvasView::changeBounds" in src, "changeBounds not implemented"
    print("PASS AC-6: changeBounds implemented")


def test_palette_chip_implemented():
    """AC-7: FG/BG chip draw code present in paint_palette.cpp."""
    repo_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    src = open(os.path.join(repo_root, "app/paint/paint_palette.cpp")).read()
    assert "aFg" in src and "aBg" in src, "FG/BG chip attrs not found"
    assert "FG/BG color chip" in src, "FG/BG chip comment not found"
    print("PASS AC-7: palette FG/BG chip implemented")


def test_paint_rest_endpoints_exist():
    """AC-8: REST routes for paint operations present in main.py."""
    repo_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    src = open(os.path.join(repo_root, "tools/api_server/main.py")).read()
    for route in ["/paint/cell", "/paint/line", "/paint/rect", "/paint/clear", "/paint/export"]:
        assert route in src, f"REST route {route!r} not found in main.py"
    print("PASS AC-8: paint REST endpoints present")


def test_mouse_move_handled():
    """AC-9: evMouseMove is handled in paint_canvas.cpp handleEvent (not just in eventMask)."""
    repo_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    src = open(os.path.join(repo_root, "app/paint/paint_canvas.cpp")).read()
    # Must appear after the handleEvent function definition, not just in constructor
    handle_start = src.find("TPaintCanvasView::handleEvent")
    assert handle_start != -1, "handleEvent not found in paint_canvas.cpp"
    handle_body = src[handle_start:]
    assert "evMouseMove" in handle_body, "evMouseMove not handled in handleEvent body"
    print("PASS AC-9: evMouseMove handled in handleEvent")


def test_text_tool_focus():
    """AC-10: Canvas calls select() on mouseDown; tool panel skips keyboard when Text tool active."""
    repo_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    canvas_src = open(os.path.join(repo_root, "app/paint/paint_canvas.cpp")).read()
    tools_src = open(os.path.join(repo_root, "app/paint/paint_tools.h")).read()

    # Canvas must call select() in the evMouseDown handler (not just eventMask line).
    # Find the handleEvent body and look for select() near the evMouseDown branch.
    handle_start = canvas_src.find("TPaintCanvasView::handleEvent")
    assert handle_start != -1, "handleEvent not found"
    handle_body = canvas_src[handle_start:]
    mouse_down_pos = handle_body.find("evMouseDown")
    assert mouse_down_pos != -1, "evMouseDown not in handleEvent body"
    nearby = handle_body[mouse_down_pos:mouse_down_pos + 300]
    assert "select()" in nearby, "canvas does not call select() on evMouseDown"

    # Tool panel must bail on keyboard when Text tool is active
    assert "ctx->tool == PaintContext::Text" in tools_src and "return" in tools_src, \
        "tool panel does not yield keyboard when Text tool active"

    # Keyboard handler must NOT gate text input on pixelMode == PixelMode::Text
    # (pixelMode is never set to Text, so that double-gate would silently block all typing)
    handle_start = canvas_src.find("TPaintCanvasView::handleEvent")
    handle_body = canvas_src[handle_start:]
    assert "pixelMode == PixelMode::Text && ctx && ctx->tool == PaintContext::Text" not in handle_body, \
        "keyboard handler still has redundant pixelMode gate that blocks text input"
    print("PASS AC-10: text tool focus implemented")


def test_chat_window_uaf_guard():
    """AC-11: Chat window has windowAlive_ guard to prevent use-after-free on close."""
    repo_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    header = open(os.path.join(repo_root, "app/wibwob_view.h")).read()
    view = open(os.path.join(repo_root, "app/wibwob_view.cpp")).read()

    assert "windowAlive_" in header, "windowAlive_ not declared in wibwob_view.h"
    assert "windowAlive_.store(false)" in view, "windowAlive_ not cleared in destructor"
    assert "windowAlive_.load()" in view, "windowAlive_ not checked in stream callback"
    print("PASS AC-11: chat window use-after-free guard present")


if __name__ == "__main__":
    # Static tests (no app required)
    test_no_debug_colours()
    test_canvas_resize_implemented()
    test_palette_chip_implemented()
    test_paint_rest_endpoints_exist()
    test_mouse_move_handled()
    test_text_tool_focus()
    test_chat_window_uaf_guard()

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
