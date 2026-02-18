#!/usr/bin/env python3
"""Room orchestrator for WibWob-DOS teleport rooms.

Reads room configs (markdown + YAML frontmatter), spawns ttyd+WibWob
instance pairs, manages lifecycle (health check, restart on failure),
generates shared secrets for agent auth.

Usage:
    ./tools/room/orchestrator.py start rooms/*.md
    ./tools/room/orchestrator.py stop
    ./tools/room/orchestrator.py status
"""

import argparse
import json
import os
import secrets
import signal
import socket
import subprocess
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from room_config import RoomConfig, parse_room_config

# Project root (orchestrator runs from repo root)
PROJECT_ROOT = Path(__file__).parent.parent.parent


@dataclass
class RoomProcess:
    """Tracks a running room (ttyd + WibWob instance)."""

    config: RoomConfig
    ttyd_proc: Optional[subprocess.Popen] = None
    auth_secret: str = ""
    start_time: float = 0.0
    restart_count: int = 0

    @property
    def sock_path(self) -> str:
        return f"/tmp/wibwob_{self.config.instance_id}.sock"

    @property
    def is_running(self) -> bool:
        return self.ttyd_proc is not None and self.ttyd_proc.poll() is None


class Orchestrator:
    """Manages room lifecycle."""

    def __init__(self, project_root: Path = PROJECT_ROOT):
        self.project_root = project_root
        self.rooms: dict[str, RoomProcess] = {}
        self._running = False
        self._state_file = Path("/tmp/wibwob_orchestrator.json")

    def load_configs(self, config_paths: list[Path]) -> list[RoomConfig]:
        """Parse and validate room configs."""
        configs = []
        for path in config_paths:
            try:
                config = parse_room_config(path, check_files=False)
                configs.append(config)
                print(f"[orch] Loaded: {config.room_id} (instance={config.instance_id}, port={config.ttyd_port})")
            except ValueError as e:
                print(f"[orch] SKIP: {path}: {e}", file=sys.stderr)
        return configs

    def generate_secret(self) -> str:
        """Generate a 32-byte hex shared secret for agent auth."""
        return secrets.token_hex(32)

    def spawn_room(self, config: RoomConfig) -> RoomProcess:
        """Spawn a ttyd+WibWob pair for a room config."""
        auth_secret = self.generate_secret()

        # Build environment for the WibWob instance
        env = os.environ.copy()
        env["WIBWOB_INSTANCE"] = str(config.instance_id)
        env["WIBWOB_AUTH_SECRET"] = auth_secret
        env["TERM"] = "xterm-256color"

        if config.layout_path:
            layout_abs = str(self.project_root / config.layout_path)
            env["WIBWOB_LAYOUT_PATH"] = layout_abs

        # Build ttyd command
        app_path = str(self.project_root / "build" / "app" / "test_pattern")
        log_path = f"/tmp/wibwob_{config.instance_id}.log"

        ttyd_cmd = [
            "ttyd",
            "--port", str(config.ttyd_port),
            "--writable",
            "-t", "fontSize=14",
            "-t", f'theme={{"background":"#000000"}}',
            "--",
            "bash", "-c",
            f"cd {self.project_root} && exec {app_path} 2>{log_path}",
        ]

        print(f"[orch] Spawning {config.room_id}: ttyd :{config.ttyd_port} -> instance {config.instance_id}")

        proc = subprocess.Popen(
            ttyd_cmd,
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )

        room = RoomProcess(
            config=config,
            ttyd_proc=proc,
            auth_secret=auth_secret,
            start_time=time.time(),
        )
        self.rooms[config.room_id] = room
        return room

    def probe_socket(self, sock_path: str) -> bool:
        """Check if a WibWob IPC socket is responding."""
        try:
            s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
            s.settimeout(2.0)
            s.connect(sock_path)
            s.sendall(b"cmd:get_state\n")
            data = s.recv(4096)
            s.close()
            return len(data) > 0
        except (ConnectionRefusedError, FileNotFoundError, OSError, TimeoutError):
            return False

    def health_check(self) -> dict[str, bool]:
        """Check health of all rooms. Returns room_id -> healthy."""
        results = {}
        for room_id, room in self.rooms.items():
            if not room.is_running:
                results[room_id] = False
                continue

            # Check if ttyd process is alive
            if room.ttyd_proc.poll() is not None:
                results[room_id] = False
                continue

            # Check if IPC socket responds
            results[room_id] = self.probe_socket(room.sock_path)
        return results

    def restart_room(self, room_id: str) -> bool:
        """Restart a failed room."""
        if room_id not in self.rooms:
            return False

        room = self.rooms[room_id]
        print(f"[orch] Restarting {room_id} (restart #{room.restart_count + 1})")

        # Kill existing process if still running
        if room.ttyd_proc and room.ttyd_proc.poll() is None:
            room.ttyd_proc.terminate()
            try:
                room.ttyd_proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                room.ttyd_proc.kill()

        # Respawn
        new_room = self.spawn_room(room.config)
        new_room.restart_count = room.restart_count + 1
        return True

    def stop_room(self, room_id: str):
        """Stop a specific room."""
        if room_id not in self.rooms:
            return
        room = self.rooms[room_id]
        if room.ttyd_proc and room.ttyd_proc.poll() is None:
            print(f"[orch] Stopping {room_id}")
            room.ttyd_proc.terminate()
            try:
                room.ttyd_proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                room.ttyd_proc.kill()
        del self.rooms[room_id]

    def stop_all(self):
        """Stop all rooms."""
        for room_id in list(self.rooms.keys()):
            self.stop_room(room_id)

    def save_state(self):
        """Save orchestrator state to file for status command."""
        state = {
            "rooms": {
                room_id: {
                    "room_id": room.config.room_id,
                    "instance_id": room.config.instance_id,
                    "ttyd_port": room.config.ttyd_port,
                    "pid": room.ttyd_proc.pid if room.ttyd_proc else None,
                    "running": room.is_running,
                    "start_time": room.start_time,
                    "restart_count": room.restart_count,
                    "sock_path": room.sock_path,
                }
                for room_id, room in self.rooms.items()
            },
            "timestamp": time.time(),
        }
        self._state_file.write_text(json.dumps(state, indent=2))

    def run_loop(self, health_interval: float = 10.0):
        """Main loop: health check and restart failed rooms."""
        self._running = True

        def handle_signal(signum, frame):
            print(f"\n[orch] Signal {signum} received, shutting down...")
            self._running = False

        signal.signal(signal.SIGINT, handle_signal)
        signal.signal(signal.SIGTERM, handle_signal)

        print(f"[orch] Running with {len(self.rooms)} room(s). Health check every {health_interval}s.")
        print(f"[orch] Ctrl+C to stop.")

        while self._running:
            time.sleep(health_interval)
            if not self._running:
                break

            health = self.health_check()
            self.save_state()

            for room_id, healthy in health.items():
                if not healthy:
                    room = self.rooms.get(room_id)
                    if room and room.restart_count < 5:
                        self.restart_room(room_id)
                    elif room:
                        print(f"[orch] {room_id} exceeded max restarts (5), leaving stopped.")

        self.stop_all()
        if self._state_file.exists():
            self._state_file.unlink()
        print("[orch] Shutdown complete.")


