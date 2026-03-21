# GOTCHAS Cures — Code changes that eliminate gotchas at source

> For each gotcha: what code change would make the gotcha unnecessary?
> Ordered by impact × feasibility. Each cure has a concrete file:change spec.

---

## Tier 1 — High impact, straightforward code changes

### 1. Scaffold auto-registers in microapp-registry.ts
**Cures:** "Scaffolded microapps don't appear until registered"
**File:** `.pi/skills/microapp-creator/scripts/scaffold-microapp.sh`
**Change:** After writing `index.ts` + `microapp.json`, the scaffold script
appends `"<app-id>": "beta",` to `src/core/microapp-registry.ts` inside REGISTRY.
Use `sed` to insert before the closing `}` of the beta block.
**Verify:** scaffold → restart → `curl /commands/list | grep <id>` returns the command.
**Risk:** Low. If the sed target changes, scaffold fails loudly (no silent breakage).

### 2. `createAnimationClock` starts paused by default
**Cures:** "createAnimationClock starts immediately — call clock.pause() on next line"
**File:** `src/sdk/runtime-helpers.ts`
**Change:** `let running = false;` instead of `let running = true;`. Add `opts.autoplay?: boolean`
param for the rare case where immediate start is wanted.
**Verify:** Existing apps that call `clock.pause()` immediately after creation still work.
Apps that relied on auto-start need `clock.play()` (they already have it for resume).
**Risk:** Medium. Must audit existing callers — `step-seq`, `ascii-rain`, `spore-clock` etc.
Any that don't call `play()` will silently stop animating. Grep `createAnimationClock` across
all microapps to find them.

### 3. `createManagedList` SDK helper — typed blessed.list wrapper
**Cures:** "`blessed.list.setItems()` / `.selected` need `(list as any)` cast", AND
"`setItems` fires `select item` event → recursion"
**File:** `src/sdk/composition-helpers.ts` (new export) + `src/services/microapp-sdk.ts` (re-export)
**Change:** New CompositionHelper:
```typescript
export function createManagedList(parent: BoxElement, opts: ManagedListOptions): ManagedListHandle {
  // Internally creates blessed.list, handles:
  // - setItems() with recursion guard built in
  // - .selected property typed
  // - .onSelect(cb) typed callback
  // - .items getter typed
  // - onRestyle with item/scrollbar keys included
  return { element, setItems, selected, onSelect, update, destroy };
}
```
**Verify:** Refactor kanban + habit-tracker to use it. Both currently use `(list as any)`.
**Risk:** Low. New API, opt-in. Existing code unchanged.

### 4. List style crash — `createManagedList` includes safe defaults
**Cures:** "restyleAll must include `item` and `scrollbar` keys in list style"
**File:** Same as above — `createManagedList` bakes in safe style defaults.
**Change:** `onRestyle` handler inside the helper always spreads `item: { fg, bg }` and
`scrollbar: { fg }` into the style. No blessed crash possible through the helper.
**Risk:** None. New code, safe defaults.

### 5. `multiInstance: false` → focus existing window instead of silent no-op
**Cures:** "multiInstance: true required for re-openable microapps"
**File:** `src/services/microapp-loader.ts` (the open-command handler)
**Change:** When `multiInstance: false` and the window already exists, instead of
silently returning, focus the existing window. Log: `"[microapp] ${id} already open — focusing"`.
**Verify:** Open click-counter twice → second open focuses existing window.
**Risk:** Low. Behaviour change but strictly better — no one wants silent no-op.

### 6. `reload-microapp.sh` warns if host files changed since boot
**Cures:** "reload-microapp.sh doesn't cover host-side changes"
**File:** `scripts/reload-microapp.sh` (or its implementation)
**Change:** Compare `git diff --name-only $(cat scratch/boot-hash 2>/dev/null || echo HEAD)..HEAD`
against `src/services/* src/core/* src/sdk/*`. If any changed, print:
`"⚠ host files changed since boot — reload won't pick these up. Run: bash scripts/restart.sh --tmux"`
Write `$(git rev-parse HEAD)` to `scratch/boot-hash` at startup.
**Verify:** Edit `microapp-sdk.ts` → run reload → see warning.
**Risk:** Low. Warning only, no behaviour change.

### 7. `desktop.clear-all` returns a promise / waits internally
**Cures:** "Open windows immediately after desktop.clear-all and their IDs are missing from /state"
**File:** `src/core/command-registry.ts` or `src/core/app-controller.ts`
**Change:** The `desktop.clear-all` command handler waits for all window close callbacks to
complete before returning `{"ok":true}`. The API response means "done", not "started".
**Verify:** `curl POST desktop.clear-all && curl POST open` → window appears in `/state`.
**Risk:** Medium. Must ensure close callbacks don't hang. Add timeout.

### 8. Workspace restore with crash protection
**Cures:** "Workspace restore crash → boot loop"
**File:** `src/services/workspace-service.ts` (or wherever restore runs)
**Change:** Wrap each microapp restore in try/catch. If a microapp crashes during restore,
log the error, skip that microapp, and continue. After restore, report:
`"⚠ 1 microapp failed to restore: wibwob.broken-app (TypeError: ...)"`.
**Verify:** Corrupt a microapp → save workspace → restart → other windows restore, broken one skipped.
**Risk:** Low. Strictly better — boot loop is never correct.

