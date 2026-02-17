#!/usr/bin/env python3
"""WibWob-DOS Instance Monitor — tmux sidebar companion.

Discovers all active WibWob IPC sockets, polls get_state on each,
and renders a compact ANSI dashboard. Zero external dependencies.

Usage:
    python3 tools/monitor/instance_monitor.py [poll_interval_seconds]
"""

import glob
import json
import os
import socket
import sys
import time


def discover_sockets():
    """Find all /tmp/wibwob_*.sock files plus legacy path."""
    socks = sorted(glob.glob("/tmp/wibwob_*.sock"))
    legacy = "/tmp/test_pattern_app.sock"
    if os.path.exists(legacy) and legacy not in socks:
        socks.insert(0, legacy)
    return socks


def probe_instance(sock_path, timeout=2.0):
    """Send get_state to one socket, return parsed dict or error string."""
    try:
        s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        s.settimeout(timeout)
        s.connect(sock_path)
        s.sendall(b"cmd:get_state\n")
        chunks = []
        while True:
            chunk = s.recv(8192)
            if not chunk:
                break
            chunks.append(chunk)
        s.close()
        raw = b"".join(chunks).decode("utf-8", errors="ignore").strip()
        return json.loads(raw)
    except (ConnectionRefusedError, FileNotFoundError):
        return "DEAD"
    except socket.timeout:
        return "TIMEOUT"
    except Exception as e:
        return f"ERROR: {e}"


def render_dashboard(states, term_width=42):
    """Render ANSI dashboard to stdout."""
    print("\033[2J\033[H", end="")
    print(" WibWob Instance Monitor")
    print(" " + "=" * min(term_width, 40))
    print()

    if not states:
        print("  No WibWob sockets found in /tmp/")
        print("  Waiting...")
        print()
        print(f"  Last check: {time.strftime('%H:%M:%S')}")
        return

    for sock_path, state in states.items():
        name = os.path.basename(sock_path).replace(".sock", "")

        if isinstance(state, str):
            print(f"  [{name}] {sock_path}")
            print(f"      Status: {state}")
            print()
            continue

        windows = state.get("windows", [])
        win_count = len(windows)
        print(f"  [{name}] {sock_path}")
        print(f"      Status: \033[32mLIVE\033[0m  | Windows: {win_count}")

        for w in windows[:3]:
            title = w.get("title", "?")[:25]
            print(f"        - {title}")
        if win_count > 3:
            print(f"        ... +{win_count - 3} more")
        print()

    print(f"  Last refresh: {time.strftime('%H:%M:%S')}")


def main():
    interval = float(sys.argv[1]) if len(sys.argv) > 1 else 2.0
    try:
        while True:
            socks = discover_sockets()
            states = {sp: probe_instance(sp) for sp in socks}
            render_dashboard(states)
            time.sleep(interval)
    except KeyboardInterrupt:
        print("\n  Monitor stopped.")


if __name__ == "__main__":
    main()
