#!/usr/bin/env python3
"""Build an agent-friendly catalogue of Pi extensions.

Scans TypeScript files in .pi/extensions, extracts top-level docblocks, discovers
command/tool/shortcut registrations, and emits a progressive-disclosure Markdown
report.
"""

from __future__ import annotations

import argparse
import os
import re
import subprocess
from pathlib import Path
from typing import Iterable


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Export a Markdown catalogue of Pi extensions")
    parser.add_argument(
        "--extensions-dir",
        default=".pi/extensions",
        help="Directory containing extension .ts files (default: .pi/extensions)",
    )
    parser.add_argument(
        "--out",
        default="scratch/reports/pi-extension-catalogue.md",
        help="Output Markdown file path",
    )
    parser.add_argument(
        "--copy",
        action="store_true",
        help="Copy generated Markdown to clipboard (macOS: pbcopy)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help="Limit number of extensions (0 = all)",
    )
    return parser.parse_args()


def extract_top_docblock(source: str) -> str:
    match = re.match(r"\s*/\*\*(.*?)\*/", source, re.S)
    if not match:
        return ""
    lines = []
    for raw in match.group(1).splitlines():
        clean = re.sub(r"^\s*\*\s?", "", raw).rstrip()
        lines.append(clean)
    return "\n".join(lines).strip()


def first_sentence(text: str) -> str:
    compact = " ".join(text.split())
    if not compact:
        return "No top-level docblock description found."
    match = re.search(r"(.+?[.!?])(?:\s|$)", compact)
    return match.group(1).strip() if match else compact


def discover(pattern: str, source: str) -> list[str]:
    return sorted(set(re.findall(pattern, source)))


def bulletise_docblock_lines(docblock: str, max_lines: int = 6) -> list[str]:
    if not docblock:
        return []
    lines = [ln.strip() for ln in docblock.splitlines() if ln.strip()]
    keep: list[str] = []
    for line in lines:
        low = line.lower()
        if low.startswith(("supports", "provides", "usage", "note", "when ", "small tui", "/")):
            keep.append(line)
            continue
        if any(k in low for k in ("supports", "provides", "preflight", "selector", "review", "loop", "context")):
            keep.append(line)
    return keep[:max_lines]


def markdown_for_extension(path: Path, source: str) -> tuple[str, str, list[str], list[str], list[str], list[str]]:
    docblock = extract_top_docblock(source)
    summary = first_sentence(docblock)

    commands = discover(r'pi\.registerCommand\("([^"]+)"', source)
    shortcuts = discover(r'pi\.registerShortcut\("([^"]+)"', source)

    tools = discover(r'name:\s*"([a-zA-Z0-9_-]+)"', source)
    tool_whitelist = {"signal_loop_success"}
    tools = [t for t in tools if t in tool_whitelist]

    details = bulletise_docblock_lines(docblock)
    return (path.name, summary, commands, shortcuts, tools, details)


def build_report(rows: list[tuple[str, str, list[str], list[str], list[str], list[str]]], source_dir: Path) -> str:
    lines: list[str] = []
    lines.append("# Pi Extension Catalogue")
    lines.append("")
    lines.append("## TL;DR")
    lines.append(f"- Scanned `{source_dir}` for extension surfaces and top-level intent.")
    lines.append(f"- Found **{len(rows)}** extension files.")
    lines.append("- Use this as a fast routing index before reading full extension code.")
    lines.append("")

    lines.append("## At a glance")
    lines.append("| Extension | Primary purpose |")
    lines.append("|---|---|")
    for name, summary, *_ in rows:
        lines.append(f"| `{name}` | {summary} |")
    lines.append("")

    lines.append("## Progressive disclosure")
    lines.append("")
    for name, summary, commands, shortcuts, tools, details in rows:
        lines.append(f"### `{name}`")
        lines.append("**What it is**")
        lines.append(f"- {summary}")

        if commands:
            lines.append("**Surface (commands)**")
            lines.append("- " + ", ".join(f"`/{c}`" for c in commands))

        if shortcuts:
            lines.append("**Surface (shortcuts)**")
            lines.append("- " + ", ".join(f"`{s}`" for s in shortcuts))

        if tools:
            lines.append("**Surface (tools)**")
            lines.append("- " + ", ".join(f"`{t}`" for t in tools))

        if details:
            lines.append("**Details**")
            for detail in details:
                lines.append(f"- {detail}")

        lines.append("")

    return "\n".join(lines).rstrip() + "\n"


def copy_to_clipboard(text: str) -> tuple[bool, str]:
    if os.uname().sysname != "Darwin":
        return (False, "clipboard copy skipped (non-macOS)")
    try:
        subprocess.run(["pbcopy"], input=text.encode("utf-8"), check=True)
        return (True, "copied to clipboard via pbcopy")
    except Exception as exc:  # noqa: BLE001
        return (False, f"clipboard copy failed: {exc}")


def iter_extension_files(root: Path) -> Iterable[Path]:
    yield from sorted(p for p in root.glob("*.ts") if p.is_file())


def main() -> int:
    args = parse_args()
    source_dir = Path(args.extensions_dir)
    if not source_dir.exists():
        raise SystemExit(f"Extensions directory not found: {source_dir}")

    files = list(iter_extension_files(source_dir))
    if args.limit > 0:
        files = files[: args.limit]

    rows = []
    for path in files:
        source = path.read_text(encoding="utf-8")
        rows.append(markdown_for_extension(path, source))

    report = build_report(rows, source_dir)

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(report, encoding="utf-8")

    print(f"Wrote {out} ({len(rows)} extensions)")

    if args.copy:
        ok, msg = copy_to_clipboard(report)
        print(msg)
        if not ok:
            return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
