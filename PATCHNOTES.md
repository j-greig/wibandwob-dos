# PATCHNOTES — Cross-Platform Script Fixes

> Script patches to make WibWob-DOS startup work identically on macOS (human),
> Linux cloud containers (Claude Code), and headless CI. Plus process improvements
> to prevent these issues from recurring.

---

## The root cause: one command, two platforms

### What breaks

Three startup scripts default to `--direct` mode, which calls `script -q /dev/null`
with **macOS syntax**. On Linux cloud containers, `script` has different flags:

| Platform | `script` syntax for running a command in a PTY |
|----------|------------------------------------------------|
| **macOS** | `script -q /dev/null bash -c "CMD"` |
| **Linux** | `script -qfc "CMD" /dev/null` |

The macOS form treats `bash` as the output filename on Linux, producing:
```
script: unexpected number of arguments
```

### Five whys

1. **Why do agents fail to start WibWob-DOS in cloud?**
   Because `ensure-running.sh` defaults to `--direct` mode, which fails.

2. **Why does `--direct` mode fail?**
   Because `ww_start_app()` in `scripts/lib/process-manager.sh:126` calls
   `script -q /dev/null bash -c "..."` — macOS-only syntax.

3. **Why is it macOS-only syntax?**
   Because the script was written on macOS and never tested on Linux.
   Linux `script` uses `-c` for command execution, not positional args.

4. **Why wasn't this caught earlier?**
   Because local development happens on macOS and tmux mode (which works
   everywhere) was the original pattern. `--direct` mode was added later
   as a "no tmux dependency" convenience without cross-platform testing.

5. **Why does this matter now?**
   Because Claude Code cloud instances run on Linux containers. The
   `PHILOSOPHY.md` design constraint — "whatever the human can do, the
   agent must be able to do" — is violated when default startup fails.

---

## Patch 1: Auto-detect headless in `process-manager.sh`

**File:** `scripts/lib/process-manager.sh`
**Line:** 23 (after the defaults block)

### Current code (`scripts/lib/process-manager.sh:22-23`)
```bash
WW_ROOT="${WW_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
WW_MODE="${WW_MODE:-direct}"
```

### Patched code
```bash
WW_ROOT="${WW_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"

# Auto-detect: use tmux in headless/cloud environments unless explicitly overridden.
# Rationale: --direct mode uses macOS `script` syntax that fails on Linux containers.
# PHILOSOPHY.md: "whatever the human can do, the agent must be able to do."
if [[ -z "${WW_MODE:-}" ]]; then
  if [[ ! -t 0 ]] || [[ "${TERM:-dumb}" == "dumb" ]]; then
    WW_MODE="tmux"
  else
    WW_MODE="direct"
  fi
fi
```

### Why this works

- `[ ! -t 0 ]` — stdin is not a terminal (headless agent, CI, piped input)
- `$TERM == "dumb"` — no terminal capabilities (common in cloud containers)
- Humans on macOS with a real terminal still get `--direct` by default
- Explicit `--direct` or `--tmux` flags always override (parsed later by `ww_parse_mode`)
- **No behaviour change for existing human workflows**

---

## Patch 2: Cross-platform `script` command in `ww_start_app()`

**File:** `scripts/lib/process-manager.sh`
**Lines:** 122-127 (the `else` branch of `ww_start_app`)

### Current code (`scripts/lib/process-manager.sh:122-127`)
```bash
    # Direct mode: allocate a PTY via `script`, run in background
    mkdir -p "$(dirname "$WW_LOG_FILE")"
    echo "  launching (direct mode): $cmd"
    echo "  log: $WW_LOG_FILE"

    # Use `script` to provide a real PTY for blessed.
    # -q = quiet, /dev/null = don't save typescript file (we use our own log).
    # COLUMNS/LINES set the PTY dimensions.
    COLUMNS="$WW_COLS" LINES="$WW_ROWS" \
      nohup script -q /dev/null bash -c "cd $WW_ROOT && $cmd" \
      > "$WW_LOG_FILE" 2>&1 &
```

