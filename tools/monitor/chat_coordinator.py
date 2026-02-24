#!/usr/bin/env python3
"""Inter-instance WibWob group chat broker via local Unix sockets.

Group-chat behavior:
- Poll each instance's chat history via get_chat_history
- Detect new messages (user + assistant)
- Broadcast each message to all other instances with attribution
- Suppress rebroadcast of broker-injected copies via side-channel dedup

Usage:
  python3 tools/monitor/chat_coordinator.py
  python3 tools/monitor/chat_coordinator.py --max-turns 10 --poll-interval 2 --cooldown 5
"""

from __future__ import annotations

import argparse
import glob
import hashlib
import json
import math
import os
import socket
import time
from typing import Dict, List, Set, Tuple


def discover_sockets() -> List[str]:
    """Find all /tmp/wibwob_*.sock files plus legacy path."""
    socks = sorted(glob.glob("/tmp/wibwob_*.sock"))
    legacy = "/tmp/test_pattern_app.sock"
    if os.path.exists(legacy) and legacy not in socks:
        socks.insert(0, legacy)
    return socks


def instance_name(sock_path: str) -> str:
    return os.path.basename(sock_path).replace(".sock", "")


def pretty_instance_label(sock_path: str) -> str:
    name = instance_name(sock_path)
    if name.startswith("wibwob_"):
        suffix = name.split("_", 1)[1]
        if suffix.isdigit():
            return f"Instance {suffix}"
    return name


def pct_encode(value: str) -> str:
    """Percent-encode for IPC k=v params (matches api_ipc.cpp percent_decode)."""
    return (
        value.replace("%", "%25")
             .replace(" ", "%20")
             .replace("\n", "%0A")
             .replace("\r", "%0D")
             .replace("\t", "%09")
    )


def send_ipc_line(sock_path: str, line: str, timeout: float = 5.0) -> str:
    s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    s.settimeout(timeout)
    s.connect(sock_path)
    try:
        s.sendall((line.rstrip("\n") + "\n").encode("utf-8"))
        chunks: List[bytes] = []
        while True:
            chunk = s.recv(8192)
            if not chunk:
                break
            chunks.append(chunk)
        return b"".join(chunks).decode("utf-8", errors="ignore").strip()
    finally:
        s.close()


def exec_command(sock_path: str, name: str, **kv: str) -> str:
    parts = ["cmd:exec_command", f"name={name}"]
    for k, v in kv.items():
        parts.append(f"{k}={pct_encode(str(v))}")
    return send_ipc_line(sock_path, " ".join(parts))


def get_chat_history(sock_path: str) -> List[dict]:
    raw = exec_command(sock_path, "get_chat_history")
    if raw.startswith("err"):
        raise RuntimeError(raw)
    data = json.loads(raw)
    msgs = data.get("messages", [])
    if not isinstance(msgs, list):
        raise RuntimeError("invalid get_chat_history payload: messages is not a list")
    return msgs


def estimate_tokens(text: str) -> int:
    return max(1, math.ceil(len(text) / 4))


def make_event_id(source_label: str, role: str, index: int, content: str) -> str:
    payload = f"{source_label}|{role}|{index}|{content}".encode("utf-8", errors="ignore")
    return hashlib.sha1(payload).hexdigest()[:12]


def format_relay_prompt(source_label: str, role: str, content: str) -> str:
    return f"[{source_label} says]: {content}"


def relay_to_peer(target_sock: str, source_label: str, role: str, content: str) -> str:
    text = format_relay_prompt(source_label, role, content)
    return exec_command(target_sock, "wibwob_ask", text=text)


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Inter-instance WibWob group chat broker")
    p.add_argument("--poll-interval", type=float, default=2.0)
    p.add_argument("--max-turns",     type=int,   default=20)
    p.add_argument("--cooldown",      type=float, default=5.0)
    p.add_argument("--token-budget",  type=int,   default=4000)
    p.add_argument("--require",       type=int,   default=2,
                   help="Minimum live instances required (default: 2)")
    p.add_argument("--roles",         default="user,assistant",
                   help="Comma-separated roles to broadcast (default: user,assistant)")
    return p.parse_args()


