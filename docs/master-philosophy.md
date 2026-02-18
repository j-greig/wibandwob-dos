# Master Philosophy of Coding for WibWob-DOS

## 1. Identity: This Is a Symbient OS, Not a Tool

WibWob-DOS is a coinhabited operating environment for human and synthetic agency.
Design and code choices must preserve parity, co-presence, and continuity of identity.

Non-negotiables:
- Build for coinhabitation, not assistant UX.
- Human and AI command surfaces must stay capability-equivalent.
- "Helpful defaults" must not silently reduce AI agency or human control.
- The system should feel inhabited, not automated.

## 2. C++14 + Turbo Vision Core Rules

The C++ app is the primary runtime authority.
Turbo Vision event loop integrity is more important than convenience abstractions.

Rules:
- Keep `TApplication`/`TDeskTop`/`TView` ownership and lifecycle explicit.
- New UI behavior should be implemented as composable `TView`/`TWindow` units, not ad-hoc global state.
- Preserve deterministic event handling; no hidden side channels mutating UI state.
- `get_state` output must reflect real runtime state, not placeholders.
- Multi-instance isolation is mandatory; no cross-instance leakage through shared socket/state assumptions.

ANSI rendering guardrail:
- Never draw raw ANSI escape streams directly into `TDrawBuffer`.
- Always parse bytes into a cell grid (`glyph`, `fg`, `bg`) first.
- Render via native Turbo Vision draw calls.
- Visible ESC/CSI sequences in UI are a correctness failure.

## 3. Python Bridge Principles

Python is the integration/control plane, not a second source of truth.

Rules:
- Async-first for network/API edges; avoid blocking paths in request handlers.
- IPC contract must remain explicit, versioned, and testable.
- Python mirrors C++ state; it does not invent authoritative runtime fields.
- State import/export must be deterministic and schema-valid.
- `open_workspace`/`import_state` must apply state, never return false-positive success.
- Degradation behavior must be explicit (timeouts, fetch errors, unavailable backends).

## 4. Unified Command Registry Pattern

One list, many callers.

Rules:
- Define command capability metadata once in C++ registry.
- Menu wiring, IPC/API handlers, MCP tool exposure, and slash-command bridging derive from that source.
- Never maintain duplicate command inventories in parallel files.
- Any new command must include: registry entry, canonical dispatch path, parity tests.

## 5. Multiplayer Sync Principles (E008 Direction)

Multiplayer is convergence, not terminal buffer sharing.

Rules:
- Sync semantic state diffs (`add/remove/update` windows), not raw terminal frames.
- Use stable window type slugs and deterministic props for cross-instance apply.
- PartyKit room object is coordination authority for shared room state.
- Bridge layer must suppress self-echo and support reconnect.
- Keep periodic reconciliation available as safety net against drift.
- Park stretch features (cursor overlay, advanced art sync) if they block core mirror+chat MVP.

## 6. Testing Philosophy

Every acceptance criterion needs a concrete runnable test.

Rules:
- AC → Test traceability is mandatory in planning briefs.
- Add contract tests when behavior crosses C++/Python/API/MCP boundaries.
- Build/test gates are not optional:
  - C++ build must pass.
  - Contract tests must pass.
  - Feature-specific smoke/evidence must exist for integration-heavy slices.
- Prefer deterministic tests over manual-only validation.
- If behavior is parity-sensitive, add drift tests.

## 7. Naming, Organization, and Documentation Standards

Consistency is part of reliability.

Rules:
- C++ files: `snake_case.cpp/.h`
- Python files: `snake_case.py`
- Planning files in `.planning/epics/`: canonical prefixes (`eNNN`, `fNN`, `sNN`, `spkNN`).
- Markdown files: kebab-case or canonical uppercase names (`README.md`, etc.).
- Planning briefs must always include:
  - `Status: ...`
  - `GitHub issue: #...`
  - `PR: ...`
- Keep issue lifecycle synced with planning updates and test evidence.

## 8. Practical Engineering Doctrine

- Small vertical slices beat broad speculative rewrites.
- Preserve compatibility unless breakage is explicitly scoped.
- Prefer boring, observable flows to clever hidden coupling.
- If parity, determinism, or state correctness is unclear, stop and add instrumentation/tests first.
- If a feature fights the symbient model, redesign it.
