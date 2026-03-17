---
name: repo-hygiene
description: >-
  Monthly repo health check — branch census, worktree audit, stale docs,
  planning drift, GH issue triage. Run when branches pile up, worktrees
  sprawl, or planning docs drift from reality. Triggers on: "repo hygiene",
  "branch cleanup", "jubilee", "audit branches", "stale docs", "planning drift".
---

# Repo Hygiene

Monthly health check for the WibWob-DOS repo. Covers branches, worktrees,
docs, planning status, and GH issues.

## Quick run

```bash
# 1. Branch & worktree health
bash scripts/git-census.sh --full

# 2. Doc freshness (flags files >30 days untouched)
bash scripts/list-docs.sh

# 3. Planning status
bun run planning:status
```

## Full audit checklist

### Branches
- [ ] Run `scripts/git-census.sh --full`
- [ ] Any unpushed commits? Push or note why.
- [ ] Any truly unique commits on unmerged branches? Decide: merge, archive, or accept risk.
- [ ] Merged branches? Delete: `git branch --merged main | grep -v main | xargs git branch -d`
- [ ] Stale remote branches? `git push origin --delete <branch>`

### Worktrees
- [ ] `git worktree list` — any pointing at deleted/merged branches?
- [ ] `git worktree prune` to clean broken refs
- [ ] Worktrees >2 weeks old with no commits — remove or recommit

### Docs
- [ ] Run `scripts/list-docs.sh` — any ⚠️ stale flags?
- [ ] AGENTS.md still accurate? Quick scan of sections.
- [ ] Any dead references? `grep -r "six.lens\|agent-master-plan" --include="*.md" | grep -v .trash`

### Planning
- [ ] `bun run planning:status` — any epics stuck in-progress >2 weeks?
- [ ] Cross-check `gh issue list` with `.planning/epics/` — any closed but not in .done/?
- [ ] Active epics with no branch — still real or speculative?
- [ ] Spikes with status:done — move to .done/
- [ ] Ideas with status implemented — move to ideas/.done/

### GH Issues
- [ ] `gh issue list` — any non-epic issues open? Graduate or close.
- [ ] Any epic issues for done epics? Close them.

## When done

```bash
bash scripts/reflect.sh "repo hygiene: <summary of what you found and fixed>" --journal
```
