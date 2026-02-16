# E004 Claude Execution Prompt

Use this prompt in Claude Code to execute E004 end-to-end with issue/planning sync.

## Links

- Epic issue: https://github.com/j-greig/wibandwob-dos/issues/49
- Feature F1: https://github.com/j-greig/wibandwob-dos/issues/50
- Feature F2: https://github.com/j-greig/wibandwob-dos/issues/51
- Feature F3: https://github.com/j-greig/wibandwob-dos/issues/52
- Epic brief: `.planning/epics/e004-browser-rendering-reliability/e004-epic-brief.md`

## Prompt

You are executing E004 browser hardening in WibWob-DOS.

Primary objective:
- Deliver Epic #49 by completing Feature issues #50, #51, and #52 in scoped PR slices.

Required workflow:
1. Issue-first and branch-per-issue.
2. Keep PRs to one logical slice.
3. Keep `.planning` mirrors synced the same day as issue state changes.
4. Preserve AC -> Test traceability in every planning brief.
5. Post progress comments on the relevant GitHub issue with commit SHA + test evidence.

Execution order:
1. Feature #50 first: lock render/mode contract semantics.
2. Feature #51 second: add lazy/progressive image loading behavior.
3. Feature #52 third: build known-site smoke harness for browse/copy/screenshot.

Implementation requirements:
- Keep browser text visible in all modes.
- Enforce deterministic mode behavior (`none`, `key-inline`, `all-inline`, `gallery`).
- Use known sites (including `symbient.life`) for smoke profiles.
- Validate API + TUI flow using screenshot and copy outputs.
- Produce machine-readable smoke artifacts and a human-readable summary.

Mandatory verification before each PR:
- Build:
  - `cmake . -B ./build -DCMAKE_BUILD_TYPE=Release`
  - `cmake --build ./build`
- Relevant tests for the slice (contracts/integration/smoke).
- For browser behavior changes, include at least one screenshot artifact path and one copy payload sample.

Completion criteria:
- #50, #51, #52 closed with evidence.
- Epic #49 closed only after all feature ACs pass.
- `e004-epic-brief.md` and any child feature/story briefs reflect final status.

