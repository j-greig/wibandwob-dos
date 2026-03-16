# WibWob CLI + Instance Architecture — Notes

## How the CLI resolves which instance to talk to

The `wibwob` CLI (src/cli/wibwob.ts) is a thin HTTP/socket client. It does NOT
import the command catalog or registry. It talks to a running instance via:

### Resolution order (resolveBase function):

1. `--instance <label>` flag → unix socket at `scratch/instances/<label>.sock`
2. `$WW_API` or `$WIBWOB_API` env var → arbitrary URL
3. `$WIBWOB_INSTANCE` env var → unix socket lookup
4. **Default fallback** → `http://127.0.0.1:<CONTROL_API_PORT>` (default 8099)

### The problem: step 4 is ambiguous

When no flag or env var is set, the CLI hits port 8099. But:

- Each instance tries ports 8099, 8100, 8101, 8102, 8103 in sequence
  (src/services/control-api.ts:209-230)
- If 8099 is taken, the second instance lands on 8100
- The CLI always hits 8099 unless told otherwise
- Agents don't know which port the user's instance is on
- Dead sockets litter `scratch/instances/` (5 dead sockets found in main repo)

## How commands flow

```
CLI (wibwob.ts)
  → HTTP POST /commands/run { id, args }
    → control-api.ts handleRequest()
      → runApiCommand(id, args)
        → command-registry.ts execute()
          → command-catalog.ts (source of truth for all command definitions)
            → app-controller.ts (action handlers)
```

The command catalog (src/core/command-catalog.ts) is the single source of truth.
Every command has: id, label, description, group, actionKey, surface flags
(api, agent, menu, palette). The CLI discovers commands via GET /commands/list.

## Instance identity

Each instance gets:
- A random 3-char ID (e.g. "pfk", "xav", "h7f")
- An optional label (e.g. "main") from $WIBWOB_INSTANCE_LABEL
- A unix socket at scratch/instances/<label-or-id>.sock
- An HTTP port (8099 + N fallback)

The `wibwob instances` command probes all sockets and reports which are alive.

## The multi-instance confusion

### Current state (this worktree)
- scratch/instances/ has 7 sockets, only 2 alive (main on 8099, q7d on 8100)
- The main repo (wibandwob-dos) has 5 dead sockets, 0 alive
- When we run `wibwob health` it hits 8099 which is THIS worktree's instance
- The main repo's instance (if running) would be on a different port

### What agents get wrong
1. Assume port 8099 is always the right instance
2. Don't check `wibwob instances` to discover what's running
3. Don't use `--instance <label>` to target explicitly
4. Don't know the worktree's scratch/ is separate from main repo's scratch/

### What would help
- `wibwob` should warn when multiple instances are alive
- Dead sockets should be cleaned up aggressively (cmdInstances already does this)
- The default should be smarter: if only one instance is alive, use it
- Agent docs should mandate `wibwob health` first to confirm instance identity

## src/adapters/ — why empty

The COAT architecture envisions TUI, CLI, and API as "thin adapters" over
shared runtime semantics (src/application/). The adapters/ directory is
scaffolded but empty because the refactor hasn't moved the existing code yet.
Currently:
- TUI adapter lives in src/core/app-controller.ts (the composition root)
- API adapter lives in src/services/control-api.ts
- CLI adapter lives in src/cli/wibwob.ts

The application/ layer has started with runtime-command-service.ts etc but
the adapters themselves haven't been extracted from their current homes.

## src/application/ — the semantic layer

Four services that own shared verbs:
- runtime-command-service.ts — command execution
- runtime-inspection-service.ts — state snapshots
- runtime-window-service.ts — window lifecycle
- runtime-workspace-service.ts — save/restore

These are the COAT seams: command, inspection, window, workspace.
Adapters (TUI, CLI, API) should be thin clients of these services.
