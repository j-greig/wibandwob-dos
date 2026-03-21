# Spike: COAT Runtime Compliance Gate

**Branch:** `spike/spk-coat-compliance-runtime`  
**Status:** Draft  
**Effort:** M (CC: ~30 min / human: ~3 days)  
**Origin:** Office-hours architecture review — Premise P2 verdict ("partially false")

---

## Problem

The COAT test is: *"Would this work using only the API?"*

`scripts/checks/check-coat.ts` already enforces COAT **structurally** — import
boundaries, manifest fields, orphan actionKeys, command ID format. It answers:
*"Is the code shaped correctly?"*

It does not answer: *"At runtime, can an agent actually do what a human can?"*

That gap is the one the architecture review named as P2 (partially false):

> Agents regularly hitting capabilities only reachable via the TUI — window
> focus, visual state, real-time feedback. The 22-point DX list items 1, 4, 5,
> 6, 7 are all about missing API surface that humans have via TUI.

`scripts/coat-compliance.sh` closes that gap by **running the system and
checking behavioral parity**. Static = structure. Runtime = behaviour.

---

## What compliance means

A command is COAT-compliant if, after calling it via the HTTP API:

1. `GET /state` returns a window entry with changed `lastCommand` or
   `describeState()` output, **or**
2. `GET /windows/:id/state` returns metadata showing the action took effect

If a command can be triggered via API but leaves no detectable state trace —
it fails. The agent has no feedback; the action is unverifiable.

Three explicit capability gaps (from DX list) are also first-class assertions:

| # | Gap | Expected endpoint | Failure condition |
|---|-----|-------------------|-------------------|
| G1 | No error surface | `GET /errors/recent` | 404 or missing field |
| G2 | No state stream | `GET /state/stream` (SSE) | 404 or non-streaming |
| G3 | No symbolic window refs | `POST /windows/by-title/:title/command` | 404 |

These three are **capability gaps** — things the human can do (read recent
errors in the TUI, observe real-time state, target a window by name) that the
agent simply cannot. They are scored separately from command observability.

---

## Script behaviour

### Invocation

```sh
scripts/coat-compliance.sh [--instance <label>] [--json] [--fix-hints]
```

`--instance` targets a running WibWob instance (default: first found via health
check). `--json` outputs machine-readable results. `--fix-hints` appends
remediation notes for each failure.

### Phase 1 — Prerequisite: running instance

Calls `GET /health`. If not 200, exits 2 (skip, not fail — compliance requires
a live system). This means it does **not** run in cold CI; it runs post-launch.

### Phase 2 — Capability gap assertions (G1–G3)

For each gap endpoint, HTTP probe. Pass = 2xx. Fail = 4xx or no response.
These are binary. They either exist or they don't.

### Phase 3 — Command round-trip check

For every command in `GET /commands` response:

1. Snapshot `GET /state` → `state_before`
2. POST the command via `POST /commands/:id` (or equivalent)
3. Wait 300ms (enough for synchronous state update; not polling)
4. Snapshot `GET /state` → `state_after`
5. Assert: any window's `describeState` or `lastCommand` changed

**Skip conditions** (not failures):

- Commands marked `requiresInput: true` (they need a parameter we can't safely
  infer — e.g. `window.open-url`)
- Commands with `destructive: true` flag (e.g. `window.close`, `session.clear`)
- Commands in category `navigation` that require a target to be pre-open

These should be marked in the command catalog. If they aren't marked, the
command is treated as testable.

### Phase 4 — State observability check

For every open window, `GET /windows/:id/state` must return a non-empty
`describeState` object. Windows that return `{}` or `null` fail — they are
opaque to agents.

### Phase 5 — Report

Outputs a scored table:

```
COAT Runtime Compliance Report
Instance: wibwob1  Port: 8099  Checked: 2026-03-21T14:00:00Z

Capability Gaps
  ❌ G1  GET /errors/recent           404
  ❌ G2  GET /state/stream            404
  ❌ G3  POST /windows/by-title/*/cmd 404
  Gap score: 0/3

Command Round-Trips (42 testable / 6 skipped)
  ✅  window.new                  → describeState changed
  ✅  window.focus                → lastCommand changed
  ❌  microapp.clock.toggle-mode  → no observable state change
  ...
  Round-trip score: 41/42

State Observability (12 open windows)
  ✅  primer (ID: win_01)
  ❌  clock (ID: win_07)           describeState: {}
  ...
  Observability score: 11/12

OVERALL: 52/57  (91%)
EXIT: 1  (threshold: 100% round-trips + 0 opaque windows)
```

Exit 0 = full compliance. Exit 1 = failures. Exit 2 = no instance running.

### Threshold

The gate is strict on two things:
- **Command round-trips**: must be 100% (for testable commands)
- **State observability**: must be 100% (no opaque windows)

Capability gaps (G1–G3) are **reported but do not gate** until the companion
spike (spk-api-capability-gaps) closes them. Once closed, they flip to gating.

