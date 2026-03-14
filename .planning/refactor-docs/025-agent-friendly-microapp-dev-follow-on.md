## Agent-Friendly Microapp Dev Follow-On

Status: parked
GitHub issue: —
PR: —

## Why This Exists

The runtime refactor improved the shared host seams, SDK ownership, and API parity.
The next quality bar for module development is agent ergonomics:

- fast proof modules that exercise the new runtime/API/SDK seams
- low-friction build/test loops for module authors
- optional hot reload when a module's TypeScript source changes

## Goals

1. build a small handful of new proof microapps that stress:
   - runtime inspection reads
   - shared command execution
   - window/open/focus/close semantics
   - SDK primitives and updated public exports
   - API-visible state / describeState patterns
2. make the microapp dev loop agent-friendly:
   - scaffold -> typecheck -> open -> edit -> verify
   - minimize full-shell reload requirements when only `modules/*` changed
3. explore optional per-module hot reload:
   - top-level module opt-in
   - watch TS file changes
   - reload module instance without full WibWob restart where safe

## Suggested Proof Set

- a runtime-inspection consumer with richer panes/tabs
- a command-lab microapp that invokes shared runtime verbs
- a workspace-aware microapp with snapshot/restore
- a layout-heavy microapp using newer SDK primitives/components

## Acceptance Criteria

- at least several new microapps can be built and verified through the modern SDK path
- the proof set meaningfully exercises newly refactored seams
- editing module TS and seeing the change reflected is as close to instant as the architecture safely allows
- hot reload is either shipped as an explicit opt-in or clearly documented as not yet safe for certain module classes

## Notes

- prefer module-only reload over full shell restart whenever the change is confined to `modules/*`
- keep this separate from host-owned runtime refactor closure; it is a developer-experience and proof-surface follow-on
