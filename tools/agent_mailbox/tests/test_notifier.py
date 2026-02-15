from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
MAILBOX_DIR = ROOT / "tools" / "agent_mailbox"
if str(MAILBOX_DIR) not in sys.path:
    sys.path.insert(0, str(MAILBOX_DIR))

from notifier import touch_sentinel


def test_touch_sentinel_creates_file(tmp_path: Path) -> None:
    sent = touch_sentinel(tmp_path, "claude")
    assert sent.exists()
    assert sent.name == ".new-mail-claude"
