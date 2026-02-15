from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
CLI = ROOT / "tools" / "agent_mailbox" / "agent_mail.py"


def _run(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(CLI), *args],
        cwd=str(ROOT),
        capture_output=True,
        text=True,
        check=True,
    )


def test_cli_send_inbox_ack(tmp_path: Path) -> None:
    root = str(tmp_path)

    send = _run(
        "send",
        "--root",
        root,
        "--from",
        "codex",
        "--to",
        "claude",
        "--subject",
        "hello",
        "--body-text",
        "ping",
    )
    msg = json.loads(send.stdout)

    inbox = _run("inbox", "--root", root, "--agent", "claude", "--json")
    arr = json.loads(inbox.stdout)
    assert len(arr) == 1
    assert arr[0]["id"] == msg["id"]

    _run("ack", "--root", root, "--agent", "claude", "--id", msg["id"])

    inbox_after = _run("inbox", "--root", root, "--agent", "claude", "--json")
    arr_after = json.loads(inbox_after.stdout)
    assert arr_after == []


def test_cli_inbox_strips_control_sequences_in_text_mode(tmp_path: Path) -> None:
    root = str(tmp_path)
    raw_subject = "hello\x1b[31m-red"
    _run(
        "send",
        "--root",
        root,
        "--from",
        "codex",
        "--to",
        "claude",
        "--subject",
        raw_subject,
        "--body-text",
        "ping",
    )

    inbox = _run("inbox", "--root", root, "--agent", "claude")
    assert "\x1b" not in inbox.stdout
    assert "hello[31m-red" in inbox.stdout
