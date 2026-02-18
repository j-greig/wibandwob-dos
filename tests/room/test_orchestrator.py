"""Tests for room orchestrator.

Unit tests covering config loading, conflict detection, secret generation,
and state management. Does not spawn actual ttyd/WibWob processes.
"""

import json
import os
import socket
import sys
import tempfile
import time
import uuid
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent.parent / "tools" / "room"))

from orchestrator import Orchestrator, RoomProcess
from room_config import RoomConfig


def make_config(room_id="test", instance_id=1, ttyd_port=7681) -> RoomConfig:
    """Create a minimal RoomConfig for testing."""
    return RoomConfig(
        room_id=room_id,
        instance_id=instance_id,
        ttyd_port=ttyd_port,
    )


def write_room_md(path: Path, room_id: str, instance_id: int, ttyd_port: int) -> Path:
    """Write a minimal room config markdown file."""
    content = f"""---
room_id: {room_id}
instance_id: {instance_id}
ttyd_port: {ttyd_port}
---

# {room_id}

## System Prompt

Test prompt.
"""
    path.write_text(content)
    return path


class TestOrchestratorInit:
    def test_creates_empty(self):
        orch = Orchestrator()
        assert orch.rooms == {}

    def test_custom_project_root(self, tmp_path):
        orch = Orchestrator(project_root=tmp_path)
        assert orch.project_root == tmp_path


class TestSecretGeneration:
    def test_secret_is_hex(self):
        orch = Orchestrator()
        secret = orch.generate_secret()
        assert len(secret) == 64  # 32 bytes = 64 hex chars
        int(secret, 16)  # should not raise

    def test_secrets_are_unique(self):
        orch = Orchestrator()
        secrets_set = {orch.generate_secret() for _ in range(100)}
        assert len(secrets_set) == 100


class TestConfigLoading:
    def test_load_valid_config(self, tmp_path):
        orch = Orchestrator()
        config_path = tmp_path / "room.md"
        write_room_md(config_path, "test-room", 1, 7681)
        configs = orch.load_configs([config_path])
        assert len(configs) == 1
        assert configs[0].room_id == "test-room"

    def test_skip_invalid_config(self, tmp_path):
        orch = Orchestrator()
        bad = tmp_path / "bad.md"
        bad.write_text("# no frontmatter\n")
        configs = orch.load_configs([bad])
        assert len(configs) == 0

    def test_load_multiple_configs(self, tmp_path):
        orch = Orchestrator()
        paths = []
        for i in range(3):
            p = tmp_path / f"room{i}.md"
            write_room_md(p, f"room-{i}", i + 1, 7681 + i)
            paths.append(p)
        configs = orch.load_configs(paths)
        assert len(configs) == 3


class TestRoomProcess:
    def test_sock_path(self):
        config = make_config(instance_id=5)
        room = RoomProcess(config=config)
        assert room.sock_path == "/tmp/wibwob_5.sock"

    def test_not_running_when_no_proc(self):
        config = make_config()
        room = RoomProcess(config=config)
        assert room.is_running is False

    def test_running_with_mock_proc(self):
        config = make_config()
        mock_proc = MagicMock()
        mock_proc.poll.return_value = None  # still running
        room = RoomProcess(config=config, ttyd_proc=mock_proc)
        assert room.is_running is True

    def test_not_running_after_exit(self):
        config = make_config()
        mock_proc = MagicMock()
        mock_proc.poll.return_value = 0  # exited
        room = RoomProcess(config=config, ttyd_proc=mock_proc)
        assert room.is_running is False


class TestHealthCheck:
    def test_empty_rooms(self):
        orch = Orchestrator()
        assert orch.health_check() == {}

    def test_dead_process_unhealthy(self):
        orch = Orchestrator()
        config = make_config()
        mock_proc = MagicMock()
        mock_proc.poll.return_value = 1  # exited with error
        room = RoomProcess(config=config, ttyd_proc=mock_proc)
        orch.rooms["test"] = room
        health = orch.health_check()
        assert health["test"] is False

    def test_no_proc_unhealthy(self):
        orch = Orchestrator()
        config = make_config()
        room = RoomProcess(config=config)  # no proc
        orch.rooms["test"] = room
        health = orch.health_check()
        assert health["test"] is False


class TestProbeSocket:
    def test_probe_live_socket(self):
        """Probe should detect a live listener."""
        sock_path = f"/tmp/ww_orch_test_{uuid.uuid4().hex[:8]}.sock"
        orch = Orchestrator()

        # Create a simple listener that responds
        server = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        server.bind(sock_path)
        server.listen(1)

        import threading

        def accept_one():
            conn, _ = server.accept()
            conn.recv(1024)
            conn.sendall(b'{"ok":true}\n')
            conn.close()

        t = threading.Thread(target=accept_one)
        t.start()

        try:
            assert orch.probe_socket(sock_path) is True
        finally:
            t.join(timeout=2)
            server.close()
            if os.path.exists(sock_path):
                os.unlink(sock_path)

    def test_probe_nonexistent_socket(self):
        orch = Orchestrator()
        assert orch.probe_socket("/tmp/ww_nonexistent_test.sock") is False


class TestSaveState:
    def test_save_and_read_state(self):
        orch = Orchestrator()
        orch._state_file = Path(tempfile.mktemp(suffix=".json"))

        config = make_config(room_id="demo", instance_id=3, ttyd_port=9999)
        mock_proc = MagicMock()
        mock_proc.pid = 12345
        mock_proc.poll.return_value = None
        room = RoomProcess(config=config, ttyd_proc=mock_proc, start_time=time.time())
        orch.rooms["demo"] = room

        try:
            orch.save_state()
            assert orch._state_file.exists()

            state = json.loads(orch._state_file.read_text())
            assert "demo" in state["rooms"]
            assert state["rooms"]["demo"]["pid"] == 12345
            assert state["rooms"]["demo"]["ttyd_port"] == 9999
            assert state["rooms"]["demo"]["instance_id"] == 3
        finally:
            if orch._state_file.exists():
                orch._state_file.unlink()


class TestConflictDetection:
    """Test that the orchestrator detects port and instance conflicts."""

    def test_duplicate_ports_detected(self, tmp_path):
        """Two rooms with same ttyd_port should be caught."""
        p1 = tmp_path / "a.md"
        p2 = tmp_path / "b.md"
        write_room_md(p1, "room-a", 1, 7681)
        write_room_md(p2, "room-b", 2, 7681)  # same port

        orch = Orchestrator()
        configs = orch.load_configs([p1, p2])
        assert len(configs) == 2

        # Check for conflict
        ports = {}
        conflicts = []
        for c in configs:
            if c.ttyd_port in ports:
                conflicts.append(f"Port {c.ttyd_port}: {ports[c.ttyd_port]} vs {c.room_id}")
            ports[c.ttyd_port] = c.room_id
        assert len(conflicts) == 1

    def test_duplicate_instances_detected(self, tmp_path):
        """Two rooms with same instance_id should be caught."""
        p1 = tmp_path / "a.md"
        p2 = tmp_path / "b.md"
        write_room_md(p1, "room-a", 1, 7681)
        write_room_md(p2, "room-b", 1, 7682)  # same instance

        orch = Orchestrator()
        configs = orch.load_configs([p1, p2])

        instances = {}
        conflicts = []
        for c in configs:
            if c.instance_id in instances:
                conflicts.append(f"Instance {c.instance_id}: {instances[c.instance_id]} vs {c.room_id}")
            instances[c.instance_id] = c.room_id
        assert len(conflicts) == 1
