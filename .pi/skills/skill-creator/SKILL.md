---
name: skill-creator
description: >
  Create well-structured Agent Skills that follow the agentskills.io specification
  and best practices. Use when building a new skill, restructuring an existing one,
  writing a SKILL.md, or when the user says "make a skill", "create a skill",
  "scaffold a skill", "write a SKILL.md", or asks how to structure skill directories,
  frontmatter, descriptions, scripts, or progressive disclosure.
---

# Skill Creator

Build skills that follow the [Agent Skills spec](https://agentskills.io/specification.md)
and [best practices](https://agentskills.io/skill-creation/best-practices.md).

## Workflow

### 1. Scaffold the directory

```
<skill-name>/
├── SKILL.md              # Required: frontmatter + core instructions
├── scripts/              # Optional: bundled executables
├── references/           # Optional: detailed docs (progressive disclosure)
└── assets/               # Optional: templates, data files
```

### 2. Write the frontmatter

```yaml
---
name: my-skill            # lowercase, hyphens only, matches dir name, max 64 chars
description: >            # max 1024 chars — this is the trigger
  What it does and when to use it. Be pushy: "Use when..." and list
  trigger phrases the user might say.
---
```

**Name rules:** lowercase a-z, 0-9, hyphens. No leading/trailing/consecutive hyphens.
Must match parent directory name.

### 3. Write the SKILL.md body

The body is loaded when the skill activates. Keep it **under 500 lines / 5000 tokens**.

**Include:**
- Step-by-step instructions needed on every run
- Defaults + fallback paths
- Validation loop and done criteria
- Links to `references/` files for deep detail

**Omit:**
- Things the agent already knows
- Exhaustive optional edge cases without strong evidence
- Long reference material better placed under `references/`

**The LLM-known test:** before writing any instruction, ask — would an LLM already
know this from training data? General TypeScript conventions, standard git workflow,
common CLI patterns — these waste tokens without adding orientation. Only write what
is genuinely non-obvious about *this* repo or *this* tool.

### 4. Write the description (the trigger gate)

The description carries the entire burden of triggering.

Principles:
- **Imperative:** "Use when..."
- **Intent-focused:** user goal, not internal mechanics
- **Pushy:** include likely and non-obvious trigger phrasings
- **Concise:** short paragraph quality > long text quantity

### 5. Add a required Gotchas section

Every production skill should include a `Gotchas` section containing:
- recurring failure symptom
- likely cause
- detection step
- canonical fix

Keep this updated from real execution traces.

### 6. Progressive disclosure structure

Three tiers of context loading:

| Tier | What | When loaded | Budget |
|------|------|-------------|--------|
| Metadata | `name` + `description` | Always | ~100 tokens |
| Instructions | SKILL.md body | On activation | < 5000 tokens |
| Resources | `references/`, `scripts/`, `assets/` | On demand | As needed |

Tell the agent **when** to load each reference file.

### 7. Bundle scripts for deterministic work

Scripts in `scripts/` should be:
- non-interactive (flags/env/stdin only)
- self-contained where possible
- explicit on failure (what failed, expected, next step)
- documented via `--help`

Use relative paths from skill root.

### 8. Description eval loop (minimum)

Before finalising, run a small trigger test set:
- ~8 should-trigger prompts
- ~8 should-not-trigger near-misses

Refine description based on misses.
Avoid keyword overfitting.

### 9. Output-quality eval loop (minimum)

For at least 2–3 real tasks:
- run with skill
- run without skill (or previous version)
- compare pass quality + time/token cost

Keep only skills that add clear value.

## Quick Checklist

```
- [ ] Directory name matches `name` field
- [ ] Description is intent-focused and trigger-strong
- [ ] Description <= 1024 chars
- [ ] SKILL.md <= 500 lines
- [ ] Includes defaults + validation loop + done criteria
- [ ] Includes Gotchas section
- [ ] Scripts are non-interactive with --help
- [ ] References are linked with explicit load conditions
- [ ] Trigger eval run completed
- [ ] Output-quality eval run completed
```

## References

Read these for deeper guidance:
- [references/best-practices.md](references/best-practices.md)
- [references/optimizing-descriptions.md](references/optimizing-descriptions.md)
- [references/evaluating-skills.md](references/evaluating-skills.md)
- [references/using-scripts.md](references/using-scripts.md)
- [references/specification.md](references/specification.md)

## Canonical Sources

- Spec: https://agentskills.io/specification.md
- Best practices: https://agentskills.io/skill-creation/best-practices.md
- Descriptions: https://agentskills.io/skill-creation/optimizing-descriptions.md
- Evaluating: https://agentskills.io/skill-creation/evaluating-skills.md
- Scripts: https://agentskills.io/skill-creation/using-scripts.md
- Index: https://agentskills.io/llms.txt

Pi-specific skills docs:
`/opt/homebrew/lib/node_modules/@mariozechner/pi-coding-agent/docs/skills.md`