### Patched code
```bash
    # Direct mode: allocate a PTY via `script`, run in background
    mkdir -p "$(dirname "$WW_LOG_FILE")"
    echo "  launching (direct mode): $cmd"
    echo "  log: $WW_LOG_FILE"

    # Use `script` to provide a real PTY for blessed.
    # macOS: script -q /dev/null bash -c "CMD"
    # Linux: script -qfc "CMD" /dev/null
    local script_cmd
    if [[ "$(uname)" == "Darwin" ]]; then
      script_cmd="script -q /dev/null bash -c 'cd $WW_ROOT && $cmd'"
    else
      script_cmd="script -qfc 'bash -c \"cd $WW_ROOT && $cmd\"' /dev/null"
    fi

    COLUMNS="$WW_COLS" LINES="$WW_ROWS" \
      nohup bash -c "$script_cmd" \
      > "$WW_LOG_FILE" 2>&1 &
```

### Why this works

- `uname` reliably distinguishes Darwin from Linux
- Each platform gets its native `script` syntax
- The PTY allocation still works — blessed gets a real terminal either way
- `--tmux` mode is unaffected (it never calls `script`)

---

## Patch 3: Same fix in `start-alt-instance.sh`

**File:** `scripts/start-alt-instance.sh`
**Lines:** 62-64 (the `else` branch)

### Current code (`scripts/start-alt-instance.sh:62-64`)
```bash
  COLUMNS="$WW_COLS" LINES="$WW_ROWS" \
    nohup script -q /dev/null bash -c "cd $ROOT && $CMD" \
    > "$WW_LOG_FILE" 2>&1 &
```

### Patched code
```bash
  # Cross-platform PTY allocation (see process-manager.sh for rationale)
  local script_cmd
  if [[ "$(uname)" == "Darwin" ]]; then
    script_cmd="script -q /dev/null bash -c 'cd $ROOT && $CMD'"
  else
    script_cmd="script -qfc 'bash -c \"cd $ROOT && $CMD\"' /dev/null"
  fi

  COLUMNS="$WW_COLS" LINES="$WW_ROWS" \
    nohup bash -c "$script_cmd" \
    > "$WW_LOG_FILE" 2>&1 &
```

---

## Patch 4: Add `--max-time` to `ww-ops` skill examples

**File:** `.pi/skills/ww-ops/SKILL.md`
**Lines:** 55-57 (§3 Health Check)

### Current code
```bash
curl -sf http://127.0.0.1:8099/health
curl -sf http://127.0.0.1:8099/state | python3 -m json.tool
```

### Patched code
```bash
curl -sf --max-time 5 http://127.0.0.1:8099/health
curl -sf --max-time 5 http://127.0.0.1:8099/state | python3 -m json.tool
```

### Why this matters

Without `--max-time`, a hung API causes curl to run forever. In cloud agent
environments, this consumes a process slot silently. The agent's bash command
appears to hang, and the agent may retry — creating more zombie curls.

This is documented in the devlog (`.pi/reflections/claude-code-cloud-agent-devlog.md:114-125`)
but the skill doc that agents actually read during ops work doesn't include it.

---

## Process improvements to prevent recurrence

### 1. Add a `scripts/checks/check-cross-platform.sh` smoke test

A pre-commit or CI check that greps for platform-specific patterns:

```bash
#!/usr/bin/env bash
# check-cross-platform.sh — flag macOS-only patterns in scripts
set -euo pipefail

ERRORS=0
# Pattern: `script -q /dev/null <command>` without platform guard
while IFS= read -r file; do
  if grep -n 'script -q /dev/null' "$file" | grep -v 'uname\|Darwin\|Linux' >/dev/null 2>&1; then
    echo "WARNING: $file uses macOS-only \`script\` syntax without platform guard"
    grep -n 'script -q /dev/null' "$file"
    ERRORS=$((ERRORS + 1))
  fi
done < <(find scripts/ -name '*.sh' -type f)

if [[ $ERRORS -gt 0 ]]; then
  echo ""
  echo "$ERRORS file(s) use platform-specific commands without guards."
  echo "See PATCHNOTES.md for the cross-platform pattern."
  exit 1
fi
echo "✓ No platform-specific patterns found without guards."
```

### 2. Add environment detection to `CLAUDE.md`

The root `CLAUDE.md` is the first file every agent reads. Adding a one-line
pointer ensures agents find the right docs immediately:

