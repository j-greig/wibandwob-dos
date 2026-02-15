from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from notifier import macos_notification, terminal_bell, touch_sentinel
from store import MailboxStore


def _default_root() -> Path:
    return Path.cwd() / "logs" / "agent-mailbox"


def _thread_mtimes(store: MailboxStore) -> dict[str, float]:
    mtimes: dict[str, float] = {}
    for p in store.threads_dir.glob("*.ndjson"):
        try:
            mtimes[str(p)] = p.stat().st_mtime
        except FileNotFoundError:
            continue
    return mtimes


def _notify_agents(store: MailboxStore, title: str, body: str) -> None:
    agents = store.list_agents()
    for agent in agents:
        touch_sentinel(store.root, agent)
    terminal_bell()
    macos_notification(title=title, message=body)


def run_daemon(root: str | Path, poll_interval: float, once: bool = False) -> int:
    store = MailboxStore(root)
    known = _thread_mtimes(store)
    store.refresh_unread_indices()

    while True:
        current = _thread_mtimes(store)
        changed = False

        all_paths = set(known.keys()) | set(current.keys())
        for path in all_paths:
            if path not in known:
                changed = True
                break
            if path not in current:
                changed = True
                break
            if current[path] > known[path]:
                changed = True
                break

        if changed:
            store.refresh_unread_indices()
            _notify_agents(store, title="Agent Mailbox", body="New mailbox event")
            known = current

        if once:
            return 0

        time.sleep(poll_interval)


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Agent mailbox daemon")
    p.add_argument("--root", default=str(_default_root()), help="Mailbox root path")
    p.add_argument("--poll-interval", type=float, default=0.5, help="Polling interval in seconds")
    p.add_argument("--once", action="store_true", help="Process one polling cycle and exit")
    return p


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    return run_daemon(root=args.root, poll_interval=args.poll_interval, once=args.once)


if __name__ == "__main__":
    raise SystemExit(main())
