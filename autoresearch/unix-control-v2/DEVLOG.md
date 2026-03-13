# Unix Control v2 — Devlog

## 2026-03-13: _apiCall guard — interactive prompts no longer hijack the TUI

**Human note:** FINALLY! some workarounds to this painful bug thats been bugging me for ages

### The problem

Commands like `primer.open`, `editor.open`, `figlet.open`, and `markdown.open`
have a dual personality: called from a menu with no args, they open an interactive
file picker overlay. Called via the API with no args... they also open an interactive
file picker overlay. The API returns `{ok: true}` immediately, but the picker takes
over the entire screen, blocking the TUI until dismissed by keyboard. Agents and CLI
users have no way to dismiss it.

This was especially nasty because the API reported success while the app was bricked.

### The fix

The best approach: when a command is run via the API (`/commands/run`), inject a
`_source: "api"` marker into args. Then in the handlers, when `_source === "api"`
and required args are missing, return an error instead of opening an interactive
prompt.

Actually even simpler — the control-api already knows it's an API call. Let me just
inject `_apiCall: true` into the args:

```typescript
// control-api.ts — /commands/run handler
const apiArgs = { ...(args ?? {}), _apiCall: true };
const result = this.handlers.runCommand(id, apiArgs);
```

Then in each action handler that has an interactive fallback:

```typescript
// app-controller.ts — primer.open handler
if (!filePath) {
  if (args?._apiCall) return { ok: false, error: "primer.open requires filePath arg when called via API" };
  this.promptForPrimer();  // only reached from menu/palette
  return;
}
```

### Commands guarded

- `primer.open` — was: opens full-screen primer file browser
- `editor.open` — was: opens file picker
- `markdown.open` — was: opens .md file list prompt
- `figlet.open` — was: opens text input prompt

All four now return `{ok: false, error: "... requires X arg when called via API"}`
instead of hijacking the TUI.

### Why this matters

The whole point of the CLI/API surface is programmatic control. Interactive prompts
are for humans at the keyboard. Letting API calls trigger interactive overlays breaks
the contract — the caller gets `{ok: true}` while the app is stuck waiting for
keyboard input that will never come. This was a silent failure mode that could brick
a running session.

The `_apiCall` marker is minimal and non-invasive. It doesn't change the menu/palette
behaviour at all. It only affects the API path, which is the only path where
interactive prompts are wrong.
