<retired reason="superseded" replacement=".planning/BUILD.md">
Post-migration resumption guide. Migration landed; outstanding work now tracked in master checklist.
Master checklist: .planning/BUILD.md
Architecture reference: .planning/refactor-docs/020-target-architecture.md

# E002 Post-Migration Pickup

Use this file when resuming work after the TS TUI root migration.

## Reality Check

Do **not** restart E002 from scratch.

Root migration is already landed enough that these are now canonical:

- `/Users/james/Repos/wibandwob-dos/src/`
- `/Users/james/Repos/wibandwob-dos/docs/`
- `/Users/james/Repos/wibandwob-dos/package.json`
- `/Users/james/Repos/wibandwob-dos/bun.lock`
- `/Users/james/Repos/wibandwob-dos/tsconfig.json`

The old spike path is no longer the app root-in-practice.

## Read First

1. `/Users/james/Repos/wibandwob-dos/docs/000-docs-overview.md`
2. `/Users/james/Repos/wibandwob-dos/docs/020-target-architecture.md`
3. `/Users/james/Repos/wibandwob-dos/.planning/epics/e002-ts-tui-root-migration/e002-brief.md`
4. `/Users/james/Repos/wibandwob-dos/.planning/epics/e002-ts-tui-root-migration/s01-lift-ts-tui-to-root.md`
5. `/Users/james/Repos/wibandwob-dos/.planning/epics/e002-ts-tui-root-migration/migration-decisions.md`
6. `/Users/james/Repos/wibandwob-dos/.planning/epics/e002-ts-tui-root-migration/migration-summary.md`

## What Is Already Done

- TS TUI app lifted to repo root
- active docs moved to root `docs/`
- root `README.md` and `CLAUDE.md` rewritten for TS canon
- root clutter pruned heavily
- `.gitmodules` rewritten to surviving submodules
- spike `.pi` merged selectively into root `.pi`
- legacy C++ runtime/vendor/test clutter largely removed

## Do Not Re-Do

- do not repeat structural `git mv` work
- do not recreate spike-vs-root duplication
- do not resurrect deleted C++/Python runtime surfaces
- do not treat legacy docs as active unless `docs/000-docs-overview.md` says so

## Immediate Next Work

### 1. Verify root runtime still matches canon

- run `bun run typecheck` from repo root
- run the documented root launch path
- confirm `docs/000-docs-overview.md` and `docs/020-target-architecture.md`
  still describe reality

### 2. Fix startup workspace semantics

Implement the boot rule already captured in `020`:

- try to restore `scratch/workspaces/default.json` on launch
- later optionally support a last-used-workspace pointer
- only fall back to opening `Scramble` if no workspace can be restored

### 3. Continue core stabilization

Primary follow-ons, in order:

1. `/Users/james/Repos/wibandwob-dos/docs/015-window-manager-reference-and-repair-plan.md`
   - repaint/shadow invalidation
   - drag/release sanity
   - stale cell cleanup
2. `/Users/james/Repos/wibandwob-dos/docs/018-command-registry-and-tool-adapter-prd.md`
   - keep collapsing shared command paths
3. `/Users/james/Repos/wibandwob-dos/docs/019-context-sensitive-menu-bar-prd.md`
   - finish the context-sensitive menu model on top of the registry
4. `/Users/james/Repos/wibandwob-dos/docs/021-unicode-cell-rendering-follow-on.md`
   - post-refactor Unicode/cell-aware rendering follow-on

### 4. Keep pruning dead references

- remove lingering spike-era wording
- remove dead feature references
- prefer deletion over compatibility clutter

## Constraints

- root layout is canon now
- active docs stay in root `docs/`
- use `migration-decisions.md` if a root-disposition question reappears
- if reality changes, update `docs/000-docs-overview.md` the same day

## Success Condition For This Pickup

The next agent should not spend its first hour rediscovering that root
migration already happened. It should start directly from:

- root app canonical
- root docs canonical
- post-migration stabilization work only
</retired>
