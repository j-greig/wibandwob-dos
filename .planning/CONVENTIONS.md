# .planning — How Work Gets Planned

## Structure

```
.planning/
  epics/          active epic briefs (eNNN-slug/)
  epics/.done/    completed
  spikes/         time-boxed explorations (spk-slug/)
  spikes/.done/   completed
  ideas/          future possibilities
  ideas/.done/    actioned
  chores/         housekeeping
  parking-lot.md  cross-cutting deferred items
```

## Hierarchy

1. **Epic** — multi-PR outcome. Gets `eNNN-brief.md` + one GitHub issue.
2. **Feature** — capability inside an epic. Gets `fNN-feature-brief.md`. No issue.
3. **Story** — smallest mergeable slice. Gets `sNN-story-brief.md`. No issue.
4. **Task** — checkbox in a story brief.
5. **Spike** — uncertainty reduction. Gets `spk-slug/` under `spikes/`.

## Naming

Branches: `epic/e0NN-slug`, `spike/spk-slug`, `fix/slug`, `feat/slug`, `chore/slug`
Commits: `type(scope): imperative summary` — e.g. `feat(microapp): add createWindow`

## Status tracking

Epic briefs use YAML frontmatter:
```yaml
status: not-started | in-progress | blocked | done | dropped
```

Checkboxes: `[ ]` not-started · `[~]` in-progress · `[x]` done · `[-]` dropped

## Scratch pads

- **GitHub issues** — brainfart capture only. Open → graduate or close same session.
- **`.pi/todos`** — session whiteboard. Two sessions max → promote to brief or close.

## Brainfart capture

GitHub issues = inbox. Must graduate same session:
- Epic-level → create brief, keep issue as tracker
- Story/task → add to existing brief, close issue
- Vague → add to `ideas/` or `parking-lot.md`, close issue
- Already done → close with a note

Never leave a non-epic issue open across sessions.

## Commands

```bash
bun run planning:status   # epic summary
bun run planning:sync     # regenerate EPIC_STATUS.md
bun run planning:inbox    # sweep issues + stale todos
```

## Acceptance criteria

Every AC must be observable, binary, scoped, and tested.

```
AC-1: WibWobWorld reopens in hybrid mode after restart.
Test: Save workspace in hybrid. Restart. GET /state shows renderMode: "hybrid".
```

## Before merging

- `bun run typecheck` clean
- `bun run test` passes
- ACs tested
- `bun run planning:sync` if epic status changed
- No direct commits to `main`
