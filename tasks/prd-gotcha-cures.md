# PRD: Gotcha Cures — Eliminate Silent Failures from the Microapp Dev Loop

## 1. Introduction/Overview

Two Claude Code Cloud sessions built 13 microapps using only repo docs and recorded every friction point. A review session documented these as gotchas with why-chains and proposed cures. This PRD converts those cures into implementable user stories.

Every gotcha is a place where the agent-human parity contract (PHILOSOPHY.md §The operational consequence) is broken. Each cure converts a silent failure into either **correct default behaviour** (the gotcha never arises) or **a loud error** (the agent sees immediately what went wrong).

**Principle:** Fix the platform, not the app. If a gotcha burns every microapp author, the fix belongs in `src/` (the host SDK), not in each microapp's `index.ts`. The SDK is the host — PHILOSOPHY.md §4: "Host owns complexity."

## 2. Goals

- Eliminate all code-curable silent failures from the microapp development loop
- Convert dangerous patterns into safe SDK helpers with correct defaults
- Move configuration out of compiled source (registration) into discoverable config surfaces
- Add observability so agents can diagnose runtime errors without tmux access
- Reduce GOTCHAS.md to platform-only constraints (≤800 words)

## 3. User Stories

### Phase 1 — Safe defaults (no API changes, no new files)

Small diffs, high confidence. Change existing behaviour to be correct by default.

---

### US-001: `multiInstance: false` → focus existing window

**Description:** As a microapp user (human or agent), I want re-opening a single-instance app to focus the existing window so that the `open` command always produces a visible result.

**Acceptance Criteria:**
- [ ] When `multiInstance: false` and window exists, `open` focuses the existing window
- [ ] API returns `{"ok": true, "focused": true}` on re-open (not silent no-op)
- [ ] `curl POST open` twice → second returns `focused: true` + window is visually focused
- [ ] Verify with click-counter: open → open again → window comes to front
- [ ] `bun run typecheck` clean
- [ ] `bun run health` passes

**Files:** `src/services/microapp-loader.ts`

---

### US-002: `createTextViewer` types accept `number | string`

**Description:** As a microapp developer, I want positional fields (`top`, `bottom`, `left`, `right`, `width`, `height`) on `TextViewerOptions` to accept string percentages so that I don't need `as any` casts for blessed-compatible values.

**Acceptance Criteria:**
- [ ] `TextViewerOptions.top`, `.bottom`, `.left`, `.right`, `.width`, `.height` typed as `number | string`
- [ ] Existing microapps using numeric values still typecheck
- [ ] A test microapp using `top: "40%"` typechecks without `as any`
- [ ] `bun run typecheck` clean
- [ ] `bun run health` passes

**Files:** `src/sdk/composition-helpers.ts`

---

### US-003: `safeReadJSONOrDefault<T>(path, fallback): T`

**Description:** As a microapp developer using persistence, I want a single function that reads JSON with a fallback default so that I don't write the same 3-line wrapper in every app.

**Acceptance Criteria:**
- [ ] `safeReadJSONOrDefault<T>(path: string, fallback: T): T` exists in `src/core/safe-fs.ts`
- [ ] Exported from `src/services/microapp-sdk.ts` as `@public`
- [ ] Returns parsed data when file exists, returns fallback when file missing or invalid
- [ ] habit-tracker refactored to use it (manual fallback wrapper removed)
- [ ] `bun run typecheck` clean
- [ ] `bun run health` passes

**Files:** `src/core/safe-fs.ts`, `src/services/microapp-sdk.ts`, `microapps/habit-tracker/index.ts`

---

### Phase 1 gate

- [ ] Run `.planning/prompts/post-session-review.md` — passes
- [ ] `bun run typecheck` clean
- [ ] Validate click-counter (focus test) and habit-tracker (persistence test)

---

### Phase 2 — SDK helpers (new API surface, opt-in)

New SDK helpers that make dangerous patterns safe. Existing code unchanged; new code gets a better path. Depends on Phase 1 (types must be correct first).

---

### US-004: `createManagedList` — typed blessed.list wrapper

**Description:** As a microapp developer, I want a typed, recursion-safe, theme-resilient list helper so that I never need `(list as any)` casts, don't hit `setItems` recursion, and don't crash on theme switch.

