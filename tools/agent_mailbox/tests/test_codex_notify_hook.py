from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
HOOK = ROOT / "tools" / "agent_mailbox" / "hooks" / "codex_notify_hook.py"


def test_codex_notify_hook_writes_message(tmp_path: Path) -> None:
    payload = {
        "type": "agent-turn-complete",
        "turn_id": "turn-123",
        "status": "ok",
    }

    cp = subprocess.run(
        [
            sys.executable,
            str(HOOK),
            "--root",
            str(tmp_path),
            "--from-agent",
            "codex",
            "--to-agent",
            "claude",
            "--thread",
            "notify",
        ],
        input=json.dumps(payload),
        text=True,
        capture_output=True,
        check=True,
    )

    out = json.loads(cp.stdout)
    assert out["from"] == "codex"
    assert out["to"] == "claude"
    assert out["thread_id"] == "notify"

    ndjson_files = list((tmp_path / "threads").glob("notify-*.ndjson"))
    assert ndjson_files
    text = ndjson_files[0].read_text(encoding="utf-8")
    assert "agent-turn-complete" in text
