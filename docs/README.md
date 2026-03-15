# WibWob-DOS Documentation

## For agents

Start at `AGENTS.md` (project root) — that's the entry point for every session.
Run `bash scripts/discover.sh` for a lens-organized index of scripts, skills, and docs.

Deeper agent docs live in `.agents/`:
- `.agents/microapp-dev/` — build microapps (7 docs, start with `quick-start.md`)
- `.agents/shell-dev/` — host runtime internals (specs, architecture, devlog)
- `.agents/agent-master-plan.md` — COAT lenses, script mapping, vision

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
