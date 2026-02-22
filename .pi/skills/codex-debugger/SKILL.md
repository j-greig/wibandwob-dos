---
name: codex-debugger
description: Delegate complex debugging, code review, or multi-file implementation to the Codex CLI agent. Read-only mode for analysis, workspace-write for edits. Unattended-safe with reliable log capture.
---

# Codex Debugger

Delegate to OpenAI Codex via `codex exec` (non-interactive). Two modes: analysis (read-only) and implementation (writes files).

## When to use

- Root-cause analysis across multiple files
- Hard-to-reproduce bugs, race conditions, state issues
- Cross-file refactors or feature implementation
- Architecture review or second opinion
- You're stuck after 2+ fix attempts

## Modes

### 1. Analysis (read-only, default)

No file writes. Use for investigation, review, diagnosis.

```bash
LOG="archive/session-logs/$(date +%F)/codex-<topic>-$(date +%Y%m%d-%H%M%S).log"
mkdir -p "$(dirname "$LOG")"

codex exec -C <repo> "<prompt>" \
  2>&1 | tee "$LOG" &
```

### 2. Implementation (workspace-write)

Codex reads and writes files. For background/unattended runs, `-a never` is **mandatory** — without it Codex blocks waiting for approval that never comes.

```bash
LOG="archive/session-logs/$(date +%F)/codex-<topic>-$(date +%Y%m%d-%H%M%S).log"
mkdir -p "$(dirname "$LOG")"

codex -s workspace-write -a never exec -C <repo> "<prompt>" \
  2>&1 | tee "$LOG" &
```

## Critical gotchas

1. **Always capture logs** with `2>&1 | tee "$LOG"`. Codex reasoning is ephemeral — 100k+ tokens vanish when the process ends.
2. **Background runs need `-a never`**. Without it, Codex will pause waiting for human approval.
3. **`--full-auto` is NOT safe for background runs** — it maps to `-a on-request`, which can still pause.
4. **DEVNOTE for implementation prompts** — prevents Codex stalling on its own log file:

```text
DEVNOTE: Files matching codex-*.log are intentional run logs and may be untracked.
Ignore them completely. Do not mention them or propose changes for them.
```

## Prompt templates

### Analysis prompt

```text
TASK: Diagnose <issue>.

EFFICIENCY: Use targeted commands, not full-file dumps.
Prefer rg -n -C3 'pattern' file (grep + context) or sed -n '45,55p' file (narrow range).
Avoid nl -ba file | sed -n '1,300p'. Only dump full files if <50 lines.

Scope:
- Files: <file1>, <file2>
- Symptoms: <what fails and how>
- Repro: <command to reproduce>

Deliver:
1) Root cause
2) Fix options with tradeoffs
3) Risks and tests to add
```

### Implementation prompt

```text
DEVNOTE: Files matching codex-*.log are intentional run logs. Ignore completely.

EFFICIENCY: Use targeted commands, not full-file dumps.
Prefer rg -n -C3 'pattern' file or sed -n '45,55p' file.
Avoid nl -ba file | sed -n '1,300p'. Only dump full files if <50 lines.

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

## Output modes

### Report file (preferred for subagent pattern)

Use `-o` to have Codex write its final answer to a file. Read the report, not the log. The log is backup/audit only.

```bash
REPORT="archive/session-logs/$(date +%F)/codex-<topic>-report.md"
LOG="archive/session-logs/$(date +%F)/codex-<topic>-$(date +%Y%m%d-%H%M%S).log"
mkdir -p "$(dirname "$LOG")"

codex exec -C <repo> -o "$REPORT" "<prompt>" \
  2>&1 | tee "$LOG" &
```

Add this to the end of prompts: `Write your findings to the output file as a structured markdown report.`

Then just `read "$REPORT"` when done — no log parsing needed.

### Log monitoring (fallback)

```bash
# Check progress
tail -40 "$LOG"

# Resume a previous session
codex exec resume --last
```

Progress indicators in logs: `thinking` sections (reasoning), `exec` sections (commands), `tokens used NNNNN` (cumulative).

## CLI flags reference

```
codex exec           Non-interactive execution (alias: codex e)
-C, --cd <DIR>       Working directory
-m, --model <MODEL>  Model override (default: gpt-5.3-codex)
-s, --sandbox        read-only (default) | workspace-write | danger-full-access
-a, --ask-for-approval  untrusted | on-request | never
--full-auto          Alias for -a on-request -s workspace-write (NOT for background)
--add-dir <DIR>      Grant additional write-access dirs (repeatable)
--search             Enable live web search
--json               Emit JSONL events instead of formatted text
-o <FILE>            Write final message to file
--skip-git-repo-check  Allow non-git directories
```

**For unattended background runs:** always `-s workspace-write -a never`.

## Quick checklist

Before:
- [ ] Correct mode chosen (analysis vs implementation)
- [ ] Background run: `-a never` flag present
- [ ] Implementation: `-s workspace-write` flag present  
- [ ] Log capture: `2>&1 | tee "$LOG"` with `&` for background
- [ ] Implementation prompt: DEVNOTE boilerplate included

After:
- [ ] Share log path with user
- [ ] Move any codex-generated files from repo root into `archive/session-logs/`
- [ ] Summarise findings and next steps

## Token efficiency in prompts

Codex tends to dump entire files with `nl -ba file.cpp | sed -n '1,300p'` which bloats logs with hundreds of lines the caller already has. This wastes tokens twice: once when Codex reads it, again when the caller reads the log back.

**Always include this directive in prompts:**

```text
EFFICIENCY: When inspecting files, use targeted commands — not full-file dumps.
Prefer: rg -n -C3 'pattern' file.cpp (grep with 3 lines context)
Prefer: sed -n '45,55p' file.cpp (narrow 10-line windows around the issue)
Avoid: nl -ba file.cpp | sed -n '1,300p' (wastes tokens on irrelevant lines)
Only dump full files if the entire file is <50 lines or you truly need all of it.
```

## Common mistakes

| Mistake | Fix |
|---------|-----|
| Codex can't write files | Add `-s workspace-write` |
| Codex blocks mid-run | Add `-a never` for background runs |
| Codex asks about its own log file | Add DEVNOTE to prompt |
| Lost all reasoning output | Always `tee` to a log file |
| Codex reads entire codebase | Narrow prompt to specific files |
| Codex dumps entire files into log | Add EFFICIENCY directive to prompt (see above) |
