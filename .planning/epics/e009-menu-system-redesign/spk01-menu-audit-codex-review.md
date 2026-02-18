# SPK01 — Menu System Codex Review + Spike Plan

Status: not-started

## Purpose

Before implementing the menu redesign (E009), run a focused Codex session to:
1. Validate and extend the initial audit (`CODEX-ANALYSIS-MENU-AUDIT.md`)
2. Produce an ordered implementation sequence
3. Identify any blockers or unexpected complexity

## Codex prompt adjustments needed

The Codex job should be given:
- `CODEX-RETRO-20260218.md` as context (coding conventions + prior Codex guidance)
- `CODEX-ANALYSIS-MENU-AUDIT.md` as prior audit
- `app/command_registry.h`, `app/command_registry.cpp`, `app/window_type_registry.cpp`, `app/test_pattern_app.cpp`
- Explicit instructions to produce: ordered fix list, PR sequence, test plan

Key prompt additions:
- "Read CODEX-RETRO-20260218.md first for project conventions"
- "Read CODEX-ANALYSIS-MENU-AUDIT.md for the prior audit"
- "Produce an ordered implementation plan: which fixes first, which last, and why"
- "Flag any fixes that require a C++ rebuild to verify"

## Rules changes suggested

- Move all Codex analysis logs to `docs/codex-reviews/` subdirectory (currently cluttering repo root)
- Update CLAUDE.md Verification section to note `docs/codex-reviews/` as canonical log location
- Add note to Codex prompt template: "Save log to docs/codex-reviews/codex-<topic>-YYYYMMDD.log"

## Output

- Ordered implementation plan for E009 features
- Test plan for each fix
- PR sequence recommendation
