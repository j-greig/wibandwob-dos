# WibWob-DOS Refactor Prompt (2026-02-15, refined)

```text
You are operating inside the wibandwob-dos repository with filesystem and command access.

Mission:
Deliver a real, incremental refactor that makes WibWob-DOS a contract-driven, agent-native Turbo Vision OS while preserving Turbo Vision architectural DNA and eliminating drift between UI, IPC/API, and MCP/tool surfaces.

This is implementation work, not brainstorming.

Hard constraints:
1) Do not assume idealized repo layout. Start from actual files in this checkout.
2) Preserve behavior for existing users unless a change is explicitly flagged as breaking.
3) No broad rewrite. Prefer smallest vertical slice with strong evidence.
4) Do not add retrieval-pipeline features in this pass.

Mandatory onboarding reads before proposing code changes:
- workings/chatgpt-refactor-vision-planning-2026-01-15/overview.md
- workings/chatgpt-refactor-vision-planning-2026-01-15/thread-memory-refresh.md
- workings/chatgpt-refactor-vision-planning-2026-01-15/spec-state-log-vault-browser.md
- workings/chatgpt-refactor-vision-planning-2026-01-15/pr-acceptance-and-quality-gates.md
- workings/chatgpt-refactor-vision-planning-2026-01-15/prompts/execution-prompts.md
- workings/chatgpt-refactor-vision-planning-2026-01-15/local-first-research-phase-a.md
- workings/chatgpt-refactor-vision-planning-2026-01-15/local-first-research-phases-b-f.md

Preserve Turbo Vision invariants:
- TObject hierarchy and ownership lifecycle
- TView/TGroup event routing discipline
- TApplication loop model (GetEvent -> HandleEvent -> Idle)
- Command/message architecture (cmXxx semantics)
- Streamability/persistence as an architectural principle

Distinguish principles from historical constraints:
- Historical DOS constraints may be modernized.
- Architectural principles must be preserved.

Non-negotiable architecture outcomes:
1) Single source of truth for commands/capabilities in C++.
2) Parity between menu actions, IPC/API commands, and MCP/tool exposure.
3) Authoritative engine state with append-only, actor-attributed events.
4) Deterministic snapshot export/import sanity.
5) Instance isolation model (local-first now, hosted-ready later).
6) Versioned schemas/contracts and validation tests.

Repo-reality hints (verify, do not blindly trust):
- UI/menu command definitions are concentrated in app/test_pattern_app.cpp.
- API/MCP surfaces are under tools/api_server/ (main.py, controller.py, mcp_tools.py).
- Existing capabilities endpoint exists but may not be canonical yet.

Required process:

PHASE 0 — Grounding and invariants digest
- Confirm onboarding docs were read.
- Produce a short invariants digest tied to this repo (not generic).

PHASE 1 — Drift and authority audit
- Map command definitions and execution paths across:
  - Turbo Vision menu/command handlers
  - IPC bridge
  - FastAPI endpoints
  - MCP tool exposure
- Identify duplicated command declarations and any state-authority split.
- Produce file-precise drift report with line references.

PHASE 2 — vNext architecture (incremental, no rewrite)
- Define command registry + capability export contract.
- Define event and snapshot contracts (append-only events, deterministic snapshots).
- Define instance/vault boundaries for local-first durability.
- Define migration path from current shape to target shape.
- Call out assumptions and unknowns explicitly.

PHASE 3 — PR-sized rollout plan
- Break work into PR-1 / PR-2 / PR-3 with explicit boundaries.
- For each PR include:
  - scope and non-goals
  - touched files/components
  - tests and acceptance criteria
  - rollback strategy
  - risk notes

PHASE 4 — Execute PR-1 only
- Implement the smallest vertical slice that proves parity direction.
- Stop after PR-1 and report outcomes.

PR-1 minimum target:
- Introduce a C++ command/capability registry skeleton (or equivalent canonical table) integrated with existing command handling.
- Drive at least one API/MCP path from that canonical source instead of duplicated hardcoded command lists.
- Add at least:
  - one parity test (menu/command/API consistency)
  - one schema validation test
  - one snapshot/event sanity test (can be minimal)
- Update docs for source-of-truth and migration intent.

Required deliverables in-repo (create if missing):
- docs/architecture/parity-drift-audit.md
- docs/architecture/refactor-brief-vnext.md
- docs/migration/vnext-migration-plan.md
- versioned schemas under contracts/ (or a clearly justified equivalent path)
- tests covering parity + contract validation + snapshot/event sanity

Quality gates (blocking):
- Satisfy checklist in:
  - workings/chatgpt-refactor-vision-planning-2026-01-15/pr-acceptance-and-quality-gates.md
- At minimum prove:
  - schema validation passes
  - capabilities -> execution sanity is intact
  - everyday command parity is not regressed
  - snapshot round-trip sanity
  - impacted local runtime smoke checks

Output format:
1) Findings and risks
2) Proposed architecture
3) PR breakdown
4) PR-1 implementation with exact changed files
5) Test evidence (commands run + key output)
6) Remaining work for PR-2

Style rules:
- Be concrete, file-specific, and test-oriented.
- Keep decisions explicit, reversible, and contributor-friendly.
- If blocked, stop and report blockers with smallest viable next move.

Begin with PHASE 0.
```
