from __future__ import annotations

import argparse
import json
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


def _unread_counts(store: MailboxStore) -> dict[str, int]:
    counts: dict[str, int] = {}
    for path in store.index_dir.glob("unread-*.json"):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            agent = str(data.get("agent", ""))
            count = int(data.get("count", 0))
        except Exception:
            continue
        if agent:
            counts[agent] = count
    return counts


def _notify_agents_for_deltas(
    store: MailboxStore, before: dict[str, int], after: dict[str, int], title: str, body: str
) -> None:
    changed_agents = [agent for agent, count in after.items() if count > before.get(agent, 0)]
    if not changed_agents:
        return
    for agent in changed_agents:
        touch_sentinel(store.root, agent)
    terminal_bell()
    macos_notification(title=title, message=body)


def run_daemon(root: str | Path, poll_interval: float, once: bool = False) -> int:
    store = MailboxStore(root)
    known = _thread_mtimes(store)
    store.refresh_unread_indices()
    last_counts = _unread_counts(store)

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
            before = dict(last_counts)
            store.refresh_unread_indices()
            after = _unread_counts(store)
            _notify_agents_for_deltas(store, before=before, after=after, title="Agent Mailbox", body="New mailbox event")
            last_counts = after
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
