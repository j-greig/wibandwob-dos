# .planning — Canon Terms for Development Planning

This directory is the authoritative reference for how work is planned, named,
scoped, tested, and shipped in WibWob-DOS. Every agent and contributor follows
these conventions. No exceptions.

WibWob-DOS is a **TypeScript / Bun / Blessed TUI** application. It is not a C++
project. There is no engine, no IPC, no cmake. The runtime is Bun; the interface
layer is Blessed; state lives in TypeScript objects serialised to JSON workspace
files. These docs reflect that reality.

## Glossary of Canon Terms

| Term | Meaning |
|------|---------|
| **TUI** | The Blessed terminal UI — the entire visual surface. Windows, menus, palette, and desktop live here. |
| **Window** | A Blessed box managed by AppController. Has a `WindowKind`, `WindowRecord`, lifecycle hooks, and workspace serialisation. |
| **Microapp** | A dynamically-loaded window type registered by a module at runtime. Lives in `modules/` or `modules-private/`. |
| **Module** | A directory with a `module.json` manifest and `index.ts` entry point. Registers window types, commands, themes, or snapshot handlers. |
| **Command** | A named, catalogued action in `CommandRegistry`. The single source of truth for what the app can do. Projected into menus, palette, API, and agent tools. |
| **Primer** | Content module (art, prompts, themes) loaded from `modules/` or `modules-private/`. |
| **Workspace** | The persisted JSON snapshot of the desktop: open windows, positions, sizes, and per-window state. Saved and restored automatically. |
| **Snapshot** | A window's serialised state round-tripped through `describeState()` and `restoreFromState()`. |
| **Theme** | A named token set registered via `registerExternalTheme()`. All windows observe theme changes via `onRestyle()`. |
| **Actor** | An attributed identity (human, agent, system) attached to state-mutating API calls. |
| **Epic** | A multi-PR program of work that delivers a major outcome. |
| **Feature** | A coherent capability inside an epic; typically delivered across 1–3 stories. |
| **Story** | A vertical slice with user-visible or interface-visible value, normally one PR target. |
| **Task** | A concrete implementation step inside a story. |
| **Spike** | Timeboxed investigation to reduce uncertainty before implementation. |

## Naming Conventions

### Branches

```
<type>/<short-kebab-description>
```

Canon branch types: `epic`, `spike`, `fix`, `feat`, `chore`, `docs`.

Examples:
- `epic/e024-session-retroapply`
- `spike/plasma-fullscreen`
- `fix/session-retroapply`
- `feat/command-registry-dynamic`
- `chore/planning-hook-guard`
- `docs/planning-readme`

## Branch Discipline

All development work must happen on a branch tied to the current `.planning`
focus: an epic, spike, or canonical development-task branch.

Rules:
1. Create the branch before the first commit for that work.
2. Match canon branch names:
   - `epic/e0NN-slug`
   - `spike/spk-slug`
   - `fix/slug`
   - `feat/slug`
   - `chore/slug`
   - `docs/slug`
3. Never commit directly to `main`; merge to `main` only after passing
   `bun run typecheck` and smoke.

### Commits

```
<type>(<scope>): <imperative summary>
```

- **type**: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `ci`, `spike`
- **scope**: short module name — `app`, `tui`, `window`, `microapp`, `module`,
  `theme`, `api`, `llm`, `agent`, `primer`, `workspace`, `command`, `snapshot`,
  `build`, `planning`
- **summary**: imperative mood, lowercase, no trailing period, max ~72 chars

Examples:
```
feat(microapp): add MicroappHost createWindow + registerSnapshot wiring
fix(workspace): honour serialised renderMode on restore — remove restoreSafeMode
refactor(module): return geometry from registerSnapshot so positions restore
test(snapshot): add round-trip test for wibwobworld renderMode field
docs(planning): rewrite README for WibWob-DOS — remove C++ engine content
chore(build): upgrade bun lockfile after @anthropic-ai/claude-code bump
```

Multi-line body is encouraged for non-trivial commits. Explain *why*, not *what*.

### Files and Directories

- TypeScript source: `kebab-case.ts` (files), `PascalCase` (classes/interfaces)
- Module manifests: `module.json` in module root
- Test files: `*.test.ts` or `test-*.ts` under `tests/`
- ADRs: `adr-NNNN-<kebab-title>.md`

