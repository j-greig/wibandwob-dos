#!/usr/bin/env python3
"""
gen-skills-doc.py — generate docs/skills.md from live skill data.

Sources (read-only):
  .pi/skills/*/SKILL.md        — name, description, trigger phrases
  .pi/metrics/usage-last-seen.json — last-used dates and counts

Output:
  docs/skills.md               — sections-first format, quick-ref table at bottom

Run any time to regenerate an up-to-date index:
  python3 scripts/gen-skills-doc.py
"""

import json, re, sys
from pathlib import Path
from datetime import datetime, timezone

ROOT        = Path(__file__).parent.parent
SKILLS_DIR  = ROOT / ".pi" / "skills"
USAGE_FILE  = ROOT / ".pi" / "metrics" / "usage-last-seen.json"
OUTPUT      = ROOT / "docs" / "skills.md"

# ── family groupings ─────────────────────────────────────────────────────────
FAMILIES = {
    "chiptune":        ["chiptune", "chiptune-cover", "chiptune-studio"],
    "autoresearch":    ["autoresearch", "autoresearch-microapp-migration"],
    "simplify":        ["simplify", "simplify-docs", "simplify-planning"],
    "wibwob-ops":      ["wibwobdos", "wibwobdos-cinema", "ww-ops"],
    "pi-introspection":["pi-extension-catalogue", "pi-session-log-explorer", "pi-usage-audit"],
}

FAMILY_OF = {skill: fam for fam, members in FAMILIES.items() for skill in members}

FAMILY_NOTES = {
    "chiptune":         "chiptune (see also: chiptune-cover, chiptune-studio)",
    "autoresearch":     "autoresearch (see also: autoresearch-microapp-migration)",
    "simplify":         "simplify (see also: simplify-docs, simplify-planning)",
    "wibwob-ops":       "wibwob-ops (see also: wibwobdos, wibwobdos-cinema, ww-ops)",
    "pi-introspection": "pi-introspection (see also: pi-extension-catalogue, pi-session-log-explorer, pi-usage-audit)",
}

# ── role-label heuristics ─────────────────────────────────────────────────────
ROLE_MAP = {
    "agentic-dev-reflection":          "Friction Journalist",
    "autoresearch":                    "Skill Optimiser",
    "autoresearch-microapp-migration": "Migration Pilot",
    "backroom-log-explorer":           "Archive Curator",
    "changelog":                       "Release Scribe",
    "chiptune":                        "Chiptune Composer",
    "chiptune-cover":                  "Chiptune Arranger",
    "chiptune-studio":                 "Studio Engineer",
    "codex":                           "Codex Delegate",
    "commit":                          "Commit Gatekeeper",
    "composable-engines":              "Engine Extractor",
    "devlog-briefing":                 "Session Briefer",
    "discord-tui-share":               "TUI Broadcaster",
    "figlet-videographer":             "Typography VJ",
    "git-branch-oneliners":            "Git Reporter",
    "img-to-ascii":                    "ASCII Converter",
    "joan-stark-ascii-art":            "Art Librarian",
    "librarian":                       "Repo Cacher",
    "michel-gondry-music-video-director": "Director Lens",
    "pi-extension-catalogue":          "Extension Mapper",
    "pi-session-log-explorer":         "Session Archaeologist",
    "pi-usage-audit":                  "Stale-Skill Auditor",
    "planning-update":                 "Planning Closer",
    "qmd":                             "Knowledge Searcher",
    "repo-hygiene":                    "Repo Janitor",
    "session-archaeology":             "Confusion Miner",
    "signls":                          "Sequencer Pilot",
    "simplify":                        "Code Simplifier",
    "simplify-docs":                   "Docs Simplifier",
    "simplify-planning":               "Planning Simplifier",
    "skill-creator":                   "Skill Architect",
    "timeline-smoke":                  "Timeline Tester",
    "tui-smoke-test":                  "TUI Test Writer",
    "vj-timeline":                     "Show Director",
    "wibwob-hosting-smoke":            "Deployment Validator",
    "wibwobdos":                       "Desktop Operator",
    "wibwobdos-cinema":                "Reel Director",
    "ww-ops":                          "Ops Engineer",
    "ww-primitives":                   "Primitives Maintainer",
    "ww-room-chat":                    "Room Chat Launcher",
    "youtube-transcript":              "Transcript Fetcher",
}

