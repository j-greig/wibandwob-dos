#!/usr/bin/env python3
"""
session-debrief-parser.py — Extract session data and prepare for LLM analysis.

This script does TWO things:
1. Extracts raw data from a pi session JSONL (tool calls, outputs, file reads)
2. Outputs a condensed session summary that gets piped to a haiku agent for analysis

The keyword matching / pattern detection is done by the LLM, NOT by this code.
This code only extracts and formats.
"""
import sys, json
from collections import Counter
from pathlib import Path

session_file = sys.argv[1]
mode = sys.argv[2] if len(sys.argv) > 2 else "summary"

messages = []
with open(session_file) as f:
    for line in f:
        try:
            messages.append(json.loads(line))
        except:
            pass

# ── Extract raw data ──────────────────────────────────────────────────────

tool_calls = Counter()
file_reads = Counter()
bash_outputs = []  # (command_hint, output_snippet)
tool_results = []  # all tool results for context

for msg in messages:
    if msg.get("type") != "message":
        continue
    m = msg.get("message", {})
    role = m.get("role", "")
    tool = m.get("toolName", "")
    content_blocks = m.get("content", [])

    # Assistant messages — extract tool calls
    if role == "assistant" and isinstance(content_blocks, list):
        for b in content_blocks:
            if isinstance(b, dict) and b.get("type") in ("tool_use", "toolCall"):
                inp = b.get("input", b.get("args", {}))
                name = b.get("name", b.get("toolName", ""))
                tool_calls[name] += 1
                if name in ("read", "Read") and isinstance(inp, dict) and "path" in inp:
                    file_reads[inp["path"]] += 1

    # Tool results — capture bash output snippets
    if role == "toolResult" and tool:
        for b in content_blocks:
            if isinstance(b, dict) and b.get("type") == "text":
                text = b["text"][:300]  # truncate for prompt budget
                if tool in ("bash", "Bash"):
                    bash_outputs.append(text)
                tool_results.append({"tool": tool, "snippet": text[:150]})

# ── Mode: summary (for LLM consumption) ──────────────────────────────────

if mode == "summary":
    gotchas_content = ""
    if Path("GOTCHAS.md").exists():
        gotchas_content = Path("GOTCHAS.md").read_text()

    guide_headings = ""
    if Path("SDK-MICROAPP-DEV.md").exists():
        guide_headings = "\n".join(
            line for line in Path("SDK-MICROAPP-DEV.md").read_text().splitlines()
            if line.startswith("## ") or line.startswith("### ")
        )

    # Build condensed session summary for the LLM
    summary = []
    summary.append(f"SESSION: {Path(session_file).name}")
    summary.append(f"TOTAL TOOL CALLS: {sum(tool_calls.values())}")
    summary.append("")
    summary.append("TOOL CALL COUNTS:")
    for t, c in tool_calls.most_common(15):
        summary.append(f"  {c:4d}  {t}")

    summary.append("")
    summary.append("MOST-READ FILES:")
    for path, count in file_reads.most_common(15):
        summary.append(f"  {count:4d}  {path}")

    summary.append("")
    summary.append(f"BASH OUTPUTS ({len(bash_outputs)} total, showing last 15 snippets):")
    for output in bash_outputs[-15:]:
        # Show first 2 lines of each output
        lines = output.strip().split("\n")[:2]
        summary.append(f"  > {' | '.join(lines)[:150]}")

    summary.append("")
    summary.append("CURRENT GOTCHAS.MD (headings only):")
    for line in gotchas_content.splitlines():
        if line.startswith("**") or line.startswith("## "):
            summary.append(f"  {line[:100]}")

    summary.append("")
    summary.append("CURRENT GUIDE SECTIONS:")
    summary.append(guide_headings)

    print("\n".join(summary))

# ── Mode: stats (quick non-LLM overview) ─────────────────────────────────

elif mode == "stats":
    total = sum(tool_calls.values())
    print(f"## Session summary ({total} tool calls)")
    print()
    for t, c in tool_calls.most_common(10):
        print(f"  {c:4d}  {t}")
    print()
    if file_reads:
        print("## Most-read files")
        print()
        for path, count in file_reads.most_common(10):
            flag = " ⚠ re-read" if count > 3 else ""
            print(f"  {count:4d}  {path}{flag}")
        print()
