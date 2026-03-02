# E001: Codified Context Infrastructure

Status: not-started
GitHub issue: #106
PR: —

## Summary (300 words)

Informed by "Codified Context: Infrastructure for AI Agents in a Complex
Codebase" (Vasilopoulos, 2026; arXiv:2602.20478v1).
> https://arxiv.org/html/2602.20478v1

The paper's core insight: documentation is INFRASTRUCTURE, not artifact.
Specs are load-bearing — agents depend on them to produce correct output.
When a spec is stale, agents silently produce wrong code that looks right.

Three tiers, distinguished by loading strategy and update frequency:

Tier 1 (Hot Memory): Constitution (~660 lines), always loaded. Conventions,
build commands, architectural summaries, and TRIGGER TABLES with redundant
routing: pre-change triggers (consult specialist BEFORE touching files) and
post-change triggers (review after), PLUS a fallback to suggest_agent(task)
when exploring unfamiliar code. Both paths enforced.

Tier 2 (Domain Experts): 19 specialist agents (115-1,233 lines each).
Each declares: scope, tools, permissions (some READ-ONLY for safety),
relevant Tier 3 docs, output format, and common domain mistakes. Over half
of each spec is domain knowledge, not behavioral instructions — intentional
overlap with Tier 3, because complex domains need a complete pre-loaded
mental model, not piecemeal retrieval. Created REACTIVELY: when debugging
stalls an unguided session, create a specialist and restart.

Tier 3 (Cold Memory): 34 single-subsystem docs written for MACHINE
consumption — file paths, parameter names, expected behaviour, invariants,
symptom/cause/fix tables. Served via MCP with 5 tools: list_subsystems,
get_files_for_subsystem, find_relevant_context, search_context_documents,
suggest_agent. Keyword substring matching (embeddings are future work).

Rollout was PHASED AND REACTIVE, not designed upfront: Phase 1 (days 1-10)
~100-line constitution only; Phase 2 (days 11-30) specs + agents for
high-failure domains; Phase 3 (days 31-57) MCP retrieval + agent pool
expansion. The 24.2% knowledge-to-code ratio is TELEMETRY not a target —
the useful signal is agent behaviour: inconsistency means a spec is missing
or stale.

Key guideline: let the planner gather context BEFORE implementation. Run a
planning pass that surfaces which specs and specialists a task needs.

WibWob-DOS already has elements (CLAUDE.md, AGENTS.md, .pi/skills,
.planning, qmd). This epic formalises and extends them.

## Relevance to WibWob-DOS

We already have:
- CLAUDE.md (~660 lines) — functions as Tier 1 constitution
- AGENTS.md — project-level agent instructions
- .pi/skills/ — 13 skills acting as partial Tier 2 specialists
- .planning/ — spikes, epics, sparks (partial Tier 3)
- qmd collection — 62 indexed md files for search

We lack:
- Trigger tables with pre-change AND post-change routing + suggest_agent fallback
- Agent permission classes (read-only reviewers vs write-capable builders)
- Subsystem specs in machine-consumption format (ours are mixed human/AI)
- Intentional Tier 2/3 overlap for complex domains needing full mental models
- Drift detection as SESSION-START HOOK (not just CI) — parsing recent Git
  commits against subsystem-to-file mapping, injecting warning into context
- Planner-first workflow: gather context before implementation
- Factory agents for bootstrapping new specs/agents from templates
- Phased rollout plan starting with high-failure domains

## Acceptance Criteria

- [ ] AC-1: Constitution includes trigger table with BOTH pre-change and
  post-change triggers, plus fallback to suggest_agent(task) for unfamiliar code
  Test: grep CLAUDE.md for pre-change and post-change trigger sections;
  verify at least 10 file-pattern->skill mappings across both categories;
  verify suggest_agent fallback instruction exists

- [ ] AC-2: At least 5 subsystem specs, each scoped to ONE subsystem, using
  repeatable structure: overview / key files / invariants / failure modes
  (symptom-cause-fix) / do-don't / commands / change checklist
  Test: each spec validates against structure checklist; each contains
  file paths, parameter names, expected behaviour; no spec covers >1 subsystem

- [ ] AC-3: Context drift detector runs as SESSION-START HOOK, parses recent
  Git commits against spec-to-file mapping, injects warning when code changed
  without corresponding spec update
  Test: modify a file covered by a spec without updating spec; start new
  session; verify warning injected into context mentioning the stale spec

- [ ] AC-4: Retrieval exposes 4 search paths: list all specs, lookup by
  subsystem key, free-text search, and agent suggestion (suggest_agent)
  Test: exercise all 4 paths from agent session; verify each returns results

