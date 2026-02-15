#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

SCRIPT_DIR = Path(__file__).resolve().parents[1]
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from store import MailboxStore


def _default_root() -> Path:
    return Path.cwd() / "logs" / "agent-mailbox"


def _parse_payload(payload_arg: str | None) -> dict[str, Any]:
    raw = payload_arg if payload_arg is not None else sys.stdin.read()
    raw = raw.strip()
    if not raw:
        return {"type": "unknown", "raw": ""}
    try:
        parsed = json.loads(raw)
        if isinstance(parsed, dict):
            return parsed
        return {"type": "non_object", "value": parsed}
    except json.JSONDecodeError:
        return {"type": "invalid_json", "raw": raw}


def _extract_subject(payload: dict[str, Any]) -> str:
    event_type = str(payload.get("type", "unknown"))
    return f"codex notify: {event_type}"


def _extract_body(payload: dict[str, Any]) -> str:
    event_type = str(payload.get("type", "unknown"))
    turn_id = payload.get("turn_id") or payload.get("id") or ""
    status = payload.get("status") or ""
    return f"event={event_type} turn={turn_id} status={status}".strip()


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Codex notify hook -> local mailbox adapter")
    p.add_argument("payload", nargs="?", help="Optional JSON payload (if omitted, read stdin)")
    p.add_argument("--root", default=str(_default_root()), help="Mailbox root path")
    p.add_argument("--from-agent", default="codex")
    p.add_argument("--to-agent", default="claude")
    p.add_argument("--thread", default="notify")
    p.add_argument("--priority", choices=["low", "medium", "high"], default="low")
    return p


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    payload = _parse_payload(args.payload)

    store = MailboxStore(args.root)
    msg = store.send(
        from_agent=args.from_agent,
        to_agent=args.to_agent,
        subject=_extract_subject(payload),
        body_text=_extract_body(payload),
        body_path=None,
        thread_id=args.thread,
        priority=args.priority,
        metadata={"source": "codex-notify", "payload": payload},
    )

    print(msg.model_dump_json(by_alias=True, exclude_none=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