---

## Baseline and regression detection

The script will fail on first run — G1–G3 don't exist yet, and some windows
likely have empty `describeState`. That is **existing debt**, not a regression.
Without a baseline mechanism the gate is all-or-nothing: you either clear all
debt before the script is useful, or you soften the threshold and lose the
signal.

Instead, the script writes a baseline file on first run and uses it to classify
failures on every subsequent run:

```
coat-compliance.baseline.json   (committed, lives at repo root)
```

```json
{
  "generatedAt": "2026-03-21T14:00:00Z",
  "knownFailures": {
    "gaps": ["G1", "G2", "G3"],
    "roundTrips": ["microapp.clock.toggle-mode"],
    "observability": ["win_07"]
  }
}
```

**Failure classification:**

| Failure type | Baseline entry? | Gate? |
|---|---|---|
| Regression | No — new failure | **YES — blocks** |
| Existing debt | Yes — known failure | No — reported only |
| Improvement | Was in baseline, now passing | Reported as 🎉, remove from baseline |

**`--update-baseline` flag** — re-records all current failures as known debt.
Use after intentionally accepting debt (e.g. when first running the script, or
after a deliberate deferral decision). Requires a commit message explaining why.

This means the gate is **useful from day one**: it only blocks regressions you
introduced, not the debt you inherited. Debt shrinks as each item is fixed and
removed from the baseline.

---

## What this is not

- **Not a replacement for `check-coat.ts`** — that's static, this is runtime.
  Both run in CI; they cover different failure modes.
- **Not a full integration test suite** — it does not assert *what* a command
  does, only that it produces *some* observable state change.
- **Not a load test** — single sequential pass, no concurrency.

---

## Integration

```sh
# Post-launch smoke (runs after ensure-running.sh)
scripts/coat-compliance.sh --instance wibwob1

# In scripts/checks/ as a named check (alongside check-coat.ts)
scripts/checks/check-coat-runtime.sh  → calls coat-compliance.sh
```

Pre-commit hook: **no** — requires a live instance. Add to the post-deploy
smoke suite (`scripts/health-full.sh`) and to the autoresearch loop if one
exists for API surface.

---

## Implementation notes

### Command catalog annotation needed

To make skip conditions reliable, add two optional fields to command catalog
entries:

```ts
{
  id: "window.open-url",
  requiresInput: true,   // skip in automated round-trip
  destructive: false,
}
```

Without this annotation the script must guess from command ID patterns
(`.close`, `.clear`, `.delete`, `.reset`). Annotation is cleaner; should be a
prerequisite or done in the same PR.

### describeState contract

`describeState()` must return a non-trivial object for every window. "Non-trivial"
= at least one key-value pair that reflects current window state (not just
`{ type: "clock" }`). The check should flag windows where describeState is
structurally present but semantically empty (e.g. only contains static
registration metadata).

### Timing

300ms wait after command POST. This is enough for synchronous state updates
and short animations. Async background tasks (e.g. a microapp that fetches
data) may need a longer wait — annotate those commands with `asyncResult: true`
and wait 2s instead.

---

## Acceptance criteria

- [ ] `scripts/coat-compliance.sh` runs against a live WibWob instance and exits 0/1/2 correctly
- [ ] First run with no baseline writes `coat-compliance.baseline.json` and exits 0
- [ ] Subsequent runs gate on regressions (new failures not in baseline), not existing debt
- [ ] `--update-baseline` re-records current failures; requires explicit invocation
- [ ] Capability gaps G1–G3 are reported (not yet gating)
- [ ] Command round-trip check covers all non-skipped commands in `GET /commands`
- [ ] State observability check covers all open windows
- [ ] Output is human-readable by default; `--json` is machine-readable
- [ ] Script is called from `scripts/health-full.sh`
- [ ] Command catalog annotation (`requiresInput`, `destructive`) documented in a code comment

---

## Relationship to other work

| Spike / Epic | Relationship |
|---|---|
| `spk-codebase-health-and-automation` | This is the runtime complement to the static checks there |
| `scripts/checks/check-coat.ts` | Runs alongside — static vs runtime, both needed |
| `spk-api-capability-gaps` (not yet created) | Closes G1–G3; once done, flip those to gating here |
| `gotchas-cures` epic Story 2.1 (`createManagedList`) | Better state from managed components → higher observability scores |

---

## Open questions

1. **Destructive command detection** — guess from ID patterns or require
   catalog annotation? Annotation is correct but adds schema work. Decide
   before implementing Phase 3.

2. **Threshold policy** — 100% round-trips is ambitious for a first pass.
   Should the gate start at 90% and tighten? Recommend starting strict and
   adding skip annotations rather than softening the threshold.

3. **Multiple instances** — if two instances are running, run compliance
   against each independently? Or target only the primary? Lean toward
   `--instance` flag required when multiple exist (mirrors `wibwob -i` posture).
