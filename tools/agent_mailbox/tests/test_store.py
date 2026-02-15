from __future__ import annotations

import json
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[3]
MAILBOX_DIR = ROOT / "tools" / "agent_mailbox"
if str(MAILBOX_DIR) not in sys.path:
    sys.path.insert(0, str(MAILBOX_DIR))

from store import MailboxStore


def test_send_inbox_ack_roundtrip(tmp_path: Path) -> None:
    store = MailboxStore(tmp_path)
    msg = store.send(
        from_agent="codex",
        to_agent="claude",
        subject="review",
        body_text="done",
        body_path=None,
        thread_id="general",
    )

    unread = store.inbox(agent="claude", unread_only=True)
    assert len(unread) == 1
    assert unread[0].id == msg.id

    store.ack(agent="claude", target_id=msg.id, thread_id="general")

    unread_after = store.inbox(agent="claude", unread_only=True)
    assert unread_after == []

    all_msgs = store.inbox(agent="claude", unread_only=False)
    assert len(all_msgs) == 1


def test_concurrent_append_no_corruption(tmp_path: Path) -> None:
    store = MailboxStore(tmp_path)

    def _send(i: int) -> None:
        store.send(
            from_agent="codex",
            to_agent="claude",
            subject=f"s-{i}",
            body_text=f"body-{i}",
            body_path=None,
            thread_id="concurrency",
        )

    with ThreadPoolExecutor(max_workers=8) as ex:
        list(ex.map(_send, range(50)))

    files = list((tmp_path / "threads").glob("concurrency-*.ndjson"))
    assert files
    lines = [ln for ln in files[0].read_text(encoding="utf-8").splitlines() if ln.strip()]
    assert len(lines) == 50
    for line in lines:
        obj = json.loads(line)
        assert obj["event"] == "message"


def test_blob_roundtrip(tmp_path: Path) -> None:
    store = MailboxStore(tmp_path)
    source = b"hello blob"
    blob_path = store.write_blob(source)
    out = store.read_blob(blob_path)
    assert out == source


def test_read_blob_rejects_paths_outside_blob_root(tmp_path: Path) -> None:
    store = MailboxStore(tmp_path)
    outside = tmp_path / "outside.txt"
    outside.write_text("nope", encoding="utf-8")

    with pytest.raises(ValueError):
        store.read_blob(str(outside))


def test_iter_records_skips_malformed_lines(tmp_path: Path) -> None:
    store = MailboxStore(tmp_path)
    store.send(
        from_agent="codex",
        to_agent="claude",
        subject="good-1",
        body_text="ok",
        body_path=None,
        thread_id="general",
    )
    thread_file = next((tmp_path / "threads").glob("general-*.ndjson"))
    with thread_file.open("a", encoding="utf-8") as f:
        f.write("{bad-json\n")
    store.send(
        from_agent="codex",
        to_agent="claude",
        subject="good-2",
        body_text="ok",
        body_path=None,
        thread_id="general",
    )

    unread = store.inbox(agent="claude", unread_only=True, thread_id="general")
    subjects = [m.subject for m in unread]
    assert "good-1" in subjects
    assert "good-2" in subjects
