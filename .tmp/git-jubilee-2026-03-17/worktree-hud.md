# Worktree HUD — 4 worktrees

> Every branch is pushed to origin. Nothing is lost.
> This doc should be constantly updated to reflect filedir reality on this machine.

---

## ✅ Active

- **wibandwob-dos** · `main` · Mar 17
  The repo itself.

- **wibwob-targeting** · `spike/spk-instance-targeting-v2` · Mar 17 · 204M
  Desktop naming, @ addressing, user stories. Also contains wibmux prototype (merged in). 11 unique commits.

## 🏷️ Dormant (on origin, worth keeping locally for now)

- **wibandwob-dos-e019** · `epic/e019-rogue-tui-port` · Mar 10 · 631M
  Rogue TUI game — castle, magick, sigils, mode switching. 7 unique commits.

- **wibandwob-dos-touchlab-v2** · `epic/e041-touchlab-v2` · Mar 14 · 193M
  TouchDesigner for ASCII art — operator taxonomy, recursive desktop, CLI pipes. 14 unique commits.

## Sibling dirs (not worktrees)

- **wibandwob-dos-tvision** · 72M — Standalone clone. TVision C++ archive. Keep.
- **wibandwob-dos-ghostty** · 98M — Separate repo? Check.

---

## ✂️ Deleted this session

- **wibandwob-dos-cinema** · `main` — Second main checkout. Main moved to primary repo.
- **wibwob-file-manager-v3** · `epic/e047-file-manager-v3` — Merged to main, branch deleted.
- **wibandwob-dos-last-days-of-tvision** · `last-days-of-tvision` — Archived to `j-greig/wibandwob-dos-tvision`.
- **wibandwob-dos-asciicker-engine** · `epic/e042-asciicker-engine` — 24 commits on `origin/`.
- **e046-deep-linking** · `epic/e046-deep-linking` — Merged to main, branch deleted.
- **wibwob-pi** · `epic/e047-wibwob-pi` — Merged to main, branch deleted.
- **wibandwob-dos-journal-v4** · `spike/spk-journal-v4-auto-journal` — Merged to main, branch deleted.
- **wibandwob-dos-wibmux** · `autoresearch/wibmux-2026-03-15` — Merged into targeting branch.
- **wibwob-ralph-glitchbox** · `feat/ralph-glitchbox-run` — 1 commit on `origin/`.
- **wibwobdos-vps** · `epic/e021-vps-multi-agent-world` — 35 commits on `origin/`.
- **wibwob-sdk** · `feat/microapp-sdk-runtime` — 4 commits on `origin/`.
- **wibwobdos-e022** · `epic/e022-wibwobworld-restore` — 1 commit on `origin/`.
- **wibwob-e034-layout-sdk** · `epic/e034-layout-primitives-sdk` — 1 commit on `origin/`.
- **wibandwob-dos-browse** · `autoresearch/chrome-browser-extraction` — 1 commit on `origin/`.
- **wibwob-unblessed-spike** — Empty dir.

---

## Scripts

### Regenerate this HUD

```bash
#!/bin/bash
set -euo pipefail

git worktree list --porcelain | grep "^worktree " | sed 's/^worktree //' | while read wt; do
  dir=$(basename "$wt")
  branch=$(git -C "$wt" branch --show-current 2>/dev/null || echo "DETACHED")
  last=$(git -C "$wt" log -1 --format='%ad' --date=short 2>/dev/null)
  disk=$(du -sh "$wt" 2>/dev/null | cut -f1)
  unique=$(git log "$branch" --oneline --not origin/main 2>/dev/null | wc -l | tr -d ' ')
  echo "- **$dir** · \`$branch\` · $last · $disk — $unique unique commits"
done
```
