#!/usr/bin/env python3
"""Scan Claude Code JSONL sessions for confusion signals per subsystem.

Counts agent self-corrections, retries, error messages, and human
corrections. Outputs a ranked trouble score per subsystem.

Usage:
    python3 confusion-scan.py <project-slug> [--branch BRANCH] [--subsystems FILE] [--top N] [--json]

The subsystems file is a JSON file mapping subsystem names to regex
patterns. If omitted, uses a minimal default set. See examples/subsystems.json.

Output: ranked table of subsystems by trouble score, plus session hotspots.
With --json: machine-readable JSON for downstream processing.
"""

import argparse
import json
import os
import glob
import re
import sys
from collections import Counter, defaultdict


# Default confusion signal patterns (agent self-correcting)
CONFUSION_PATTERNS = [
    re.compile(r"let me (?:try again|fix|correct|re-read|reconsider|look again|rethink|check)", re.I),
    re.compile(r"actually,?\s+(?:I think|the issue|looking|I see|I realize|I notice|that)", re.I),
    re.compile(r"I (?:missed|overlooked|didn't notice|forgot|should have|incorrectly|was wrong)", re.I),
    re.compile(r"that (?:didn't work|failed|broke|won't|doesn't|isn't right|isn't correct)", re.I),
    re.compile(r"(?:TypeError|ReferenceError|Error:|Cannot find|not found|undefined is not)", re.I),
    re.compile(r"(?:SIGBUS|SIGSEGV|segfault|crash(?:ed|es)?)", re.I),
    re.compile(r"(?:regression|broke something|breaking change|stale|out of date|mismatch)", re.I),
    re.compile(r"(?:the (?:real|actual|root) (?:problem|issue|cause|bug))", re.I),
    re.compile(r"(?:my mistake|I apologize|I'm sorry|I was wrong about)", re.I),
]

# Human correction patterns (user pushing back)
CORRECTION_PATTERNS = [
    re.compile(r"(?:no,?\s+(?:that's|you're|it's) (?:wrong|not|incorrect))", re.I),
    re.compile(r"(?:I (?:already|just) (?:told|said|explained|mentioned))", re.I),
    re.compile(r"(?:try again|that's not what I)", re.I),
    re.compile(r"NEVER(?:\s+\w+){1,3}", re.I),
    re.compile(r"(?:STOP|WRONG|NO!)", re.I),
]

# Minimal default subsystems (project-agnostic)
DEFAULT_SUBSYSTEMS = {
    "build-system": r"CMakeLists|cmake|Makefile|bun.*build|tsconfig|compilation|linker|compile.*error",
    "config": r"config|\.env|environment|settings|\.json.*config",
    "database": r"database|migration|schema|query|SQL|ORM",
    "auth": r"auth|login|session|token|JWT|password|credential",
    "api": r"API|endpoint|route|handler|middleware|request|response",
    "testing": r"test|spec|assert|mock|fixture|coverage",
    "types": r"type|interface|schema|validation|zod|TypeScript",
    "state": r"state|store|reducer|context|provider",
    "ui": r"component|render|view|layout|style|CSS|DOM",
}


def load_subsystems(path):
    """Load subsystem definitions from JSON file."""
    if path and os.path.exists(path):
        with open(path) as f:
            raw = json.load(f)
        return {name: re.compile(pattern, re.I) for name, pattern in raw.items()}
    return {name: re.compile(pat, re.I) for name, pat in DEFAULT_SUBSYSTEMS.items()}


def extract_text(obj):
    """Extract text content from a JSONL message object."""
    msg = obj.get("message", {})
    if not isinstance(msg, dict):
        return ""
    content = msg.get("content", [])
    if not isinstance(content, list):
        return ""
    parts = []
    for p in content:
        if isinstance(p, dict) and p.get("type") == "text" and p.get("text"):
            parts.append(p["text"])
    return " ".join(parts)


