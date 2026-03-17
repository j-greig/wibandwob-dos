# Preemptive Hygiene — Research + Plan

Branch: `chore/preemptive-hygiene`

## Key takeaways

1. **Docs are infrastructure.** Stale spec = silent wrong code. Monthly hygiene, not annual jubilee.
2. **Token cost is the constraint.** Every line in AGENTS.md competes with conversation. Ruthless curation.
3. **Reactive creation > upfront design.** Don't write specs until an agent gets confused. Then write it.
4. **Devlogs are cross-session memory.** Closest thing to persistent learning. Make them zero-friction.
5. **Generate, don't maintain.** Lists of files, commands, agents — generate from source, don't hand-write.

---

## Research synthesis

### Anthropic best practices (progressive disclosure + context engineering)

- **Token cost is the constraint.** Every line in AGENTS.md competes with conversation history. Challenge each sentence: "does this justify its token cost?"
- **Tiered loading:** name+description at discovery, full doc only when relevant. Already how pi skills work — apply same pattern to `.agents/` docs.
- **Degrees of freedom matched to fragility:** prose for flexible tasks, exact scripts for critical ops. Our AGENTS.md mixes both — separate them.
- **Memory across sessions:** devlog entries ARE cross-session memory. Make them first-class, not afterthought.
- **Curation over bulk:** remove stale patterns, keep evergreen. Monthly hygiene, not annual jubilee.

### Codified Context paper (E001 brief)

- **Docs are infrastructure, not artifact.** When a spec is stale, agents silently produce wrong code.
- **Three tiers:** hot (always loaded), domain experts (on-demand), cold (retrieved). We have Tier 1 (AGENTS.md) and partial Tier 3 (.agents/shell-dev/specs/). Tier 2 is our `.pi/agents/` subagents.
- **Reactive creation:** don't design specs upfront. When an agent gets confused, create the spec.
- **Self-updating:** agents edit specs directly. Agent Notes tables for quick findings.

### Agent-native concept (.agents/agent-native-concept.md)

- **Parity:** whatever UI can do, agent can do via tools/API. Already our COAT principle.
- **Granularity:** atomic primitives, features are outcomes from agent loops.
- **New features = new prompts** when tools are atomic. This is why devlog + journal matter — they're the prompt surface for process improvement.

### Existing meta skills audit

| Skill | What | Status |
|-------|------|--------|
| `devlog-briefing` | Read devlog + standing notes to orient | ✅ good, use at session start |
| `planning-update` | Tick checkboxes, advance status, sync | ✅ good but rarely invoked |
| `simplify` | Code review + cleanup | ✅ good |
| `simplify-docs` | Doc review — DRY, agent readability, human readability | ✅ good |
| `simplify-planning` | Planning audit — coherence, scope, canon compliance | ✅ good but heavy |
| `session-archaeology` | Mine session logs for confusion patterns | 🤔 valuable but never used |
| `skill-creator` | Scaffold new skills | ✅ good |
| `pi-session-log-explorer` | Recover lost work from session logs | 🤔 niche |

**Missing:** repo-hygiene skill (branches, worktrees, stale docs, planning drift).

### Child doc audit

| Path | Lines | Role | Status |
|------|-------|------|--------|
| `AGENTS.md` | ~180 | Tier 1 constitution | 🔄 restructuring |
| `PHILOSOPHY.md` | 427 | North star, overlaps COAT | ⚠️ trim, signpost from AGENTS |
| `LEXICON.md` | 260 | Vocabulary | ✅ useful but large |
| `.agents/README.md` | 76 | Repeats COAT, signposts discover | ⚠️ redundant |
| `.agents/agent-master-plan.md` | 201 | Six lenses (stale) | 🗑️ archive |
| `.agents/INTEGRATION_SURFACE.md` | 1034 | Full API reference | ⚠️ should be generated |
| `.agents/shell-dev/architecture.md` | ? | File index, subsystems | ✅ useful |
| `.agents/shell-dev/invariants.md` | ? | Rules | ✅ useful |
| `.agents/shell-dev/control-api.md` | ? | API details | ✅ useful |
| `.agents/shell-dev/specs/*.md` | 6 files | Subsystem specs (Tier 3) | ✅ useful |
| `.agents/shell-dev/devlogs/*.md` | 3 files | Weekly devlogs | ✅ promote |
| `.agents/microapp-dev/*.md` | 7 files | Microapp building guide | ✅ good |
| `.agents/reviews/pi-mono-2026-03-16/` | 3 files | One-off review | 🗑️ archive |
| `docs/*.md` | 10 files | Design system, SDK, examples | ✅ useful |
| Root clutter: HANDOVER, AGENTS-DEVLOG, JOURNAL_PLANNING_SEARCH_REPORT, modules-private-commits | 4 files | Stale/one-off | 🗑️ move to scratch |
| `.planning/CONVENTIONS.md` | 75 | Planning + commit conventions | ✅ just simplified |
| `.planning/AGENTS.md` | 40 | Planning quick reference | ✅ just simplified |

---

## Execution plan

### Phase 1 — Clear the deck
1. ~~Create `chore/preemptive-hygiene` branch~~ ✅
2. ~~Research best practices~~ ✅
3. Move root clutter to scratch/
4. Archive stale agent docs (agent-master-plan, reviews)
5. Clean stale references to "six lenses" across repo

### Phase 2 — Build tools
6. Write `scripts/devlog.sh` — create/append weekly devlog, journal-compatible output
7. Write `scripts/git-census.sh` — unified branch/worktree/orphan audit
8. Write `scripts/planning-close.sh` — automate .done/ moves
9. Write `scripts/list-docs.sh` — generated doc index

### Phase 3 — Restructure docs
10. Kill COAT duplication — one definition, signposts elsewhere
11. Restructure `.agents/` — promote devlogs, separate docs from artefacts
12. Restructure AGENTS.md — 9-section outline
13. Trim PHILOSOPHY.md — signpost to AGENTS.md for COAT, keep only north star

### Phase 4 — Process sustainability
14. Review `.planning/` vs reality — crosscheck with gh issues, branches, actual use patterns
15. Simplify `.planning/` if hierarchy is over-engineered for actual human behaviour
16. Build `repo-hygiene` skill — monthly jubilee as repeatable skill
17. Write devlog entry for this session

### Phase 5 — Longer term
18. Make INTEGRATION_SURFACE.md auto-generated from command-catalog.ts
19. Consider session-archaeology as input to spec creation (E001 reactive pattern)
20. Review if `.agents/` subagents (arch-reviewer, coat-reviewer, code-reviewer) should merge or archive
