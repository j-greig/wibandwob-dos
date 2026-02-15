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
import agent_mailboxd


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
        # Wait for daemon process to stay alive and complete initial startup.
        startup_deadline = time.time() + 2.0
        while time.time() < startup_deadline:
            if daemon.poll() is not None:
                stderr = daemon.stderr.read() if daemon.stderr else ""
                raise AssertionError(f"daemon exited during startup: {stderr}")
            time.sleep(0.05)
            if time.time() - (startup_deadline - 2.0) >= 0.4:
                break

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


def test_notify_agents_for_deltas_targets_only_increased_unread(tmp_path: Path, monkeypatch) -> None:
    store = MailboxStore(tmp_path / "mailbox")
    touched: list[str] = []

    def _fake_touch(root: str | Path, agent: str) -> Path:
        touched.append(agent)
        return Path(root) / "index" / f".new-mail-{agent}"

    monkeypatch.setattr(agent_mailboxd, "touch_sentinel", _fake_touch)
    monkeypatch.setattr(agent_mailboxd, "terminal_bell", lambda: None)
    monkeypatch.setattr(agent_mailboxd, "macos_notification", lambda title, message: True)

    before = {"claude": 1, "codex": 2}
    after = {"claude": 2, "codex": 2, "reviewer": 1}
    agent_mailboxd._notify_agents_for_deltas(
        store, before=before, after=after, title="Agent Mailbox", body="New mailbox event"
    )
    assert touched == ["claude", "reviewer"]
