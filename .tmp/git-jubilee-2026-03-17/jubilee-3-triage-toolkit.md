# Jubilee Toolkit

> Reusable scripts in `scripts/`. This doc is the checklist + index.

## Scripts

| Script | What |
|--------|------|
| `census.sh` | Branch counts, worktrees, merged vs unmerged |
| `safety-check.sh` | Verify main == origin/main before nuking |
| `stale-branches.sh` | Unmerged branches ranked by date + ahead/behind |
| `find-orphans.sh` | Commits that only exist locally (the one that saved TVision) |
| `remote-only.sh` | Remote branches with no local tracking |
| `backup-repo.sh` | Create private GitHub backup of all branches + tags |
| `nuke-merged.sh` | Delete all merged branches, local + remote |

## Checklist

1. [ ] `bash scripts/census.sh`
2. [ ] `bash scripts/safety-check.sh`
3. [ ] `git push origin --all`
4. [ ] `bash scripts/backup-repo.sh`
5. [ ] `bash scripts/find-orphans.sh` — **stop if 🔴, push or archive first**
6. [ ] Archive any legacy branches to separate repo
7. [ ] `bash scripts/nuke-merged.sh`
8. [ ] `bash scripts/stale-branches.sh` — verdict per unmerged branch
9. [ ] Remove stale worktrees: `git worktree remove [--force] <path>`
10. [ ] `bash scripts/census.sh` — verify counts dropped