def scan_sessions(project_slug, branch_filter=None, subsystems_file=None, min_size=5120):
    log_dir = os.path.expanduser(f"~/.claude/projects/{project_slug}/")
    if not os.path.isdir(log_dir):
        print(f"Error: {log_dir} does not exist", file=sys.stderr)
        sys.exit(1)

    subsystems = load_subsystems(subsystems_file)
    files = sorted(glob.glob(os.path.join(log_dir, "*.jsonl")))

    confusion_by_sub = Counter()
    correction_by_sub = Counter()
    mention_by_sub = Counter()
    example_problems = defaultdict(list)
    session_trouble = []
    sessions_scanned = 0

    for f in files:
        if os.path.getsize(f) < min_size:
            continue

        session_id = os.path.basename(f).replace(".jsonl", "")
        branch = ""
        timestamp = ""
        session_conf = 0
        session_corr = 0

        with open(f) as fh:
            for line in fh:
                try:
                    obj = json.loads(line)
                    if not branch and obj.get("gitBranch"):
                        branch = obj["gitBranch"]
                    if not timestamp and obj.get("timestamp"):
                        timestamp = obj["timestamp"]

                    if branch_filter and branch and branch != branch_filter:
                        break

                    text = extract_text(obj)
                    if not text or len(text) < 20:
                        continue

                    mentioned = set()
                    for sub_name, sub_pat in subsystems.items():
                        if sub_pat.search(text):
                            mentioned.add(sub_name)
                            mention_by_sub[sub_name] += 1

                    role = obj.get("type", "")

                    if role == "assistant":
                        conf = sum(len(p.findall(text)) for p in CONFUSION_PATTERNS)
                        if conf > 0:
                            session_conf += conf
                            for sub in mentioned:
                                confusion_by_sub[sub] += conf
                                if len(example_problems[sub]) < 5:
                                    for sentence in re.split(r'[.!?\n]', text):
                                        sentence = sentence.strip()
                                        if len(sentence) > 20 and any(
                                            p.search(sentence) for p in CONFUSION_PATTERNS
                                        ):
                                            example_problems[sub].append(
                                                (sentence[:120], session_id[:8], timestamp[:10])
                                            )
                                            break

                    if role == "user":
                        corr = sum(len(p.findall(text)) for p in CORRECTION_PATTERNS)
                        if corr > 0:
                            session_corr += corr
                            for sub in mentioned:
                                correction_by_sub[sub] += corr

                except Exception:
                    continue

        if branch_filter and branch and branch != branch_filter:
            continue

        sessions_scanned += 1
        if session_conf + session_corr > 0:
            session_trouble.append({
                "session_id": session_id,
                "date": timestamp[:10] if timestamp else "unknown",
                "branch": branch,
                "confusion": session_conf,
                "corrections": session_corr,
                "score": session_conf + session_corr * 3,
            })

    # Build results
    all_subs = set(
        list(confusion_by_sub.keys())
        + list(correction_by_sub.keys())
        + list(mention_by_sub.keys())
    )
    results = []
    for sub in all_subs:
        c = confusion_by_sub.get(sub, 0)
        r = correction_by_sub.get(sub, 0)
        m = mention_by_sub.get(sub, 0)
        score = c + r * 3
        results.append({
            "subsystem": sub,
            "score": score,
            "confusion": c,
            "corrections": r,
            "mentions": m,
            "examples": example_problems.get(sub, []),
        })

    results.sort(key=lambda x: -x["score"])
    session_trouble.sort(key=lambda x: -x["score"])

    return {
        "sessions_scanned": sessions_scanned,
        "subsystems": results,
        "session_hotspots": session_trouble[:20],
    }


def print_table(data):
    print(f"Sessions scanned: {data['sessions_scanned']}")
    print()
    print(f"{'Rank':<5} {'Subsystem':<28} {'Score':>6} {'Conf':>6} {'Corr':>6} {'Mentions':>9}")
    print("-" * 65)
    for i, sub in enumerate(data["subsystems"], 1):
        if sub["score"] == 0:
            continue
        print(
            f"{i:<5} {sub['subsystem']:<28} {sub['score']:>6} "
            f"{sub['confusion']:>6} {sub['corrections']:>6} {sub['mentions']:>9}"
        )

    print()
    print("Session hotspots:")
    for s in data["session_hotspots"][:10]:
        print(
            f"  score={s['score']:>4} conf={s['confusion']:>3} "
            f"corr={s['corrections']:>3}  {s['date']} {s['session_id'][:8]} ({s['branch']})"
        )


def main():
    parser = argparse.ArgumentParser(
        description="Scan Claude Code sessions for subsystem confusion signals"
    )
    parser.add_argument(
        "--project", "-p",
        dest="project_slug",
        required=True,
        help="Project directory name under ~/.claude/projects/"
    )
    parser.add_argument("--branch", default=None, help="Filter to git branch")
    parser.add_argument(
        "--subsystems", default=None,
        help="JSON file mapping subsystem names to regex patterns"
    )
    parser.add_argument("--top", type=int, default=0, help="Show only top N subsystems")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    parser.add_argument(
        "--min-size", type=int, default=5120,
        help="Skip JSONL files smaller than this (bytes)"
    )
    args = parser.parse_args()

    data = scan_sessions(
        args.project_slug,
        branch_filter=args.branch,
        subsystems_file=args.subsystems,
        min_size=args.min_size,
    )

    if args.top:
        data["subsystems"] = data["subsystems"][:args.top]

    if args.json:
        # Strip examples for clean JSON (they contain tuples)
        for sub in data["subsystems"]:
            sub["examples"] = [
                {"text": t, "session": s, "date": d}
                for t, s, d in sub["examples"]
            ]
        print(json.dumps(data, indent=2))
    else:
        print_table(data)


if __name__ == "__main__":
    main()
