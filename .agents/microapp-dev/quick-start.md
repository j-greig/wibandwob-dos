# Microapp Quick Start

Scaffold, edit, run. Under 60 seconds to a working microapp.

## 1. Scaffold

```bash
bash scripts/scaffold-microapp.sh microapps/my-app wibwob.myapp "My App" 150
```

Creates `microapps/my-app/microapp.json` + `microapps/my-app/index.ts`.

Repo naming note:
- files live under `microapps/`
- the runtime surface is a microapp

## 2. The five imports you always need

```typescript
import blessed from "blessed";
import type { MicroappHost } from "../../src/services/microapp-sdk.js";
import { createTimer, clearTimers } from "../../src/services/microapp-sdk.js";
```

Add more from the SDK as needed — see `sdk-reference.md` for the full surface.

## 3. The pattern

```typescript
export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: "My App",
    menu: [{ category: "applications", order: 150, label: "My App" }],
    palette: { order: 150, label: "Open My App" },
    action: () => openMyApp(host),
  });
}

function openMyApp(host: MicroappHost) {
  const win = host.createWindow({ title: "My App", width: 60, height: 20 });
  const timers = new Set<ReturnType<typeof setInterval>>();

  const content = blessed.box({
    parent: win.body,
    top: 0, left: 0, right: 0, bottom: 0,
    content: "Hello from My App!",
    style: host.theme().body,
  });

  // Four required hooks:
  win.describeState(() => ({ summary: "My App — running." }));
  win.captureText(() => content.getContent());
  win.onRestyle(() => { content.style = host.theme().body; host.screen.render(); });
  win.onCleanup(() => clearTimers(timers));

  win.focus();
}
```

## 4. Verify

```bash
bun run typecheck
wibwob cmd microapps.reload
curl -s http://127.0.0.1:8099/state | grep -i myapp
./scripts/screenshot-window.sh "My App"
```

If you changed `src/` host code instead of `microapps/*`, use `bash scripts/restart.sh`.

Optional, experimental loop:

```bash
bun run watch:microapp -- microapps/my-app --open
```

This builds on the stable `microapps.reload` path but best-effort reopens the
microapp window. Use it as development scaffolding, not as a guaranteed live
state-preserving hot-reload system.

## Next steps

- Full guide: `docs/building-custom-microapps.md`
- Pick an example by complexity: `examples-by-tier.md`
- Advanced SDK primitives: `sdk-reference.md`
- Workspace persistence: `persistence.md`
- Common mistakes: `pitfalls.md`
- Visual TUI proof: `tmux attach -t wibwob`
- Stable scaffold: `scripts/scaffold-microapp.sh`
- Experimental reload loop: `scripts/watch-microapp.ts`
