# .planning — Canon Terms for Development Planning

This directory is the authoritative reference for how work is planned, named, scoped, tested, and shipped in WibWob-DOS. Every agent and contributor follows these conventions. No exceptions.

## Glossary of Canon Terms

| Term | Meaning |
|------|---------|
| **Engine** | The C++ core. Authoritative for runtime state. UI is optional; engine is not. |
| **Registry** | Single source of truth for commands/capabilities. Defined once in C++, consumed everywhere. |
| **Parity** | Menu actions, IPC commands, REST endpoints, and MCP tools all execute the same command surface. Drift is a bug. |
| **Contract** | Versioned JSON schema under `contracts/`. Breaking changes require version bump. |
| **Capability** | A command's schema-exported description. API/MCP tools are *derived from* capabilities, never hand-maintained separately. |
| **Snapshot** | Deterministic JSON export of engine state at a point in time. Must round-trip: export then import produces identical state. |
| **Event** | Append-only, actor-attributed state mutation record. Events are truth; logs are projections. |
| **Vault** | Durable, human-readable, local-first memory substrate. Engine is replaceable; vault persists. |
| **Instance** | An isolated runtime context (state, vault, events). Instance A cannot mutate Instance B. |
| **Actor** | An attributed identity (human, agent, system) attached to every state mutation. |
| **Adapter** | IPC, REST, MCP, CLI — anything that translates between the engine command surface and an external caller. |
| **Sidecar** | An optional external process (browser renderer, image converter) that talks to the engine via adapters. |
| **Primer** | Content module (art, prompts, themes) loaded from `modules/` or `modules-private/`. |

## Naming Conventions

### Branches

```
<type>/<short-kebab-description>
```

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `spike`.

Examples:
- `feat/command-registry`
- `fix/ipc-timeout`
- `refactor/parity-audit`
- `spike/vault-prototype`
- `docs/planning-readme`

### Commits

```
<type>(<scope>): <imperative summary>
```

- **type**: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `ci`, `spike`
- **scope**: short module name — `engine`, `registry`, `ipc`, `api`, `mcp`, `ui`, `contracts`, `vault`, `events`, `paint`, `llm`, `build`, `planning`
- **summary**: imperative mood, lowercase, no trailing period, max ~72 chars

Examples:
```
feat(registry): add CommandRegistry skeleton with exec_command dispatch
fix(ipc): handle socket timeout on macOS when app not running
refactor(api): replace hardcoded tool list with capability-driven export
test(contracts): add parity validation for menu vs capabilities
docs(planning): add canon terms and acceptance criteria reference
chore(build): upgrade cmake minimum to 3.14
```

Multi-line body is encouraged for non-trivial commits. Explain *why*, not *what*.

### Files and Directories

- C++ source: `snake_case.h`, `snake_case.cpp`
- C++ classes: `PascalCase` (e.g., `CommandRegistry`, `StateStore`)
- Python: `snake_case.py`
- Schemas: `<domain>.schema.json` under versioned dirs (e.g., `contracts/protocol/v1/capabilities.schema.json`)
- ADRs: `adr-NNNN-<kebab-title>.md` (e.g., `adr-0001-contracts.md`)
- Test files: `test_<thing>.py` or `test_<thing>.cpp`

## Git Conventions

1. **Issue-first.** Every non-trivial change starts as a GitHub issue. Reference the issue number in commits and PR body.
2. **Branch-per-issue.** One branch per issue. One logical change per PR.
3. **No force-push to `main`.** Ever.
4. **No batching unrelated changes.** If a PR touches command registry *and* paint palette colors, split it.
5. **PR-sized milestones.** Each PR is small enough to review in one sitting. If you can't describe the change in two sentences, split it.
6. **Rollback notes.** Every PR body includes a "Rollback" section: what to revert and what breaks.

## Goals (This Refactor Pass)

1. **Single source of truth for commands.** One `CommandRegistry` in C++ — menu items, IPC handlers, API endpoints, and MCP tools all derive from it.
2. **Parity enforcement.** Automated tests that fail when menu commands and capabilities drift.
3. **Authoritative engine state.** All state mutation goes through `exec_command(name, args, actor)`. No backdoor mutations.
4. **Append-only event discipline.** State changes emit typed, actor-attributed events. Events are append-only.
5. **Deterministic snapshots.** `export_state` then `import_state` produces identical engine state. Tested.
6. **Instance isolation.** Instance A's state, vault, and events are invisible to Instance B. Tested.
7. **Contract-driven interfaces.** Versioned JSON schemas under `contracts/`. Breaking changes require version bump. Schema validation in CI.
8. **PR-safe contributor workflow.** Any agent or human can pick up an issue, implement on a branch, and pass quality gates without tribal knowledge.

## Non-Goals (Explicitly Out of Scope)

