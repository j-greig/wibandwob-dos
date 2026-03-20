---
name: simplify-docs
description: >-
  Radically simplify documentation by applying the system-knowledge test: if a
  script, skill, CLI, or the running system already tells you something, don't
  write it down. Docs contain decisions, constraints, and conventions only.
  Use when: "simplify docs", "tighten specs", "agent-friendly docs",
  "progressive disclosure", "dedupe docs", "too many docs", "doc cleanup".
---

# Simplify Docs

## Core rule

> If the system already knows it, don't write it down.
> Docs contain decisions, constraints, and conventions — not procedures,
> file lists, or command references that `--help` already covers.

---

## The method

### Pass 1 — System knowledge test

For each section in each doc, ask:

1. Does a **skill** already cover this? → cut, point to skill
2. Does the **CLI help** tell you this? → cut, mention `--help`
3. Does the **running system** expose this? → cut, add `<progressive-disclosure>` tag
4. Does `ls` show you this? → cut file/key-file listings
5. Does **source JSDoc** document this? → cut, reference the source file

If yes to any: the section does not belong in the doc.

### Pass 2 — Overlap check

Cross-reference every doc against:
- Other docs (same concept in two places → one dies)
- Skills (doc restates what a skill's SKILL.md says → doc section dies)
- `scripts/gen-*` generators (doc restates generated output → replace with `<progressive-disclosure>` tag)

### Pass 3 — DRY / single-source ownership

1. One concept = one canonical owner file.
2. Secondary docs link, never restate.
3. If source code defines a contract, link the source path.
4. Remove stale duplicated content unless needed for explanation.

### Pass 4 — Agent decidability

1. Remove soft ambiguity (`should/could`) where direction is known.
2. File paths, command IDs, type names must match repo reality.
3. Prefer stepwise instructions over abstract statements.
4. Pick one default approach; list alternatives only as fallbacks.

### Pass 5 — Human scanability

1. Status clarity: active/in-progress/done/stale must be obvious.
2. Structure: convert prose into headers, lists, tables.
3. Signal-to-noise: move historical context under `Background` or delete.

---

## Progressive disclosure convention

`<progressive-disclosure>` tags in docs contain a one-liner describing what
a `scripts/gen-*` script provides, plus the command to run it.

```markdown
<progressive-disclosure>
Full SDK export directory with stability tiers: run `bun scripts/gen-sdk-surface.ts`
</progressive-disclosure>
```

Human maintains the doc. Agent maintains the generator script.
The tag bridges the two.

---

## CAPS MD governance

Root CAPS MD files (`AGENTS.md`, `PHILOSOPHY.md`, etc.) are the entire doc surface.
Max 7 — above that triggers human review. If a proposed doc doesn't earn CAPS
status, it either belongs in a skill, a script, or the running system.

---

## Fix policy

- **Delete over summarise.** If the system knows it, remove the section entirely.
- **Point don't restate.** Replace with a skill name or `<progressive-disclosure>` tag.
- **Preserve decisions.** Human rationale, design constraints, and invariants stay.

---

## Output summary

For each edited doc:
- What was deleted (system already knew it)
- What was replaced with a skill pointer
- What got a `<progressive-disclosure>` tag
- What remains as human-only knowledge