**Acceptance Criteria:**
- [ ] `createManagedList` exported from `src/sdk/composition-helpers.ts` and re-exported from `microapp-sdk.ts`
- [ ] Returns `ManagedListHandle` with: `element`, `setItems()` (recursion-guarded), `selected` (typed readonly), `onSelect()`, `update()` (safe restyle with `item`/`scrollbar` keys), `destroy()`
- [ ] `setItems()` internally guards against re-entrant calls (no recursion)
- [ ] `update()` ensures `style.item` and `style.scrollbar` keys are always present
- [ ] Refactor kanban to use `createManagedList` — zero `(list as any)` casts remain
- [ ] Refactor habit-tracker to use `createManagedList` — zero `(list as any)` casts remain
- [ ] Theme switch 3 times without crash on refactored apps
- [ ] `bun run typecheck` clean
- [ ] `bun run health` passes

**Files:** `src/sdk/composition-helpers.ts`, `src/services/microapp-sdk.ts`, `microapps/kanban/index.ts`, `microapps/habit-tracker/index.ts`

---

### US-005: `createAnimationClock` starts paused by default

**Description:** As a microapp developer, I want the animation clock to start paused so that I can set up rendering before frames fire, avoiding CPU saturation and hung HTTP APIs.

**Acceptance Criteria:**
- [ ] **Pre-work:** Grep all `createAnimationClock` callers. Add `.play()` to any that don't already call it after setup (before changing the default)
- [ ] `createAnimationClock` default is `running = false` (paused)
- [ ] Optional second param `{ autoplay?: boolean }` for backward-compat where needed
- [ ] No microapp uses `clock.pause()` as the line immediately after creation
- [ ] `step-seq`, `ascii-rain`, `spore-clock` all still animate correctly
- [ ] All 13 registered microapps using animation clocks verified working
- [ ] `bun run typecheck` clean
- [ ] `bun run health` passes

**Files:** `src/sdk/runtime-helpers.ts`, affected microapps (grep first)

---

### Phase 2 gate

- [ ] Run `.planning/prompts/post-session-review.md` — passes
- [ ] `bun run typecheck` clean
- [ ] Full 13-app validation sweep: `validate-microapp.sh` on all registered microapps

---

### Phase 3 — Script & loader hardening (behaviour changes, safety nets)

Changes how the system responds to errors. Some change user-visible behaviour. Depends on Phase 2 (SDK helpers should be stable before hardening the loader).

---

### US-006: Externalise microapp registration — no source edits to add an app

**Description:** As a microapp developer (human or agent), I want new microapps to be discovered automatically and tier-overridable via config so that I never edit TypeScript source to register an app.

**Approach:** Auto-discover from `microapps/*/microapp.json` at beta tier by default. `.wibwob/microapps.json` serves as tier override (promote to core, demote to internal, etc.). Core apps stay in `src/core/microapp-registry.ts` (they ship with the product).

**Acceptance Criteria:**
- [ ] Any `microapps/*/microapp.json` not in the hardcoded registry is auto-discovered at `"beta"` tier
- [ ] Auto-discovery logged: `"[loader] auto-registered <id> at beta tier"`
- [ ] `.wibwob/microapps.json` overrides tier for any app (auto-discovered or hardcoded)
- [ ] Core apps remain in `src/core/microapp-registry.ts` (documented as "shipped apps")
- [ ] Scaffold script writes `microapps/` dir + `microapp.json` — no source file edits needed
- [ ] Scaffold → restart → app appears in `/state` without editing any `src/` file
- [ ] `git diff src/` is clean after scaffolding a new microapp (only loader changes for the feature itself)
- [ ] `bun run typecheck` clean
- [ ] `bun run health` passes

**Files:** `src/services/microapp-loader.ts`, `src/core/microapp-registry.ts`, `.wibwob/microapps.json` (new), `.pi/skills/microapp-creator/scripts/scaffold-microapp.sh`

---

### US-007: `reload-microapp.sh` warns on host file changes

**Description:** As an agent developing microapps, I want the reload script to warn me when host SDK files changed since boot so that I know to restart instead of chasing phantom errors.

**Acceptance Criteria:**
- [ ] Boot writes `$(git rev-parse HEAD)` to `scratch/boot-commit`
- [ ] `reload-microapp.sh` diffs HEAD against boot-commit for `src/**`
- [ ] If `src/` changed, prints warning: "Host files changed since boot — restart required"
- [ ] No behaviour change beyond the warning (reload still executes)
- [ ] Edit `microapp-sdk.ts` → run reload → see warning
- [ ] `bun run health` passes

**Files:** `src/` (boot commit write), `scripts/reload-microapp.sh`

---

### US-008: Workspace restore crash protection