### Planning Files

Files under `.planning/epics/` follow prefix conventions enforced by hooks:

| Level | Prefix | Dir example | File example |
|-------|--------|-------------|--------------|
| Epic | `eNNN-` | `e001-command-parity-refactor/` | `e001-brief.md` |
| Feature | `fNN-` | `f01-command-registry/` | `f01-feature-brief.md` |
| Story | `sNN-` | `s01-registry-skeleton/` | `s01-story-brief.md` |

Story numbers should be globally unique within an epic (s01–s99), not per-feature.
(Convention — hooks enforce prefix matching, not cross-file uniqueness.)

**All spikes** live under `.planning/spikes/` — never inside epic or feature dirs:

| Level | Dir pattern | File convention |
|-------|-------------|-----------------|
| Spike | `.planning/spikes/spk-<kebab-name>/` | `spk01-findings.md`, `dev-log.md`, etc. |

The hook enforces: any file named `spk[0-9]*.md` must live under
`.planning/spikes/` — rejected everywhere else.

## Progress Tracking

### Authority Rule

**`.planning/` docs are the source of truth for work state.** Feature briefs,
story briefs, and their checkboxes are where design, scope, ACs, and progress
live. GitHub issues exist at the epic level for board-level visibility and PR
linkage (`closes #N`). Do not duplicate feature/story/task tracking as separate
GitHub issues — the briefs already carry more context than issue bodies ever will.

### Status Header

Every epic brief, feature brief, story brief, and spike file must have status
metadata.

**Epic briefs** use YAML frontmatter (preferred — enables `bun run planning:sync`
and auto-sync to `EPIC_STATUS.md`):

```yaml
---
id: E005
title: Theme Runtime Wiring
status: not-started
issue: 43
pr: ~
depends_on: [E003]
---
```

Valid `status` values: `not-started`, `in-progress`, `blocked`, `done`, `dropped`.

**Feature/story/spike briefs** use a body-level status block in the `## Status`
section:

```
Status: not-started | in-progress | blocked | done | dropped
GitHub issue: #NNN
PR: #NNN (when created)
```

Both formats are accepted by the `planning-post-write-guard` hook.

### Checkbox Format

Use these and only these checkbox states:

| Marker | Meaning |
|--------|---------|
| `[ ]` | Not started |
| `[~]` | In progress |
| `[x]` | Done |
| `[-]` | Dropped / not applicable |

Link checkboxes to their GitHub issue when one exists at the epic level:

```
- [x] Module loader scans manifests at startup
- [~] Snapshot round-trip for microapp windows
- [ ] Geometry restored on restart
- [-] Web-based module registry (out of scope this pass)
```

### Where Progress Lives

| Item | Truth lives in | GitHub |
|------|---------------|--------|
| Epic | `eNNN-brief.md` frontmatter + feature checklist | One issue per epic (board view + PR linkage) |
| Feature | `fNN-feature-brief.md` story checklist + ACs | No separate issue — brief is sufficient |
| Story | `sNN-story-brief.md` task/AC checklist | No separate issue — brief is sufficient |
| Spike | `spkNN-*.md` findings section | Issue if cross-cutting, otherwise brief only |
| Task | Story brief task list | No issue — checkbox in brief |

### Parking Lot

Each epic can have an `eNNN-parking-lot.md` for deferred items. Use
`.planning/parking-lot.md` for cross-cutting follow-ons not tied to a specific
epic.

Rules:
1. Parking lot items do not need GitHub issues unless promoted to a feature/story.
2. Use `task` (implementation) or `spike` (investigation) labels in the register.
3. If an item grows beyond one small PR, promote it into a proper feature/story.

### Off-Cuff / Side Work Rule

When work appears mid-stream and is not required to close the current
story/feature:

1. Add it to the relevant epic's parking lot or `.planning/parking-lot.md`.
2. Do not mark parent ACs done based on follow-on progress.
3. Promote to a feature/story if it needs its own branch.

## How to Update Planning

Use the planning scripts to check and sync status across briefs and
`EPIC_STATUS.md`:

```bash
# Print current epic status summary
bun run planning:status

# Sync EPIC_STATUS.md from epic brief frontmatter
bun run planning:sync
```

Both commands run `.claude/scripts/planning.sh` with the appropriate verb.

### Updating an Epic Brief

