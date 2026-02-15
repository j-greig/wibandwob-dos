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


def test_cli_reply_send_and_ack_in_one_step(tmp_path: Path) -> None:
    root = str(tmp_path)
    inbound = _run(
        "send",
        "--root",
        root,
        "--from",
        "claude",
        "--to",
        "codex",
        "--subject",
        "incoming",
        "--body-text",
        "ping",
    )
    inbound_msg = json.loads(inbound.stdout)

    reply = _run(
        "reply",
        "--root",
        root,
        "--from",
        "codex",
        "--to",
        "claude",
        "--subject",
        "re: incoming",
        "--body-text",
        "pong",
        "--ack-id",
        inbound_msg["id"],
    )
    payload = json.loads(reply.stdout)
    assert payload["message"]["from"] == "codex"
    assert payload["ack"]["target_id"] == inbound_msg["id"]

    codex_unread = json.loads(_run("inbox", "--root", root, "--agent", "codex", "--json").stdout)
    assert codex_unread == []

    claude_unread = json.loads(_run("inbox", "--root", root, "--agent", "claude", "--json").stdout)
    assert len(claude_unread) == 1
    assert claude_unread[0]["subject"] == "re: incoming"


def test_cli_reply_without_ack(tmp_path: Path) -> None:
    root = str(tmp_path)
    out = _run(
        "reply",
        "--root",
        root,
        "--from",
        "codex",
        "--to",
        "claude",
        "--subject",
        "quick",
        "--body-text",
        "just reply",
    )
    payload = json.loads(out.stdout)
    assert payload["message"]["subject"] == "quick"
    assert payload["ack"] is None
