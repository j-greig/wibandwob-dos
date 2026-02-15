# AGENTS.md (Codex Prompt-Shim)

This file aligns Codex execution style with the repo canon in `.planning/README.md` and the guardrails encoded in `.claude/hooks/*`.

## Important: Hooks vs Codex

Codex does not natively execute Claude Code hook scripts.  
Treat the rules below as a required prompt-shim and manual gate before finishing work.
Mirror high-value hook behavior explicitly, including `.claude/hooks/gh-format-lint.sh` for GitHub markdown posting safety.

## Canon Workflow Rules

1. Issue-first for non-trivial work.
2. Branch-per-issue.
3. Keep PR scope to one logical slice.
4. Update planning briefs the same day issue state changes.
5. Preserve AC -> Test traceability in story files.
6. Sync GitHub issue lifecycle continuously, not just at closeout:
   - Set issue to `in-progress` when implementation starts.
   - Comment with commit SHAs and test evidence as slices land.
   - Update planning `PR:` field when PR is opened.
   - Close story/feature/epic issues immediately after their acceptance checks pass and planning status is `done`.

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

## GitHub Formatting Guardrails

1. Never send long GitHub markdown inline in a quoted shell argument.
2. For issue/PR comments, always use `gh ... --body-file` with a file or heredoc stdin.
3. For PR body updates, always use `gh pr edit --body-file`.
4. Use explicit markdown sections (`Summary`, `Evidence`, `Tests`, `Links`) for readability.
5. Confirm rendered newlines by reading back body text (`gh pr view --json body` / `gh api ... --jq .body`).
6. For commit messages with multiline bodies, use heredoc (`git commit -m \"subject\" -m \"$(cat <<'EOF' ... EOF)\"`) to preserve line breaks.

## Stop Checklist (mirror `stop-ac-check.sh`)

Before ending a coding pass:

1. Verify changed planning briefs still contain required status header lines.
2. Verify every acceptance criterion has at least one runnable test.
3. Verify no untested AC remains for completed/in-progress work.
4. Verify commit messages (if committing) follow `type(scope): ...`.
5. Verify issue lifecycle is synced (`state`, progress comment, PR link, close conditions).

## Closeout Pass (Canon)

When asked to "tidy", "polish", or "close out" an epic/feature, treat it as a canon `closeout pass` task:

1. Reconcile GitHub issue state vs `.planning` mirrors (GitHub is source of truth).
2. Ensure all newly completed follow-ons are marked done/closed in epic/feature briefs.
3. Record unresolved blockers explicitly in the epic/feature/story status blocks.
4. Add or refresh evidence links (test commands, logs, issue comments).
5. Keep closeout commits scoped to reconciliation/docs/small guardrail fixes only.

## Codex Execution Defaults for This Repo

1. Prefer smallest vertical slice proving direction.
2. Keep behavior compatible unless explicitly scoped as breaking.
3. Add tests for parity/contracts/state sanity when refactoring command surfaces.
4. Include rollback notes in issue/PR artifacts.

## Turbo Vision ANSI Guardrail

When rendering images or rich terminal output inside Turbo Vision:

1. Never dump raw ANSI escape streams directly into `TDrawBuffer` text.
2. Always parse ANSI (CSI/SGR) into a cell model first:
   - cell = glyph + fg + bg
3. Render the cell model using Turbo Vision-native drawing (`putChar`/`putAttribute`/`moveStr` with mapped attrs).
4. Treat raw `\x1b[` sequences appearing in UI as a hard failure.

### Prompt Template (use at task start)

Use this exact prompt when starting ANSI/image rendering work:

`Before coding, design the render path from first principles for Turbo Vision: source bytes -> ANSI stream -> parsed cell grid (glyph, fg, bg) -> native TV draw calls. Do not render raw ANSI text. Show the parser/renderer boundaries, cache keys, failure modes, and a test that fails if ESC sequences appear in UI output.`
