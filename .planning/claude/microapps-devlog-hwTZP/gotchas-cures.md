# Epic: Gotcha Cures — eliminate silent failures from the microapp dev loop

## Context

### Where these gotchas came from

Two Claude Code Cloud (CCC) sessions built 13 microapps using only repo docs.
Their devlogs record every friction point:
- `.pi/reflections/claude-code-cloud-agent-devlog.md` — CCC run 1 (10 apps)
- `.pi/reflections/microapp-trio-devlog.md` — CCC run 2 (3 apps)
- `.pi/reflections/2026-W12.md` — cross-session raw notes (from older runs, less important now)
- `.planning/ideas/agent-dx-improvements-2026-03-21.md` — CCC run 2's ranked DX list

This session then reviewed all pain with fresh eyes against PHILOSOPHY.md and
ARCHITECTURE.md, added JSDoc steering to SDK source files, consolidated 4 docs
into `SDK-MICROAPP-DEV.md`, and built autopoietic scripts (`session-debrief.sh`,
`validate-microapp.sh`, `check-scaffold-sync.sh`).

What remains: **code changes** that make the gotchas impossible, not just documented.

### Why this matters

PHILOSOPHY.md §The operational consequence:
> **Whatever the human can do, the agent must be able to do.**

Every gotcha is a place where that contract is broken. The agent CAN do the task,
but only if it knows the workaround. Silent failures are worst: the agent thinks
it succeeded, builds on broken foundations, and the cascade compounds.

Each cure converts a silent failure into either:
- **Correct default behaviour** — the gotcha never arises
- **A loud error** — the agent sees immediately what went wrong

### Principle: fix the platform, not the app

If a gotcha burns every microapp author, the fix belongs in `src/` (the host SDK),
not in each microapp's `index.ts`. Spending time on a one-line SDK fix that benefits
all future microapps is always preferable to writing finicky workaround code inside
each app. The SDK is the host — PHILOSOPHY.md §4: **"Host owns complexity."**

This extends to the build/registration system. If registering a microapp requires
editing source code (`src/core/microapp-registry.ts`), that's a barrier for third-party
developers who install this repo and want to add modules without touching `src/`.
Where possible, move configuration out of source and into a discoverable config surface
(e.g. `.wibwob/` folder, JSON config files) — the same pattern as `.pi/`, `.github/`,
`.vscode/`. The source should read configuration; it should not BE configuration.

### How to work this epic

Each story is self-contained. Pick one, read its why-chain, follow the file:change
spec, run the verify step. Stories within a phase can be done in any order.
Stories across phases have ordering constraints noted.

**Modifying `src/` is encouraged** when the fix benefits all microapp authors.
Don't work around an SDK gap in app code — fix the SDK. Don't document a workaround
in GOTCHAS — eliminate the need for the workaround.

**After completing any phase (or any logical group of 2+ stories):**
run the post-session review prompt at `.planning/prompts/post-session-review.md`
against your changes. It checks invariant compliance, COAT surface, describeState
contracts, doc honesty, and evidence gates. Do this before merging.

---

## Phase 1 — Safe defaults (no API changes, no new files)

These change existing behaviour to be correct by default. Small diffs, high confidence.

### Story 1.1: `multiInstance: false` → focus existing window

**Gotcha it cures:** "running `open` a second time silently no-ops"

**Why chain:**
1. Why does re-opening do nothing? → Command handler returns early when window exists.
2. Why not focus the existing window? → The early return is bare — no side effects.
3. Why is this a problem? → An agent issuing API commands has no memory of what it
   opened earlier. It expects `open` to either create or bring to front.

**File:** `src/services/microapp-loader.ts`
**Change:** When `multiInstance: false` and window exists, focus it.
Return `{"ok":true, "focused": true}` so the caller knows what happened.
**Verify:** Open click-counter → open again → window comes to front.
**AC:** `curl POST open` twice → second returns `focused: true` + window is focused.

### Story 1.2: `createTextViewer` types accept `number | string`

**Gotcha it cures:** "passing `top: '40%'` works at runtime, TypeScript complains"

**Why:** Types are narrower than blessed's actual API. Blessed accepts string percentages
for positioning but the SDK type says `number` only.

**File:** `src/sdk/composition-helpers.ts`
**Change:** Widen `TextViewerOptions.top`, `.bottom` to `number | string`.
**Verify:** `bun run typecheck` with `top: "40%"` in a test microapp → no error.
**AC:** Typecheck clean without `as any` casts on positional fields.

