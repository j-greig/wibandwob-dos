<retired reason="superseded" replacement=".planning/BUILD.md">
Doc pruning plan. Pruning is done; outstanding work now tracked in master checklist.
Master checklist: .planning/BUILD.md

# 022 — Doc Prune Backlog

Status: active
GitHub issue: —
PR: —

## TL;DR

Ruthless docs simplification plan for the TS TUI app.

Default bias:

- keep only docs that drive the TypeScript TUI forward
- absorb useful material into canonical active docs
- move obsolete planning/history into `docs/.trash/`
- delete only after a second pass confirms no remaining live value

## Canonical Active Set

These should remain the planning center:

- `000-docs-overview.md`
- `015-window-manager-reference-and-repair-plan.md`
- `018-command-registry-and-tool-adapter-prd.md`
- `020-target-architecture.md`
- `021-unicode-cell-rendering-follow-on.md`
- `refactor-epoch-plan.md`

Secondary but still live:

- `019-context-sensitive-menu-bar-prd.md`

## First Prune Slice

Move from docs root to `docs/.trash/` now:

- `002-architecture-plan-content-sizing-layout.md`
- `003-document-plan.md`
- `017-framework-direction-and-today-plan.md`
- `BUILD-ORDER.md`
- `BUILD-ORDER-FINAL.md`
- `overview.md`
- `wibwob-chat-v2-plan.md`

Reason:

- all are already retired in `000-docs-overview.md`
- their durable guidance is absorbed elsewhere
- keeping them in the live docs root creates false planning surface area

## Second Prune Slice Candidates

Move to `docs/.trash/` after one more validation pass:

- `003-pi-mono-chat-window-evaluation.md`
- `004-piclaw-sandbox-evaluation.md`
- `terminal-native-research.md`
- `spk-agent-window-enhancement.md`

Reason:

- useful rationale/history
- no longer primary execution drivers

## Third Prune Slice Candidates

Keep as reference for now, but reassess after root migration:

- `001-primer-dimensions-and-agent-sizing.md`
- `004-window-type-registry-and-factories.md`
- `006-command-registry-and-ipc-protocol.md`
- `007-terminal-emulator.md`
- `008-theme-system-and-desktop-rendering.md`
- `010-browser-and-text-rendering.md`
- `013-events-persistence-and-multi-instance.md`

Reason:

- still useful as legacy handover/reference material
- not active planning docs
- may become removable once the TS repo no longer needs old C++/Python context

## Review Docs

Keep for now, but treat as evidence only:

- `chat-collapse-review.md`
- `content-measurement-review.md`
- `editor-save-review.md`
- `window-facade-review.md`
- `window-facade-phase1-review.md`
- `window-facade-full-review.md`

Delete later only if:

- fixes are fully landed
- no remaining follow-on work cites them
- evidence value is no longer worth the clutter

## Trash Rules

`docs/.trash/` means:

- removed from active working set
- preserved for archaeology
- not valid planning input unless explicitly reopened

When moving a doc to `.trash`:

1. update `000-docs-overview.md`
2. update any active doc that still links to it
3. avoid keeping a duplicate copy in docs root

## Success Bar

- opening `docs/` shows mostly live planning docs
- active architecture is obvious without historical scanning
- agents are not nudged toward dead paths by filename proximity
</retired>
