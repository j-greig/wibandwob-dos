#!/usr/bin/env python3
"""Extract Claude Code JSONL session logs into searchable markdown files.

Reads ~/.claude/projects/<project>/*.jsonl and writes one .md per session
containing human prompts, agent text, and tool call summaries.

Usage:
    python3 extract-sessions.py <project-slug> [--out-dir DIR] [--branch BRANCH] [--min-size BYTES] [--max-msg-len N]

Examples:
    # Extract all sessions for wibandwob-dos
    python3 extract-sessions.py -Users-james-Repos-wibandwob-dos

    # Only sessions on a specific branch
    python3 extract-sessions.py -Users-james-Repos-wibandwob-dos --branch feat/ts-tui-mvp

    # Custom output directory
    python3 extract-sessions.py -Users-james-Repos-wibandwob-dos --out-dir ./session-extracts

The project slug is the directory name under ~/.claude/projects/ — typically
the repo path with slashes replaced by dashes. Run `ls ~/.claude/projects/`
to find yours.
"""

import argparse
import json
import os
import glob
import shutil
import sys


def extract_sessions(project_slug, out_dir, branch_filter=None, min_size=5120, max_msg_len=0):
    log_dir = os.path.expanduser(f"~/.claude/projects/{project_slug}/")
    if not os.path.isdir(log_dir):
        print(f"Error: {log_dir} does not exist", file=sys.stderr)
        print(f"Available projects:", file=sys.stderr)
        for d in sorted(os.listdir(os.path.expanduser("~/.claude/projects/"))):
            print(f"  {d}", file=sys.stderr)
        sys.exit(1)

    files = sorted(glob.glob(os.path.join(log_dir, "*.jsonl")))
    print(f"Found {len(files)} session files in {log_dir}")

    os.makedirs(out_dir, exist_ok=True)

    extracted = 0
    skipped_size = 0
    skipped_branch = 0
    skipped_empty = 0

    for f in files:
        if os.path.getsize(f) < min_size:
            skipped_size += 1
            continue

        session_id = os.path.basename(f).replace(".jsonl", "")
        branch = ""
        timestamp = ""
        messages = []

        with open(f) as fh:
            for line in fh:
                try:
                    obj = json.loads(line)
                    if not branch and obj.get("gitBranch"):
                        branch = obj["gitBranch"]
                    if not timestamp and obj.get("timestamp"):
                        timestamp = obj["timestamp"]

                    msg = obj.get("message", {})
                    if not isinstance(msg, dict):
                        continue
                    content = msg.get("content", [])
                    if not isinstance(content, list):
                        continue

                    role = obj.get("type", "")
                    if role not in ("user", "assistant"):
                        continue

                    text_parts = []
                    for p in content:
                        if not isinstance(p, dict):
                            continue
                        if p.get("type") == "text" and p.get("text"):
                            text_parts.append(p["text"])
                        elif p.get("type") == "tool_use":
                            name = p.get("name", "?")
                            inp = p.get("input", {})
                            if isinstance(inp, dict):
                                args = ", ".join(
                                    f"{k}={str(v)[:80]}"
                                    for k, v in list(inp.items())[:4]
                                )
                                text_parts.append(f"[{name}({args})]")
                            else:
                                text_parts.append(f"[{name}]")
                        elif p.get("type") == "tool_result":
                            # Include tool result summaries (first 200 chars)
                            result_content = p.get("content", "")
                            if isinstance(result_content, list):
                                result_text = " ".join(
                                    r.get("text", "")[:200]
                                    for r in result_content
                                    if isinstance(r, dict) and r.get("type") == "text"
                                )
                            elif isinstance(result_content, str):
                                result_text = result_content[:200]
                            else:
                                result_text = ""
                            if result_text:
                                text_parts.append(f"[result: {result_text}]")

                    text = " ".join(text_parts).strip()
                    if text:
                        messages.append((role, text))
                except Exception:
                    continue

        if branch_filter and branch != branch_filter:
            skipped_branch += 1
            continue

        if len(messages) < 3:
            skipped_empty += 1
            continue

        date_part = timestamp[:10] if timestamp else "unknown"
        out_path = os.path.join(out_dir, f"{date_part}_{session_id[:8]}.md")

        with open(out_path, "w") as out:
            out.write(f"# Session {session_id[:8]}\n\n")
            out.write(f"Session ID: {session_id}\n")
            out.write(f"Branch: {branch}\n")
            out.write(f"Date: {timestamp}\n")
            out.write(f"Messages: {len(messages)}\n\n---\n\n")

            for role, text in messages:
                label = "HUMAN" if role == "user" else "AGENT"
                out.write(f"## {label}\n\n")
                if max_msg_len and len(text) > max_msg_len:
                    out.write(text[:max_msg_len] + "\n[...truncated...]\n")
                else:
                    out.write(text + "\n")
                out.write("\n")

        extracted += 1

    print(f"\nExtracted: {extracted}")
    print(f"Skipped (too small <{min_size}B): {skipped_size}")
    if branch_filter:
        print(f"Skipped (wrong branch): {skipped_branch}")
    print(f"Skipped (too few messages): {skipped_empty}")

    total_size = sum(
        os.path.getsize(os.path.join(out_dir, f))
        for f in os.listdir(out_dir)
        if f.endswith(".md")
    )
    print(f"Output: {out_dir} ({total_size / 1024:.0f}KB, {extracted} files)")
    return extracted


def main():
    parser = argparse.ArgumentParser(
        description="Extract Claude Code session logs to searchable markdown"
    )
    parser.add_argument(
        "--project", "-p",
        dest="project_slug",
        required=True,
        help="Project directory name under ~/.claude/projects/"
    )
    parser.add_argument(
        "--out-dir",
        default="/tmp/session-extracts",
        help="Output directory (default: /tmp/session-extracts)"
    )
    parser.add_argument(
        "--branch",
        default=None,
        help="Filter to sessions on this git branch"
    )
    parser.add_argument(
        "--min-size",
        type=int,
        default=5120,
        help="Skip JSONL files smaller than this (bytes, default: 5120)"
    )
    parser.add_argument(
        "--max-msg-len",
        type=int,
        default=0,
        help="Truncate messages longer than this (0=no limit, default: 0)"
    )
    parser.add_argument(
        "--clean",
        action="store_true",
        help="Delete output directory before extracting"
    )
    args = parser.parse_args()

    if args.clean and os.path.exists(args.out_dir):
        shutil.rmtree(args.out_dir)

    extract_sessions(
        args.project_slug,
        args.out_dir,
        branch_filter=args.branch,
        min_size=args.min_size,
        max_msg_len=args.max_msg_len,
    )


if __name__ == "__main__":
    main()
