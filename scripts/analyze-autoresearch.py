#!/usr/bin/env python3
"""
Analyze autoresearch subdirectories and produce a structured report.
Usage: python3 scripts/analyze-autoresearch.py /path/to/autoresearch [--json]
"""

import json, os, sys, glob
from pathlib import Path
from datetime import datetime

def parse_jsonl(path):
    """Parse autoresearch.jsonl, return (configs, experiments)."""
    configs = []
    experiments = []
    segment = 0
    try:
        with open(path) as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    entry = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if entry.get("type") == "config":
                    configs.append(entry)
                    if experiments:
                        segment += 1
                else:
                    entry["_segment"] = segment
                    experiments.append(entry)
    except Exception as e:
        return [], []
    return configs, experiments

def analyze_dir(dirpath):
    """Analyze a single autoresearch subdirectory."""
    name = os.path.basename(dirpath)
    result = {
        "name": name,
        "path": str(dirpath),
        "files": {},
        "status": "unknown",
        "has_jsonl": False,
        "has_md": False,
        "has_sh": False,
        "has_checks": False,
        "has_ideas": False,
        "has_screenshots": False,
        "extra_files": [],
    }

    # Catalog files
    for f in sorted(os.listdir(dirpath)):
        if f.startswith("."):
            continue
        fpath = os.path.join(dirpath, f)
        if os.path.isfile(fpath):
            result["files"][f] = os.path.getsize(fpath)
        elif os.path.isdir(fpath):
            count = len(os.listdir(fpath))
            result["files"][f + "/"] = count

    result["has_jsonl"] = "autoresearch.jsonl" in result["files"]
    result["has_md"] = "autoresearch.md" in result["files"]
    result["has_sh"] = "autoresearch.sh" in result["files"]
    result["has_checks"] = "autoresearch.checks.sh" in result["files"]
    result["has_ideas"] = "autoresearch.ideas.md" in result["files"]
    result["has_screenshots"] = "screenshot.png" in result["files"] or "shots/" in result["files"]

    # Extra files beyond the standard set
    standard = {"autoresearch.jsonl", "autoresearch.md", "autoresearch.sh",
                "autoresearch.checks.sh", "autoresearch.ideas.md",
                "screenshot.png", "shots/", ".DS_Store"}
    result["extra_files"] = [f for f in result["files"] if f not in standard]

    # Parse JSONL if present
    jsonl_path = os.path.join(dirpath, "autoresearch.jsonl")
    if os.path.exists(jsonl_path):
        configs, experiments = parse_jsonl(jsonl_path)
        result["configs"] = len(configs)
        result["total_runs"] = len(experiments)

        # Experiment breakdown
        status_counts = {}
        for e in experiments:
            s = e.get("status", "unknown")
            status_counts[s] = status_counts.get(s, 0) + 1
        result["status_counts"] = status_counts

        # Metric info from config
        if configs:
            latest_config = configs[-1]
            result["metric_name"] = latest_config.get("metricName", "unknown")
            result["metric_unit"] = latest_config.get("metricUnit", "")
            result["direction"] = latest_config.get("bestDirection", "lower")
            result["session_name"] = latest_config.get("name", name)

        # Metric progression
        if experiments:
            keeps = [e for e in experiments if e.get("status") == "keep" and e.get("metric", 0) > 0]
            if keeps:
                first_metric = experiments[0].get("metric", 0)
                best_metric = None
                direction = result.get("direction", "lower")
                for e in keeps:
                    m = e.get("metric", 0)
                    if best_metric is None:
                        best_metric = m
                    elif direction == "lower" and m < best_metric:
                        best_metric = m
                    elif direction == "higher" and m > best_metric:
                        best_metric = m

                result["baseline_metric"] = first_metric
                result["best_metric"] = best_metric
                result["last_metric"] = keeps[-1].get("metric", 0)

                if first_metric and first_metric != 0:
                    result["improvement_pct"] = round(
                        ((best_metric - first_metric) / first_metric) * 100, 1
                    )

                # Secondary metrics tracked
                sec_names = set()
                for e in experiments:
                    for k in e.get("metrics", {}).keys():
                        sec_names.add(k)
                result["secondary_metrics"] = sorted(sec_names)

            # Timestamps
            timestamps = [e.get("timestamp", 0) for e in experiments if e.get("timestamp")]
            if timestamps:
                result["first_run"] = datetime.fromtimestamp(min(timestamps) / 1000).isoformat()
                result["last_run"] = datetime.fromtimestamp(max(timestamps) / 1000).isoformat()

            # Last 3 experiment descriptions (for context)
            result["recent_descriptions"] = [
                e.get("description", "") for e in experiments[-3:]
            ]

        # Determine status
        if result["total_runs"] > 0:
            keep_rate = status_counts.get("keep", 0) / result["total_runs"]
            if keep_rate > 0.5:
                result["status"] = "productive"
            elif keep_rate > 0.2:
                result["status"] = "moderate"
            else:
                result["status"] = "struggling"
        else:
            result["status"] = "initialized_only"
    else:
        # No JSONL — check what we have
        if result["has_md"] and result["has_sh"]:
            result["status"] = "setup_not_run"
        elif result["has_md"] or any("plan" in f for f in result["files"]):
            result["status"] = "planning"
        else:
            result["status"] = "skeleton"

    # Read ideas file if present
    ideas_path = os.path.join(dirpath, "autoresearch.ideas.md")
    if os.path.exists(ideas_path):
        with open(ideas_path) as f:
            content = f.read()
        result["ideas_lines"] = len(content.strip().split("\n"))
        # Count bullet points
        result["ideas_bullets"] = sum(1 for line in content.split("\n")
                                       if line.strip().startswith("- "))
        result["ideas_preview"] = content[:500]

    # Read MD objective (first paragraph after ## Objective)
    md_path = os.path.join(dirpath, "autoresearch.md")
    if os.path.exists(md_path):
        with open(md_path) as f:
            md_content = f.read()
        result["md_size"] = len(md_content)
        # Extract objective
        lines = md_content.split("\n")
        in_objective = False
        obj_lines = []
        for line in lines:
            if "## Objective" in line or "## objective" in line:
                in_objective = True
                continue
            if in_objective:
                if line.startswith("## "):
                    break
                if line.strip():
                    obj_lines.append(line.strip())
        result["objective"] = " ".join(obj_lines[:3])[:300] if obj_lines else ""

    return result