- **Retrieval pipelines / RAG.** No vector search, no embedding indexes, no retrieval-augmented anything. Vault is flat files.
- **Cloud sync.** Local-first only. No remote storage, no sync protocol.
- **Web viewer implementation.** Architecture accommodates it; this pass doesn't build it.
- **Hosted/multi-tenant runtime.** Instance model supports it; this pass only implements local single-instance.
- **Broad rewrite.** Migration, not replacement. Existing code adapts incrementally.
- **Graph databases.** Graphs are derived projections, never canonical. If you can't `cat` the source file and understand it, the design is wrong.

## Acceptance Criteria (AC) Rules

Every issue and PR must have specific, measurable acceptance criteria. Vague criteria like "improve performance" or "clean up code" are not acceptable.

### What Makes an AC Valid

An AC is valid if and only if it is:
1. **Observable.** A human or CI can verify it passed without reading the implementation.
2. **Binary.** It either passes or it doesn't. No "mostly works" or "should be fine."
3. **Scoped.** It describes one verifiable behavior, not a bundle.

### AC Format

```
AC-<N>: <imperative statement of observable behavior>
Test: <exact command or procedure that proves it>
```

### Examples

```
AC-1: CommandRegistry returns a capabilities JSON array containing all registered commands.
Test: Unit test calls registry.getCapabilities(), asserts result validates against contracts/protocol/v1/capabilities.schema.json.

AC-2: Creating a window via REST /windows endpoint uses exec_command dispatch, not direct TView construction.
Test: Integration test creates window via API, checks event log contains a command event with actor="api".

AC-3: Menu parity holds — every command in the registry with category="window" appears in the Window menu.
Test: Parity test loads registry, loads menu definition, asserts symmetric difference is empty.

AC-4: Snapshot round-trip is deterministic — export then import produces byte-identical re-export.
Test: test_snapshot_determinism exports state, imports it, re-exports, asserts SHA256 match.
```

### The Test Rule

**Every AC must have at least one test.** No exceptions.

- If the AC describes a schema: add a schema validation test.
- If the AC describes a behavior: add a unit or integration test.
- If the AC describes parity: add a parity/drift test.
- If the AC describes a round-trip: add a determinism test.
- If the AC describes isolation: add a cross-instance mutation test.

A PR with untested ACs is not mergeable.

### Test Locations

| Domain | Location | Runner |
|--------|----------|--------|
| Contract/schema validation | `tests/contract/` | `uv run pytest` |
| C++ unit tests | `tests/cpp/` | cmake/ctest |
| Python API/IPC tests | `tools/api_server/test_*.py` | `uv run python <file>` |
| Parity/drift tests | `tests/contract/` | `uv run pytest` |

## PR Checklist (Blocking)

Every PR must satisfy these before merge. Derived from `workings/chatgpt-refactor-vision-planning-2026-01-15/pr-acceptance-and-quality-gates.md`.

### Contracts and Parity
- [ ] Contracts validate; breaking changes require version bump
- [ ] New/changed command defined once in C++ registry
- [ ] Menu parity preserved (or explicit documented exclusion)
- [ ] MCP/toolgen parity preserved from capabilities
- [ ] `exec_command(name, args, actor)` path works across UI, IPC, and API/MCP

### State and Replay
- [ ] `get_state()` validates against state schema
- [ ] Snapshot export/import round-trip test passes
- [ ] State-mutation commands emit typed events with actor attribution

### Instances
- [ ] Instance isolation holds (A does not mutate B)
- [ ] Actor identity present for mutating operations

### Quality Gates
- [ ] Every AC has at least one test
- [ ] Python lint/tests pass
- [ ] Contract/schema tests pass
- [ ] No untracked TODOs without issue links
- [ ] Rollback notes in PR body

### Docs
- [ ] Architecture docs updated for contract/registry/instance/event changes
- [ ] ADR added for irreversible architectural decisions

## Relationship to Other Directories

| Directory | Role |
|-----------|------|
| `.planning/` | **This directory.** Canon terms, conventions, and quality rules. Normative. |
| `workings/` | Research, planning threads, extracted conversation bundles. Informational, not normative. Local working files, not shipped. |
| `contracts/` | Versioned JSON schemas. Machine-readable interface definitions. (Created during refactor.) |
| `docs/` | Architecture docs, guides, reference. Human-readable. (Created during refactor.) |
| `tests/` | Automated tests proving ACs. (Created during refactor.) |

## Quick Reference Card

```
Branch:   feat/command-registry
Commit:   feat(registry): add CommandRegistry skeleton with exec_command dispatch
AC:       AC-1: Registry returns capabilities JSON validating against schema
Test:     test_registry_capabilities.py — asserts schema validation passes
PR body:  ## ACs / ## Rollback / ## What remains for next PR
Merge:    All checklist items checked, all tests green
```
