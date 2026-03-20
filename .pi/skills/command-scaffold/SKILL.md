---
name: command-scaffold
description: >
  Add a new command to WibWob-DOS — walks the 4-file wiring path so you don't miss a step.
  Use when: "add a command", "new command", "wire a command", "scaffold command".
---

# Command Scaffold

Adding a command touches 4 files. This skill walks the path.

## The 4 files (in order)

### 1. `src/core/command-catalog.ts`

Add the command definition AND the action key to `AppMenuActions`:

```typescript
// In AppMenuActions interface:
myAction: (args?: Record<string, unknown>) => unknown;

// In COMMANDS array:
{
  id: "group.verb",
  label: "Human Label",
  description: "What it does. Args: name (type).",
  group: "group",           // must exist in AppCommandGroup
  actionKey: "myAction",
  palettePlacement: { order: 100 },
  api: true,
  agent: true
}
```

### 2. `src/domain/command-definition.ts`

If `group` is new, add it to the `AppCommandGroup` union type.

### 3. `src/core/app-controller.ts`

Add the action to the actions object (search for existing actions near yours):

```typescript
myAction: (args) => {
  // implementation
  return { ok: true };
},
```

### 4. `src/services/control-api.ts` (if API-exposed)

Add endpoint to the `ENDPOINT_TABLE` array AND add the route handler:

```typescript
// ENDPOINT_TABLE:
{ method: "POST", path: "/my/endpoint", body: { arg: "type" }, description: "..." },

// Route handler (near similar routes):
if (request.method === "POST" && url.pathname === "/my/endpoint") {
  // handle it
}
```

## After wiring

```bash
bun run typecheck              # must pass
bash scripts/restart.sh        # core files need restart, not reload
bash scripts/doc-sync.sh       # regenerates COAT.md with new command/endpoint
bash scripts/doc-health.sh     # verify loop stays green
```

## See also

`GOTCHAS.md §Adding a command` — documents the 4-file tax.
