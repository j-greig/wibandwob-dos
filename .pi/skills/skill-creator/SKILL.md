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
- Step-by-step instructions the agent needs on every run
- Key settings, commands, examples
- Links to `references/` files for deeper content

**Omit:**
- Things the agent already knows (what a PDF is, how HTTP works)
- Exhaustive edge cases — let the agent's judgment handle most
- Long reference material — put it in `references/` instead

### 4. Write the description (the most important field)

The description carries the **entire burden of triggering**. If the agent doesn't
load your skill, nothing else matters.

**Principles:**
- **Imperative phrasing:** "Use when..." not "This skill does..."
- **Focus on user intent:** what the user is trying to achieve, not internals
- **Be pushy:** list specific trigger phrases and near-miss phrasings
- **Include non-obvious triggers:** "even if they don't mention X explicitly"
- **Stay concise:** a few sentences to a short paragraph

**Good:**
```yaml
description: >
  Extract text and tables from PDF files, fill PDF forms, merge multiple PDFs.
  Use when working with PDF documents, even if the user doesn't explicitly
  mention "PDF". Triggers on: "extract from this doc", "fill out this form",
  "merge these files", "parse this document".
```

**Bad:**
```yaml
description: Helps with PDFs.
```

### 5. Structure for progressive disclosure

Three tiers of context loading:

| Tier | What | When loaded | Budget |
|------|------|-------------|--------|
| Metadata | `name` + `description` | Always (startup) | ~100 tokens |
| Instructions | SKILL.md body | On activation | < 5000 tokens |
| Resources | `references/`, `scripts/`, `assets/` | On demand | As needed |

Move detailed docs to `references/` and tell the agent *when* to load them:
"Read `references/api-errors.md` if the API returns a non-200 status code."

### 6. Bundle scripts properly

Scripts in `scripts/` should be:
- **Self-contained** — inline dependencies where possible (PEP 723 for Python, npm: for Deno)
- **Non-interactive** — no TTY prompts, accept all input via flags/env/stdin
- **Helpful on failure** — say what went wrong, what was expected, what to try
- **Documented** — `--help` output is how the agent learns the interface

Use relative paths from skill root: `bash scripts/process.sh "$INPUT"`

### 7. Validate

Check against the spec:
- Name matches directory, lowercase, no bad hyphens
- Description exists and is under 1024 chars
- SKILL.md has valid YAML frontmatter
- Body under 500 lines
- File references are relative and one level deep

## Quick Checklist

```
- [ ] Directory name matches `name` field (lowercase, hyphens)
- [ ] Description is intent-focused with trigger phrases
- [ ] Description under 1024 chars
- [ ] SKILL.md body under 500 lines
- [ ] Core instructions only — reference docs in references/
- [ ] Scripts are self-contained with --help and good errors
- [ ] Relative paths throughout
- [ ] Tested: does the skill trigger on realistic prompts?
```

## References

Read these for deeper guidance on specific topics:

- [references/best-practices.md](references/best-practices.md) — scoping, calibrating control, patterns for effective instructions
- [references/optimizing-descriptions.md](references/optimizing-descriptions.md) — eval-driven description testing with train/validation splits
- [references/evaluating-skills.md](references/evaluating-skills.md) — test cases, assertions, grading, iteration loops
- [references/using-scripts.md](references/using-scripts.md) — one-off commands, inline deps, agentic script design
- [references/specification.md](references/specification.md) — full format spec (frontmatter, directories, validation)

## Canonical Sources

All guidance distilled from the Agent Skills standard:
- Spec: https://agentskills.io/specification.md
- Best practices: https://agentskills.io/skill-creation/best-practices.md
- Descriptions: https://agentskills.io/skill-creation/optimizing-descriptions.md
- Evaluating: https://agentskills.io/skill-creation/evaluating-skills.md
- Scripts: https://agentskills.io/skill-creation/using-scripts.md
- Index: https://agentskills.io/llms.txt

Pi-specific skill docs: `/opt/homebrew/lib/node_modules/@mariozechner/pi-coding-agent/docs/skills.md`
