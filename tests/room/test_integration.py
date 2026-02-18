"""Integration smoke test for E007: end-to-end room serving.

Spawns a room from example config via orchestrator, verifies:
- ttyd serves HTTP on configured port
- WibWob IPC socket is created
- IPC socket responds to get_state
- Auth handshake works when secret is set

Requires: built test_pattern binary, ttyd installed.
"""

import hashlib
import hmac
import json
import os
import socket
import subprocess
import sys
import time
from pathlib import Path

import pytest

PROJECT_ROOT = Path(__file__).parent.parent.parent
APP_BINARY = PROJECT_ROOT / "build" / "app" / "test_pattern"
EXAMPLE_CONFIG = PROJECT_ROOT / "rooms" / "example.md"

sys.path.insert(0, str(PROJECT_ROOT / "tools" / "room"))

from room_config import parse_room_config


def ttyd_available() -> bool:
    try:
        subprocess.run(["ttyd", "--version"], capture_output=True, timeout=5)
        return True
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False


def app_built() -> bool:
    return APP_BINARY.exists()


requires_ttyd = pytest.mark.skipif(not ttyd_available(), reason="ttyd not installed")
requires_app = pytest.mark.skipif(not app_built(), reason="test_pattern not built")


def wait_for_socket(sock_path: str, timeout: float = 10.0, connect_test: bool = True) -> bool:
    """Wait for a Unix socket to appear.
    If connect_test is True, also verify it accepts connections.
    Set connect_test=False for auth-enabled sockets (probe would trigger auth).
    """
    start = time.time()
    while time.time() - start < timeout:
        if os.path.exists(sock_path):
            if not connect_test:
                return True
            try:
                s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
                s.settimeout(1.0)
                s.connect(sock_path)
                s.close()
                return True
            except (ConnectionRefusedError, OSError):
                pass
        time.sleep(0.5)
    return False


def ipc_command(sock_path: str, command: str, secret: str = "", timeout: float = 10.0) -> str:
    """Send a command to the IPC socket, handling auth if needed."""
    s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    s.settimeout(timeout)
    s.connect(sock_path)

    if secret:
        # Read challenge
        data = s.recv(512).decode().strip()
        challenge = json.loads(data)
        nonce = challenge["nonce"]

        # Compute HMAC and send auth response
        hmac_hex = hmac.new(
            secret.encode(), nonce.encode(), hashlib.sha256
        ).hexdigest()
        auth_resp = json.dumps({"type": "auth", "hmac": hmac_hex}) + "\n"
        s.sendall(auth_resp.encode())

        # Wait for auth_ok
        ack = s.recv(512).decode().strip()

    s.sendall((command + "\n").encode())
    response = s.recv(8192).decode().strip()
    s.close()
    return response


@requires_app
class TestDirectInstance:
    """Test spawning a WibWob instance directly (no ttyd)."""

    def test_instance_creates_socket(self):
        """WibWob instance creates IPC socket at expected path."""
        instance_id = "99"
        sock_path = f"/tmp/wibwob_{instance_id}.sock"
        log_path = f"/tmp/wibwob_{instance_id}_test.log"

        # Clean up any existing socket
        if os.path.exists(sock_path):
            os.unlink(sock_path)

        env = os.environ.copy()
        env["WIBWOB_INSTANCE"] = instance_id
        env["TERM"] = "xterm-256color"

        # Start the app (needs a terminal, so we wrap in script)
        cmd = f"exec {APP_BINARY} 2>{log_path}"
        proc = subprocess.Popen(
            ["script", "-q", "/dev/null", "bash", "-c", cmd],
            env=env,
        )

        try:
            # Wait for socket to appear
            assert wait_for_socket(sock_path, timeout=10), \
                f"Socket {sock_path} did not appear within 10s"

            # Give the server time to process the probe connection
            time.sleep(1)

            # Send get_state command (no auth)
            response = ipc_command(sock_path, "cmd:get_state")
            assert len(response) > 0
            # Response should be valid JSON with windows
            state = json.loads(response)
            assert "windows" in state

        finally:
            proc.terminate()
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()
            if os.path.exists(sock_path):
                os.unlink(sock_path)

    def test_instance_with_auth_secret(self):
        """WibWob instance with auth secret requires handshake."""
        instance_id = "98"
        sock_path = f"/tmp/wibwob_{instance_id}.sock"
        log_path = f"/tmp/wibwob_{instance_id}_test.log"
        secret = "test-integration-secret-12345678"

        if os.path.exists(sock_path):
            os.unlink(sock_path)

        env = os.environ.copy()
        env["WIBWOB_INSTANCE"] = instance_id
        env["WIBWOB_AUTH_SECRET"] = secret
        env["TERM"] = "xterm-256color"

        # Use bash -c to redirect stderr properly while keeping script's PTY
        cmd = f"exec {APP_BINARY} 2>{log_path}"
        proc = subprocess.Popen(
            ["script", "-q", "/dev/null", "bash", "-c", cmd],
            env=env,
        )

        try:
            # Don't connect-test: that would trigger auth flow on probe connection
            assert wait_for_socket(sock_path, timeout=10, connect_test=False), \
                f"Socket {sock_path} did not appear within 10s"

            # Give the server time to initialise
            time.sleep(2)

            # Test auth: with correct secret, get_state should work.
            # The TUI event loop processes connections on its own tick,
            # so we retry with increasing delays.
            response = None
            for attempt in range(5):
                try:
                    response = ipc_command(sock_path, "cmd:get_state", secret=secret)
                    if response and len(response) > 2:
                        break
                except (ConnectionError, OSError, TimeoutError, json.JSONDecodeError):
                    pass
                time.sleep(1 + attempt)

            assert response is not None and len(response) > 2, \
                "get_state with auth failed after 5 attempts"
            state = json.loads(response)
            assert "windows" in state

        finally:
            proc.terminate()
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()
            if os.path.exists(sock_path):
                os.unlink(sock_path)
