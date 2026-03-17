# Preemptive Hygiene

Branch: `chore/preemptive-hygiene` (from main, 2026-03-17)

## Context

Repo-wide cleanup after a branch jubilee session. 100→28 local branches,
18→3 worktrees, TVision era archived to separate repo. Planning audit found
243 files, ~18 stale, 3 duplicate epic IDs, 7 missing from EPIC_STATUS.md.

Full audit: `.planning/AUDIT-2026-03-17.md`
Jubilee scripts: `.tmp/git-jubilee-2026-03-17/`

## Principles

1. **Docs are infrastructure.** Stale spec = silent wrong code. Monthly hygiene, not annual jubilee.
2. **Token cost is the constraint.** Every AGENTS.md line competes with conversation. Ruthless curation.
3. **Reactive creation > upfront design.** Write specs when agents get confused, not before.
4. **Devlogs are cross-session memory.** Zero-friction or they won't happen.
5. **Generate, don't maintain.** Lists from source code, not hand-written.
6. **`.trash/` for soft deletes.** Only in meaty dirs (`.agents/`, `.planning/`, root). Not in leaf dirs.

## Done criteria

- `bun run typecheck` passes
- No duplicate epic IDs
- AGENTS.md under 150 lines, 9 sections, no COAT duplication
- `scripts/devlog.sh` and `scripts/git-census.sh` exist and work
- Devlog entry written for this session
- EPIC_STATUS.md matches reality

---

## Execution plan

### Phase 1 — Build tools first (so later phases use them)

- [ ] `scripts/devlog.sh` — create/append weekly devlog, journal-compatible
- [ ] `scripts/git-census.sh` — unified branch/worktree/orphan audit
- [ ] `scripts/planning-close.sh` — automate epic/spike → .done/ moves
- [ ] `scripts/list-docs.sh` — generated doc index

### Phase 2 — Clear the deck

- [ ] Root clutter → scratch/ or .trash/: HANDOVER.md, AGENTS-DEVLOG.md, JOURNAL_PLANNING_SEARCH_REPORT.md, modules-private-commits.md
- [ ] `.agents/.trash/` ← agent-master-plan.md, reviews/pi-mono-2026-03-16/
- [ ] Clean "six lenses" references across repo
- [ ] Triage `.fileme/` — capture wibwob-command-ideas, trash session log
- [ ] Move bug-sweep-march-16.md from spikes/ to chores/

### Phase 3 — Fix planning data (use planning-close.sh)

- [ ] Renumber duplicate IDs: e039-unix-cli→e048, e043-session-capture→e049, e047-file-manager-v3→e050
- [ ] .done/ epics: e035-layout-sdk-buildout, e039-instance-lifecycle
- [ ] .done/ spikes: agent-chat-tool-display, clean-screenshot, multi-instance-clarity, opentui-vs-blessed
- [ ] .done/ ideas: plan9-plumber.md (implemented as `wibwob plumb`)
- [ ] Fix E046 status → in-progress (phase 1 shipped)
- [ ] Rename E028 dir: responsive-column-layout → canvas-documents
- [ ] Give e047-wibwob-pi.md its own directory

### Phase 4 — Restructure docs

Target AGENTS.md outline (17→9 sections):
```
1. Intro + Where to look
2. Building a Microapp
3. Shell Development (signpost)
4. Principles (merge COAT + Canon)
5. Operating (merge Key Files + Commands + Lifecycle + Verification)
6. Agent Resources (merge Subagents + Agent Tooling)
7. Planning (signpost + worktrees)
8. Posture (merge Constraints + Operating Posture)
9. Parking Lot
```

- [ ] Review dir names as progressive disclosure (e.g. `.agents/` → `.agent-docs/`? explore during restructure)
- [ ] AGENTS.md → 9-section outline, under 150 lines
- [ ] Kill COAT duplication — one definition in AGENTS.md, signposts elsewhere
- [ ] Trim PHILOSOPHY.md — keep north star, signpost AGENTS.md for COAT
- [ ] `.agents/README.md` — strip COAT repetition, pure signpost
- [ ] Restructure `.agents/` — promote devlogs, separate docs from artefacts

### Phase 5 — Process sustainability

- [ ] Review `.planning/` vs reality (crosscheck gh issues, branches)
- [ ] Progressive disclosure in planning dirs (README per multi-file dir)
- [ ] Simplify `.planning/` hierarchy if over-engineered
- [ ] Build `repo-hygiene` skill — monthly jubilee as repeatable process
- [ ] Write devlog entry for this session

### Phase 6 — Longer term

- [ ] Auto-generate INTEGRATION_SURFACE.md from command-catalog.ts
- [ ] Session-start drift detection (from E001)
- [ ] Session-archaeology as input to spec creation
- [ ] Review .pi/agents/ subagents — merge or archive arch/coat/code reviewers
- [ ] Close refactor-docs/025 with pointer to E034/E035/E042
- [ ] Update E001 brief: this chore delivered practical foundation

---

## Research (reference only — read principles above first)

Full research in: `.planning/chores/preemptive-hygiene/research.md`
