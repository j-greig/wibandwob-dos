# WibWob-DOS Documentation

## For agents

Start at `AGENTS.md` (project root) — that's the entry point for every session.
Run `bash scripts/discover.sh` for a lens-organized index of scripts, skills, and docs.

Deeper agent docs live in `.agents/`:
- `.agents/guides/microapp.md` — microapp guide (scaffold, SDK, layout, pitfalls)
- `.agents/guides/shell.md` — shell guide (invariants, control API, World Chat)

## For humans

| Doc | What |
|-----|------|
| `building-custom-microapps.md` | Public guide to building microapps |
| `ascii-composition-vocabulary.md` | Creative vocabulary for ASCII visual work |
| `runtime-stats-surface.md` | Spec for runtime inspection surface |

## Architecture

COAT — Command Once, Adapt Thin. Four shared seams (command, inspection,
window, workspace). TUI, CLI, API, agent, and microapps are thin adapters.
Full explanation: `AGENTS.md` § COAT.
