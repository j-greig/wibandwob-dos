#!/usr/bin/env python3
import os
import socket
import time


def _sock_path():
    inst = os.environ.get("WIBWOB_INSTANCE")
    if inst:
        return f"/tmp/wibwob_{inst}.sock"
    return "/tmp/test_pattern_app.sock"


def test_ipc_connection():
    """Test direct IPC connection to debug the issue"""
    sock_path = _sock_path()
    
    print(f"Testing connection to {sock_path}")
    
    try:
        s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        print("Socket created successfully")
        
        print("Attempting to connect...")
        s.connect(sock_path)
        print("Connected successfully!")
        
        # Send a simple command
        cmd = "cmd:get_state\n"
        print(f"Sending command: {cmd.strip()}")
        s.sendall(cmd.encode("utf-8"))
        
        # Read response
        print("Waiting for response...")
        data = s.recv(4096)
        response = data.decode("utf-8", errors="ignore")
        print(f"Response: {response}")
        
        s.close()
        print("Test completed successfully")
        
    except Exception as e:
        print(f"Error: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_ipc_connection()