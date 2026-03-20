#!/usr/bin/env python3
"""
Score docs/skills.md for the skill-index autoresearch loop.
Outputs METRIC lines. Max score = 100.

Dimensions (resistant to gaming — each requires genuine content):
  coverage  (30): each .pi/skills/ dir name appears in the doc
  triggers  (35): per-skill entry has 3+ distinct phrases (quoted/backtick/bullets)
  doesnot   (20): per-skill entry has an explicit "does not" / boundary statement
  roles     (15): per-skill entry has a role/specialist description

Anti-cheat: all four dimensions check for real content in the *correct section*
(700 chars after the skill name), not document-wide keyword counts.
"""
import os, re, sys
from pathlib import Path

SKILLS_DIR = Path(".pi/skills")
TARGET     = Path("docs/skills.md")

skills = sorted(p.name for p in SKILLS_DIR.iterdir() if p.is_dir())
total  = len(skills)

if not TARGET.exists():
    for metric in ["score=0", f"coverage=0", "triggers=0", "doesnot=0", "roles=0"]:
        print(f"METRIC {metric}")
    sys.exit(0)

content       = TARGET.read_text()
content_lower = content.lower()

# ── helpers ───────────────────────────────────────────────────────────────────

def find_section(skill: str) -> str:
    """Return ~700 chars starting at the skill's first mention."""
    for v in [skill, skill.replace("-", " "), skill.replace("-", "")]:
        idx = content_lower.find(v.lower())
        if idx != -1:
            return content[idx : idx + 700]
    return ""

# ── 1. Coverage (30 pts) ──────────────────────────────────────────────────────
covered     = [s for s in skills if find_section(s)]
coverage_pts = round(len(covered) / total * 30)

# ── 2. Trigger completeness (35 pts) ─────────────────────────────────────────
# Each covered skill needs 3+ distinct phrases in its section.
# Phrases counted: "quoted strings", `backtick phrases`, - Bullet points
trigger_rich = 0
for s in covered:
    sec     = find_section(s)
    quoted  = re.findall(r'["\u201c\u201d]([^""\n]{6,70})["\u201c\u201d]', sec)
    ticked  = re.findall(r'`([^`\n]{4,60})`',                               sec)
    bullets = re.findall(r'[\-\*]\s+([A-Z][^\n]{8,70})',                    sec)
    uniq    = set(p.lower().strip() for p in quoted + ticked + bullets)
    if len(uniq) >= 3:
        trigger_rich += 1

trigger_pts = round(trigger_rich / total * 35)

# ── 3. Does-NOT boundary (20 pts) ─────────────────────────────────────────────
doesnot_rich = 0
for s in covered:
    sec = find_section(s).lower()
    if re.search(r"does not|not for|won't|never |not a |avoids|excludes|do not use", sec):
        doesnot_rich += 1

doesnot_pts = round(doesnot_rich / total * 20)

# ── 4. Specialist role label (15 pts) ─────────────────────────────────────────
role_rich = 0
for s in covered:
    sec = find_section(s)[:350]
    if re.search(
        r"specialist|your [a-z]+|[A-Z][a-z]+ (?:engineer|artist|director|writer|"
        r"reviewer|curator|auditor|composer|pilot|operator|advisor|lens|guide)|expert",
        sec, re.I
    ):
        role_rich += 1

role_pts = round(role_rich / total * 15)

# ── result ────────────────────────────────────────────────────────────────────
total_score = coverage_pts + trigger_pts + doesnot_pts + role_pts

print(f"METRIC score={total_score}")
print(f"METRIC coverage={coverage_pts}  ({len(covered)}/{total} skills found)")
print(f"METRIC triggers={trigger_pts}  ({trigger_rich}/{total} with 3+ phrases)")
print(f"METRIC doesnot={doesnot_pts}  ({doesnot_rich}/{total} with does-not)")
print(f"METRIC roles={role_pts}  ({role_rich}/{total} with role label)")