**Description:** As a WibWob-DOS user, I want workspace restore to skip broken microapps instead of crashing so that one broken app doesn't brick the entire desktop.

**Acceptance Criteria:**
- [ ] Each microapp restore is wrapped in try/catch
- [ ] On failure: log error with microapp ID, skip, continue restoring others
- [ ] After boot: report which apps failed to restore (visible in log or API)
- [ ] Break a microapp → save workspace → restart → other windows restore, broken one skipped
- [ ] Boot completes successfully with broken app logged
- [ ] `bun run typecheck` clean
- [ ] `bun run health` passes

**Files:** `src/services/workspace-service.ts` (or equivalent)

---

### US-009: `desktop.clear-all` waits for completion

**Description:** As an agent scripting the desktop, I want `clear-all` to return only after all windows are closed so that subsequent commands see correct state immediately.

**Acceptance Criteria:**
- [ ] `clear-all` awaits all window close callbacks before returning the API response
- [ ] 2-second timeout safety net (returns with warning if windows don't close in time)
- [ ] `curl POST clear-all && curl POST open` → new window appears in `/state` immediately
- [ ] No `sleep` needed between clear-all and next command
- [ ] `bun run typecheck` clean
- [ ] `bun run health` passes

**Files:** `src/core/app-controller.ts` (or command handler)

---

### Phase 3 gate

- [ ] Run `.planning/prompts/post-session-review.md` — passes
- [ ] Run `bash scripts/session-debrief.sh` on this session's log
- [ ] `bun run typecheck` clean
- [ ] Full validation sweep

---

### Phase 4 — Observability & deprecation (API additions, breaking changes)

Larger scope. Each story is independently shippable. No ordering constraints within phase.

---

### US-010: `GET /errors/recent` API endpoint

**Description:** As an agent debugging microapps, I want an API endpoint that returns recent runtime errors so that I can diagnose crashes without tmux access.

**Acceptance Criteria:**
- [ ] New `src/core/error-buffer.ts` — ring buffer of last 20 errors
- [ ] Errors captured from microapp `setup()`, `onRestyle()`, `onResize()` lifecycle hooks
- [ ] `GET /errors/recent` returns JSON array with: `microappId`, `stack`, `timestamp`, `message`
- [ ] Bun TDZ errors and uncaught exceptions also captured
- [ ] `curl localhost:8099/errors/recent` returns meaningful error data after triggering a crash
- [ ] `bun run typecheck` clean
- [ ] `bun run health` passes

**Files:** `src/services/control-api.ts`, `src/core/error-buffer.ts` (new)

---

### US-011: `.kind` → `.appType` migration

**Description:** As an agent parsing `/state`, I want `appType` to be the prominent window type field so that filtering by app type works reliably.

**Acceptance Criteria:**
- [ ] `appType` moved to prominent position in `/state` window objects (before other metadata)
- [ ] `.kind` renamed to `_deprecated_kind` (or removed entirely — document decision)
- [ ] All internal code using `.kind` updated to use `.appType`
- [ ] Scripts/skills updated if they reference `.kind`
- [ ] `bun run typecheck` clean
- [ ] `bun run health` passes

**Files:** `src/services/state-service.ts`, potentially scripts/skills that parse state

---

### US-012: `host.promptValue` restores focus on dismiss

**Description:** As a microapp developer, I want focus to return to the previous element after a prompt modal is dismissed so that keyboard navigation isn't broken.

**Acceptance Criteria:**
- [ ] `screen.focused` saved before showing prompt modal
- [ ] Focus restored to saved element in dismiss callback (both confirm and cancel paths)
- [ ] Open a microapp → trigger prompt → dismiss → keyboard input goes to the right element
- [ ] `bun run typecheck` clean
- [ ] `bun run health` passes

**Files:** `src/services/microapp-loader.ts`

---

### US-013: 1×1 screen detection in recording

**Description:** As a user running wibwob-record, I want the script to abort early if no real PTY is attached so that I don't get empty recordings.

**Acceptance Criteria:**
- [ ] `wibwob-record.sh` checks `/health` for screen dimensions before recording
- [ ] Aborts with clear error message if screen ≤ 1×1
- [ ] Works correctly when PTY is present (recording proceeds normally)
- [ ] `bun run health` passes

**Files:** `scripts/wibwob-record.sh`

---

### US-014: `add-command.sh` scaffold

**Description:** As a developer adding commands to WibWob-DOS, I want a scaffold script that generates all required file edits so that I don't miss any of the 4+ wiring points.

**Acceptance Criteria:**
- [ ] `bash scripts/add-command.sh <group>.<verb> "<label>"` generates all required edits
- [ ] Covers: command catalog entry, handler, API route, help text (or whatever the current 4-file wiring is)
- [ ] Generated code is syntactically correct (`bun run typecheck` clean after running)
- [ ] `bun run health` passes

**Files:** `scripts/add-command.sh` (new)

---

### US-015: `canvas` dependency audit

**Description:** As a developer deploying WibWob-DOS in cloud containers, I want the `canvas` native dependency to be optional or removed so that `bun install` doesn't fail in headless environments.

**Acceptance Criteria:**
- [ ] Transitive dependency path to `canvas` identified and documented
- [ ] `canvas` made optional (moved to `optionalDependencies`) or removed entirely
- [ ] `bun install` succeeds in a container without native build tools
- [ ] Functionality that used `canvas` still works when it IS available (graceful degradation)
- [ ] `bun run typecheck` clean
- [ ] `bun run health` passes

**Files:** `package.json`, potentially code that imports canvas transitively

---

### Phase 4 gate

- [ ] Run `.planning/prompts/post-session-review.md` — passes
- [ ] Run `.planning/prompts/simplicity-review.md` on the full phase diff
- [ ] Run `bash scripts/session-debrief.sh` — no new pain introduced

---

## 4. Functional Requirements

- FR-1: The system must focus existing windows when `multiInstance: false` and re-opened
- FR-2: The SDK must accept string percentages for positional layout fields
- FR-3: The SDK must provide `safeReadJSONOrDefault<T>()` for persistence with fallbacks
- FR-4: The SDK must provide `createManagedList` with recursion guard and theme-safe styles
- FR-5: `createAnimationClock` must start paused by default
- FR-6: The loader must auto-discover microapps from `microapps/*/microapp.json`
- FR-7: `.wibwob/microapps.json` must override tiers for any discovered app
- FR-8: `reload-microapp.sh` must warn when `src/` changed since boot
- FR-9: Workspace restore must not crash on individual microapp failures
- FR-10: `clear-all` must await all window closures before returning
- FR-11: `GET /errors/recent` must return last 20 runtime errors as JSON
- FR-12: `/state` must use `appType` as the primary type discriminator
- FR-13: Prompt modals must restore focus on dismiss
- FR-14: Recording must abort on 1×1 screen dimensions
- FR-15: Command scaffolding must generate all wiring points
- FR-16: `canvas` must be optional or removed from the dependency tree

## 5. Non-Goals (Out of Scope)

- Forking blessed to fix platform-level constraints (modal textarea, emoji encoding, etc.)
- Rewriting the microapp architecture (this is incremental cure, not a rewrite)
- Adding new microapps (this epic fixes the platform for existing and future apps)
- Changing the core app registry format (core apps stay in source)
- Backwards-compatible `.kind` support beyond deprecation notice

## 6. Technical Considerations

- **Bun-first:** All changes must work with Bun runtime. No Node-only APIs.
- **Strict TypeScript:** `strict: true` in tsconfig. No `any` casts in new code.
- **ES Modules:** `type: "module"`, NodeNext resolution.
- **SDK boundary:** Microapps import from `microapp-sdk.js` only, never from `src/core/*` or `src/services/*` directly.
- **Phase ordering:** Phase 2 depends on Phase 1. Phase 3 depends on Phase 2. Phase 4 is independent per-story.
- **Pre-work for US-005:** Must grep all `createAnimationClock` callers and add `.play()` before changing the default.
- **Story 3.1 auto-discovery:** Log auto-registered apps so humans/agents know what was picked up.

## 7. Success Metrics

- All 15 code-curable gotchas eliminated (verified by test/typecheck/runtime)
- GOTCHAS.md reduced to ≤800 words (platform constraints only)
- `bash scripts/doc-health.sh` → 15/15
- Zero `(list as any)` casts in refactored microapps
- Zero `clock.pause()` immediately after `createAnimationClock()`
- `bun install` succeeds in headless container
- All 13 microapps pass `validate-microapp.sh`
- No new gotchas introduced (verified by `session-debrief.sh`)

## 8. Open Questions

- Should `_deprecated_kind` be kept for one release cycle, or can `.kind` be removed immediately? (US-011)
- Should auto-discovery (US-006) scan only `microapps/` or also a user-level `~/.wibwob/microapps/` directory?
- What's the exact 4-file wiring path for `add-command.sh`? (US-014 — needs investigation at implementation time)