- [ ] AC-5: Telemetry tracks spec-hit rate (how often specs are retrieved),
  stale-spec warnings fired, and tasks requiring repeated human re-explanation
  (the paper's useful signal: agent confusion = missing/stale spec)
  Test: run telemetry script; verify it reports hit rate, warning count,
  and flags repeated explanation patterns from session logs

## Design Questions (open — block implementation until answered)

These questions must be answered before features/stories are cut.

### Stack and storage
1. Is QMD the preferred cold-memory format, or plain Markdown + frontmatter
   as the canonical layer with QMD as search index only?
2. Should the hot-memory constitution stay in CLAUDE.md, or split into
   CLAUDE.md + smaller generated includes?
3. Should specs be stored in .planning/specs/, a new docs/specs/, or
   alongside the code they describe?

### Routing
4. Should trigger routing use file globs only, or also command IDs, window
   types, and changed subsystem tags?
5. Should the command registry serve as the primary routing graph for docs
   too, not just for UI actions?

### Specialists
6. What are the first high-failure domains deserving specialists? Candidates:
   window manager, workspace restore, command registry, blessed rendering,
   agent control API, content measurement, theming
7. Which specialists should be read-only reviewers vs write-capable builders?
8. Should .pi/skills/ stay as the Tier 2 layer, or introduce a new agents/
   layer with skills as one subtype?

### Orchestration
9. Is the orchestrator a human habit, a Claude/Codex convention, or an actual
   runtime service inside the repo?
10. Should planner-first behaviour be enforced by tooling or just documented
    as a guideline?

### Spec format and lifecycle
11. Rigid schema (summary / key files / invariants / commands / failure modes
    / tests / related agents / related specs) or something looser?
12. Should specs be self-compacting (summarising older detail upward) or
    append-only with generated digests?
13. Spec lifecycle: draft -> active -> compressed -> archived, or just
    active/obsolete?
14. For self-updating docs, which source of truth wins when they disagree:
    code, tests, workspace snapshots, or constitution?
15. Should agents be allowed to update specs directly, or only propose
    patches for human review?

### Scope of cold memory
16. Should cold memory document only code structure, or also design intent,
    UX rules, terminal behaviour, and agent etiquette?
17. Should subsystem docs be keyed by folder, concept ("workspace
    persistence"), or runtime object ("WindowManager")?
18. Should workspace JSON snapshots become part of Tier 3 knowledge, or stay
    runtime state only?
19. Which current repo artifacts are already close to good Tier 3 docs and
    should be promoted first?

### Retrieval
20. Should retrieval return only docs, or also exact commands, tests, files,
    and recent commits?
21. Should the WibWob-DOS agent be able to query the TUI for live context, so
    cold memory includes runtime state, not just repo docs?
22. Should QMD retrieval be the canonical interface with MCP as thin adapter,
    or MCP canonical and QMD just storage?
23. Should every spec maintain an explicit file coverage map, or infer
    coverage from backlinks and embeddings?

### Drift and staleness
24. What counts as "stale": changed file hash, changed exported API, changed
    test snapshot, changed command signature, changed workspace schema?
25. Should drift detection run at session start, pre-commit, CI, or all three?
26. Should "missing knowledge" detection use agent confusion text, null
    retrievals, repeated retries, or all of them?

### Maintenance
27. How much do you care about token thrift vs richer always-loaded memory?
28. Which parts of .planning/ remain human-facing prose and which become
    machine-facing specs?
29. Does "self-compacting" mean deduping repeated facts, rolling up old
    decisions into constitutions, or summarising old chat/planning material
    into stable subsystem docs?
30. Is this system mainly for Claude Code / Codex agents, or should it also
    feed in-world Wib/Wob/Scramble agents?

## Reference

Full paper text preserved below for agent consumption.

---
<secondary>
## Full Paper Text

Source: https://arxiv.org/html/2602.20478v1
Title: Codified Context: Infrastructure for AI Agents in a Complex Codebase
Authors: Aristidis Vasilopoulos
Date: 24 Feb 2026

### Abstract

LLM-based agentic coding assistants lack persistent memory: they lose
coherence across sessions, forget project conventions, and repeat known
mistakes. Recent studies characterize how developers configure agents
through manifest files, but an open challenge remains how to scale such
configurations for large, multi-agent projects. This paper presents a
three-component codified context infrastructure developed during
construction of a 108,000-line C# distributed system: (1) a hot-memory
constitution encoding conventions, retrieval hooks, and orchestration
protocols; (2) 19 specialized domain-expert agents; and (3) a cold-memory
knowledge base of 34 on-demand specification documents. Quantitative
metrics on infrastructure growth and interaction patterns across 283
development sessions are reported alongside four observational case studies
illustrating how codified context propagates across sessions to prevent
failures and maintain consistency. The framework is published as an
open-source companion repository.

### 1. Introduction

AI coding agents such as GitHub Copilot, Cursor, and Claude Code have
reached millions of developers, and recent work documents fully agentic
systems capable of planning, executing, and iterating on complex
development tasks. These tools possess broad programming knowledge, but
they lack project memory: each session begins without awareness of prior
sessions, established conventions, or past mistakes. Consistent output for
a specific project requires knowledge that persists across sessions, yet
single-file manifests (.cursorrules, CLAUDE.md, AGENTS.md) do not scale
beyond modest codebases: a 1,000-line prototype can be fully described in a
single prompt, but a 100,000-line system cannot. The AI must be told —
repeatedly, reliably, and in a format it can act on — how the project
works, what patterns to follow, and what mistakes to avoid. Structured
knowledge transfer to agents remains a largely open interaction design
problem.

This paper addresses the gap with a codified context infrastructure that
treats documentation as infrastructure — load-bearing artifacts that AI
agents depend on to produce correct output. Machine-readable specification
documents, available on demand, allow agents to simulate persistent memory
even in a complex codebase.

The architecture was developed iteratively during construction of a
108,000-line C# distributed system (a real-time multiplayer simulation
built on the MonoGame framework and the Arch Entity Component System
library). Both application code and context infrastructure were generated
using Claude Code as the sole code-generation tool, directed by human
prompting and agent orchestration. The author's primary background is in
chemistry rather than software engineering, making this project a test case
for a specific emerging use pattern: domain experts building software
beyond their primary expertise with AI agents.

> etc.. etc...

### 6. Conclusion

Structured access to project-specific knowledge substantially improves
consistency of AI-generated code. The tiered architecture treats project
documentation as infrastructure rather than artifact. This supported a
single developer in constructing a 108,000-line distributed system in under
70 days of part-time development.

Companion repository:
https://github.com/arisvas4/codified-context-infrastructure
</secondary>