def cmd_start(args):
    """Start rooms from config files."""
    orch = Orchestrator()
    config_paths = [Path(p) for p in args.configs]
    configs = orch.load_configs(config_paths)

    if not configs:
        print("[orch] No valid configs found.", file=sys.stderr)
        sys.exit(1)

    # Check for port/instance conflicts
    ports = {}
    instances = {}
    for c in configs:
        if c.ttyd_port in ports:
            print(f"[orch] ERROR: Port {c.ttyd_port} used by both {ports[c.ttyd_port]} and {c.room_id}", file=sys.stderr)
            sys.exit(1)
        if c.instance_id in instances:
            print(f"[orch] ERROR: Instance {c.instance_id} used by both {instances[c.instance_id]} and {c.room_id}", file=sys.stderr)
            sys.exit(1)
        ports[c.ttyd_port] = c.room_id
        instances[c.instance_id] = c.room_id

    for config in configs:
        orch.spawn_room(config)

    # Give processes a moment to start
    time.sleep(1)
    orch.save_state()

    if args.once:
        # Single health check then exit (for testing)
        time.sleep(2)
        health = orch.health_check()
        for room_id, healthy in health.items():
            status = "OK" if healthy else "FAIL"
            room = orch.rooms[room_id]
            print(f"  {room_id}: {status} (pid={room.ttyd_proc.pid if room.ttyd_proc else '?'}, port={room.config.ttyd_port})")
        orch.stop_all()
    else:
        orch.run_loop(health_interval=args.interval)


def cmd_status(args):
    """Show status of running rooms."""
    state_file = Path("/tmp/wibwob_orchestrator.json")
    if not state_file.exists():
        print("[orch] No orchestrator running.")
        return

    state = json.loads(state_file.read_text())
    print(f"Rooms ({len(state['rooms'])}):")
    for room_id, info in state["rooms"].items():
        status = "running" if info["running"] else "stopped"
        uptime = time.time() - info["start_time"]
        print(f"  {room_id}: {status} pid={info['pid']} port={info['ttyd_port']} uptime={uptime:.0f}s restarts={info['restart_count']}")


def cmd_stop(args):
    """Signal running orchestrator to stop."""
    state_file = Path("/tmp/wibwob_orchestrator.json")
    if not state_file.exists():
        print("[orch] No orchestrator running.")
        return

    state = json.loads(state_file.read_text())
    for room_id, info in state["rooms"].items():
        pid = info.get("pid")
        if pid:
            try:
                os.kill(pid, signal.SIGTERM)
                print(f"[orch] Sent SIGTERM to {room_id} (pid={pid})")
            except ProcessLookupError:
                print(f"[orch] {room_id} (pid={pid}) already dead")
    state_file.unlink()


def main():
    parser = argparse.ArgumentParser(description="WibWob room orchestrator")
    sub = parser.add_subparsers(dest="command")

    p_start = sub.add_parser("start", help="Start rooms from config files")
    p_start.add_argument("configs", nargs="+", help="Room config .md files")
    p_start.add_argument("--once", action="store_true", help="Single health check then exit (for testing)")
    p_start.add_argument("--interval", type=float, default=10.0, help="Health check interval in seconds")
    p_start.set_defaults(func=cmd_start)

    p_status = sub.add_parser("status", help="Show running room status")
    p_status.set_defaults(func=cmd_status)

    p_stop = sub.add_parser("stop", help="Stop running rooms")
    p_stop.set_defaults(func=cmd_stop)

    args = parser.parse_args()
    if not args.command:
        parser.print_help()
        sys.exit(1)

    args.func(args)


if __name__ == "__main__":
    main()
