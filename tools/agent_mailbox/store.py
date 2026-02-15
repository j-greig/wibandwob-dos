from __future__ import annotations

import hashlib
import json
import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

import fcntl

from models import AckEvent, MessageEvent, Record, parse_record


class MailboxStore:
    def __init__(self, root: str | Path) -> None:
        self.root = Path(root)
        self.threads_dir = self.root / "threads"
        self.blobs_dir = self.root / "blobs"
        self.index_dir = self.root / "index"
        self.threads_dir.mkdir(parents=True, exist_ok=True)
        self.blobs_dir.mkdir(parents=True, exist_ok=True)
        self.index_dir.mkdir(parents=True, exist_ok=True)

    def send(
        self,
        from_agent: str,
        to_agent: str,
        subject: str,
        body_text: str | None,
        body_path: str | None,
        thread_id: str = "general",
        priority: str = "medium",
        ref: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> MessageEvent:
        message = MessageEvent(
            **{
                "from": from_agent,
                "to": to_agent,
                "thread_id": thread_id,
                "subject": subject,
                "body_text": body_text,
                "body_path": body_path,
                "priority": priority,
                "ref": ref,
                "metadata": metadata or {},
            }
        )
        self._append_record(message)
        self._write_unread_index(to_agent)
        return message

    def ack(self, agent: str, target_id: str, thread_id: str = "general") -> AckEvent:
        ack = AckEvent(actor=agent, target_id=target_id, thread_id=thread_id)
        self._append_record(ack)
        self._write_unread_index(agent)
        return ack

    def inbox(self, agent: str, thread_id: str | None = None, unread_only: bool = True) -> list[MessageEvent]:
        messages: list[MessageEvent] = []
        acked = self._acked_message_ids(agent=agent, thread_id=thread_id)
        for record in self._iter_records(thread_id=thread_id):
            if isinstance(record, MessageEvent) and record.to_agent == agent:
                if unread_only and record.id in acked:
                    continue
                messages.append(record)
        return messages

    def write_blob(self, data: bytes) -> str:
        digest = hashlib.sha256(data).hexdigest()
        p = self.blobs_dir / digest
        if not p.exists():
            p.write_bytes(data)
        return str(p)

    def read_blob(self, path: str | Path) -> bytes:
        requested = Path(path)
        candidate = requested if requested.is_absolute() else (self.blobs_dir / requested)
        resolved = candidate.resolve()
        root_resolved = self.blobs_dir.resolve()
        if root_resolved not in resolved.parents and resolved != root_resolved:
            raise ValueError("blob path must stay within mailbox blobs directory")
        if not resolved.exists():
            raise FileNotFoundError(str(resolved))
        return resolved.read_bytes()

    def list_agents(self, thread_id: str | None = None) -> set[str]:
        agents: set[str] = set()
        for record in self._iter_records(thread_id=thread_id):
            if isinstance(record, MessageEvent):
                agents.add(record.from_agent)
                agents.add(record.to_agent)
            elif isinstance(record, AckEvent):
                agents.add(record.actor)
        return agents

    def refresh_unread_indices(self, agents: set[str] | None = None) -> None:
        target_agents = agents or self.list_agents()
        for agent in sorted(target_agents):
            self._write_unread_index(agent)

    def _thread_path(self, thread_id: str, ts: datetime) -> Path:
        day = ts.astimezone(timezone.utc).strftime("%Y%m%d")
        return self.threads_dir / f"{thread_id}-{day}.ndjson"

    def _append_record(self, record: Record) -> None:
        ts = record.ts if isinstance(record.ts, datetime) else datetime.now(timezone.utc)
        target = self._thread_path(record.thread_id, ts)
        payload = record.model_dump_json(by_alias=True, exclude_none=True) + "\n"
        self._safe_append_line(target, payload.encode("utf-8"))

    def _safe_append_line(self, target: Path, payload: bytes) -> None:
        target.parent.mkdir(parents=True, exist_ok=True)
        fd = os.open(str(target), os.O_APPEND | os.O_CREAT | os.O_WRONLY, 0o644)
        try:
            fcntl.flock(fd, fcntl.LOCK_EX)
            offset = 0
            while offset < len(payload):
                written = os.write(fd, payload[offset:])
                if written <= 0:
                    raise OSError("short write while appending mailbox record")
                offset += written
            os.fsync(fd)
        finally:
            try:
                fcntl.flock(fd, fcntl.LOCK_UN)
            finally:
                os.close(fd)

        # fsync directory metadata after append to tighten durability guarantees.
        dir_fd = os.open(str(target.parent), os.O_RDONLY)
        try:
            os.fsync(dir_fd)
        finally:
            os.close(dir_fd)

    def _thread_files(self, thread_id: str | None = None) -> list[Path]:
        files = sorted(self.threads_dir.glob("*.ndjson"))
        if thread_id:
            files = [p for p in files if p.name.startswith(f"{thread_id}-")]
        return files

    def _iter_records(self, thread_id: str | None = None) -> Iterable[Record]:
        for path in self._thread_files(thread_id=thread_id):
            for line in path.read_text(encoding="utf-8").splitlines():
                if not line.strip():
                    continue
                try:
                    yield parse_record(json.loads(line))
                except (json.JSONDecodeError, ValueError):
                    # Keep mailbox readable even if one line is corrupted.
                    continue

    def _acked_message_ids(self, agent: str, thread_id: str | None = None) -> set[str]:
        acked: set[str] = set()
        for record in self._iter_records(thread_id=thread_id):
            if isinstance(record, AckEvent) and record.actor == agent:
                acked.add(record.target_id)
        return acked

    def _write_unread_index(self, agent: str) -> None:
        unread = [m.id for m in self.inbox(agent=agent, unread_only=True)]
        payload = {
            "agent": agent,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "unread_ids": unread,
            "count": len(unread),
        }
        out = self.index_dir / f"unread-{agent}.json"
        with tempfile.NamedTemporaryFile(
            mode="w", encoding="utf-8", dir=str(self.index_dir), prefix=f"{out.name}.", delete=False
        ) as tmp:
            tmp.write(json.dumps(payload, indent=2))
            tmp.flush()
            os.fsync(tmp.fileno())
            tmp_name = tmp.name

        os.replace(tmp_name, out)
        dir_fd = os.open(str(self.index_dir), os.O_RDONLY)
        try:
            os.fsync(dir_fd)
        finally:
            os.close(dir_fd)
