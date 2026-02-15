# WibWob-DOS Refactor Prompt (2026-02-15)

```text
You are operating inside the wibwob-dos repository with full filesystem access and the ability to run commands, edit files, and perform web/doc research.

Objective:
Deliver an incremental refactor plan and implementation slices that make WibWob-DOS a reference implementation of an agent-native Turbo Vision OS, while preserving Turbo Vision architectural DNA and preventing drift between UI and AI control surfaces.

This is architecture + implementation work, not brainstorming only.

Core outcomes required:
1) Single source of truth for commands/capabilities in C++.
2) Parity between menu actions, IPC commands, REST endpoints, and MCP tools.
3) Authoritative engine state with append-only events and deterministic snapshots.
4) Instance isolation model that supports local-first now and hosted/multi-tenant later.
5) PR-sized, reviewable changes with tests and docs.

Preserve Turbo Vision invariants:
- TObject hierarchy
- TView/TGroup ownership and lifecycle
- TApplication event loop discipline (GetEvent -> HandleEvent -> Idle)
- Command/message architecture (cmXxx semantics)
- Streaming/object persistence principles

Distinguish historical constraints from principles:
- Historical constraints (DOS memory model, no threads) may be modernized.
- Architectural principles (message dispatch discipline, hierarchy, streamability, command routing) must be preserved.

Non-negotiable design requirements:
- All state mutation goes through one engine command dispatch path.
- UI actions must call the same command path as API/MCP.
- API/MCP tool surfaces must derive from capabilities, not duplicate hand-maintained command lists.
- Contracts must be versioned and schema-validated.
- Event stream and snapshots must reflect engine truth.

Scope guardrails:
- Use local-first memory substrate principles.
- Do not implement retrieval pipeline features in this refactor pass.
- Focus on contracts, parity, state/event architecture, and contributor-safe workflow.

GitHub workflow rules (required):
- Plan work as GitHub issues by default.
- Implement in small PR-sized milestones, one milestone per branch/PR.
- Treat repository as multi-contributor: explicit assumptions, acceptance criteria, and rollback notes per PR.
- Do not batch unrelated architectural changes in one PR.

Required process:
PHASE 1 — Audit current repo
- Map menu commands vs IPC vs API/MCP capability drift.
- Identify duplicated command definitions and state authority conflicts.
- Produce a drift report with exact file references.

PHASE 2 — Architecture proposal
- Define command registry + capability export model.
- Define contracts layout/versioning strategy.
- Define event model + snapshot model.
- Define instance model + isolation boundaries.
- Define migration strategy (no rewrite).

PHASE 3 — Incremental implementation plan
- Split into PR-1 / PR-2 / PR-3 ... with explicit scope boundaries.
- Each PR includes: code changes, tests, docs, risks, rollback.

PHASE 4 — Execute only PR-1
- Implement first minimal slice that proves parity direction.
- Stop after PR-1 deliverables and report results.

PR-1 target (minimum viable refactor slice):
- Add command/capability registry skeleton in C++.
- Expose capabilities through IPC/API in a non-breaking way.
- Replace at least one hardcoded API command list path with capability-driven path.
- Add one parity test and one schema validation test.
- Update docs for new source-of-truth path.

Required deliverables in-repo:
- docs/architecture/refactor-brief-vnext.md
- docs/architecture/parity-drift-audit.md
- docs/migration/vnext-migration-plan.md
- docs/architecture/phase-zero-canon-alignment.md
- docs/manifestos/symbient-os-manifesto-template.md
- versioned contract schema files under contracts/
- tests for parity + contracts + snapshot/event sanity

Quality gates (must satisfy; treat as blocking):
Use and satisfy checklist in:
- workings/chatgpt-refactor-vision-planning-2026-01-15/pr-acceptance-and-quality-gates.md

At minimum include:
- contract/schema validation
- capabilities -> toolgen -> exec sanity
- menu parity check for everyday commands
- snapshot round-trip sanity
- container/local smoke checks for impacted surfaces

Output format expectations:
- Start with findings and risks.
- Then proposed architecture.
- Then PR breakdown.
- Then execute PR-1 and show concrete changed files + test evidence.
- End with what remains for PR-2.

Style constraints:
- Be concrete, file-specific, and test-oriented.
- Prefer minimal viable refactor over broad rewrites.
- Keep decisions explicit and reversible.

Begin now with PHASE 1 audit.
```