### Story 1.3: `safeReadJSONOrDefault<T>(path, fallback): T`

**Gotcha it cures:** "every persistence-using app writes a loadData wrapper with fallback"

**Why:** `safeReadJSON<T>()` returns `T | undefined`. The undefined case is always
handled identically: return a default object. This is 3 lines of boilerplate per app.

**File:** `src/core/safe-fs.ts` + export from `src/services/microapp-sdk.ts`
**Change:** New function alongside existing one:
```typescript
export function safeReadJSONOrDefault<T>(path: string, fallback: T): T {
  const data = safeReadJSON<T>(path);
  return data ?? fallback;
}
```
**Verify:** Use in habit-tracker, remove its manual fallback wrapper.
**AC:** Function exists, exported `@public`, habit-tracker simplified.

### ✅ Phase 1 gate
Run `.planning/prompts/post-session-review.md`. Typecheck clean.
Validate: click-counter (focus test), habit-tracker (persistence test).

---

## Phase 2 — SDK helpers (new API surface, opt-in)

These add new SDK helpers that make dangerous patterns safe. Existing code is unchanged;
new code gets a better path. Depends on Phase 1 (types must be correct first).

### Story 2.1: `createManagedList` — typed blessed.list wrapper

**Gotchas it cures (3):**
- "`blessed.list.setItems()` / `.selected` need `(list as any)` cast"
- "`setItems` fires `select item` → recursion"
- "list style crash on theme switch (missing `item`/`scrollbar` keys)"

**Why chain:**
1. Why do agents cast `(list as any)`? → `@types/blessed` doesn't declare `setItems`.
2. Why can't we fix the types? → We don't own `@types/blessed`.
3. Why are agents touching raw `blessed.list`? → No SDK helper for a selectable, updatable list.
4. Why does `setItems` cause recursion? → It fires `select item`, which triggers a handler
   that often calls `setItems` again. No built-in guard.
5. Why does theme switch crash? → blessed accesses `style.item[name]` internally.
   Without `item: { fg, bg }` in the style, it throws.

**File:** `src/sdk/composition-helpers.ts` (new) + `src/services/microapp-sdk.ts` (re-export)
**Change:** New CompositionHelper:
```typescript
interface ManagedListHandle {
  element: blessed.Widgets.ListElement;
  setItems(items: string[]): void;   // recursion-guarded internally
  readonly selected: number;          // typed — no cast
  onSelect(cb: (index: number, item: string) => void): void;
  update(opts?: Partial<ManagedListOptions>): void;  // safe restyle with item/scrollbar keys
  destroy(): void;
}
```
**Verify:** Refactor kanban + habit-tracker to use it. All `(list as any)` casts removed.
Theme switch doesn't crash. `bun run typecheck` clean.
**AC:** Zero `(list as any)` in refactored apps. Theme switch 3 times without crash.

### Story 2.2: `createAnimationClock` starts paused by default

**Gotcha it cures:** "clock starts immediately — call pause() on next line"

**Why chain:**
1. Why do agents hit CPU cliffs? → Clock fires at full rate before rendering is set up.
2. Why auto-start? → `let running = true` in constructor. Original assumption: caller wants
   animation immediately. Reality: every caller pauses first, sets up rendering, then plays.
3. Why dangerous? → At >10fps, blessed screen diff saturates the event loop. HTTP API stops
   responding. Agent can't even diagnose via curl — the system is hung.

**Pre-work (MUST do first):** Grep `createAnimationClock` across ALL microapps.
List every caller. Check which ones call `.play()` after setup. Any that DON'T
will silently stop animating after this change. Add `.play()` to those callers first.

