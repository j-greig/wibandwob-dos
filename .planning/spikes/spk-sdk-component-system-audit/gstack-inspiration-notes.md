# gstack Inspiration Notes (for WibWob-DOS)

Source reviewed:
- `vendor/gstack/README.md` (especially **What's new and why it matters**)
- `vendor/gstack/docs/skills.md`
- `vendor/gstack/ARCHITECTURE.md`

Goal: extract useful patterns for WibWob-DOS agents/skills/extensions/docs, aligned to COAT and current pain logs in `.agents/reflections/2026-W12.md`.

---

## What matters most from gstack

## 1) Process as product (not “bag of tools”)

gstack's strongest move is explicit sprint sequencing:
- Think → Plan → Build → Review → Test → Ship → Reflect

Why it matters for us:
- We currently have powerful pieces (skills/extensions/agents), but sequence discipline is inconsistent between sessions.
- This directly causes drift, duplicated work, and “what step are we in?” ambiguity.

## 2) One canonical control-plane state for runtime sessions

gstack's daemon model + state file (`pid/port/token/version`) prevents stale process ambiguity.

Why it matters for us:
- We repeatedly hit instance confusion (duplicate sockets, stale labels, detached vs tmux runtime mismatch).
- This maps directly to W12 pain entries around ghost instances and half-visible runtime state.

## 3) Version-aware lifecycle guardrails

gstack auto-restarts stale daemons when binary version changes.

Why it matters for us:
- We saw `microapps.reload` half-state after host-side edits.
- We need explicit invalidation rules for reload vs restart.

## 4) Generated docs from source-of-truth templates

gstack's SKILL template pipeline prevents command drift.

Why it matters for us:
- Our SDK/docs can drift when exports evolve.
- We should generate key reference tables from code (SDK export index, command surface lists), not hand-maintain.

## 5) Bounded, structured runtime logging

gstack uses ring buffers + periodic flush.

Why it matters for us:
- Crash visibility and “where did the stacktrace go?” is still painful.
- tmux capture is useful but ad-hoc; we can formalise crash bundles.

## 6) Safety utilities as explicit modes

gstack's `careful/freeze/guard` are mode toggles, not one-off prompts.

Why it matters for us:
- We already value guardrails (COAT/invariants), but enforcement at execution-time can be stronger.

---

## Concrete adaptation proposals (COAT-aligned)

## A) Runtime Control Manifest (high priority)

Create one canonical runtime manifest file per active instance, e.g.
- `<DATA_ROOT>/runtime/control-manifest.json`

Include:
- canonical control socket
- instanceId/displayId/label
- pid/port/host
- screen size
- launch mode (`tmux` vs `direct`)
- boot timestamp + git sha

Use this as the single discovery source for `wibwob` CLI.

COAT fit:
- one owner, one source of truth
- API/CLI/agent parity

## B) Reload Invalidator (high priority)

When host-side files changed since boot (`src/core/*`, `src/services/*`, etc):
- `microapps.reload` should return warning/error: “restart required”
- include exact changed files that triggered invalidation

COAT fit:
- deterministic command semantics
- fail-fast over silent half-state

## C) Crash Bundle command (high priority)

Add `wibwob crash-bundle` that captures in one run:
1. health + instances JSON
2. state snapshot
3. tmux pane capture (if available)
4. runtime logs tail
5. recent command errors

Write to timestamped bundle dir.

COAT fit:
- user-visible reliability feature is API/CLI-visible
- repeatable debugging evidence

## D) Stage-aware Sprint Dashboard (medium)

Add lightweight stage tracking extension:
- stage enum: think/plan/build/review/test/ship/reflect
- show active stage widget + next recommended skill/agent
- persist in session metadata

COAT fit:
- shared semantics across TUI/CLI/agent workflows

## E) Generated SDK docs blocks (medium)

Introduce template generation for:
- SDK export inventory
- command IDs by category
- deprecation aliases table

Generated sections in docs; prose remains human-written.

COAT fit:
- single concept owner
- docs drift reduction

## F) Guard mode for risky operations (medium)

Optional session mode that:
- warns on destructive shell commands
- optionally freezes edits to selected subtree

COAT fit:
- explicit operational mode
- reduces accidental collateral edits

---

## Mapping to known W12 pains

- **Instance ambiguity / stale sockets** → A (control manifest)
- **Reload half-state confusion** → B (reload invalidator)
- **Crash output invisibility** → C (crash bundle)
- **Session process drift** → D (stage dashboard)
- **Docs/API drift risk** → E (generated blocks)

---

## Recommended execution order

1. A Runtime Control Manifest
2. B Reload Invalidator
3. C Crash Bundle command
4. E Generated SDK docs blocks
5. D Stage-aware dashboard
6. F Guard mode

This order prioritises reliability and debugging determinism before process ergonomics.
