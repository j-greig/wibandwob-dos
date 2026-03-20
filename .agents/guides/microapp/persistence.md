# Microapp Persistence

How to make your microapp's state survive workspace save/restore cycles.

## When you need this

If your microapp has state the user would lose on restart — selected mode,
editor content, playback position, configuration — add persistence.
If your microapp is stateless or disposable, skip this.

## Setup

### 1. Set persist in microapp.json

```json
"microapp": {
  "persist": true,
  ...
}
```

### 2. Register a snapshot handler

In your `setup()` function, after registering commands:

```typescript
host.registerSnapshot({
  serialize: (window) => {
    // Read current state from the window's describeState
    const state = window.describeState?.() ?? {};
    return {
      mode: state.mode ?? "default",
      // ... any state you want to save
    };
  },
  restore: (_snapshot, payload) => {
    // Re-open the window with saved state as args
    host.runCommand("open", {
      mode: payload.mode,
      // ... pass saved state back to your open command
    });
  },
});
```

### 3. Accept restore args in your open function

```typescript
function openMyApp(host: MicroappHost, args?: Record<string, unknown>) {
  const restoreMode = args?.mode as string | undefined;
  let mode = restoreMode ?? "default";
  // ... use restored state to initialise the window
}
```

Wire the args through your registerCommand action:

```typescript
host.registerCommand({
  id: "open",
  action: (args) => openMyApp(host, args),
  // ...
});
```

### 4. Expose state in describeState

The serialize function reads from describeState, so include everything
you want to persist:

```typescript
win.describeState(() => ({
  summary: `My App — mode: ${mode}`,
  mode,
  // ... any state serialize needs to read
}));
```

## Canonical example

`microapps/demo-wibwob-poetry-clock/index.ts` — serializes `mode` and `voice`,
restores by calling its own `open` command with those values. The pattern:
snapshot minimal semantic state, restore through the same public opening path.

## The contract

- `serialize(window)` is called when the workspace is saved. Return a
  plain JSON-serialisable object. Keep it small — just the state needed
  to reconstruct the window, not the full content.
- `restore(snapshot, payload)` is called on workspace restore. `payload`
  is exactly what you returned from `serialize`. Open your window with
  that state.
- The host handles window position and size — you only persist semantic state.

## See also

- `.agents/guides/microapp/sdk-reference.md` — `registerSnapshot` API reference
- `.agents/guides/microapp/quick-start.md` — bootstrap path