# ── trigger extraction ────────────────────────────────────────────────────────

def extract_triggers(desc: str) -> list[str]:
    """Pull trigger phrases from a skill description string."""
    triggers = []

    # Explicit "Use when:" / "Triggers on:" / "Invoke on:" lists
    for pattern in [
        r"(?:Use when|Triggers on|Trigger on|Invoke on|triggers on)[:\s]+(.+?)(?:\.|$)",
        r"(?:Use for)[:\s]+(.+?)(?:\.|$)",
    ]:
        m = re.search(pattern, desc, re.I | re.DOTALL)
        if m:
            raw = m.group(1)
            # Split on commas and quoted phrases
            parts = re.split(r',\s*(?="|\w)', raw)
            for p in parts:
                p = p.strip().strip('"').strip("'").strip("`").rstrip(".")
                if 4 <= len(p) <= 70:
                    triggers.append(p)

    # Quoted strings anywhere in desc
    for q in re.findall(r'"([^"]{4,60})"', desc):
        if q not in triggers:
            triggers.append(q)

    return triggers[:8]  # cap at 8


def extract_doesnot(desc: str, skill_name: str) -> str:
    """Generate a does-not boundary from the description."""
    # Look for explicit "not for" / "does not" in desc
    m = re.search(r'(?:not for|does not|won\'t|excludes)[^\n.]{0,120}', desc, re.I)
    if m:
        return m.group(0).strip().rstrip(".")

    # Infer from family membership
    fam = FAMILY_OF.get(skill_name)
    inferences = {
        "chiptune":         "Does not produce MIDI — use signls. Does not record TUI — use wibwobdos-cinema.",
        "autoresearch":     "Does not make runtime or code changes — optimisation loop only.",
        "simplify":         "Does not simplify other domains in this family — pick the right variant.",
        "wibwob-ops":       "Does not overlap with the other two wibwob-ops members — see family note.",
        "pi-introspection": "Does not modify the data it reads — audit and report only.",
    }
    if fam and fam in inferences:
        return inferences[fam]

    return "Does not perform tasks outside its described scope — check the SKILL.md for boundaries."


# ── frontmatter parser ────────────────────────────────────────────────────────

def parse_skill(skill_dir: Path) -> dict:
    skill_md = skill_dir / "SKILL.md"
    if not skill_md.exists():
        return {}

    text = skill_md.read_text(encoding="utf-8")
    lines = text.split("\n")

    # Extract between first pair of ---
    fm_lines, in_fm, fm_done = [], False, False
    for line in lines:
        if line.strip() == "---":
            if not in_fm:
                in_fm = True
                continue
            else:
                fm_done = True
                break
        if in_fm:
            fm_lines.append(line)

    fm_text = "\n".join(fm_lines)

    # name
    name_m = re.search(r'^name:\s*(.+)$', fm_text, re.M)
    name = name_m.group(1).strip().strip('"\'') if name_m else skill_dir.name

    # description (handles scalar, |, >-, >)
    desc_m = re.search(r'^description:\s*(.*?)(?=^\w|\Z)', fm_text, re.M | re.DOTALL)
    desc = ""
    if desc_m:
        raw = desc_m.group(0).replace("description:", "").strip()
        raw = re.sub(r'^[|>-]\s*', '', raw, flags=re.M)
        desc = " ".join(raw.split())

    return {"name": name, "slug": skill_dir.name, "desc": desc}


# ── usage data ────────────────────────────────────────────────────────────────

def load_usage() -> dict:
    if not USAGE_FILE.exists():
        return {}
    data = json.loads(USAGE_FILE.read_text())
    return data.get("surfaces", {}).get("skills", {})


def fmt_last_seen(usage: dict, slug: str) -> str:
    entry = usage.get(slug)
    if not entry or not entry.get("lastSeen"):
        return "never"
    dt = datetime.fromisoformat(entry["lastSeen"].replace("Z", "+00:00"))
    days = (datetime.now(timezone.utc) - dt).days
    date_str = dt.strftime("%Y-%m-%d")
    if days == 0:
        return f"today ({date_str})"
    if days == 1:
        return f"yesterday ({date_str})"
    if days <= 7:
        return f"{days}d ago ({date_str})"
    return f"{date_str}  ⚠️ stale" if days > 14 else date_str


