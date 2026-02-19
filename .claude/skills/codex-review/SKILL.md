---
name: codex-review
description: Run OpenAI Codex CLI as a headless code reviewer with durable file output. Use when you need a second-opinion review from Codex, want to run codex exec non-interactively for code analysis, or need sandboxed GPT-powered review with saved artifacts. Works inside Claude Code sessions. Triggers on "codex review", "run codex on", "get a second opinion from codex", "codex check".
todo:
  - "Fix example paths in docs — should use full .claude/skills/codex-review/ prefix"
  - "Output location should respect --workdir when set, not just caller pwd"
  - "Add passthrough for --output-schema, --output-last-message, --profile"
  - "Clarify stderr handling rationale — thinking tokens vs error diagnostics"
---

# codex-review

Run `codex exec` headless as a code reviewer with timestamped artifact output.

## Defaults
- Sandbox: `read-only` (safe by default)
- Model: inherits from `~/.codex/config.toml`
- Effort: inherits from config
- File mode: stderr captured to output file (contains thinking tokens + errors)
- No-file mode: stderr passes through (errors visible)
- Output: `cache/codex-reviews/CODEX_REVIEW_<tag>_<timestamp>.txt`

## Command pattern

```bash
# Basic review (read-only, default model)
.claude/skills/codex-review/scripts/codex_review.sh \
  --prompt "Review app/wibwob_view.cpp for memory leaks" --tag mem

# High-effort security audit
.claude/skills/codex-review/scripts/codex_review.sh \
  --prompt "Security audit of tools/api_server/main.py" \
  --effort xhigh --tag security

# Allow edits (workspace-write sandbox)
.claude/skills/codex-review/scripts/codex_review.sh \
  --prompt "Refactor error handling in app/api_ipc.cpp" \
  --sandbox workspace-write --tag refactor

# JSON Lines output for machine parsing
.claude/skills/codex-review/scripts/codex_review.sh \
  --prompt "List all TODO comments with severity" \
  --json --tag todos
```

## Flags
- `--prompt <text>` review prompt (required)
- `--tag <slug>` output filename tag (default: `review`, alphanumeric/dash/underscore/dot only)
- `--out <path>` explicit output file path
- `--no-file` stream to stdout only
- `--model <name>` override codex model
- `--effort <level>` reasoning: `low` | `medium` | `high` | `xhigh`
- `--sandbox <mode>` `read-only` | `workspace-write` | `danger-full-access`
- `--confirm-danger` required alongside `--sandbox danger-full-access`
- `--workdir <path>` working directory for codex
- `--json` JSON Lines output format
- `--skip-git` skip git repository check

## Sandbox modes
| Mode | Use case | Gate |
|---|---|---|
| `read-only` (default) | Code review, analysis, audits | None |
| `workspace-write` | Refactoring, applying fixes | None |
| `danger-full-access` | CI/CD only | Requires `--confirm-danger` flag |

## After running
1. Read the output file and summarize key findings
2. Verify suggestions before applying
3. Only use `workspace-write` when edits are explicitly requested

## Guardrails
- Default to `read-only` unless user explicitly requests writes
- `danger-full-access` rejected without `--confirm-danger` flag
- Always write raw output for debugging (default behavior)
- Preflight checks: codex CLI must be in PATH, tag must be safe characters

<todo>
From codex self-review (cache/codex-reviews/CODEX_REVIEW_self-review_20260215_183658.txt):
4. Example paths in docs should use full .claude/skills/codex-review/ prefix from repo root
5. Output location uses caller pwd, not --workdir — consider aligning these
6. No passthrough for --output-schema, --output-last-message, --add-dir, --profile
7. Stderr handling rationale could be clearer — file mode captures everything, no-file mode passes through
</todo>
