# Preemptive Hygiene — Research Notes

Reference material. Read the brief's principles section first.

## Anthropic best practices (progressive disclosure + context engineering)

- **Token cost is the constraint.** Every line in AGENTS.md competes with conversation history. Challenge each sentence: "does this justify its token cost?"
- **Tiered loading:** name+description at discovery, full doc only when relevant. Already how pi skills work — apply same pattern to `.agents/` docs.
- **Degrees of freedom matched to fragility:** prose for flexible tasks, exact scripts for critical ops.
- **Memory across sessions:** devlog entries ARE cross-session memory. Make them first-class.
- **Curation over bulk:** remove stale patterns, keep evergreen. Monthly hygiene, not annual jubilee.

## Codified Context paper (E001 brief)

- **Docs are infrastructure, not artifact.** When a spec is stale, agents silently produce wrong code.
- **Three tiers:** hot (always loaded), domain experts (on-demand), cold (retrieved). We have Tier 1 (AGENTS.md) and partial Tier 3 (.agents/specs/). Tier 2 is our `.pi/agents/` subagents.
- **Reactive creation:** don't design specs upfront. When an agent gets confused, create the spec.
- **Self-updating:** agents edit specs directly. Agent Notes tables for quick findings.

## Agent-native concept (.agents/agent-native-concept.md)

- **Parity:** whatever UI can do, agent can do via tools/API. Already our COAT principle.
- **Granularity:** atomic primitives, features are outcomes from agent loops.
- **New features = new prompts** when tools are atomic.

## Meta skills audit

- **devlog-briefing** — read devlog + standing notes to orient. ✅ good
- **planning-update** — tick checkboxes, advance status, sync. ✅ rarely invoked
- **simplify** — code review + cleanup. ✅ good
- **simplify-docs** — doc DRY, agent readability, human readability. ✅ good
- **simplify-planning** — planning coherence, scope, canon compliance. ✅ heavy
- **session-archaeology** — mine session logs for confusion. 🤔 never used
- **skill-creator** — scaffold new skills. ✅ good
- **pi-session-log-explorer** — recover lost work. 🤔 niche
- **Missing:** repo-hygiene skill

## Child doc audit

- **AGENTS.md** ~180 lines — Tier 1 constitution, restructuring
- **PHILOSOPHY.md** 427 lines — overlaps COAT, needs trim
- **LEXICON.md** 260 lines — useful but large
- **`.agents/README.md`** 76 lines — redundant, repeats COAT
- **`.agents/agent-master-plan.md`** 201 lines — stale, archive
- **`.agents/INTEGRATION_SURFACE.md`** 1034 lines — should be generated
- **`.agents/guides/shell/architecture.md`** — file index, useful
- **`.agents/guides/shell/invariants.md`** — rules, useful
- **`.agents/guides/shell/control-api.md`** — API details, useful
- **`.agents/specs/*.md`** 6 files — subsystem specs (Tier 3), useful
- **`.agents/reflections/*.md`** 3 files — promote these
- **`.agents/guides/microapp/*.md`** 7 files — good
- **`.agents/reviews/pi-mono-2026-03-16/`** 3 files — archive
- **`docs/*.md`** 10 files — useful
- **Root clutter** (HANDOVER, AGENTS-DEVLOG, JOURNAL_PLANNING_SEARCH_REPORT, modules-private-commits) — move
- **`.planning/CONVENTIONS.md`** 75 lines — just simplified
- **`.planning/AGENTS.md`** 40 lines — just simplified
