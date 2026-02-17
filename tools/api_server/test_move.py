#!/usr/bin/env python3
import os
import socket
import time


def _sock_path():
    inst = os.environ.get("WIBWOB_INSTANCE")
    if inst:
        return f"/tmp/wibwob_{inst}.sock"
    return "/tmp/test_pattern_app.sock"


def send_ipc_cmd(cmd_str):
    """Send command directly to IPC socket"""
    sock_path = _sock_path()
    s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    try:
        s.connect(sock_path)
        s.sendall((cmd_str + "\n").encode("utf-8"))
        response = s.recv(4096).decode("utf-8", errors="ignore")
        return response.strip()
    finally:
        s.close()

# Test rapid window movements
print("Getting initial state...")
state = send_ipc_cmd("cmd:get_state")
print(f"State: {state}")

# Try to move a window quickly
if "w" in state:
    import json
    data = json.loads(state)
    if data.get("windows"):
        win_id = data["windows"][0]["id"]
        print(f"Moving window {win_id}...")
        
        # Move to different positions rapidly
        positions = [(20, 10), (40, 15), (60, 20), (10, 25), (30, 5)]
        
        for x, y in positions:
            cmd = f"cmd:move_window id={win_id} x={x} y={y}"
            print(f"Sending: {cmd}")
            result = send_ipc_cmd(cmd)
            print(f"Result: {result}")
            time.sleep(0.2)
        
        # Check final state
        final_state = send_ipc_cmd("cmd:get_state")
        print(f"Final state: {final_state}")