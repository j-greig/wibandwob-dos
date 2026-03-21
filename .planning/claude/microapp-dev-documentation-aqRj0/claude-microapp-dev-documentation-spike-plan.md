# Spike Plan — microapp-dev-documentation-aqRj0

> Branch: `claude/microapp-dev-documentation-aqRj0`
> Sources: `PATCHNOTES.md`, `MICROAPP-DEV.md`, `.pi/reflections/claude-code-cloud-agent-devlog.md` (§11 follow-up)
> Goal: apply all learnings from the CCC cloud agent run as prevention-not-cure fixes so the next run is clean

---

## Workstream A — Script patches (cross-platform)

- [x] **A1** `scripts/lib/process-manager.sh` — replace `WW_MODE="${WW_MODE:-direct}"` with headless auto-detect block (`[ ! -t 0 ]` or `$TERM == dumb` → tmux, else direct). Log "auto-detected headless" to stderr.
- [x] **A2** `scripts/lib/process-manager.sh` `ww_start_app()` — replace bare `nohup script -q /dev/null bash -c ...` with `uname` guard: Darwin uses macOS syntax, Linux uses `-qfc` syntax.
- [x] **A3** `scripts/start-alt-instance.sh` — same `uname` guard at its direct-mode block.
- [x] **A4** `.pi/skills/ww-ops/SKILL.md` — add `--max-time 5` to all bare `curl -sf` examples (lines 55, 56, 90, 160).

---

## Workstream B — Doc surface

- [x] **B1** `AGENTS.md` "How these docs work" — change "Four CAPS MD files" → "Six CAPS MD files", add:
  - `MICROAPP-DEV.md` — agent dev workflow: install, start, scaffold, verify, gotchas
  - `PATCHNOTES.md` — script patches for cross-platform (cloud + local) compatibility
- [x] **B2** `MICROAPP-DEV.md` "Visual verification pattern" section — add a **blank-app check** note: `captureText` output must be >50 chars to count as passing. Show what a blank vs passing screenshot looks like.

---

## Workstream C — SDK prevention-not-cure

- [x] **C1** `src/services/microapp-sdk.ts` — add `@group` JSDoc tags distinguishing the two component models at the export site:
  - `CompositionHelper` group: `createStatusBar`, `createTextViewer`, `createListPanel`, `createSplitView`, `createTabs`, `createCanvas`, `createInputLine`, `createHeaderBar`, `createScrollView`
  - `LayoutPart` group: `createProgressBar`, `createKeyValuePanel`, `createDataTable`, `createSpinner`
- [x] **C2** `src/services/microapp-sdk.ts` `createAnimationClock` — add fps guard: `if (fps > 10) console.warn('[microapp-sdk] createAnimationClock: fps=${fps} risks saturating blessed render (recommend ≤10)')`. Add JSDoc `@warn` noting clock starts running immediately — call `clock.pause()` if you want manual control.
- [x] **C3** `src/services/microapp-sdk.ts` — add exported `registerMicroappHooks(win, { captureText, describeState, onCleanup, onRestyle })` typed helper that enforces all four required hooks at once. Document as preferred pattern.
- [x] **C4** `MICROAPP-DEV.md` "The four required hooks" section — update to mention `registerMicroappHooks()` as the preferred approach, individual hooks as the fallback.

---

## Workstream D — Verification infrastructure

- [x] **D1** `scripts/validate-microapp.sh` — new script:
  - Args: `<command-id>` (e.g. `microapp.wibwob.click-counter.open`)
  - Flow: open app → sleep 1 → list windows → text screenshot → check output length > 50 chars → close window → print `PASS` or `FAIL` with screenshot excerpt
  - Exit 0 on PASS, exit 1 on FAIL
- [x] **D2** `scripts/checks/check-cross-platform.sh` — new script:
  - Greps `scripts/` for `script -q /dev/null` without `uname`/`Darwin`/`Linux` guard on the same line or adjacent line
  - Exits 1 with file:line if found, exits 0 with `✓ No platform-specific patterns found`
  - Run this before the Docker gate to self-check

---

## Workstream E — Docker smoke gate

