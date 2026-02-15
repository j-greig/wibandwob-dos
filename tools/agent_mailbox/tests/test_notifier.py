from __future__ import annotations

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[3]
MAILBOX_DIR = ROOT / "tools" / "agent_mailbox"
if str(MAILBOX_DIR) not in sys.path:
    sys.path.insert(0, str(MAILBOX_DIR))

from notifier import macos_notification, touch_sentinel


def test_touch_sentinel_creates_file(tmp_path: Path) -> None:
    sent = touch_sentinel(tmp_path, "claude")
    assert sent.exists()
    assert sent.name == ".new-mail-claude"


def test_touch_sentinel_rejects_unsafe_agent_name(tmp_path: Path) -> None:
    with pytest.raises(ValueError):
        touch_sentinel(tmp_path, "../../claude")


def test_macos_notification_escapes_quotes(monkeypatch) -> None:
    captured: dict[str, list[str]] = {}

    def _fake_run(cmd, check, capture_output, text):
        captured["cmd"] = cmd
        class _Res:
            returncode = 0
        return _Res()

    monkeypatch.setattr("notifier.platform.system", lambda: "Darwin")
    monkeypatch.setattr("notifier.subprocess.run", _fake_run)

    ok = macos_notification('t"itle', 'm"sg \\ value')
    assert ok is True
    script = captured["cmd"][2]
    assert 't\\"itle' in script
    assert 'm\\"sg \\\\ value' in script
