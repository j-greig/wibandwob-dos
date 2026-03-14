# Devlog: Journal Microapp — TMux/Session/Sizing Pain

**Date:** 2026-03-14
**Context:** Building Symbient Journal microapp, first hot-reload cycle

## What happened

Simple task: scaffold microapp, hot-reload, see it in TUI. Took ~15 minutes
of fighting infrastructure before the window appeared correctly.

## 5 Whys

### 1. Why did the window stay at 72x24 after code changed to 95% screen?

Because `microapps.reload` reloads commands but doesn't close/reopen existing
windows. The old window (created with old code) persists. The new `host.geometry`
sizing code only runs when `openJournal()` is called fresh.

**Fix needed:** Document clearly that reload ≠ reopen. Agent must close window,
reload, then reopen. Or use `watch:microapp --open` which does this cycle.

### 2. Why did `scripts/restart.sh` fail?

`no server running on /private/tmp/tmux-501/default` — tmux server wasn't
running. `restart.sh` assumes a tmux session `wibwob` already exists. When
the human closes their terminal or tmux dies, the script has no fallback.

**Fix needed:** `restart.sh` should detect "no tmux server" and create one
instead of failing. Or at minimum, print a helpful error: "No tmux session.
Run: `tmux new-session -d -s wibwob ...`"

### 3. Why did `tmux send-keys` fail from the human's terminal?

Same root cause — no tmux server. The human and the agent were both trying
to start tmux independently, racing. No shared understanding of "who owns
the tmux session."

**Fix needed:** Single canonical "ensure wibwob is running" script that
handles all cases: no tmux → create session. Session exists but app dead →
restart. Session exists and app alive → no-op.

### 4. Why did nested `createRow` inside `createStack` crash?

`TypeError: undefined is not an object (evaluating 'element.screen')` —
`createRow` creates internal blessed nodes, but wrapping its layout object
as a fake `LayoutPart` for `createStack` doesn't satisfy blessed's parent
chain requirements.

**Fix needed:** Document that nested layout primitives (row-in-stack) require
all blessed nodes to share the same parent (`win.body`). The layout functions
only manage positioning, they don't reparent. The working pattern is: create
all boxes with `parent: win.body`, then use `applyRect` for manual sub-layouts,
or use a single flat `createStack`/`createRow`.

### 5. Why was `host.geometry` returning stale values?

It wasn't stale — it was correct. The issue was that the *window* was created
by old code (before reload), so it had old dimensions. The geometry was fine;
the window just needed to be closed and reopened.

## Pattern for future agents

```bash
# The reliable hot-reload cycle for microapp changes:
# 1. Close existing window
curl -s -X POST $API/commands/run -H 'Content-Type: application/json' \
  -d '{"id":"desktop.close-window","args":{"windowId":ID}}'
# 2. Reload microapps  
curl -s -X POST $API/commands/run -H 'Content-Type: application/json' \
  -d '{"id":"microapps.reload"}'
# 3. Wait
sleep 1
# 4. Reopen
curl -s -X POST $API/commands/run -H 'Content-Type: application/json' \
  -d '{"id":"microapp.wibwob.journal.open"}'
```

### 6. Why did `microapps.reload` not pick up TypeScript changes?

Bun caches the imported module. `microapps.reload` re-registers commands from
the cached module but does NOT re-import the `.ts` file from disk. The old code
keeps running. Only a full app restart (`scripts/restart.sh`) loads fresh TS.

**Fix needed:** `microapps.reload` must bust the Bun import cache — either
via `delete require.cache[path]` equivalent, or by appending a `?v=timestamp`
query param to the dynamic import path. Until then, agents MUST use restart
for TS changes, not reload.

**Impact:** The autoresearch.sh script was using `microapps.reload` and getting
stale code every iteration. Switched to `scripts/restart.sh`.

## Lessons

- **`microapps.reload` does NOT reload TS code** — use `scripts/restart.sh`
- Hot reload ≠ hot reopen. Reload refreshes commands; code stays cached.
- Don't nest `createRow` inside `createStack` by wrapping layout objects.
- `restart.sh` is fragile when tmux isn't running. Agent should create session.
- Always verify window dimensions via `/state` after opening, not just assume.
- `applyRect` with manual positioning rendered blank — use blessed's own `top/left/right/bottom` props instead.
