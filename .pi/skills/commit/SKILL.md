---
name: commit
description: "Read this skill before making git commits. Enforces WibWob-DOS conventional commit format."
---

Create a git commit using the project's conventional commit format.

## Format

`<type>(<scope>): <imperative summary>`

- **type** REQUIRED: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `spike`
- **scope** OPTIONAL: short noun for affected area (`microapp`, `sdk`, `window`, `api`, `planning`, `cli`)
- **summary** REQUIRED: imperative mood, lowercase, ≤72 chars, no trailing period

## Body

Optional. Blank line after subject. Explain *why*, not just *what*.
Chase the 5 whys — scaled to the problem.

**Devlog link — two ways to close the loop:**
- Add `Addresses W13-001a` to the commit body → `devlog-triage.sh` auto-upgrades `open` → `done:<hash>`
- Or update the tag manually: `[status:done:abc1234]`

Status lifecycle: `open` → `in-progress` → `partial` → `done:hash` | `wontfix`
- `partial` = some sub-ideas shipped, pain not fully gone — update the `###` heading tag manually
- `wontfix` = explicitly not doing — add reason inline after the tag

Both paths work. Commit reference is lazier and preferred.

## Rules

- Only commit, do NOT push.
- If unclear which files to include, ask.
- Never commit directly to `main` — check `git branch --show-current` first.
- Run `bun run typecheck` before committing if you changed `.ts` files.

## Steps

1. Review `git status` and `git diff`.
2. Optionally `git log -n 10 --pretty=format:%s` to see recent style.
3. Stage intended files.
4. `git commit -m "<subject>"` (and `-m "<body>"` if needed).
5. If this commit ships a devlog idea, add `Addresses WXX-NNN` to the body — or update `[status:open]` → `[status:shipped:<hash>]` in the reflection file directly.
6. Optionally: `bash scripts/devlog-triage.sh W<NN>` to confirm the link resolved.

## Examples

```
feat(microapp): add createWindow + registerSnapshot wiring
fix(workspace): honour serialised renderMode on restore
chore(planning): move E042 to .done/
docs: radically simplify .planning/README.md
spike(targeting): add precedent comparison table
```

NEVER USE EMOJI IN COMMITS
