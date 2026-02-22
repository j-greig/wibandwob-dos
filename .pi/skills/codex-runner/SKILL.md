---
name: codex-runner
description: Use when delegating a task to the OpenAI Codex CLI as a background subagent. Best for multi-file debugging, root-cause analysis, cross-file refactors, code review, feature implementation, or architecture review — especially when stuck after 2+ fix attempts or when a fresh agent with isolated context would help.
---

# Codex Runner

Delegate a task to Codex CLI as a background subagent. Logs everything — reasoning included.

## Examples

**1. Via Claude — easiest, use this if possible:**
```
/codex-runner analyse the race condition in app/engine.cpp
```
Claude reads the skill and generates the right command for you. No bash needed.

---

**2. Script directly — analysis (read-only):**
```bash
scripts/run.sh "diagnose the race condition in app/engine.cpp"
```

---

**3. Script directly — implementation + model override:**
```bash
CODEX_MODEL=gpt-5.3-codex scripts/run.sh --impl "refactor the tick loop in app/engine.cpp"
```
`--impl` lets Codex write files. Default model is `gpt-5.3-codex`; `CODEX_MODEL` overrides it.

> **Implementation prompts must start with this line** to stop Codex getting confused by its own log files:
> `DEVNOTE: Files inside .codex-logs/ are run logs — ignore them completely.`

---

**4. Raw — no script needed (portability fallback):**
```bash
codex exec -C "$(git rev-parse --show-toplevel)" "YOUR TASK" 2>&1 | tee codex.log &
```
Use this if as a direct approach that doesn't rely on your repo's scripts. You must specify the repo root with `-C` for correct relative paths.

## Check on a running task

```bash
tail -f .codex-logs/YYYY-MM-DD/codex-*.log   # watch live
ls .codex-logs/$(date +%F)/                  # find today's logs
codex exec resume --last                      # resume if it died
```

Progress signals in the log: `thinking` = reasoning, `exec` = running commands, `tokens used` = finished.

## Override defaults

```bash
CODEX_MODEL=gpt-5.3-codex scripts/run.sh "..."    # specific model override
CODEX_LOG_DIR=~/logs scripts/run.sh "..."         # redirect logs
CODEX_REPO=/other/repo scripts/run.sh "..."       # different repo
```

## Token efficiency

Codex tends to dump entire files (`nl -ba file | sed -n '1,300p'`) which bloats logs. Add this to prompts:

```text
EFFICIENCY: Use targeted commands, not full-file dumps.
Prefer rg -n -C3 'pattern' file or sed -n '45,55p' file.
Avoid nl -ba file | sed -n '1,300p'. Only dump full files if <50 lines.
```

## Common mistakes

| Problem | Fix |
|---|---|
| Codex blocks mid-run | Always use `--impl` for background writes (sets `-a never`) |
| Lost output | Log path is printed at start — always `tee`d |
| Codex edits its own logs | Add DEVNOTE to top of implementation prompt |
| Codex dumps entire files | Add EFFICIENCY directive to prompt |
| Wrong repo | Set `CODEX_REPO` or run from the right directory |