---

## Tier 2 — Medium impact, moderate effort

### 9. `createTextViewer` positional types accept `number | string`
**Cures:** "createTextViewer positional % strings cause TypeScript complaints"
**File:** `src/sdk/composition-helpers.ts`
**Change:** `TextViewerOptions.top`, `.bottom`, `.left`, `.right` → `number | string`.
Blessed accepts both; the types should reflect runtime reality.
**Verify:** `bun run typecheck` with `top: "40%"` → no error.
**Risk:** None. Type widening, no runtime change.

### 10. `GET /errors/recent` API endpoint
**Cures:** Bun TDZ crashes (and ALL runtime errors) invisible to agents
**File:** `src/services/control-api.ts` + `src/core/error-buffer.ts` (new)
**Change:** Ring buffer of last 20 errors (microapp id, stack trace, timestamp).
Populated by wrapping microapp `setup()` and `onRestyle`/`onResize` calls in try/catch.
`GET /errors/recent` returns the buffer as JSON.
**Verify:** Open a microapp with a TDZ bug → `curl /errors/recent` shows the error.
**Risk:** Medium. Must not swallow errors that should crash. Ring buffer only — not error suppression.

### 11. `.kind` → `.appType` — deprecation + migration
**Cures:** "Figlet window .kind is 'microapp', not 'figlet'"
**File:** `src/services/state-service.ts` or wherever `/state` is built
**Change:** Add `appType` to every window in `/state` output prominently. Keep `.kind`
for backward compat but add it to GOTCHAS-level deprecation. Or: just remove `.kind`
and break scripts that use it (they're already broken by this exact gotcha).
**Risk:** Medium. Breaking change for `.kind` users, but they're already broken.

### 12. `host.promptValue` restores focus on dismiss
**Cures:** "host.promptValue focus not restored after dismiss"
**File:** `src/services/microapp-loader.ts` or wherever promptValue is implemented
**Change:** Save `screen.focused` before opening modal, restore it in the dismiss callback.
**Risk:** Low. Strictly better UX.

### 13. 1×1 screen detection in recording scripts
**Cures:** "Direct/background mode → 1×1 screen, recording captures nothing"
**File:** `scripts/wibwob-record.sh` (or equivalent)
**Change:** Before recording, check `curl /health | jq '.screen.width'`. If ≤1, abort
with error: `"✗ screen is 1×1 — WibWob needs a real PTY. Run in tmux."`.
**Risk:** None. Error message instead of empty output.

---

## Tier 3 — Good ideas, larger scope

### 14. `add-command.sh` scaffold script
**Cures:** "Adding one command touches 4+ files"
**File:** `scripts/add-command.sh` (new)
**Change:** `bash scripts/add-command.sh <group>.<verb> "<label>"` generates all 4 file edits.
Already planned in autopoietic-next §5.
**Risk:** Medium. Must parse existing files reliably.

### 15. `canvas` dependency removal
**Cures:** "bun install fails in cloud containers"
**File:** `package.json`
**Change:** Find what transitively depends on `canvas`, check if it's actually used at runtime.
If not: add to `optionalDependencies` or remove. If yes: lazy-import with try/catch.
**Risk:** Low if unused, medium if used by a runtime path.

### 16. `safeReadJSON` with default
**Cures:** "safeReadJSON returns undefined, not a typed default"
**File:** `src/core/safe-fs.ts` + `src/services/microapp-sdk.ts`
**Change:** Add `safeReadJSONOrDefault<T>(path: string, fallback: T): T` alongside existing function.
**Risk:** None. New function, additive.

---

## Not curable in code (platform constraints — keep as doc)

| Gotcha | Why it stays |
|--------|-------------|
| blessed.textarea fully modal | blessed architecture, can't fix without forking blessed |
| createInputLine modal focus | Same — blessed textbox is modal by design |
| Emoji as ? in text screenshot | Terminal encoding, not our code |
| grep -c multiline output | bash/grep behaviour, not our code |
| Never kill -9 first | blessed PTY cleanup, not our code |
| setImmediate after keypress | blessed event loop timing, not our code |

These remain as GOTCHAS entries because the only cure is "know about it".

---

## Execution priority

```
NOW (this branch, small changes):
  1. Scaffold auto-register
  5. multiInstance: false → focus existing
  9. TextViewer type widening
  16. safeReadJSONOrDefault

NEXT (separate branch, needs auditing):
  2. createAnimationClock starts paused (audit all callers first)
  3+4. createManagedList helper
  6. reload-microapp.sh host-change warning
  8. Workspace restore crash protection

LATER (separate epic, larger scope):
  7. desktop.clear-all waits
  10. GET /errors/recent
  11. .kind deprecation
  12. promptValue focus restore
  13. 1×1 screen detection
  14. add-command.sh
  15. canvas dep removal
```