def main() -> int:
    args = parse_args()
    enabled_roles: Set[str] = {r.strip() for r in args.roles.split(",") if r.strip()}

    last_seen_counts: Dict[str, int]           = {}
    last_relay_to_target_at: Dict[str, float]  = {}
    delivered_to_target: Set[Tuple[str, str]]  = set()  # (target_sock, injected_text)
    delivered_events: Set[Tuple[str, str]]      = set()  # (target_sock, event_id)
    seen_origin_events: Set[str]                = set()
    relayed_turns  = 0
    token_spend    = 0

    print(
        f"[broker] start poll={args.poll_interval}s max_turns={args.max_turns} "
        f"cooldown={args.cooldown}s token_budget={args.token_budget} roles={sorted(enabled_roles)}"
    )

    try:
        while True:
            socks = discover_sockets()
            if len(socks) < args.require:
                print(f"[broker] waiting for >= {args.require} sockets; found {len(socks)}")
                time.sleep(args.poll_interval)
                continue

            for sp in socks:
                last_seen_counts.setdefault(sp, 0)

            # Clean up disappeared sockets
            for sp in [k for k in last_seen_counts if k not in socks]:
                print(f"[broker] socket gone: {sp}")
                last_seen_counts.pop(sp, None)
                last_relay_to_target_at.pop(sp, None)
                delivered_to_target  = {p for p in delivered_to_target  if p[0] != sp}
                delivered_events     = {p for p in delivered_events      if p[0] != sp}

            for source_sock in socks:
                source_label = pretty_instance_label(source_sock)
                try:
                    msgs = get_chat_history(source_sock)
                except Exception as e:
                    print(f"[broker] read fail {source_label}: {e}")
                    continue

                prev = last_seen_counts.get(source_sock, 0)
                if len(msgs) < prev:
                    print(f"[broker] history reset {source_label} ({prev} -> {len(msgs)})")
                    prev = 0

                new_msgs = msgs[prev:]
                last_seen_counts[source_sock] = len(msgs)
                if not new_msgs:
                    continue

                for offset, msg in enumerate(new_msgs, start=prev):
                    role    = str(msg.get("role", "")).strip().lower()
                    content = str(msg.get("content", ""))

                    if role not in enabled_roles:
                        continue
                    if not content.strip():
                        continue

                    # Skip if this exact text was broker-injected into this source
                    relay_text_check = format_relay_prompt(source_label, role, content)
                    if (source_sock, content) in delivered_to_target:
                        continue

                    event_id = make_event_id(source_label, role, offset, content)
                    if event_id in seen_origin_events:
                        continue
                    seen_origin_events.add(event_id)

                    est = estimate_tokens(content)
                    if token_spend + est > args.token_budget:
                        print(f"[broker] token budget reached: {token_spend}+{est} > {args.token_budget}")
                        return 0

                    for target_sock in socks:
                        if target_sock == source_sock:
                            continue

                        target_label = instance_name(target_sock)
                        key = (target_sock, event_id)
                        if key in delivered_events:
                            continue

                        now     = time.time()
                        last_at = last_relay_to_target_at.get(target_sock, 0.0)
                        if args.cooldown > 0 and (now - last_at) < args.cooldown:
                            print(
                                f"[broker] cooldown skip {source_label}->{target_label} "
                                f"({now - last_at:.1f}s < {args.cooldown}s)"
                            )
                            continue

                        try:
                            resp = relay_to_peer(target_sock, source_label, role, content)
                        except Exception as e:
                            print(f"[broker] relay fail {source_label}->{target_label}: {e}")
                            continue

                        if resp.startswith("err"):
                            print(f"[broker] relay rejected {source_label}->{target_label}: {resp}")
                            continue

                        injected_text = format_relay_prompt(source_label, role, content)
                        delivered_to_target.add((target_sock, injected_text))
                        delivered_events.add(key)
                        last_relay_to_target_at[target_sock] = now
                        relayed_turns += 1
                        token_spend   += est

                        print(
                            f"[broker] relay #{relayed_turns}: "
                            f"{source_label}/{role} -> {target_label} "
                            f"chars={len(content)} est_tokens={est} "
                            f"budget={token_spend}/{args.token_budget} resp={resp}"
                        )

                        if relayed_turns >= args.max_turns:
                            print(f"[broker] max turns reached ({args.max_turns}); stopping")
                            return 0

            time.sleep(args.poll_interval)

    except KeyboardInterrupt:
        print("\n[broker] stopped by user")
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