- [ ] **E1** Confirm Docker is running locally: `docker info`
- [ ] **E2** Choose image: `ubuntu:22.04` + install `tmux` + `bun` (closest to CCC environment)
- [x] **E3** Write `scripts/docker-smoke.sh`:
  ```bash
  docker run --rm \
    -v "$(pwd):/app" -w /app \
    -e TERM=dumb \
    ubuntu:22.04 \
    bash -c "apt-get install -qq -y tmux curl && \
             curl -fsSL https://bun.sh/install | bash && \
             ~/.bun/bin/bun install --ignore-scripts && \
             bash scripts/ensure-running.sh --tmux && \
             curl -sf --max-time 5 http://127.0.0.1:8099/health"
  ```
- [ ] **E4** Run `scripts/docker-smoke.sh` — must exit 0 with `✓ ready` and `{"ok":true}`.
- [ ] **E5** If E4 fails, fix A1/A2/A3 before proceeding.

---

## Workstream F — Typecheck + commit

- [x] **F1** `bun run typecheck` — must pass with no errors after all C changes.
- [x] **F2** Run `scripts/checks/check-cross-platform.sh` — must pass (exit 0).
- [ ] **F3** Run `scripts/validate-microapp.sh microapp.wibwob.click-counter.open` against running local instance — must PASS (confirms the validator itself works).
- [x] **F4** Commit all changes:
  ```
  fix(scripts): cross-platform startup — headless auto-detect + Linux script syntax
  feat(sdk): registerMicroappHooks typed helper, fps guard, @group JSDoc tags
  docs: AGENTS.md +MICROAPP-DEV.md +PATCHNOTES.md in doc surface, blank-app check
  chore(checks): add check-cross-platform.sh and validate-microapp.sh
  ```

---

## Workstream G — CCC task spec

- [x] **G1** Write `.pi/tasks/microapp-run-2.md` — the exact prompt to paste into the next CCC session. Must include:
  - [ ] "Read `MICROAPP-DEV.md` before writing any code"
  - [ ] `bun install --ignore-scripts` as the install command
  - [ ] `--tmux` mode only, never `--direct`
  - [ ] `--max-time 5` on every curl
  - [ ] Three specific apps to build:
    - `world-clock` — dual-timezone digital clock, proves `createAnimationClock` at ≤8fps
    - `todo-list` — add/complete/delete, proves `createInputLine` + `createScrollView` + `registerSnapshot`
    - `ascii-clock` — large ASCII art clock face via `createCanvas`, proves animation + non-blank text output
  - [ ] After each app: run `scripts/validate-microapp.sh <id>` and include PASS output in the commit message — **no commit without PASS**
  - [ ] Use `registerMicroappHooks()` for all four hooks
  - [ ] No animation clock above 10fps; call `clock.pause()` immediately after creation
  - [ ] "MICROAPP-DEV.md is canonical; the devlog is narrative — if they conflict, trust MICROAPP-DEV.md"
  - [ ] Import only from `../../src/services/microapp-sdk.js` — never `src/core/*` or `src/ui/*`

---

## What was missing from the original prompt (for reference)

> Keep here for when writing G1 — these were the gaps in the first CCC session prompt.

- No branch constraint specified
- No named apps — open-ended "make some microapps"
- No explicit "non-blank" acceptance criterion (>50 chars captureText)
- No pointer to `ARCHITECTURE.md §The microapp contract` for hook rationale
- No clarity on which doc is canonical vs narrative
- No scope boundary ("build apps only, don't patch scripts")
- `bun install --ignore-scripts` not specified — agent had to discover via failure
- No `PHILOSOPHY.md` pointer for SDK boundary decisions

---

## Execution order

```
D2  check-cross-platform.sh       write + run (self-check before patching)
A1  process-manager.sh auto-detect
A2  process-manager.sh script fix
A3  start-alt-instance.sh fix
A4  ww-ops SKILL.md --max-time
D2  re-run check-cross-platform   must pass now
E1-E5  docker smoke gate          validate Linux behaviour
C1  sdk @group JSDoc
C2  createAnimationClock guard
C3  registerMicroappHooks helper
C4  MICROAPP-DEV.md hooks section
D1  validate-microapp.sh
B1  AGENTS.md doc surface
B2  MICROAPP-DEV.md blank-check
F1  bun run typecheck
F2  check-cross-platform.sh
F3  validate-microapp.sh (live smoke)
F4  commit
G1  write CCC task spec
```
