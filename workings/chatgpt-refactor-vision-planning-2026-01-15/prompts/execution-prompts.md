# Execution Prompt Pack (Operational)

## 1) Formalize `wibwob-oslog@1` contracts
```bash
You are operating inside the WibWob-DOS repository.

Your task is to design and implement a canonical schema specification for:
- wibwob-oslog@1
- events@1
- instance@1

This must adapt to the current repo structure.

Step 1 — Discover current state:
Inspect contracts/docs/src/engine and existing artifacts. Report what exists, partials, and conflicts.

Step 2 — Apply invariants:
- Markdown is durable human-readable memory.
- Events append-only.
- Graphs derived, not canonical.
- State reconstructible from snapshots/events.
- Versioned minimal schemas.
- No retrieval-pipeline requirements.

Step 3 — Deliverables:
Create or update:
- contracts/v1/oslog.schema.json
- contracts/v1/events.schema.json
- contracts/v1/instance.schema.json
- docs/spec/oslog-v1.md

Step 4 — Validation:
Add unit tests validating canonical examples + at least one failing schema case.

Step 5 — Self-critique:
Evaluate overfitting, readability, extensibility, instance isolation.
```

## 2) Migration strategy to vault + append-only events
```text
You are inside WibWob-DOS.

Design migration from current architecture to:
- Vault-as-memory-substrate
- Append-only events
- Deterministic snapshots
- Instance isolation

Step 1 — Current-state analysis:
Map state/log/snapshot flows; list mutable vs append-only areas; identify coupling.

Step 2 — Target model:
Produce target tree + event flow + engine-vault boundary + instance model.

Step 3 — Phased plan:
Phase 0 contracts, Phase 1 dual-write, Phase 2 canonical events, Phase 3 legacy removal.
Include rollback and integrity checks.

Step 4 — Deliverable file:
- docs/migration/vNext-migration-plan.md

Step 5 — Self-critique:
Call out hidden assumptions, complexity risks, unknowns.
```

## 3) CI and append-only discipline enforcement
```text
You are operating in WibWob-DOS.

Design and implement CI guardrails for:
- append-only events
- oslog/version invariants
- schema validity
- snapshot determinism
- instance isolation

Step 1 — Inspect current CI.
Step 2 — Define enforceable rules (line deletion guard, seq monotonicity, schema checks, path boundary checks).
Step 3 — Implement CI workflows and optional local hooks.
Step 4 — Add tests:
- test_append_only
- test_schema_validation
- test_snapshot_determinism
Step 5 — Add security checks (path traversal, actor spoofing, hash-chain/tamper checks).
Step 6 — Document rationale in docs/architecture/append-only-discipline.md.
```

## 4) Canon refactor vNext integration pass
```text
Synthesize all architectural research into a canonical vNext structure.

Do:
- reconstruct current architecture
- apply invariants (engine authoritative, vault durable, events append-only, multi-agent, instance isolation)
- propose repo tree adapted to actual current state
- identify anti-patterns (mutable logs, duplicated command definitions, hidden globals)
- write docs/refactor/vNext-brief.md with migration path and acceptance criteria
- run self-enhancement loop: assumptions, unknowns, scale risks (10 concurrent agents)
```

## 5) Meta-prompt for generating prompts like these
```text
I am building a long-lived, local-first, append-only, multi-agent operating system project.
Generate an execution-grade prompt for an AI agent in my repository.

Requirements:
- Must begin with repo discovery and structural analysis.
- Must include explicit invariants I provide.
- Must produce concrete file artifacts (schemas/docs/tests/scripts).
- Must include validation and risk analysis.
- Must include migration and compatibility strategy.
- Must avoid hardcoded assumptions and adapt to current repo state.
- Must include a self-critique phase and “what did we miss?” loop.
- Must tie output to identity continuity, instance isolation, deterministic replay, and OSS collaboration.

Do not generate generic prompts; generate precise phased prompts with deliverables and checks.
```

## Course-correction addendum
For local-first research/execution prompts in this thread's final direction:
- Exclude retrieval-pipeline implementation work.
- Focus on filesystem durability, append-only journaling, instance boundaries, event/snapshot discipline, and human-readable Markdown substrate.
