# E002 Migration Summary

## Moved (spike -> repo root)

| From | To | Notes |
|---|---|---|
| spikes/ts-tui-mvp/src/ | src/ | App source tree |
| spikes/ts-tui-mvp/package.json | package.json | Renamed to wibandwob-dos |
| spikes/ts-tui-mvp/bun.lock | bun.lock | |
| spikes/ts-tui-mvp/tsconfig.json | tsconfig.json | |
| spikes/ts-tui-mvp/blessed-xterm-1.5.1.tgz | blessed-xterm-1.5.1.tgz | |
| spikes/ts-tui-mvp/scripts/*.sh | scripts/*.sh | 4 smoke scripts |
| spikes/ts-tui-mvp/AGENTS.md | CLAUDE.md | Real file (was spike AGENTS.md) |
| — | AGENTS.md | Symlink -> CLAUDE.md |

## Active docs moved to root docs/

000-docs-overview, 015-window-manager, 018-command-registry, 019-context-menus,
020-target-architecture, 021-unicode-cell-rendering, 022-doc-prune-backlog,
refactor-epoch-plan

## Reference docs archived

23 reference/review/stale docs moved to
`.planning/epics/e002-ts-tui-root-migration/legacy-docs/`
(7 already-retired docs in legacy-docs/.trash/)

## Retained at root

| Item | Reason |
|---|---|
| .agents/, .claude/, .codex/, .github/, .pi/, .planning/, .zed/, .zilla/ | Repo governance dot-dirs |
| microapps/ | Public content modules |
| microapps-private/ | Private content submodule |
| vendor/claude-system | Reference submodule |
| logs/ | Runtime logs |
| scratch/ | Ephemeral local state (gitignored) |
| screenshots/ | Media/verification artifacts |
| exports/ | Generated output artifacts |
| NOTES.md | Working glossary (absorb into README later) |
| tools/agent_mailbox/ | Operational tooling, still active |
| tools/github/gh-markdown.sh | Repo-wide utility |
| scripts/init-submodules.sh | Submodule init (still needed) |

## Rewritten

| Item | Change |
|---|---|
| .gitignore | Rewritten for TS root shape |
| .gitmodules | Rewritten: only claude-system + modules-private |
| src/core/config.ts | Path resolution fixed for root; SPIKE_* renamed with compat aliases |
| package.json | name -> wibandwob-dos, version 0.2.0 |

## Deleted

| Item | Reason |
|---|---|
| partykit/ | Multiplayer parked, git history recovers |
| tools/api_server/ | C++ Python API server, replaced by TS control-api |
| tools/smoke_parade.py | C++ contract test runner |
| tools/arrange.py | C++ layout prototyping |
| tools/contour_stream.py | C++ era generative |
| tools/generative_engine.py | C++ era generative |
| tools/generative_stream.py | C++ era generative |
| tools/room/ | Multiplayer (partykit deleted) |
| tools/monitor/ | C++ era instance monitor |
| tools/scripts/ | Legacy nested scripts |
| tests/contract/ | C++ API contract tests |
| tests/room/ | Multiplayer tests |
| tests/test_*.py | C++ IPC tests |
| tests/test_*.sh | C++ menu tests |
| tests/run_ipc_chain.py | C++ IPC chain |
| scripts/dev-start.sh, dev-stop.sh | C++ launchers |
| scripts/parity-check.py | C++ parity checker |
| scripts/snap.sh, stamp.sh | Legacy capture helpers |
| scripts/sprite-*.sh | Legacy deployment |
| scripts/workspace_snapshot.py | Legacy API snapshot |
| scripts/tmux-launch.sh | C++ tmux launcher (rewrite noted in 020) |
| vendor/tvision | C++ dependency |
| vendor/tvterm | C++ dependency |
| vendor/MicropolisCore | C++ dependency |
| spikes/ts-tui-mvp/vendor/pi-mono | Research, not promoted |
| spikes/ts-tui-mvp/vendor/piclaw | Research, not promoted |
| spikes/ts-tui-mvp/.pi/ | Merged selectively into root .pi/ |
| CLAUDE.md (old root) | Replaced by spike version |
| README.md (old root) | Replaced by spike version |
| AGENTS.md (old root) | Now symlink to CLAUDE.md |

## Verification

- `bun run typecheck` passes clean from repo root
- `bun run start` is the documented launch command
- Active doc paths updated to root locations
- Smoke script ROOT= paths updated
