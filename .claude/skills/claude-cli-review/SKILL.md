---
name: claude-cli-review
description: Use Claude CLI to review files or proposals and save the full output to a timestamped artifact by default, then summarize findings for follow-up edits.
---

# claude-cli-review

Use Claude CLI as a second-opinion reviewer with durable output artifacts.

## Use when
- You want independent feedback on code, skill design, issue text, or implementation plans.
- You need a saved review transcript for traceability.
- You want Codex to run Claude, then read and summarize key actions.

## Default behavior
- Always write Claude output to a file under `cache/claude-cli-reviews/` unless explicitly disabled.
- Include absolute file paths in prompt context.
- After Claude runs, read the output file and summarize concrete fixes.

## Command pattern

```bash
# From repo root
.claude/skills/claude-cli-review/scripts/run_claude_review.sh \
  --prompt "Review /abs/path/to/file and propose concrete edits" \
  --tag my-topic
```

## Flags
- `--prompt <text>` required prompt for `claude -p`
- `--tag <slug>` optional output filename tag
- `--out <path>` explicit output file path
- `--no-file` disable file output and stream to stdout

## Guardrails
- Prefer file output mode (`--no-file` only when explicitly requested).
- Keep prompts specific: ask for severity-ranked findings and exact edit suggestions.
- Read output file before acting; do not assume Claude’s advice is correct without verification.