1. Open the epic's `eNNN-brief.md`.
2. Update the YAML frontmatter `status` field.
3. Check off completed features in the feature checklist.
4. Run `bun run planning:sync` to propagate to `EPIC_STATUS.md`.
5. Commit: `docs(planning): mark E0NN <feature> done`.

### Updating a Story or Feature Brief

1. Open the brief and update `Status:` and checkbox states.
2. Add the PR number to the `PR:` field when a PR opens.
3. No sync script needed — briefs are the truth.

### Self-Update Patterns

For agent-driven planning updates (after landing a story, closing an epic,
running a planning audit), see the `simplify-planning` skill:
`.pi/skills/simplify-planning/SKILL.md`.

## Epic Lifecycle Ceremony

### Opening an Epic (`not-started` → `in-progress`)

1. Set `status: in-progress` in YAML frontmatter.
2. Open the GitHub issue and add a comment linking to the brief.
3. Run `bun run planning:sync`.
4. Commit: `docs(planning): open E0NN <title>`.

### Landing a Story

1. Mark all task checkboxes `[x]` in the story brief.
2. Set story `Status: done` and add the PR number.
3. Check off the story in the parent feature brief.
4. If all stories in the feature are done, set feature `Status: done`.

### Closing an Epic (`in-progress` → `done`)

1. Verify all feature checklists are fully `[x]` or `[-]`.
2. Set `status: done` in YAML frontmatter.
3. Close the GitHub issue with a comment summarising what shipped.
4. Run `bun run planning:sync`.
5. Commit: `docs(planning): close E0NN <title>`.

### Dropping Work

- Set `status: dropped` in the brief.
- Add a one-line reason in the brief body.
- Mark open checkboxes `[-]` with a reason comment.
- Move any still-relevant items to the parking lot.

## Non-Goals (Explicitly Out of Scope)

- **Retrieval pipelines / RAG.** No vector search, no embedding indexes. Content
  is flat files.
- **Cloud sync.** Local-first only. No remote storage, no sync protocol.
- **Web viewer.** Architecture may accommodate it someday; no current epic owns it.
- **Hosted / multi-tenant runtime.** Single local instance only.
- **Graph databases.** If you can't `cat` the source file and understand it, the
  design is wrong.

## Git Conventions

1. **Epic issue only.** Each epic gets one GitHub issue for board visibility and
   PR linkage. Features/stories/tasks live in `.planning/` briefs, not as
   separate issues.
2. **Branch-per-epic or per-feature.** One branch per logical unit of work. One
   logical change per PR.
3. **No force-push to `main`.** Ever.
4. **No batching unrelated changes.** If a PR touches command registry *and*
   paint palette colours, split it.
5. **PR-sized milestones.** Each PR is small enough to review in one sitting. If
   you can't describe the change in two sentences, split it.
6. **Rollback notes.** Every PR body includes a "Rollback" section: what to
   revert and what breaks.

## Work Item Model (Epic → Feature → Story → Task)

### Hierarchy

1. **Epic** — large outcome across multiple PRs.
   Tracked: `eNNN-brief.md` + one GitHub issue.
2. **Feature** — coherent capability under one epic.
   Tracked: `fNN-feature-brief.md`. No GitHub issue.
3. **Story** — smallest vertical slice we merge confidently.
   Tracked: `sNN-story-brief.md`. No GitHub issue.
4. **Task** — implementation checklist item inside a story.
   Tracked: checkbox in story brief.
5. **Spike** — uncertainty reduction only.
   Tracked: `spkNN-*.md`. GitHub issue only if cross-cutting.

### GitHub Mapping

| Item | GitHub representation | `.planning/` representation |
|------|----------------------|----------------------------|
| Epic | Issue + `epic` label | `eNNN-brief.md` (frontmatter + feature checklist) |
| Feature | — | `fNN-feature-brief.md` (stories + ACs) |
| Story | — | `sNN-story-brief.md` (tasks + ACs) |
| Task | — | Checkbox in story brief |
| Spike | Issue if cross-cutting | `spkNN-*.md` |

### Epic Issue Requirements

Every epic issue should include:
- One-line objective
- Link to epic brief in `.planning/`
- Feature checklist (mirrors brief)

Detailed scope, ACs, test plans, and rollback notes live in the feature/story
briefs, not in the issue body.