```markdown
## How these docs work

Five CAPS MD files at repo root are the entire doc surface:

- `AGENTS.md` — conventions, workflow, posture (this file)
- `PHILOSOPHY.md` — why this exists, design filters, SDK boundary
- `ARCHITECTURE.md` — COAT (Command Once, Adapt Thin), subsystems, invariants
- `LEXICON.md` — vocabulary
- `MICROAPP-DEV.md` — agent dev workflow: install, start, scaffold, verify, gotchas
```

### 3. Make `bun install --ignore-scripts` the documented default

The `canvas` native module fails in every non-macOS environment. Since it's a
transitive dependency (`LEXICON.md:186-187`) and nothing in the critical path
uses it, `--ignore-scripts` should be the default install command everywhere —
not just a cloud workaround.

**Where to update:**
- `MICROAPP-DEV.md` — already done (see §Install)
- `.pi/skills/ww-ops/SKILL.md` — add note to §1 or new §0
- `README.md` (if one exists) — update install instructions
- Any CI/Docker files — audit for bare `bun install`

### 4. Default mode logging

When auto-detection picks tmux mode, the script should log why:

```bash
if [[ ! -t 0 ]] || [[ "${TERM:-dumb}" == "dumb" ]]; then
  WW_MODE="tmux"
  echo "  (auto-detected headless environment — using tmux mode)" >&2
fi
```

This makes debugging trivial: if an agent sees "auto-detected headless" in
output, they know the detection worked. If they don't see it, they know
`WW_MODE` was set explicitly.

### 5. Skill docs should match the devlog

The `ww-ops` skill (`SKILL.md:29-32`) documents `ensure-running.sh` without
mentioning mode flags. The `microapp-creator` skill (`SKILL.md:48-51`) uses
`wibwob` CLI commands for verification — which may not be available in cloud.

**Principle:** every command in a skill doc should work in both environments.
If a command is platform-specific, it must say so. This follows
`PHILOSOPHY.md:25-26`: "Whatever the human can do, the agent must be able to do."

---

## Files affected by these patches

| File | Lines | Change |
|------|-------|--------|
| `scripts/lib/process-manager.sh` | 22-23 | Auto-detect headless → tmux |
| `scripts/lib/process-manager.sh` | 122-127 | Cross-platform `script` syntax |
| `scripts/start-alt-instance.sh` | 62-64 | Cross-platform `script` syntax |
| `.pi/skills/ww-ops/SKILL.md` | 55-57 | Add `--max-time` to curl examples |
| `CLAUDE.md` | 9-14 | Add `MICROAPP-DEV.md` pointer |

---

## Verification after applying patches

```bash
# 1. Typecheck (scripts are bash, so this just confirms no TS broke)
bun run typecheck

# 2. Test auto-detection (simulate headless)
WW_MODE="" TERM=dumb bash -c 'source scripts/lib/process-manager.sh && echo "mode=$WW_MODE"'
# Expected: mode=tmux

# 3. Test explicit override still works
bash scripts/ensure-running.sh --direct  # should use direct mode regardless
bash scripts/ensure-running.sh --tmux    # should use tmux mode regardless

# 4. Test cross-platform script command (on Linux)
uname  # → Linux
bash scripts/ensure-running.sh --direct  # should now work on Linux too

# 5. Full smoke: start, health, screenshot, stop
bash scripts/ensure-running.sh --tmux
curl -sf --max-time 5 http://127.0.0.1:8099/health
bash scripts/screenshot-window.sh --list
bash scripts/restart.sh --tmux
```

---

## Connection to project philosophy

These patches aren't just bug fixes. They enforce three core design filters
from `PHILOSOPHY.md`:

**1. "Whatever the human can do, the agent must be able to do" (line 25)**
Default startup failing in agent environments directly violates this constraint.
Auto-detection makes the default work everywhere.

**2. "Radical simplicity" (line 43-45)**
The fix composes existing modes (`--tmux` / `--direct`) with platform detection.
No new mode, no new abstraction — just smarter defaults.

**3. "Legibility over cleverness" (line 51-53)**
Logging "auto-detected headless environment" makes the decision visible.
Agents can't debug hidden state — they need to see why tmux was chosen.

And one ARCHITECTURE invariant:

**"User-visible = API-visible" (line 125-126)**
If agents can't start the system, they can't reach the API. Startup is the
prerequisite for every COAT interaction. A broken default means COAT is
unreachable — not because the API is missing, but because the front door is locked.
