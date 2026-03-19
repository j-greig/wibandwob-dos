#!/usr/bin/env python3
"""Audit skill/extension usage from Pi session logs for this repo.

Outputs a Markdown report with last-seen timestamps and stale (>14d) flags.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import re
from pathlib import Path
from typing import Iterable


SKILL_PATH_RE = re.compile(r"\.pi/skills/([^/]+)/SKILL\.md$")
AGENT_PATH_RE = re.compile(r"\.pi/agents/([^/]+)\.md$")
CMD_RE = re.compile(r"/(\w[\w-]*)")
MENTION_RE = re.compile(r"@([a-zA-Z0-9_-]+)")


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Audit Pi skill/extension usage")
    p.add_argument("--cwd", default=str(Path.cwd()), help="Repo root (default: current directory)")
    p.add_argument(
        "--sessions-dir",
        default=str(Path.home() / ".pi" / "agent" / "sessions"),
        help="Pi sessions root dir",
    )
    p.add_argument("--days", type=int, default=14, help="Stale threshold in days")
    p.add_argument("--out", default="scratch/reports/pi-usage-audit.md", help="Output Markdown path")
    p.add_argument(
        "--json-out",
        default="",
        help="Optional JSON output path (e.g. scratch/reports/pi-usage-audit.json)",
    )
    return p.parse_args()


def cwd_bucket_name(cwd: Path) -> str:
    return "--" + str(cwd.resolve()).strip("/").replace("/", "-") + "--"


def iter_jsonl_lines(paths: Iterable[Path]):
    for path in sorted(paths):
        try:
            with path.open("r", encoding="utf-8") as f:
                for raw in f:
                    raw = raw.strip()
                    if not raw:
                        continue
                    try:
                        yield path, json.loads(raw)
                    except json.JSONDecodeError:
                        continue
        except OSError:
            continue


def extract_extension_surfaces(extensions_dir: Path):
    commands_by_ext: dict[str, set[str]] = {}
    tools_by_ext: dict[str, set[str]] = {}

    cmd_pat = re.compile(r'pi\.registerCommand\("([^"]+)"')
    tool_pat = re.compile(r'name:\s*"([a-zA-Z0-9_-]+)"')

    for ts in sorted(extensions_dir.glob("*.ts")):
        src = ts.read_text(encoding="utf-8", errors="ignore")
        ext = ts.stem
        commands = set(cmd_pat.findall(src))
        tools = set(tool_pat.findall(src))
        commands_by_ext[ext] = commands
        tools_by_ext[ext] = tools

    # inverse maps
    cmd_to_ext = {cmd: ext for ext, cmds in commands_by_ext.items() for cmd in cmds}
    tool_to_ext = {tool: ext for ext, tools in tools_by_ext.items() for tool in tools}
    return commands_by_ext, tools_by_ext, cmd_to_ext, tool_to_ext


def all_skills(skills_dir: Path) -> set[str]:
    out: set[str] = set()
    for p in sorted(skills_dir.glob("*/SKILL.md")):
        out.add(p.parent.name)
    return out


def parse_ts(value: str | None) -> dt.datetime | None:
    if not value:
        return None
    try:
        if value.endswith("Z"):
            value = value[:-1] + "+00:00"
        return dt.datetime.fromisoformat(value)
    except Exception:
        return None


def fmt_ts(ts: dt.datetime | None) -> str:
    if ts is None:
        return "never"
    return ts.astimezone(dt.timezone.utc).strftime("%Y-%m-%d %H:%M UTC")


def is_stale(ts: dt.datetime | None, cutoff: dt.datetime) -> bool:
    return ts is None or ts < cutoff


def build_report(
    now: dt.datetime,
    threshold_days: int,
    skill_last_seen: dict[str, dt.datetime],
    ext_last_seen: dict[str, dt.datetime],
    agent_last_seen: dict[str, dt.datetime],
    all_skill_names: set[str],
    all_ext_names: set[str],
    all_agent_names: set[str],
    scanned_files: int,
):
    cutoff = now - dt.timedelta(days=threshold_days)

    lines: list[str] = []
    lines.append("# Pi Usage Audit")
    lines.append("")
    lines.append("## TL;DR")
    lines.append(f"- Scanned **{scanned_files}** session logs for this repo.")
    lines.append(f"- Stale threshold: **{threshold_days} days** (cutoff {cutoff.date()}).")
    lines.append("- ‘never’ means no usage signal found in scanned logs.")
    lines.append("")

    stale_candidates: list[tuple[str, str, dt.datetime | None]] = []
    for name in all_skill_names:
        ts = skill_last_seen.get(name)
        if is_stale(ts, cutoff):
            stale_candidates.append(("skill", name, ts))
    for name in all_ext_names:
        ts = ext_last_seen.get(name)
        if is_stale(ts, cutoff):
            stale_candidates.append(("extension", name, ts))
    for name in all_agent_names:
        ts = agent_last_seen.get(name)
        if is_stale(ts, cutoff):
            stale_candidates.append(("agent", name, ts))

    stale_candidates.sort(key=lambda row: (row[2] is not None, row[2] or dt.datetime.min.replace(tzinfo=dt.timezone.utc), row[0], row[1]))

    lines.append("## Top stale 10 (cross-surface)")
    if not stale_candidates:
        lines.append("- None")
    else:
        lines.append("| Kind | Name | Last seen |")
        lines.append("|---|---|---:|")
        for kind, name, ts in stale_candidates[:10]:
            lines.append(f"| {kind} | `{name}` | {fmt_ts(ts)} |")
    lines.append("")

    def section(kind: str, names: set[str], last_seen_map: dict[str, dt.datetime]):
        stale = sorted([n for n in names if is_stale(last_seen_map.get(n), cutoff)])
        active = sorted([n for n in names if not is_stale(last_seen_map.get(n), cutoff)])

        lines.append(f"## {kind}")
        lines.append(f"- Active (<= {threshold_days}d): **{len(active)}**")
        lines.append(f"- Stale / never: **{len(stale)}**")
        lines.append("")
        lines.append("| Name | Last seen | Status |")
        lines.append("|---|---:|---|")
        for name in sorted(names):
            ts = last_seen_map.get(name)
            status = "stale" if is_stale(ts, cutoff) else "active"
            lines.append(f"| `{name}` | {fmt_ts(ts)} | {status} |")
        lines.append("")

        lines.append(f"### {kind} stale candidates")
        if not stale:
            lines.append("- None")
        else:
            for n in stale:
                lines.append(f"- `{n}` — {fmt_ts(last_seen_map.get(n))}")
        lines.append("")

    section("Skills", all_skill_names, skill_last_seen)
    section("Extensions", all_ext_names, ext_last_seen)
    section("Agents", all_agent_names, agent_last_seen)

    return "\n".join(lines).rstrip() + "\n"


def build_json_payload(
    now: dt.datetime,
    threshold_days: int,
    skill_last_seen: dict[str, dt.datetime],
    ext_last_seen: dict[str, dt.datetime],
    agent_last_seen: dict[str, dt.datetime],
    all_skill_names: set[str],
    all_ext_names: set[str],
    all_agent_names: set[str],
    scanned_files: int,
) -> dict:
    cutoff = now - dt.timedelta(days=threshold_days)

    def block(names: set[str], seen_map: dict[str, dt.datetime]) -> dict:
        rows = []
        for name in sorted(names):
            ts = seen_map.get(name)
            rows.append(
                {
                    "name": name,
                    "last_seen": ts.astimezone(dt.timezone.utc).isoformat().replace("+00:00", "Z") if ts else None,
                    "status": "stale" if is_stale(ts, cutoff) else "active",
                }
            )
        return {
            "active": sum(1 for r in rows if r["status"] == "active"),
            "stale": sum(1 for r in rows if r["status"] == "stale"),
            "rows": rows,
        }

    payload = {
        "generated_at": now.astimezone(dt.timezone.utc).isoformat().replace("+00:00", "Z"),
        "threshold_days": threshold_days,
        "cutoff": cutoff.astimezone(dt.timezone.utc).isoformat().replace("+00:00", "Z"),
        "scanned_session_files": scanned_files,
        "skills": block(all_skill_names, skill_last_seen),
        "extensions": block(all_ext_names, ext_last_seen),
        "agents": block(all_agent_names, agent_last_seen),
    }

    stale_rows = []
    for kind, block_name in (("skill", "skills"), ("extension", "extensions"), ("agent", "agents")):
        for row in payload[block_name]["rows"]:
            if row["status"] == "stale":
                stale_rows.append({"kind": kind, **row})
    stale_rows.sort(key=lambda r: (r["last_seen"] is not None, r["last_seen"] or "", r["kind"], r["name"]))
    payload["top_stale_10"] = stale_rows[:10]
    return payload


def main() -> int:
    args = parse_args()
    cwd = Path(args.cwd).resolve()
    sessions_root = Path(args.sessions_dir)
    bucket = sessions_root / cwd_bucket_name(cwd)

    extensions_dir = cwd / ".pi" / "extensions"
    skills_dir = cwd / ".pi" / "skills"
    agents_dir = cwd / ".pi" / "agents"

    _, _, cmd_to_ext, tool_to_ext = extract_extension_surfaces(extensions_dir)
    known_exts = set(p.stem for p in extensions_dir.glob("*.ts"))
    known_skills = all_skills(skills_dir)
    known_agents = set(p.stem for p in agents_dir.glob("*.md"))

    skill_last_seen: dict[str, dt.datetime] = {}
    ext_last_seen: dict[str, dt.datetime] = {}
    agent_last_seen: dict[str, dt.datetime] = {}

    files = list(bucket.glob("*.jsonl")) if bucket.exists() else []

    for _, obj in iter_jsonl_lines(files):
        ts = parse_ts(obj.get("timestamp"))
        if ts is None:
            continue

        if obj.get("type") != "message":
            continue
        msg = obj.get("message", {})
        role = msg.get("role")

        # toolResult usage signal by tool name -> extension
        if role == "toolResult":
            tool_name = msg.get("toolName")
            if isinstance(tool_name, str) and tool_name in tool_to_ext:
                ext = tool_to_ext[tool_name]
                if ext not in ext_last_seen or ts > ext_last_seen[ext]:
                    ext_last_seen[ext] = ts

        content = msg.get("content")
        if not isinstance(content, list):
            continue

        for part in content:
            if not isinstance(part, dict):
                continue

            # skill usage via read tool path
            if part.get("type") == "toolCall":
                name = part.get("name")
                args_obj = part.get("arguments", {})
                if name == "read" and isinstance(args_obj, dict):
                    path = args_obj.get("path")
                    if isinstance(path, str):
                        m = SKILL_PATH_RE.search(path)
                        if m:
                            skill = m.group(1)
                            if skill in known_skills and (skill not in skill_last_seen or ts > skill_last_seen[skill]):
                                skill_last_seen[skill] = ts
                        m_agent = AGENT_PATH_RE.search(path)
                        if m_agent:
                            agent = m_agent.group(1)
                            if agent in known_agents and (agent not in agent_last_seen or ts > agent_last_seen[agent]):
                                agent_last_seen[agent] = ts

            # extension usage via user slash commands
            if role == "user" and part.get("type") == "text":
                text = part.get("text")
                if isinstance(text, str):
                    for cmd in CMD_RE.findall(text):
                        ext = cmd_to_ext.get(cmd)
                        if ext and (ext not in ext_last_seen or ts > ext_last_seen[ext]):
                            ext_last_seen[ext] = ts
                    for mention in MENTION_RE.findall(text):
                        if mention in known_agents and (mention not in agent_last_seen or ts > agent_last_seen[mention]):
                            agent_last_seen[mention] = ts

    now = dt.datetime.now(dt.timezone.utc)
    report = build_report(
        now=now,
        threshold_days=args.days,
        skill_last_seen=skill_last_seen,
        ext_last_seen=ext_last_seen,
        agent_last_seen=agent_last_seen,
        all_skill_names=known_skills,
        all_ext_names=known_exts,
        all_agent_names=known_agents,
        scanned_files=len(files),
    )

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(report, encoding="utf-8")
    print(f"Wrote {out}")

    if args.json_out:
        payload = build_json_payload(
            now=now,
            threshold_days=args.days,
            skill_last_seen=skill_last_seen,
            ext_last_seen=ext_last_seen,
            agent_last_seen=agent_last_seen,
            all_skill_names=known_skills,
            all_ext_names=known_exts,
            all_agent_names=known_agents,
            scanned_files=len(files),
        )
        json_out = Path(args.json_out)
        json_out.parent.mkdir(parents=True, exist_ok=True)
        json_out.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
        print(f"Wrote {json_out}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
