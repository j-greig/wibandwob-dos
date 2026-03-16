# Agent Model Reference

Keep agents on the latest models. Update this when Anthropic ships new versions.

**Source of truth:** https://platform.claude.com/docs/en/about-claude/models/overview.md

## Current Latest (2026-03-16)

| Tier | Model ID | Use For | Context | Cost (in/out MTok) |
|------|----------|---------|---------|-------------------|
| **Opus** | `anthropic/claude-opus-4-6` | Hard problems, architecture, security, adversarial | 1M | $5/$25 |
| **Sonnet** | `anthropic/claude-sonnet-4-6` | Default workhorse, reviews, multi-file edits | 1M | $3/$15 |
| **Haiku** | `anthropic/claude-haiku-4-5` | Fast/cheap: grep, status checks, trivial edits | 200k | $1/$5 |

## Agent Assignments

| Agent | Model | Rationale |
|-------|-------|-----------|
| `opus` | claude-opus-4-6 | Deep reasoning |
| `ops` | claude-opus-4-6 | Needs to diagnose complex runtime issues |
| `sonnet` | claude-sonnet-4-6 | General purpose |
| `code-reviewer` | claude-sonnet-4-6 | Pattern recognition at scale |
| `arch-reviewer` | claude-sonnet-4-6 | Cross-system correlation |
| `coat-reviewer` | claude-sonnet-4-6 | DRY/structural analysis |
| `haiku` | claude-haiku-4-5 | Speed over depth |

## When to Update

When Anthropic releases a new model generation:
1. Update this file
2. Update each `.pi/agents/*.md` frontmatter `model:` field
3. Verify with `grep "^model:" .pi/agents/*.md`
