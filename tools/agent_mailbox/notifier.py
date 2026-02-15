from __future__ import annotations

import os
import platform
import re
import subprocess
from pathlib import Path

SAFE_ID_RE = re.compile(r"^[A-Za-z0-9._-]+$")


def _escape_osascript_string(value: str) -> str:
    return value.replace("\\", "\\\\").replace('"', '\\"')


def terminal_bell() -> None:
    # Terminal bell is intentionally minimal and portable.
    print("\a", end="", flush=True)


def macos_notification(title: str, message: str) -> bool:
    if platform.system() != "Darwin":
        return False
    safe_title = _escape_osascript_string(title)
    safe_message = _escape_osascript_string(message)
    cmd = [
        "osascript",
        "-e",
        f'display notification "{safe_message}" with title "{safe_title}"',
    ]
    try:
        subprocess.run(cmd, check=False, capture_output=True, text=True)
        return True
    except Exception:
        return False


def touch_sentinel(root: str | Path, agent: str) -> Path:
    if not SAFE_ID_RE.match(agent):
        raise ValueError("agent must match ^[A-Za-z0-9._-]+$")
    p = Path(root) / "index" / f".new-mail-{agent}"
    p.parent.mkdir(parents=True, exist_ok=True)
    with p.open("a", encoding="utf-8"):
        os.utime(p, None)
    return p
