---
name: claude-cli-review
description: Use Claude CLI (claude -p) to review files or proposals and save the full output to a timestamped artifact. Run from Codex or a terminal — cannot run inside Claude Code (use codex-review skill instead). Triggers on "claude review", "get claude's opinion", "second opinion from claude".
---

# claude-cli-review

Run `claude -p` as a second-opinion reviewer with durable output artifacts.

## Use when
- You want independent feedback from Claude on code, skill design, or implementation plans.
- You need a saved review transcript for traceability.
- You are running from Codex or a standalone terminal (NOT from inside Claude Code).

## Command pattern

```bash
# From repo root
.claude/skills/claude-cli-review/scripts/run_claude_review.sh \
  --prompt "Review /abs/path/to/file and propose concrete edits" \
  --tag my-topic
```

## Flags
- `--prompt <text>` required prompt for `claude -p`
- `--tag <slug>` optional output filename tag (alphanumeric, dash, underscore, dot)
- `--out <path>` explicit output file path
- `--no-file` disable file output and stream to stdout

## Guardrails
- Cannot run inside Claude Code (nested session protection). Use `codex-review` skill instead.
- Prefer file output mode (`--no-file` only when explicitly requested).
- Keep prompts specific: ask for severity-ranked findings and exact edit suggestions.
- Read output file before acting; do not assume Claude's advice is correct without verification.
