#!/usr/bin/env python3
"""Parse a pi agent session JSONL file and extract pain signals."""
import sys, json, re
from collections import Counter
from pathlib import Path

session_file = sys.argv[1]
gotchas_path = Path("GOTCHAS.md")

messages = []
with open(session_file) as f:
    for line in f:
        try:
            messages.append(json.loads(line))
        except:
            pass

tool_calls = Counter()
tool_errors = []
file_reads = Counter()
bash_failures = []

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

    # Tool results — extract errors
    if role == "toolResult" and tool:
        if tool in ("bash", "Bash"):
            for b in content_blocks:
                if isinstance(b, dict) and b.get("type") == "text":
                    text = b["text"]
                    lower = text.lower()
                    # Only flag lines that look like actual errors, not content containing the word
                    if any(kw in lower for kw in ["command not found", "exit code", "cannot find module", "permission denied", "enoent", "eacces"]):
                        bash_failures.append(text[:200])
                    elif lower.startswith("error") or "\nerror" in lower or "command exited with code" in lower:
                        bash_failures.append(text[:200])
        for b in content_blocks:
            if isinstance(b, dict) and b.get("is_error"):
                tool_errors.append(f"{tool}: {str(b.get('text', ''))[:150]}")

# Cross-reference with GOTCHAS.md
gotcha_keywords = set()
if gotchas_path.exists():
    for line in gotchas_path.read_text().splitlines():
        if line.startswith("**"):
            gotcha_keywords.update(re.findall(r'\w+', line.lower()))

uncovered = []
for err in bash_failures:
    err_words = set(re.findall(r'\w+', err.lower()))
    if len(err_words & gotcha_keywords) < 3:
        uncovered.append(err)

# Output
total = sum(tool_calls.values())
print(f"## Session summary ({total} tool calls)")
print()
for t, c in tool_calls.most_common(10):
    print(f"  {c:4d}  {t}")
print()

if bash_failures:
    print(f"## Bash failures ({len(bash_failures)})")
    print()
    for err in bash_failures[:8]:
        print(f"  {err[:120]}")
    print()

if tool_errors:
    print(f"## Tool errors ({len(tool_errors)})")
    print()
    for err in tool_errors[:8]:
        print(f"  {err[:120]}")
    print()

if file_reads:
    print(f"## Most-read files")
    print()
    for path, count in file_reads.most_common(10):
        flag = " ⚠ re-read" if count > 3 else ""
        print(f"  {count:4d}  {path}{flag}")
    print()

if uncovered:
    print(f"## Errors not covered by GOTCHAS.md ({len(uncovered)})")
    print()
    for err in uncovered[:5]:
        print(f"  {err[:120]}")
    print()

print("## Suggested actions")
print()
print("1. Review bash failures — new GOTCHAS.md entries needed?")
print("2. Most-read files — if 5+ reads, the doc is unclear")
print("3. Run: bash scripts/checks/check-scaffold-sync.sh")
print()
print("session-debrief complete.")