**File:** `src/sdk/runtime-helpers.ts`
**Change:** `let running = false;`. Add optional `{ autoplay?: boolean }` second param.
**Verify:** `step-seq`, `ascii-rain`, `spore-clock` all still animate.
**AC:** No microapp uses `clock.pause()` as the line after creation (it's the default now).

### ✅ Phase 2 gate
Run `.planning/prompts/post-session-review.md`. Typecheck clean.
Full 13-app validation sweep: `validate-microapp.sh` on all registered microapps.

---

## Phase 3 — Script & loader hardening (behaviour changes, safety nets)

These change how the system responds to errors. Some change user-visible behaviour.
Depends on Phase 2 (SDK helpers should be stable before hardening the loader).

### Story 3.1: Externalise microapp registration — no source edits to add an app

**Gotcha it cures:** "scaffolded microapps don't appear until registered"

**Why chain:**
1. Why don't scaffolded apps appear? → Not in `src/core/microapp-registry.ts`.
2. Why doesn't scaffold add them? → It writes `index.ts` + `microapp.json` but not the registry.
3. Why is the registry a source file? → Historical. It gates visibility tiers (core/beta/internal).
4. Why does this matter beyond the immediate bug? → **A third-party developer who installs this
   repo cannot add a microapp without modifying `src/`.** That's a contribution barrier. It also
   means CCC (or any agent) must edit a TypeScript source file to register an app — a step that's
   easy to forget and produces zero feedback when skipped.
5. Why is "edit source to configure" wrong here? → The registry is configuration, not logic.
   It's a mapping of IDs to tiers. It belongs in a config file, not compiled source.

**The deeper fix:** Move registration out of `src/` entirely.

**Option A — `.wibwob/microapps.json` (recommended):**
A JSON config file at the repo root (or `~/.wibwob/microapps.json` for user-level):
```jsonc
{
  "wibwob.click-counter": "beta",
  "wibwob.habit-tracker": "beta"
}
```
The loader reads this at boot alongside the hardcoded core entries in `src/core/microapp-registry.ts`.
Core apps stay in source (they ship with the product). Third-party and dev apps live in config.

This follows the `.pi/`, `.github/`, `.vscode/` convention: the source reads configuration,
it doesn't BE configuration. A developer adds a microapp by creating the `microapps/` dir
and adding one line to a JSON file. No TypeScript, no typecheck, no restart of the dev mental model.

**Option B — Auto-discovery with tier default:**
Any `microapps/*/microapp.json` not in the registry is loaded at `"beta"` tier automatically.
The registry becomes an override file, not a gate. Log: `"[loader] auto-registered <id> at beta tier"`.

Option B is simpler but loses explicit control. Option A preserves the tier system while
moving it to config.

**Scaffold change:** After writing files, scaffold appends to `.wibwob/microapps.json` (or
the chosen config path) instead of editing TypeScript source.

**Files:**
- `src/services/microapp-loader.ts` — read from config file at boot, merge with source registry
- `src/core/microapp-registry.ts` — keep for core apps only, document as "shipped apps"
- `.wibwob/microapps.json` — new config file for dev/third-party apps
- `.pi/skills/microapp-creator/scripts/scaffold-microapp.sh` — write to config, not source

**Verify:** Scaffold → restart → app appears. No source files modified.
**AC:** `git diff src/` is clean after scaffolding a new microapp.

### Story 3.2: `reload-microapp.sh` warns on host file changes

**Gotcha it cures:** "reload doesn't cover host-side changes — Unknown command"

**Why chain:**
1. Why does reload miss changes? → Only re-evaluates `microapps/*/index.ts`.
2. Why doesn't it know host files changed? → No mechanism to compare current state vs boot state.
3. Why does this burn agents? → Agent edits `microapp-sdk.ts`, runs reload (success), then gets
   "Unknown command" on next open. Error appears to be in the microapp but the root cause is
   stale host code.

**Change:** Write `$(git rev-parse HEAD)` to `scratch/boot-commit` at boot.
`reload-microapp.sh` diffs HEAD against boot-commit for `src/**`. If changed, warns.
**Verify:** Edit `microapp-sdk.ts` → run reload → see warning.
**AC:** Warning printed. No behaviour change otherwise.

### Story 3.3: Workspace restore crash protection

**Gotcha it cures:** "workspace restore crash → boot loop"

**Why chain:**
1. Why boot loop? → Workspace restore re-opens every saved app. Crashed app = boot fails.
2. Why no recovery? → Crash is uncaught. User must `rm scratch/workspace.json`.
3. Why critical? → One broken microapp bricks the entire desktop. Agent can't start WibWob.

**File:** `src/services/workspace-service.ts` (or equivalent)
**Change:** try/catch per microapp restore. On failure: log, skip, continue. Report after boot.
**Verify:** Break a microapp → save workspace → restart → other windows restore, broken skipped.
**AC:** Boot completes. Broken app logged. Other windows present.

### Story 3.4: `desktop.clear-all` waits for completion

**Gotcha it cures:** "windows not in /state for ~500ms after clear-all"

**Why chain:**
1. Why missing from state? → `clear-all` starts closing asynchronously. API returns before done.
2. Why does this matter? → Agent opens new windows immediately, gets wrong IDs or empty state.
3. Why does every script work around it? → `sleep 0.5` after clear-all. Fragile, sometimes wrong.

**File:** `src/core/app-controller.ts` (or command handler)
**Change:** Await all window close callbacks before responding. 2-second timeout safety net.
**Verify:** `curl POST clear-all && curl POST open` → window in `/state` immediately.
**AC:** No `sleep` needed between clear-all and next command.

### ✅ Phase 3 gate
Run `.planning/prompts/post-session-review.md`.
Run `bash scripts/session-debrief.sh` on this session's log.
Typecheck clean. Full validation sweep.

---

## Phase 4 — Observability & deprecation (API additions, breaking changes)

Larger scope. Each story is independently shippable. No ordering constraints within phase.

### Story 4.1: `GET /errors/recent` API endpoint

**Gotcha it cures:** Bun TDZ crashes and all runtime errors invisible to agents.

**Why chain:**
1. Why can't agents see errors? → Errors print to tmux pane. Agents can't read tmux.
2. Why not in the API? → No error collection exists.
3. Why does this matter? → Microapp crashes silently. Agent sees `{"ok":true}` but blank window.
   Only diagnostic: `tmux capture-pane`. CCC ranked this #1 in their DX improvement list.

**File:** `src/services/control-api.ts` + new `src/core/error-buffer.ts`
**Change:** Ring buffer of last 20 errors. Wrap `setup()`, `onRestyle()`, `onResize()`.
**AC:** `curl /errors/recent` returns errors with microapp ID + stack trace + timestamp.

### Story 4.2: `.kind` → `.appType` migration

**Gotcha it cures:** "Figlet window .kind is 'microapp', not 'figlet'"

**Why:** `.kind` is always `"microapp"` for all microapps — useless for filtering.
Agents must use `.appType` but it's less prominent in `/state` output.

**File:** `src/services/state-service.ts`
**Change:** Move `appType` to prominent position. Deprecate `.kind` in output with
`_deprecated_kind` field (or remove and break scripts — they're already broken).

### Story 4.3: `host.promptValue` restores focus on dismiss

**Gotcha it cures:** "focus not restored after prompt modal closes"

**File:** `src/services/microapp-loader.ts`
**Change:** Save `screen.focused` before modal. Restore in dismiss callback.

### Story 4.4: 1×1 screen detection in recording

**Gotcha it cures:** "recording captures nothing with no PTY"

**File:** `scripts/wibwob-record.sh`
**Change:** Check `/health` screen dims before recording. Abort if ≤1.

### Story 4.5: `add-command.sh` scaffold

**Gotcha it cures:** "adding one command touches 4+ files"

**File:** `scripts/add-command.sh` (new)
**Change:** `bash scripts/add-command.sh <group>.<verb> "<label>"` → generates all 4 edits.

### Story 4.6: `canvas` dependency audit

**Gotcha it cures:** "bun install fails in cloud containers"

**File:** `package.json`
**Change:** Trace transitive dependency on `canvas`. Make optional or remove.

### ✅ Phase 4 gate
Run `.planning/prompts/post-session-review.md`.
Run `.planning/prompts/simplicity-review.md` on the full phase diff.
Run `bash scripts/session-debrief.sh` — any new pain introduced?

---

## Not curable in code — platform constraints

These stay as GOTCHAS.md entries. The only cure is "know about it":

| Gotcha | Platform | Why no code fix |
|--------|----------|----------------|
| `blessed.textarea` fully modal | blessed | Would need blessed fork |
| `createInputLine` modal focus | blessed | Wraps blessed.textbox |
| Emoji → `?` in text screenshots | terminal | Encoding loss in blessed screen dump |
| `grep -c` multiline output | bash | Shell behaviour |
| `kill -9` breaks PTY | blessed | Needs clean SIGTERM for escape codes |
| `setImmediate` after keypress | blessed | Event loop timing |

---

## After all phases

Once all curable gotchas are eliminated:
1. Delete cured entries from GOTCHAS.md
2. Verify `wc -w GOTCHAS.md` ≤ 800 (only platform constraints + any new burns remain)
3. Run `bash scripts/doc-health.sh` → 15/15
4. Run `bash scripts/doc-review.sh --functional` → agent builds from docs without hitting any gotcha
5. Final `.planning/prompts/post-session-review.md` pass
