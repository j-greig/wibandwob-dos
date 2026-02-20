---
name: codex-runner
description: Use when delegating a task to the OpenAI Codex CLI as a background subagent. Best for multi-file debugging, root-cause analysis, cross-file refactors, code review, feature implementation, or architecture review — especially when stuck after 2+ fix attempts or when a fresh agent with isolated context would help.
---

# Codex Runner

Delegate tasks to OpenAI Codex CLI (`codex exec`) in non-interactive mode. Two modes: **analysis** (read-only) and **implementation** (writes files). Designed to be portable across projects — configure via env vars, not by editing this file.

---

## Configuration

All settings have sensible defaults. Override by exporting env vars before running, or by adding them to your shell profile / project `.env`.

```bash
# Where session logs are written.
# Default: .codex-logs/ in the git repo root (or $PWD if not in a git repo).
export CODEX_LOG_DIR="$HOME/.local/state/codex-runner"   # example: redirect to user state dir

# Working directory Codex operates in.
# Default: git repo root of the current directory, or $PWD.
export CODEX_REPO="/path/to/other/repo"

# Model override. Omit to let Codex use its own default.
export CODEX_MODEL="o4-mini"
```

---

## When to use

- Root-cause analysis across multiple files
- Hard-to-reproduce bugs, race conditions, state issues
- Cross-file refactors or feature implementation
- Architecture review or second opinion
- Stuck after 2+ fix attempts

---

## Setup — copy-paste header

Paste this block at the top of any Codex invocation to resolve all defaults in one place:

```bash
# --- codex-runner env setup ---
_REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo "$PWD")
CODEX_REPO="${CODEX_REPO:-$_REPO_ROOT}"
CODEX_LOG_DIR="${CODEX_LOG_DIR:-$_REPO_ROOT/.codex-logs}"
_LOG="$CODEX_LOG_DIR/$(date +%F)/codex-<topic>-$(date +%Y%m%d-%H%M%S).log"
mkdir -p "$(dirname "$_LOG")"
_MODEL_FLAG="${CODEX_MODEL:+-m $CODEX_MODEL}"
# --- end setup ---
```

Replace `<topic>` with a short slug for the task (`auth-bug`, `refactor-registry`, etc.).

Logs land in `.codex-logs/YYYY-MM-DD/` by default — add `.codex-logs/` to `.gitignore` or commit selectively.

---

## Modes

### 1. Analysis (read-only, default)

No file writes. Use for investigation, review, diagnosis.

```bash
codex exec $_MODEL_FLAG -C "$CODEX_REPO" "<prompt>" \
  2>&1 | tee "$_LOG" &
```

### 2. Implementation (workspace-write)

Codex reads and writes files. `-a never` is **mandatory** for background runs — without it Codex blocks waiting for approval that never comes.

```bash
codex $_MODEL_FLAG -s workspace-write -a never exec -C "$CODEX_REPO" "<prompt>" \
  2>&1 | tee "$_LOG" &
```

---

## Critical gotchas

1. **Always capture logs** with `2>&1 | tee "$_LOG"`. Codex reasoning is ephemeral — 100k+ tokens vanish when the process ends.
2. **Background runs need `-a never`**. Without it Codex will pause waiting for human approval.
3. **`--full-auto` is NOT safe for background runs** — it maps to `-a on-request`, which can still pause.
4. **Add a DEVNOTE to implementation prompts** to stop Codex getting confused by its own log file:

```text
DEVNOTE: Files matching codex-*.log or inside .codex-logs/ are intentional run logs.
Ignore them completely. Do not mention or propose changes for them.
```

---

## Prompt templates

### Analysis

```text
TASK: Diagnose <issue>.

Scope:
- Files: <file1>, <file2>
- Symptoms: <what fails and how>
- Repro: <command to reproduce>

Deliver:
1) Root cause
2) Fix options with tradeoffs
3) Risks and tests to add
```

### Implementation

```text
DEVNOTE: Files matching codex-*.log or inside .codex-logs/ are intentional run logs. Ignore completely.

TASK: <one-line summary>.

Context:
- Files: <file list>
- Constraints: <requirements>

Do:
1) Make the smallest correct changes
2) Build: <build command>
3) Test: <test command> — all must pass
4) Summarise what changed and why
```

---

## Monitoring

```bash
# Check progress
tail -40 "$_LOG"

# Watch live
tail -f "$_LOG"

# Resume a previous session
codex exec resume --last
```

Progress indicators in logs: `thinking` sections (reasoning), `exec` sections (commands run), `tokens used NNNNN` (cumulative cost signal).

---

## CLI flags reference

```
codex exec              Non-interactive execution (alias: codex e)
-C, --cd <DIR>          Working directory
-m, --model <MODEL>     Model override (omit to use Codex default; set $CODEX_MODEL)
-s, --sandbox           read-only (default) | workspace-write | danger-full-access
-a, --ask-for-approval  untrusted | on-request | never
--full-auto             Alias for -a on-request -s workspace-write (NOT for background)
--add-dir <DIR>         Grant additional write-access dirs (repeatable)
--search                Enable live web search
--json                  Emit JSONL events instead of formatted text
-o <FILE>               Write final message to file
--skip-git-repo-check   Allow non-git directories
```

**For unattended background runs:** always `-s workspace-write -a never`.

---

## Quick checklist

### Before
- [ ] Mode chosen: analysis (no `-s`) or implementation (`-s workspace-write`)
- [ ] Background run: `-a never` present
- [ ] Log var set: `_LOG` resolves to a real path (`echo $_LOG`)
- [ ] `mkdir -p "$(dirname "$_LOG")"` has run
- [ ] Implementation prompt: DEVNOTE boilerplate included

### After
- [ ] Share log path with user: `echo "Log: $_LOG"`
- [ ] Review any agent-generated files — commit, move, or discard per project convention
- [ ] Summarise findings and next steps

---

## Common mistakes

| Mistake | Fix |
|---|---|
| Codex can't write files | Add `-s workspace-write` |
| Codex blocks mid-run | Add `-a never` for background runs |
| Codex asks about its own log file | Add DEVNOTE to prompt |
| Lost all reasoning output | Always `tee` to `$_LOG` |
| Codex reads entire codebase | Narrow prompt to specific files |
| Log ends up in wrong place | Set `CODEX_LOG_DIR` before running |
