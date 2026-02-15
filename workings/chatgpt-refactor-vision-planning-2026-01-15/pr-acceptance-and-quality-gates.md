# PR Acceptance and Quality Gates (Extracted)

## PR acceptance checklist

### Contracts and parity
- [ ] Contracts validate; breaking changes require version bump.
- [ ] Capabilities output validates against schema.
- [ ] New/changed command defined once in C++ registry (no duplicated Python definitions).
- [ ] Menu parity preserved for everyday commands or explicit documented exclusion.
- [ ] MCP/toolgen parity preserved from capabilities.
- [ ] `exec_command(name,args,actor)` path works across UI, IPC, and API/MCP.

### State and replay
- [ ] `get_state()` validates against state schema.
- [ ] Snapshot export/import round-trip test passes.
- [ ] State-mutation commands emit typed events with actor attribution.

### Instances
- [ ] Instance isolation holds (A does not mutate B).
- [ ] Storage layout matches instance spec.
- [ ] Actor identity present for mutating operations.

### Packaging
- [ ] Docker build passes.
- [ ] Container smoke test passes (`/health`, `/capabilities`, one command, state readback).
- [ ] Local non-container run still works.

### Quality gates
- [ ] C++ format/lint pass.
- [ ] Python lint/tests pass.
- [ ] Contract/schema tests pass.
- [ ] No untracked TODOs without issue links.

### Docs
- [ ] Architecture docs updated for contract/registry/instance/event changes.
- [ ] Skills docs updated when contributor workflow changes.
- [ ] ADR added for irreversible changes.

## Recommended verifiable tests
- Capabilities schema validation.
- Capabilities -> toolgen -> exec round-trip.
- Menu parity against registry categories.
- Snapshot round-trip determinism.
- Event stream sanity and actor attribution.
- Docker smoke checks.

## Hook strategy
- `pre-commit`: fast checks (format/lint/schema/secrets pattern).
- `pre-push`: unit + contract + smoke checks.
- CI: authoritative full suite.

## Suggested CI workflows
- `ci.yml`: build, lint, tests, contract validation.
- `sanitizers.yml`: ASan/UBSan scheduled or gated.
- `docker.yml`: build + runtime smoke.
- `contracts-lock.yml`: contract change guard (version bump or explicit compatibility proof).
