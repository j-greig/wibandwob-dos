#!/usr/bin/env python3
"""Integration tests for BrowserWindow IPC commands.

Requires a running TUI app (./build/app/test_pattern) and API server.

AC-1: create_window type=browser → get_state shows browser window
AC-3: browser_fetch url=<url> → response ok
"""

import json
import os
import socket
import sys
import time


def _sock_path():
    inst = os.environ.get("WIBWOB_INSTANCE")
    if inst:
        return f"/tmp/wibwob_{inst}.sock"
    return "/tmp/test_pattern_app.sock"


SOCK_PATH = _sock_path()


def send_ipc(cmd: str) -> str:
    """Send an IPC command and return the response."""
    s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    s.settimeout(5.0)
    s.connect(SOCK_PATH)
    s.sendall((cmd + "\n").encode("utf-8"))
    data = s.recv(8192)
    s.close()
    return data.decode("utf-8", errors="ignore").strip()


def test_ac1_create_browser_window():
    """AC-1: create_window type=browser opens a BrowserWindow visible in get_state."""
    print("AC-1: Testing create_window type=browser ...")

    # Create browser window
    resp = send_ipc("cmd:create_window type=browser")
    assert resp == "ok", f"Expected 'ok', got: {resp}"
    print(f"  create_window response: {resp}")

    # Small delay for window to be inserted
    time.sleep(0.2)

    # Check get_state
    state_resp = send_ipc("cmd:get_state")
    print(f"  get_state response: {state_resp[:200]}...")

    # Parse JSON and check for a window (browser window will have title "Browser")
    state = json.loads(state_resp)
    windows = state.get("windows", [])
    browser_windows = [w for w in windows if "Browser" in w.get("title", "")]
    assert len(browser_windows) > 0, f"No browser window found in state. Windows: {windows}"
    print(f"  Found {len(browser_windows)} browser window(s)")
    print("AC-1: PASS")


def test_ac3_browser_fetch():
    """AC-3: browser_fetch url=<url> triggers fetch on browser window."""
    print("\nAC-3: Testing browser_fetch IPC command ...")

    # Ensure a browser window exists (may already exist from AC-1 test)
    send_ipc("cmd:create_window type=browser")
    time.sleep(0.2)

    # Send fetch command
    resp = send_ipc("cmd:browser_fetch url=https://example.com")
    print(f"  browser_fetch response: {resp}")
    assert resp == "ok", f"Expected 'ok', got: {resp}"
    print("AC-3: PASS")


def main():
    print(f"Connecting to IPC socket: {SOCK_PATH}\n")
    try:
        test_ac1_create_browser_window()
        test_ac3_browser_fetch()
        print("\n=== All IPC integration tests passed ===")
    except ConnectionRefusedError:
        print(f"\nERROR: Could not connect to {SOCK_PATH}")
        print("Make sure the TUI app is running: ./build/app/test_pattern")
        sys.exit(1)
    except AssertionError as e:
        print(f"\nFAILED: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\nERROR: {type(e).__name__}: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
