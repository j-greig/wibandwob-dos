# F7: Self-Maintaining CLI Help

**Epic:** E039 Instance Lifecycle
**Status:** done
**Depends on:** —
**Origin:** ops review found `completions` already missing from help text

## Problem

`wibwob help` is a hardcoded string. The `switch` dispatch is a separate
block. They drift. `completions` is already out of sync (has a case, no
help line). Multiple agents will add subcommands rapidly — this will get
worse.

## COAT Alignment

The command catalog already self-discovers microapp commands. Catalog
commands are already self-documenting via `wibwob commands` and dot-syntax.
Only the CLI's built-in subcommands (state, health, write, read, etc.)
are the manual layer. This feature makes that layer self-documenting too.

## Design: Command Table Pattern

Single `CLI_COMMANDS` array drives both dispatch and help. Each entry:
`{name, aliases?, args?, desc, fn}`. The `usage()` function formats it.
The switch block becomes a Map lookup.

```typescript
interface CliCommand {
  name: string;
  aliases?: string[];
  args?: string;
  desc: string;
  fn: (args: string[]) => Promise<void> | void;
}

const CLI_COMMANDS: CliCommand[] = [
  { name: "state",      desc: "Full desktop state (JSON)",               fn: () => cmdState() },
  { name: "health",     desc: "API health check",                        fn: () => cmdHealth() },
  { name: "screenshot", aliases: ["read"], args: "[id]",
    desc: "Text screenshot (desktop or window)",                          fn: (a) => cmdScreenshot(a[1]) },
  { name: "write",      args: "<id>", desc: "Write stdin into a window", fn: (a) => cmdWrite(a[1]) },
  // ... every built-in subcommand
];

const CMD_MAP = new Map<string, CliCommand>();
for (const cmd of CLI_COMMANDS) {
  CMD_MAP.set(cmd.name, cmd);
  for (const alias of cmd.aliases ?? []) CMD_MAP.set(alias, cmd);
}
```

**Dispatch** becomes `CMD_MAP.get(sub)?.fn(args)` with fallthrough to
the existing dot-syntax / noun-verb default block.

**Help** becomes a loop over `CLI_COMMANDS` — impossible to forget a
subcommand.

## Current State (decomposed)

| Help line | Case | Function | API | Drift? |
|-----------|------|----------|-----|--------|
| state | ✅ | cmdState | GET /state | — |
| inspection | ✅ | cmdInspection | GET /runtime/inspection | — |
| windows | ✅ | cmdWindows | GET /state | — |
| commands | ✅ | cmdCommands | GET /commands/list | — |
| health | ✅ | cmdHealth | GET /health | — |
| minimap/map | ✅ | cmdMinimap | GET /state | — |
| screenshot/read | ✅ | cmdScreenshot | GET /screenshot/text | — |
| write | ✅ | cmdWrite | GET /state + POST /commands/run | — |
| instances | ✅ | cmdInstances | socket probe | — |
| attach | ✅ | cmdAttach | socket + spawn | — |
| completions | ✅ case | cmdCompletions | GET /commands/list | ⚠️ **missing from help** |
| cmd | ✅ | cmdRun | POST /commands/run | — |

Plus 3 implicit patterns (dot-syntax, noun-verb, window targeting) that
stay as static help text — they're dispatch patterns, not registered commands.

## Stories

- [x] S1: Define `CliCommand` interface and `CLI_COMMANDS` array
- [x] S2: Replace `switch` dispatch with `CLI_CMD_MAP.get()` lookup
- [x] S3: Replace hardcoded `usage()` with loop over `CLI_COMMANDS`
- [x] S4: Keep dot-syntax / noun-verb / window targeting in fallthrough block
- [x] S5: Add `completions` to the table (fixes existing drift)
- [x] S6: Verify: `wibwob help` output matches all switch cases — 100/100 stable

## Why This Wins

- **One array** — add a subcommand = add one object. Help auto-updates.
- **Offline** — no running instance needed. Pure static data.
- **Greppable** — `grep 'name: "attach"'` finds everything.
- **Typechecks** — `fn` signature enforced by TypeScript.
- **COAT-aligned** — mirrors command-catalog (single array → multiple
  projections) but for the CLI layer.
- **~30 lines of infrastructure** replacing 40-line usage string +
  40-line switch block.

## Key Files

| File | What changes |
|------|-------------|
| `src/cli/wibwob.ts` | Replace switch + usage() with CLI_COMMANDS table |

## Non-Goals

- Auto-discovering API endpoints as CLI subcommands (over-engineering)
- Generating help from a running instance (must work offline)
- Changing the dot-syntax / noun-verb dispatch (already works)
