# AGENTS.md (Codex Prompt-Shim)

This file aligns Codex execution style with the repo canon in `.planning/README.md` and the guardrails encoded in `.claude/hooks/*`.

## Important: Hooks vs Codex

Codex does not natively execute Claude Code hook scripts.  
Treat the rules below as a required prompt-shim and manual gate before finishing work.

## Canon Workflow Rules

1. Issue-first for non-trivial work.
2. Branch-per-issue.
3. Keep PR scope to one logical slice.
4. Update planning briefs the same day issue state changes.
5. Preserve AC -> Test traceability in story files.

## Naming Rules (mirror `name-lint.sh`)

1. C++ files: `snake_case.cpp` / `snake_case.h`
2. Python files: `snake_case.py`
3. Markdown files: kebab-case or uppercase canonical names (`README.md`, `CHANGELOG.md`)
4. Planning filenames under `.planning/epics/` must match epic/feature/story prefixes:
   - `eNNN-*`
   - `fNN-*`
   - `sNN-*`
   - `spkNN-*`
5. Planning checkbox meanings:
   - `[ ]` = not started
   - `[~]` = in progress
   - `[x]` = done
   - `[-]` = dropped / not applicable

## Planning Brief Rules (mirror planning post-write guard)

Every `*-brief.md` under `.planning/epics/` must include:

- `Status: not-started | in-progress | blocked | done | dropped`
- `GitHub issue: #NNN`
- `PR: —` (or actual PR)

If status is not `not-started`, issue must be a real issue number (not placeholder).

## AC/Test Traceability Rule

In planning briefs, every `AC-*` bullet must be followed by a concrete `Test:` line.
No placeholder test lines (`TBD`, `TODO`, `later`).

## Commit Message Rule (mirror `commit-lint.sh`)

Commit subject must match:

`type(scope): imperative summary`

Allowed types:
- `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `ci`, `spike`

Recommended scopes:
- `engine`, `registry`, `ipc`, `api`, `mcp`, `ui`, `contracts`, `vault`, `events`, `paint`, `llm`, `build`, `planning`

## Stop Checklist (mirror `stop-ac-check.sh`)

Before ending a coding pass:

1. Verify changed planning briefs still contain required status header lines.
2. Verify every acceptance criterion has at least one runnable test.
3. Verify no untested AC remains for completed/in-progress work.
4. Verify commit messages (if committing) follow `type(scope): ...`.

## Codex Execution Defaults for This Repo

1. Prefer smallest vertical slice proving direction.
2. Keep behavior compatible unless explicitly scoped as breaking.
3. Add tests for parity/contracts/state sanity when refactoring command surfaces.
4. Include rollback notes in issue/PR artifacts.