# ── section renderer ──────────────────────────────────────────────────────────

def render_section(skill: dict, usage: dict) -> str:
    slug    = skill["slug"]
    desc    = skill["desc"]
    role    = ROLE_MAP.get(slug, "Specialist")
    last    = fmt_last_seen(usage, slug)
    fam     = FAMILY_OF.get(slug)

    triggers  = extract_triggers(desc)
    doesnot   = extract_doesnot(desc, slug)

    # Fallback triggers from description keywords if extraction came up short
    if len(triggers) < 3:
        # pull quoted phrases from the description directly
        extras = [q for q in re.findall(r'"([^"]{4,50})"', desc) if q not in triggers]
        triggers += extras
    if len(triggers) < 3:
        # last resort: first sentence split on commas
        first = desc.split(".")[0]
        for chunk in first.split(","):
            t = chunk.strip().strip('"').strip()
            if 4 <= len(t) <= 60 and t not in triggers:
                triggers.append(t)

    # hard-coded extras for skills with sparse frontmatter
    EXTRA_TRIGGERS = {
        "img-to-ascii":       ["convert image to ASCII", "image to primer", "img-to-ascii", "turn this image into text art"],
        "joan-stark-ascii-art": ["find ASCII art", "Joan Stark art", "period-authentic ASCII", "jgs art", "ASCII animal"],
    }
    if slug in EXTRA_TRIGGERS:
        for t in EXTRA_TRIGGERS[slug]:
            if t not in triggers:
                triggers.append(t)

    trigger_str = ", ".join(f'"{t}"' for t in triggers[:7]) if triggers else '"(see SKILL.md)"'

    lines = [f"## {slug}"]
    lines.append(f"**Your {role}** — {desc[:160].rstrip()}{'…' if len(desc) > 160 else ''}")
    lines.append("")
    lines.append(f"Triggers on: {trigger_str}.")
    lines.append("")
    lines.append(f"Does not: {doesnot}")
    lines.append("")
    if fam:
        lines.append(f"> **Family:** {FAMILY_NOTES[fam]}")
        lines.append("")
    lines.append(f"Last used: {last} · See: `.pi/skills/{slug}/SKILL.md`")

    return "\n".join(lines)


# ── quick-ref table ───────────────────────────────────────────────────────────

def render_table(skills: list[dict]) -> str:
    rows = ["## Quick Reference", "",
            "| Skill | Specialist | What they do |",
            "|-------|-----------|--------------|"]
    for s in skills:
        role = ROLE_MAP.get(s["slug"], "Specialist")
        blurb = s["desc"].split(".")[0][:80]
        rows.append(f"| {s['slug']} | {role} | {blurb} |")
    return "\n".join(rows)


# ── main ──────────────────────────────────────────────────────────────────────

def main():
    skills = sorted(
        (parse_skill(d) for d in SKILLS_DIR.iterdir() if d.is_dir() and (d / "SKILL.md").exists()),
        key=lambda s: s["slug"]
    )
    usage = load_usage()

    fam_slugs = [s for fam in FAMILIES.values() for s in fam]
    fam_summary = " · ".join(f"{fam} × {len(members)}" for fam, members in FAMILIES.items())

    parts = [
        "# WibWob-DOS Skills",
        "",
        "One scannable index of every `.pi/skills/` entry — who they are, when to invoke "
        "them, and what they won't do.",
        "",
        f"> **Family consolidation candidates:** {fam_summary}",
        "",
        "> Generated by `scripts/gen-skills-doc.py` — re-run any time to update.",
        "",
        "---",
        "",
    ]

    for skill in skills:
        parts.append(render_section(skill, usage))
        parts.append("")
        parts.append("---")
        parts.append("")

    parts.append(render_table(skills))
    parts.append("")

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text("\n".join(parts), encoding="utf-8")
    print(f"Written {OUTPUT} ({OUTPUT.stat().st_size} bytes, {len(skills)} skills)")


if __name__ == "__main__":
    main()
