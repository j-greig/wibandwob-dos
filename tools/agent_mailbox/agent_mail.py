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


def _sanitize_display(text: str) -> str:
    return "".join(ch for ch in text if ch == "\t" or ch == "\n" or ord(ch) >= 0x20)


def _cmd_send(args: argparse.Namespace) -> int:
    store = MailboxStore(args.root)
    msg = _send_message_from_args(store, args)
    print(msg.model_dump_json(by_alias=True, exclude_none=True))
    return 0


def _resolve_body(args: argparse.Namespace) -> tuple[str | None, str | None]:
    body_text = args.body_text
    body_path = args.body_path
    if body_path and not body_text:
        body_path = str(Path(body_path).resolve())
    return body_text, body_path


def _send_message_from_args(store: MailboxStore, args: argparse.Namespace):
    body_text, body_path = _resolve_body(args)
    return store.send(
        from_agent=args.from_agent,
        to_agent=args.to_agent,
        subject=args.subject,
        body_text=body_text,
        body_path=body_path,
        thread_id=args.thread,
        priority=args.priority,
        ref=args.ref,
    )


def _cmd_reply(args: argparse.Namespace) -> int:
    store = MailboxStore(args.root)
    msg = _send_message_from_args(store, args)
    ack = None
    if args.ack_id:
        ack = store.ack(
            agent=args.from_agent,
            target_id=args.ack_id,
            thread_id=(args.ack_thread or args.thread),
        )
    payload = {
        "message": msg.model_dump(by_alias=True, exclude_none=True, mode="json"),
        "ack": ack.model_dump(exclude_none=True, mode="json") if ack else None,
    }
    print(json.dumps(payload, indent=2))
    return 0


def _cmd_inbox(args: argparse.Namespace) -> int:
    store = MailboxStore(args.root)
    messages = store.inbox(agent=args.agent, thread_id=args.thread, unread_only=(not args.all))
    if args.json:
        print(json.dumps([m.model_dump(by_alias=True, exclude_none=True, mode="json") for m in messages], indent=2))
        return 0

    for m in messages:
        print(
            f"{_sanitize_display(m.id)}\t"
            f"{m.ts.isoformat()}\t"
            f"{_sanitize_display(m.from_agent)}\t"
            f"{_sanitize_display(m.subject)}"
        )
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
                    print(
                        f"{_sanitize_display(m.id)}\t"
                        f"{m.ts.isoformat()}\t"
                        f"{_sanitize_display(m.from_agent)}\t"
                        f"{_sanitize_display(m.subject)}"
                    )
            time.sleep(args.interval)
    except KeyboardInterrupt:
        return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Local agent mailbox CLI")
    sub = parser.add_subparsers(dest="cmd", required=True)

    def _add_send_like_args(p: argparse.ArgumentParser) -> None:
        p.add_argument("--from", dest="from_agent", required=True)
        p.add_argument("--to", dest="to_agent", required=True)
        p.add_argument("--subject", default="")
        p.add_argument("--thread", default="general")
        p.add_argument("--priority", choices=["low", "medium", "high"], default="medium")
        p.add_argument("--ref")
        body_group = p.add_mutually_exclusive_group(required=True)
        body_group.add_argument("--body-text")
        body_group.add_argument("--body-path")

    send = sub.add_parser("send", help="Send a mailbox message")
    _add_common_args(send)
    _add_send_like_args(send)
    send.set_defaults(func=_cmd_send)

    reply = sub.add_parser("reply", help="Send reply and optionally ack original")
    _add_common_args(reply)
    _add_send_like_args(reply)
    reply.add_argument("--ack-id", help="Message id to acknowledge after sending reply")
    reply.add_argument("--ack-thread", help="Ack thread override (defaults to --thread)")
    reply.set_defaults(func=_cmd_reply)

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
