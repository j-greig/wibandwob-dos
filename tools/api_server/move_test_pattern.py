#!/usr/bin/env python3
import socket
import json

def send_ipc_cmd(cmd_str):
    """Send command directly to IPC socket"""
    sock_path = "/tmp/test_pattern_app.sock"
    s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    try:
        s.connect(sock_path)
        s.sendall((cmd_str + "\n").encode("utf-8"))
        response = s.recv(4096).decode("utf-8", errors="ignore")
        return response.strip()
    finally:
        s.close()

print("Getting current window state...")
state = send_ipc_cmd("cmd:get_state")
print(f"Current state: {state}")

data = json.loads(state)
test_pattern_window = None

# Find the "Test Pattern 1" window
for window in data.get("windows", []):
    if "Test Pattern 1" in window["title"]:
        test_pattern_window = window
        break

if test_pattern_window:
    current_x = test_pattern_window["x"]
    current_y = test_pattern_window["y"]
    win_id = test_pattern_window["id"]
    
    new_x = current_x + 20  # Move 20 characters to the right
    
    print(f"Found Test Pattern 1 window: {win_id}")
    print(f"Current position: ({current_x}, {current_y})")
    print(f"Moving to: ({new_x}, {current_y})")
    
    # Move the window
    cmd = f"cmd:move_window id={win_id} x={new_x} y={current_y}"
    result = send_ipc_cmd(cmd)
    print(f"Move result: {result}")
    
    # Verify the move
    final_state = send_ipc_cmd("cmd:get_state")
    final_data = json.loads(final_state)
    
    for window in final_data.get("windows", []):
        if "Test Pattern 1" in window["title"]:
            print(f"Final position: ({window['x']}, {window['y']})")
            break
else:
    print("Test Pattern 1 window not found!")