def render_report(analyses):
    """Render markdown report from analyses."""
    lines = []

    # Summary table
    active = [a for a in analyses if a.get("total_runs", 0) > 0]
    setup = [a for a in analyses if a["status"] in ("setup_not_run", "planning", "skeleton")]
    init_only = [a for a in analyses if a["status"] == "initialized_only"]

    total_runs = sum(a.get("total_runs", 0) for a in analyses)
    total_keeps = sum(a.get("status_counts", {}).get("keep", 0) for a in analyses)
    total_crashes = sum(a.get("status_counts", {}).get("crash", 0) for a in analyses)
    ideas_count = sum(1 for a in analyses if a.get("has_ideas"))

    lines.append("## Overview\n")
    lines.append(f"- **{len(analyses)}** subdirectories total")
    lines.append(f"- **{len(active)}** with experiment data, **{len(setup) + len(init_only)}** setup/planning only")
    lines.append(f"- **{total_runs}** total experiment runs ({total_keeps} kept, {total_crashes} crashed)")
    lines.append(f"- **{ideas_count}/{len(analyses)}** have an ideas file ← low adoption")
    lines.append("")

    # Active experiments table
    lines.append("## Active Experiments\n")
    lines.append("| Task | Runs | Keep | Discard | Crash | Metric | Baseline → Best | Δ% | Status |")
    lines.append("|------|------|------|---------|-------|--------|-----------------|-----|--------|")
    for a in sorted(active, key=lambda x: x.get("total_runs", 0), reverse=True):
        sc = a.get("status_counts", {})
        metric = a.get("metric_name", "?")
        unit = a.get("metric_unit", "")
        baseline = a.get("baseline_metric")
        best = a.get("best_metric")
        pct = a.get("improvement_pct", "—")
        baseline_s = f"{baseline}{unit}" if baseline is not None else "—"
        best_s = f"{best}{unit}" if best is not None else "—"
        pct_s = f"{pct}%" if pct != "—" else "—"
        lines.append(
            f"| **{a['name']}** | {a.get('total_runs',0)} | "
            f"{sc.get('keep',0)} | {sc.get('discard',0)} | {sc.get('crash',0)} | "
            f"{metric} | {baseline_s} → {best_s} | {pct_s} | {a['status']} |"
        )
    lines.append("")

    # Ideas file adoption
    lines.append("## Ideas File Adoption\n")
    lines.append("| Task | Has Ideas? | Bullets | Lines | Notes |")
    lines.append("|------|-----------|---------|-------|-------|")
    for a in analyses:
        if a.get("has_ideas"):
            lines.append(
                f"| **{a['name']}** | ✅ | {a.get('ideas_bullets',0)} | "
                f"{a.get('ideas_lines',0)} | Active |"
            )
        elif a.get("total_runs", 0) > 3:
            lines.append(f"| **{a['name']}** | ❌ | — | — | **Should have one** (>{a.get('total_runs',0)} runs) |")
    lines.append("")

    # Per-task details
    lines.append("## Per-Task Details\n")
    for a in sorted(analyses, key=lambda x: x.get("total_runs", 0), reverse=True):
        lines.append(f"### {a['name']}\n")
        lines.append(f"- **Status:** {a['status']}")
        if a.get("objective"):
            lines.append(f"- **Objective:** {a['objective']}")
        if a.get("session_name"):
            lines.append(f"- **Session:** {a['session_name']}")

        files_present = []
        for key, label in [("has_md", "md"), ("has_sh", "sh"), ("has_jsonl", "jsonl"),
                           ("has_checks", "checks"), ("has_ideas", "ideas"),
                           ("has_screenshots", "screenshots")]:
            if a.get(key):
                files_present.append(label)
        lines.append(f"- **Files:** {', '.join(files_present) if files_present else 'minimal'}")

        if a.get("total_runs"):
            sc = a.get("status_counts", {})
            lines.append(f"- **Runs:** {a['total_runs']} (keep={sc.get('keep',0)} discard={sc.get('discard',0)} crash={sc.get('crash',0)} checks_failed={sc.get('checks_failed',0)})")
            if a.get("baseline_metric") is not None:
                unit = a.get("metric_unit", "")
                lines.append(f"- **Metric:** {a.get('metric_name','?')} — baseline {a['baseline_metric']}{unit} → best {a.get('best_metric','?')}{unit} ({a.get('improvement_pct','?')}%)")
            if a.get("secondary_metrics"):
                lines.append(f"- **Secondary:** {', '.join(a['secondary_metrics'])}")
            if a.get("first_run"):
                lines.append(f"- **Period:** {a['first_run'][:10]} → {a['last_run'][:10]}")
            if a.get("recent_descriptions"):
                lines.append(f"- **Recent:** {' | '.join(a['recent_descriptions'][-2:])}")

        if a.get("extra_files"):
            lines.append(f"- **Extra files:** {', '.join(a['extra_files'])}")

        if a.get("ideas_preview"):
            preview = a["ideas_preview"][:200].replace("\n", " ")
            lines.append(f"- **Ideas preview:** {preview}…")

        lines.append("")

    # Setup-only tasks
    setup_tasks = [a for a in analyses if a["status"] in ("setup_not_run", "planning", "skeleton")]
    if setup_tasks:
        lines.append("## Not Yet Run\n")
        lines.append("| Task | Status | Has MD | Has SH | Notes |")
        lines.append("|------|--------|--------|--------|-------|")
        for a in setup_tasks:
            notes = a.get("objective", "")[:80] or ", ".join(a.get("extra_files", []))[:80]
            lines.append(f"| **{a['name']}** | {a['status']} | {'✅' if a['has_md'] else '❌'} | {'✅' if a['has_sh'] else '❌'} | {notes} |")
        lines.append("")

    return "\n".join(lines)


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 analyze-autoresearch.py <autoresearch-dir> [--json]")
        sys.exit(1)

    root = sys.argv[1]
    as_json = "--json" in sys.argv

    analyses = []
    for entry in sorted(os.listdir(root)):
        dirpath = os.path.join(root, entry)
        if os.path.isdir(dirpath) and not entry.startswith("."):
            analyses.append(analyze_dir(dirpath))

    if as_json:
        print(json.dumps(analyses, indent=2))
    else:
        print(render_report(analyses))


if __name__ == "__main__":
    main()
