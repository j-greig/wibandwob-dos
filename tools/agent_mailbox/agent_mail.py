from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from store import MailboxStore


def _default_root() -> Path:
    return Path.cwd() / "logs" / "agent-mailbox"


def _add_common_args(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--root", default=str(_default_root()), help="Mailbox root path")


def _cmd_send(args: argparse.Namespace) -> int:
    store = MailboxStore(args.root)
    body_text = args.body_text
    body_path = args.body_path
    if body_path and not body_text:
        body_path = str(Path(body_path).resolve())
    msg = store.send(
        from_agent=args.from_agent,
        to_agent=args.to_agent,
        subject=args.subject,
        body_text=body_text,
        body_path=body_path,
        thread_id=args.thread,
        priority=args.priority,
        ref=args.ref,
    )
    print(msg.model_dump_json(by_alias=True, exclude_none=True))
    return 0


def _cmd_inbox(args: argparse.Namespace) -> int:
    store = MailboxStore(args.root)
    messages = store.inbox(agent=args.agent, thread_id=args.thread, unread_only=(not args.all))
    if args.json:
        print(json.dumps([m.model_dump(by_alias=True, exclude_none=True, mode="json") for m in messages], indent=2))
        return 0

    for m in messages:
        print(f"{m.id}\t{m.ts.isoformat()}\t{m.from_agent}\t{m.subject}")
    return 0


def _cmd_ack(args: argparse.Namespace) -> int:
    store = MailboxStore(args.root)
    ack = store.ack(agent=args.agent, target_id=args.message_id, thread_id=args.thread)
    print(ack.model_dump_json(exclude_none=True))
    return 0


def _cmd_follow(args: argparse.Namespace) -> int:
    store = MailboxStore(args.root)
    seen: set[str] = set()
    try:
        while True:
            messages = store.inbox(agent=args.agent, thread_id=args.thread, unread_only=True)
            for m in messages:
                if m.id in seen:
                    continue
                seen.add(m.id)
                if args.json:
                    print(m.model_dump_json(by_alias=True, exclude_none=True))
                else:
                    print(f"{m.id}\t{m.ts.isoformat()}\t{m.from_agent}\t{m.subject}")
            time.sleep(args.interval)
    except KeyboardInterrupt:
        return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Local agent mailbox CLI")
    sub = parser.add_subparsers(dest="cmd", required=True)

    send = sub.add_parser("send", help="Send a mailbox message")
    _add_common_args(send)
    send.add_argument("--from", dest="from_agent", required=True)
    send.add_argument("--to", dest="to_agent", required=True)
    send.add_argument("--subject", default="")
    send.add_argument("--thread", default="general")
    send.add_argument("--priority", choices=["low", "medium", "high"], default="medium")
    send.add_argument("--ref")
    body_group = send.add_mutually_exclusive_group(required=True)
    body_group.add_argument("--body-text")
    body_group.add_argument("--body-path")
    send.set_defaults(func=_cmd_send)

    inbox = sub.add_parser("inbox", help="List inbox messages")
    _add_common_args(inbox)
    inbox.add_argument("--agent", required=True)
    inbox.add_argument("--thread")
    inbox.add_argument("--all", action="store_true", help="Include acked messages")
    inbox.add_argument("--json", action="store_true")
    inbox.set_defaults(func=_cmd_inbox)

    ack = sub.add_parser("ack", help="Acknowledge a message")
    _add_common_args(ack)
    ack.add_argument("--agent", required=True)
    ack.add_argument("--id", dest="message_id", required=True)
    ack.add_argument("--thread", default="general")
    ack.set_defaults(func=_cmd_ack)

    follow = sub.add_parser("follow", help="Follow unread messages")
    _add_common_args(follow)
    follow.add_argument("--agent", required=True)
    follow.add_argument("--thread")
    follow.add_argument("--interval", type=float, default=1.0)
    follow.add_argument("--json", action="store_true")
    follow.set_defaults(func=_cmd_follow)

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return int(args.func(args))


if __name__ == "__main__":
    raise SystemExit(main())
