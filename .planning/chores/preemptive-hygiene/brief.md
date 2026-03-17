# Preemptive Hygiene

Branch: `chore/preemptive-hygiene` (from main, 2026-03-17)

## Principles

1. **Docs are infrastructure.** Stale spec = silent wrong code. Monthly hygiene, not annual jubilee.
2. **Token cost is the constraint.** Every AGENTS.md line competes with conversation. Ruthless curation.
3. **Reactive creation > upfront design.** Write specs when agents get confused, not before.
4. **Devlogs are cross-session memory.** Zero-friction or they won't happen.
5. **Generate, don't maintain.** Lists from source code, not hand-written.
6. **`.trash/` for soft deletes.** Only in meaty dirs. Not in leaf dirs.

## Done criteria

- [x] Agents use `wibwob` CLI, not `curl` — CLI prominent in AGENTS.md, child docs updated
- [x] `bun run typecheck` passes
- [x] No duplicate epic IDs
- [x] AGENTS.md under 150 lines, 9 sections, no COAT duplication
- [x] `scripts/devlog.sh` and `scripts/git-census.sh` exist and work
- [x] Devlog entries written for this session
- [x] EPIC_STATUS.md matches reality (19→10 active epics)

---

## Completed

### Phase 1 — Tools
- [x] `scripts/devlog.sh` — pain→why→fix reflections, journal-compatible
- [x] `scripts/git-census.sh` — unified branch/worktree/orphan audit
- [x] `scripts/planning-close.sh` — automate .done/ moves
- [x] `scripts/list-docs.sh` — generated doc index with staleness flags

### Phase 2 — Clear the deck
- [x] Root clutter → .trash/ (HANDOVER, AGENTS-DEVLOG, JOURNAL_PLANNING_SEARCH_REPORT, modules-private-commits)
- [x] Stale agent docs → `.agents/.trash/` (agent-master-plan, reviews/pi-mono)
- [x] Clean "six lenses" references across repo
- [x] Triage `.fileme/` — command ideas → ideas/, session log trashed
- [x] bug-sweep reclassified as chore

### Phase 3 — Fix planning data
- [x] Renumber 3 duplicate IDs (e039→e048, e043→e049, e047→e050)
- [x] 9 epics + 5 spikes + 1 idea → .done/
- [x] Fix E046 status, rename E028 dir, e047-wibwob-pi gets own dir

### Phase 4 — Restructure docs
- [x] AGENTS.md 199→121 lines, 9 sections, `wibwob` CLI front-and-centre
- [x] Kill COAT duplication — one definition, signposts elsewhere
- [x] Trim PHILOSOPHY.md — signpost to AGENTS.md for COAT
- [x] `.agents/` restructured: guides/specs/reflections/reference
- [x] Reflections: frontmatter (week+purpose+themes), TEMPLATE.md, devlog.sh
- [x] Replace curl examples with wibwob CLI in all agent-facing docs

### Phase 5 — Process sustainability
- [x] Planning reality check: 19→10 active epics, 11→6 spikes, 3 GH issues closed
- [x] `repo-hygiene` skill, `commit` skill, `librarian` skill
- [x] Script subdirs: checks/ (5) + testing/ (10), root 38→23
- [x] scripts/README.md, all @desc tags added, discover.sh updated
- [x] PTC review — complementary (scripts = primitives, PTC = glue)
- [x] mitsuhiko/agent-stuff review — adopted commit + librarian
- [x] Ops review — feedback folded in (scripts/README, health gate, drift as script not extension)

### Phase 6 — Progressive disclosure + automation
- [x] 6a: README.md in every active epic + spike dir
- [x] 6b: Auto-generate integration-surface.md (1034→256 lines)
- [x] 6c: Drift detection script (`drift-check.ts`)
- [x] 6e: Archive arch-reviewer + coat-reviewer, update code-reviewer
- [x] 6f: Close refactor-docs/025, update E001 brief
- [x] 6g: Ops review complete

---

## Remaining (future sessions)

- [ ] 6d: Session archaeology — mine ~/.pi/agent/sessions/ quarterly for confusion patterns, create specs reactively
- [ ] Consolidate overlapping test scripts in testing/ (low priority, they work)
- [ ] Numeric prefixes in epic dirs where reading order matters
- [ ] Rename `.agents/` → explore better name (80+ refs, dedicated PR)
- [ ] Explore co-locating agent scripts with agent docs
- [ ] Add gen-integration-surface + drift-check to `bun run health` gate
- [ ] Deprecation lifecycle for scripts/.archive/ (expiry dates per ops review)

---

## Research

Full research: `.planning/chores/preemptive-hygiene/research.md`