### Story Sizing Rule

- Prefer stories that land in one review session and one PR.
- If a story cannot be summarised in two sentences, split it.
- If a PR touches unrelated domains, split it.

## Acceptance Criteria (AC) Rules

Every issue and PR must have specific, measurable acceptance criteria. Vague
criteria like "improve performance" or "clean up code" are not acceptable.

### What Makes an AC Valid

An AC is valid if and only if it is:
1. **Observable.** A human or CI can verify it passed without reading the
   implementation.
2. **Binary.** It either passes or it doesn't. No "mostly works".
3. **Scoped.** It describes one verifiable behaviour, not a bundle.

### AC Format

```
AC-<N>: <imperative statement of observable behaviour>
Test: <exact command or procedure that proves it>
```

### Examples

```
AC-1: CommandRegistry.list("agent") includes dynamically registered commands.
Test: Register a test command via addDynamic(). Call list("agent"). Assert command present.

AC-2: WibWobWorld reopens in the serialised renderMode after restart.
Test: Open in hybrid mode. Save workspace. Kill and restart. Confirm GET /state
      shows renderMode: "hybrid" for the WibWobWorld window.

AC-3: module-loader registerSnapshot returns geometry so positions restore.
Test: Open microapp window at non-default position. Save workspace. Restart.
      Confirm window reopens at saved left/top/width/height via GET /state.

AC-4: bun run typecheck passes with no errors after the change.
Test: Run bun run typecheck. Assert exit code 0.
```

### The Test Rule

**Every AC must have at least one test.** No exceptions.

- If the AC describes a schema: add a schema validation test.
- If the AC describes a behaviour: add a unit or integration test.
- If the AC describes parity: add a parity/drift test.
- If the AC describes a round-trip: add a determinism test.

A PR with untested ACs is not mergeable.

### Test Locations

| Domain | Location | Runner |
|--------|----------|--------|
| Unit tests | `tests/unit/` | `bun test` |
| Integration tests | `tests/integration/` | `bun test` |
| API/smoke tests | `tests/smoke/` | `bun test` or `bash scripts/smoke.sh` |
| TypeScript types | — | `bun run typecheck` |

## PR Checklist (Blocking)

Every PR must satisfy these before merge.

### Correctness
- [ ] All ACs have at least one passing test
- [ ] `bun run typecheck` clean
- [ ] `bun test` passes (or failures are pre-existing and documented)
- [ ] No untracked TODOs without issue links

### Workspace / Snapshot
- [ ] New window state fields serialise and restore correctly
- [ ] `describeState()` round-trips through workspace save/restore
- [ ] No new `undefined` fields written to workspace JSON

### Commands and Menus
- [ ] New commands registered in `CommandRegistry` — not added ad-hoc
- [ ] Command appears in palette, menus, and `GET /commands/list` (as appropriate)
- [ ] Agent-visible commands documented in story brief

### Quality
- [ ] No debug `console.log` or breadcrumb calls left in production paths
- [ ] Rollback notes in PR body (what to revert, what breaks)
- [ ] Architecture docs updated if a subsystem's contract changed

### Docs
- [ ] Planning brief status updated to match PR state
- [ ] `bun run planning:sync` run if epic status changed

## Relationship to Other Directories

| Directory | Role |
|-----------|------|
| `.planning/` | **This directory.** Canon terms, conventions, and quality rules. Normative. |
| `workings/` | Research, planning threads, extracted conversation bundles. Informational, not normative. Local only, not shipped. |
| `docs/` | Architecture docs, guides, reference. Human-readable. |
| `tests/` | Automated tests proving ACs. |
| `scripts/` | Developer utilities — restart, smoke test, planning sync. |
| `modules/` | First-party microapp modules loaded at runtime. |
| `modules-private/` | Private microapp modules (not committed to public repo). |

## Quick Reference Card

```
Branch:   feat/workspace-restore-rendermode
Commit:   fix(workspace): honour serialised renderMode on restore
AC:       AC-1: WibWobWorld reopens in hybrid after restart
Test:     tests/integration/workspace-restore.test.ts — asserts renderMode field
PR body:  ## ACs / ## Rollback / ## What remains for next PR
Merge:    All checklist items checked, bun run typecheck clean, bun test green
Planning: bun run planning:status  |  bun run planning:sync
```
