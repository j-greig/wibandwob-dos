---
name: codex
description: Delegate tasks to OpenAI Codex CLI as a subagent. Three modes — analysis (read-only debugging/review), implementation (file writes), and review (structured code review with artifact output). Use when stuck after 2+ fix attempts, need a second opinion, want multi-file debugging, root-cause analysis, cross-file refactors, or architecture review.
---

# Codex — Unified Subagent Skill

Delegate to OpenAI Codex CLI. One skill, three modes.

## Modes

| Mode | Sandbox | Use for |
|------|---------|---------|
| analysis | read-only | Debugging, root-cause, architecture review |
| implementation | workspace-write | Refactoring, feature work, applying fixes |
| review | read-only | Structured code review with saved artifacts |

## Quick Start

**Preferred: use the pi codex tool directly:**
```
codex-analyst: "diagnose the crash in app/micropolis_ascii_view.cpp"
codex-worker: "fix the timer cleanup in app/room_chat_view.cpp"
```

**Or via scripts:**

```bash
# Analysis (read-only, default)
.claude/skills/codex/scripts/run.sh "diagnose the race condition in app/engine.cpp"

# Implementation (writes files)
.claude/skills/codex/scripts/run.sh --impl "refactor error handling in app/api_ipc.cpp"

# Structured review with artifact
.claude/skills/codex/scripts/codex_review.sh \
  --prompt "Review app/wibwob_view.cpp for memory leaks" --tag mem
```

## Prompt Templates

### Analysis

```text
EFFICIENCY: Use targeted commands, not full-file dumps.
Prefer rg -n -C3 'pattern' file or sed -n '45,55p' file.

TASK: Diagnose <issue>.
Scope: <file1>, <file2>
Symptoms: <what fails>
Repro: <command>

Deliver:
1) Root cause with file:line references
2) Fix options with tradeoffs
3) Risks and tests to add
```

### Implementation

```text
DEVNOTE: Files inside .codex-logs/ are run logs — ignore them completely.

EFFICIENCY: Use targeted commands, not full-file dumps.

TASK: <one-line summary>.
Files: <file list>
Constraints: <requirements>

Do:
1) Make the smallest correct changes
2) Build: cmake --build ./build
3) Test: <test command> — all must pass
4) Summarise what changed and why
```

### Review

```bash
.claude/skills/codex/scripts/codex_review.sh \
  --prompt "Security audit of tools/api_server/main.py" \
  --effort xhigh --tag security
```

## Script Flags

### run.sh
- `--impl` enables workspace-write sandbox and -a never (for background runs)
- `CODEX_MODEL=gpt-5.3-codex` override model
- `CODEX_LOG_DIR=path` redirect logs
- `CODEX_REPO=path` different repo

### codex_review.sh
- `--prompt <text>` review prompt (required)
- `--tag <slug>` output filename tag
- `--out <path>` explicit output file
- `--model <name>` override model
- `--effort <level>` low | medium | high | xhigh
- `--sandbox <mode>` read-only | workspace-write
- `--json` JSONL output format

## Critical Gotchas

1. Background runs MUST use `-a never` or they block waiting for approval
2. `--full-auto` is NOT safe for background — it maps to `-a on-request`
3. Always capture logs with `2>&1 | tee "$LOG"`
4. Implementation prompts need DEVNOTE or Codex stalls on its own logs
5. Codex tends to dump entire files — always include EFFICIENCY directive

## Log Locations

```bash
ls .codex-logs/$(date +%F)/           # today's logs
tail -f .codex-logs/**/*.log          # watch live
# Reviews:
ls cache/codex-reviews/               # structured review artifacts
```

## Common Mistakes

| Problem | Fix |
|---|---|
| Codex blocks mid-run | Use `--impl` for writes (sets `-a never`) |
| Lost output | Log path printed at start — always `tee`d |
| Codex edits own logs | Add DEVNOTE to implementation prompts |
| Codex dumps entire files | Add EFFICIENCY directive |
| Wrong repo | Set `CODEX_REPO` or `codex exec -C <path>` |
