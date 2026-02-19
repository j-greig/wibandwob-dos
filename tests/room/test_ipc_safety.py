"""Tests for IPC socket safety (probe-before-unlink).

These tests verify the socket probe logic independently of the TUI app,
using a minimal Python socket server to simulate live/stale sockets.
"""

import os
import socket
import tempfile
import threading
import time
import uuid

import pytest


def short_sock_path(name: str) -> str:
    """Generate a short /tmp/ socket path (Unix sockets have 104 char limit on macOS)."""
    return f"/tmp/ww_test_{name}_{uuid.uuid4().hex[:8]}.sock"


def create_unix_listener(path: str) -> socket.socket:
    """Create a listening Unix socket at path."""
    if os.path.exists(path):
        os.unlink(path)
    sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    sock.bind(path)
    sock.listen(1)
    return sock


def probe_socket_live(path: str) -> bool:
    """Python equivalent of the C++ probe_socket_live function."""
    try:
        sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        sock.connect(path)
        sock.close()
        return True
    except (ConnectionRefusedError, FileNotFoundError, OSError):
        return False


class TestProbeSocketLive:
    """Test the probe logic that determines if a socket has a live listener."""

    def test_live_socket_detected(self):
        """A socket with an active listener should be detected as live."""
        sock_path = short_sock_path("live")
        listener = create_unix_listener(sock_path)
        try:
            assert probe_socket_live(sock_path) is True
        finally:
            listener.close()
            os.unlink(sock_path)

    def test_stale_socket_detected(self):
        """A socket file with no listener should be detected as stale."""
        sock_path = short_sock_path("stale")
        # Create then immediately close — leaves orphan file
        listener = create_unix_listener(sock_path)
        listener.close()
        # Socket file exists but no one is listening
        assert os.path.exists(sock_path)
        assert probe_socket_live(sock_path) is False

    def test_nonexistent_socket(self):
        """A nonexistent path should be detected as not live."""
        sock_path = short_sock_path("nope")
        assert probe_socket_live(sock_path) is False

    def test_regular_file_not_live(self):
        """A regular file (not a socket) should not be detected as live."""
        path = short_sock_path("notsock") + ".txt"
        with open(path, "w") as f:
            f.write("hello")
        assert probe_socket_live(path) is False


class TestSocketConflictScenario:
    """Integration-style tests simulating the unlink race scenario."""

    def test_second_bind_fails_when_first_is_live(self):
        """If socket A is live, attempting to bind socket B on same path should detect conflict."""
        sock_path = short_sock_path("shared")

        # Instance A starts listening
        listener_a = create_unix_listener(sock_path)
        try:
            # Instance B checks before binding — should detect live socket
            assert probe_socket_live(sock_path) is True
            # Instance B should NOT unlink and rebind
        finally:
            listener_a.close()
            if os.path.exists(sock_path):
                os.unlink(sock_path)

    def test_safe_takeover_of_stale_socket(self):
        """If socket is stale, new instance can safely clean up and bind."""
        sock_path = short_sock_path("staletk")

        # Instance A starts and then crashes (socket file remains)
        listener_a = create_unix_listener(sock_path)
        listener_a.close()  # Simulate crash

        assert os.path.exists(sock_path)
        assert probe_socket_live(sock_path) is False

        # Instance B can safely clean up stale socket and bind
        os.unlink(sock_path)
        listener_b = create_unix_listener(sock_path)
        try:
            assert probe_socket_live(sock_path) is True
        finally:
            listener_b.close()
            if os.path.exists(sock_path):
                os.unlink(sock_path)

    def test_concurrent_probe_during_accept(self):
        """Probe should work even if the listener is busy accepting."""
        sock_path = short_sock_path("busy")
        listener = create_unix_listener(sock_path)

        # Simulate a busy listener by connecting a client
        client = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        client.connect(sock_path)
        conn, _ = listener.accept()

        try:
            # Probe should still detect the socket as live
            assert probe_socket_live(sock_path) is True
        finally:
            conn.close()
            client.close()
            listener.close()
            if os.path.exists(sock_path):
                os.unlink(sock_path)
