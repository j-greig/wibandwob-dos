# Jubilee — Triage Unmerged Branches

> 30 branches not in main. Each needs a verdict: merge, archive-tag, or delete.

## Legend

- ✅ **merge** — has value, squash into main
- 🏷️ **tag** — worth preserving as `archive/<name>`, then delete branch
- 🗑️ **delete** — superseded or dead
- 📂 = has a worktree (must `git worktree remove` first)

---

## TVision-era (pre-Bun) — all 🏷️ or 🗑️

| Branch | Date | Verdict | Notes |
|--------|------|---------|-------|
| `heads/last-days-of-tvision` 📂 | Feb 28 | 🏷️ tag as `archive/tvision-final` | Pure C++/Python era. 100 behind main-archive-tvision but has unique late fixes. Tag both, keep this one as the "last real tvision". |
| `feat/e011-desktop-shell` | Feb 21 | 🗑️ | TVision-era desktop shell, 12 unmerged commits, 1855 behind. Superseded. |
| `fix/parity-guardrails-v2` | Feb 25 | 🗑️ | TVision API parity. 11 commits, 1647 behind. Dead. |
| `spike/spk-808-drum-machine` | Feb 23 | 🏷️ tag `archive/808-drum` | Fun prototype. 1 unique commit. Worth a tag for nostalgia. |
| `feat/agent-mailbox` | Feb 15 | 🗑️ | 5 commits, 2078 behind. Ancient mailbox prototype. |

## Stale epics (>1 week, no recent activity)

| Branch | Date | +ahead/-behind | Verdict | Notes |
|--------|------|---------------|---------|-------|
| `epic/e019-rogue-tui-port` 📂 | Mar 10 | +7/-852 | 🏷️ | Rogue game. Cool but parked. Tag it. |
| `epic/e021-vps-multi-agent-world` 📂 | Mar 8 | +35/-1022 | 🏷️ | VPS multi-agent. Big divergence. Tag. |
| `epic/e022-wibwobworld-restore` 📂 | Mar 9 | +1/-939 | 🗑️ | 1 commit ahead, planning doc only. |
| `epic/e031-ui-primitives-brand` | Mar 10 | +18/-760 | 🗑️ | Superseded by E042 design system. |
| `epic/e032-smart-editor` | Mar 10 | +20/-760 | 🗑️ | Closed in planning. Superseded by slap-editor. |
| `epic/e034-layout-primitives-sdk` 📂 | Mar 12 | +1/-619 | 🗑️ | Handover note only. Superseded by E036/E042. |
| `epic/e039-unix-cli-surface` | Mar 13 | +89/-449 | ✅ merge | 89 commits of CLI surface work. Graduation threshold met. Worth keeping. |
| `epic/e041-asciicker` | Mar 14 | +22/-358 | 🏷️ | SALVAGE.md audit. Tag for reference. |
| `epic/e041-touchlab-v2` 📂 | Mar 14 | +14/-358 | 🏷️ | Operator taxonomy planning. Tag. |
| `epic/e042-asciicker-engine` 📂 | Mar 14 | +24/-358 | 🏷️ | Cat in Glasgow isometric engine. Fun. Tag. |

## Stale features/fixes/spikes

| Branch | Date | +ahead/-behind | Verdict | Notes |
|--------|------|---------------|---------|-------|
| `feat/ralph-glitchbox-run` 📂 | Mar 8 | +1/-972 | 🗑️ | 1 commit. Glitchbox already in main. |
| `feat/microapp-sdk-runtime` 📂 | Mar 8 | +4/-965 | 🗑️ | DAW components. Superseded by E042 SDK. |
| `feat/music-player-playlist` | Mar 10 | +1/-752 | 🗑️ | 1 commit. FFT analysis spike. |
| `feat/dashboard-xxl` | Mar 12 | +5/-642 | 🗑️ | Reverted screen.alloc. Dead. |
| `codex/feat-touchlab-mvp` | Mar 8 | +2/-1022 | 🗑️ | Codex output. Superseded. |
| `codex/spike-module-runtime-reload` | Mar 8 | +10/-1022 | 🗑️ | Codex output. Superseded. |
| `chore/sdk-robustness` | Mar 13 | +22/-449 | ✅ merge | Housekeeping, 22 commits. Check for useful bits. |
| `fix/connect-sh-env-autoload` | Mar 8 | +3/-1009 | 🗑️ | Tiny skill fix. Stale. |
| `fix/parity-guardrails-v2` | Feb 25 | +11/-1647 | 🗑️ | TVision era. |

## Active (keep as-is)

| Branch | Date | +ahead/-behind | Worktree | Notes |
|--------|------|---------------|----------|-------|
| `epic/e043-god-file-decomposition` 📂 | Mar 16 | +3/-3 | main repo | Nearly synced. Close to merge. |
| `epic/e045-file-manager-v2` | Mar 16 | +5/-78 | — | Recent file manager work. |
| `epic/e047-file-manager-v3` 📂 | Mar 16 | +2/-51 | wibwob-file-manager-v3 | Active column browser. |
| `spike/spk-instance-targeting-v2` 📂 | Mar 16 | +7/-1 | wibwob-targeting | Almost ready. |
| `spike/spk-journal-v4-auto-journal` 📂 | Mar 15 | +14/-216 | journal-v4 | Active spike. |
| `autoresearch/wibmux-2026-03-15` 📂 | Mar 15 | +4/-135 | wibmux | Active R&D. |
| `autoresearch/chrome-browser-extraction` 📂 | Mar 13 | +1/-449 | browse | Pi extension spike. |

---

## Worktrees to remove after deleting branches

```bash
git worktree remove ~/Repos/wibandwob-dos-last-days-of-tvision
git worktree remove ~/Repos/wibwob-ralph-glitchbox
git worktree remove ~/Repos/wibwob-sdk
git worktree remove ~/Repos/wibandwob-dos-e019
git worktree remove ~/Repos/wibwobdos-vps
git worktree remove ~/Repos/wibwobdos-e022
git worktree remove ~/Repos/wibwob-e034-layout-sdk
git worktree remove ~/Repos/wibandwob-dos-touchlab-v2
git worktree remove ~/Repos/wibandwob-dos-asciicker-engine
```
