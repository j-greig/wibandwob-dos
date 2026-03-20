---
name: git-branch-oneliners
description: >-
  Export recent git commits grouped by branch into a plain text report. Use when the
  user asks for "git oneliners", "last 24h commits by branch", "repo summary","branch commit summary",
  or wants output like "# branch" then "- sha — MM-DD HH:MM — message".
---

# Git Branch Oneliners

Generate a branch-grouped commit report for the last N hours.

## Default format

```text
# branch-name
- abc1234 — 03-19 14:22 — commit subject
```

## Command

```bash
bash .pi/skills/git-branch-oneliners/scripts/export.sh --hours 24 --out .tmp/git-branches-24h.txt --open
```

## Options

- `--hours <n>`: lookback window in hours (default `24`)
- `--out <path>`: output file path (default `.tmp/git-branches-<hours>h.txt`)
- `--open`: open the output file after writing (macOS `open`)

## Notes

- Includes local branches and `origin/*` branches.
- Skips `origin/HEAD`.
- Keeps commits newest-first within each branch section.
- Uses `MM-DD HH:MM` timestamp formatting.
