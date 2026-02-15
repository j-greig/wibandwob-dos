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
        return Path(path).read_bytes()

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

        with tempfile.NamedTemporaryFile(prefix=".tmp-", dir=str(target.parent), delete=False) as tmp:
            tmp.write(payload)
            tmp.flush()
            os.fsync(tmp.fileno())
            tmp_name = tmp.name

        fd = os.open(str(target), os.O_APPEND | os.O_CREAT | os.O_WRONLY, 0o644)
        try:
            fcntl.flock(fd, fcntl.LOCK_EX)
            os.write(fd, payload)
            os.fsync(fd)
        finally:
            fcntl.flock(fd, fcntl.LOCK_UN)
            os.close(fd)
            try:
                os.unlink(tmp_name)
            except FileNotFoundError:
                pass

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
                yield parse_record(json.loads(line))

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
        out.write_text(json.dumps(payload, indent=2), encoding="utf-8")
