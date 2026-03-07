---
name: planning-update
description: >-
  Update .planning docs after completing work — tick story checkboxes, advance
  story/feature/epic status, run planning:sync, commit. Use after finishing any
  story, feature, or epic. Triggers on: task done, story complete, epic closed,
  closing out work, updating planning docs.
---
# Planning Update

After completing any story, feature, or epic — update `.planning` immediately.
Do not leave docs stale.

## Trigger Table

| Event | Action |
|-------|--------|
| Completed a task checkbox | Edit story brief: `[ ]` → `[x]` |
| All tasks in story done + ACs verified | Set story `Status: done`. Tick story in parent feature checklist `[ ]` → `[x]` |
| All stories in feature done | Set feature `Status: done`. Tick feature in epic checklist `[ ]` → `[x]` |
| All features in epic done | Set epic frontmatter `status: done`. Run `bun run planning:sync` |
| Starting a story | Set story `Status: in-progress`. Set parent feature `[~]` |

## Exact Edit Patterns

### Story closeout — `sNN-story-brief.md`

```
Status: done
PR: #NNN
```

- Change all remaining `[ ]` → `[x]`
- Change any `[~]` → `[x]`
- Add `PR: #NNN` if a PR was merged for this story

Then open the **parent feature brief** and tick the story in its checklist:

```diff
-  - [~] S02 — Preserve renderMode on restore
+  - [x] S02 — Preserve renderMode on restore
```

### Feature closeout — `fNN-feature-brief.md`

```
Status: done
```

Then open the **parent epic brief** and tick the feature in its checklist:

```diff
-  - [~] F01 — Restore fidelity
+  - [x] F01 — Restore fidelity
```

### Epic closeout — `eNNN-brief.md` YAML frontmatter

```yaml
---
id: E022
title: WibWobWorld Restore & Layout Fidelity
status: done        # ← was in-progress
issue: 116
pr: 234             # ← add merged PR number
depends_on: [E018]
---
```

Then regenerate the status register:

```bash
bun run planning:sync
```

### Verify after any sync

```bash
bun run planning:status
```

Confirm the epic row shows `[x]` done and the PR reference is populated.

## Closeout Pass

A **closeout pass** runs after the last PR for a story, feature, or epic merges:

1. Verify all ACs pass against the running app or code — not just typecheck.
2. Tick all task checkboxes `[x]` in the story brief.
3. Set `Status: done` in the story/feature brief (or `status: done` in epic frontmatter).
4. If closing an **epic**: run `bun run planning:sync` to regenerate `EPIC_STATUS.md`.
5. Commit with the correct format (see below).

Do not declare done based on typecheck alone. Run the app and verify observable behaviour.

## Commit Format

```
docs(planning): close SNN <story title>
docs(planning): close E0NN <epic title>
docs(planning): tick <story>/<feature> — <what was verified>
```

Examples:

```
docs(planning): close S02 renderMode restore
docs(planning): close E022 WibWobWorld restore & layout fidelity
docs(planning): tick S01/F01 — debug breadcrumbs stripped, typecheck clean
```

One logical change = one planning update commit.

## Checkbox States

| Marker | Meaning |
|--------|---------|
| `[ ]` | Not started |
| `[~]` | In progress |
| `[x]` | Done |
| `[-]` | Dropped / not applicable |

## Status Values

Valid for story/feature `Status:` field and epic frontmatter `status:`:

`not-started` · `in-progress` · `blocked` · `done` · `dropped`

## DO NOT

- **Do not update `EPIC_STATUS.md` manually** — always use `bun run planning:sync`.
  The file is machine-generated from epic frontmatter; hand-edits will be overwritten.
- **Do not skip the verify step** — run `bun run planning:status` after syncing to
  confirm the register reflects reality.
- **Do not close an epic until all story ACs are verified** against running code,
  not just against typecheck or a brief scan.
- **Do not leave planning docs stale** — update in the same session the work lands,
  not retroactively in a cleanup pass.
