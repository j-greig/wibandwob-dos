from __future__ import annotations

import json
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
MAILBOX_DIR = ROOT / "tools" / "agent_mailbox"
if str(MAILBOX_DIR) not in sys.path:
    sys.path.insert(0, str(MAILBOX_DIR))

from store import MailboxStore


def test_daemon_touches_sentinel_within_sla(tmp_path: Path) -> None:
    root = tmp_path / "mailbox"
    store = MailboxStore(root)

    daemon = subprocess.Popen(
        [
            sys.executable,
            str(MAILBOX_DIR / "agent_mailboxd.py"),
            "--root",
            str(root),
            "--poll-interval",
            "0.1",
        ],
        cwd=str(ROOT),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )

    try:
        # Warm-up small delay so daemon has initial snapshot.
        time.sleep(0.2)
        start = time.time()
        msg = store.send(
            from_agent="codex",
            to_agent="claude",
            subject="latency",
            body_text="ping",
            body_path=None,
            thread_id="general",
        )
        assert msg.id

        sentinel = root / "index" / ".new-mail-claude"
        deadline = start + 2.0
        while time.time() < deadline:
            if sentinel.exists():
                assert sentinel.stat().st_mtime >= start
                break
            time.sleep(0.05)
        else:
            # Include debug snapshot for failure diagnosis.
            unread = root / "index" / "unread-claude.json"
            details = unread.read_text(encoding="utf-8") if unread.exists() else "{}"
            raise AssertionError(f"sentinel not touched within SLA; unread={details}")
    finally:
        daemon.terminate()
        daemon.wait(timeout=2)
