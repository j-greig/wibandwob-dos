# Microapp Quick Start

Scaffold, edit, run. Under 60 seconds to a working microapp.

Scope of this doc:
- shortest path to first working microapp,
- mandatory hooks and verification,
- no exhaustive API reference (see `sdk-reference.md`).

> **Authority:** This is the fastest bootstrap path. For full narrative context, see `docs/building-custom-microapps.md`.

## 1. Scaffold

```bash
bash scripts/scaffold-microapp.sh microapps/my-app wibwob.myapp "My App" 150
```

Creates `microapps/my-app/microapp.json` + `microapps/my-app/index.ts`.

Repo naming note:
- files live under `microapps/`
- the runtime surface is a microapp

## 2. Register in microapp-registry.ts

Add your microapp to `src/core/microapp-registry.ts` → `REGISTRY`:

```typescript
{ id: "wibwob.myapp", tier: "beta" }  // beta = API only; core = menu+API
```

See `AGENTS.md` for full tier definitions (`core | beta | internal | disabled`).

## 3. The core imports you usually need

```typescript
import type { MicroappHost } from "../../src/services/microapp-sdk.js";
import { createTimer, clearTimers, createTextBlock } from "../../src/services/microapp-sdk.js";
```

Prefer SDK components first. Only drop to raw `blessed` when no SDK primitive fits.
Add more from the SDK as needed — see `sdk-reference.md` for the full surface.

## 4. The pattern

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

  const content = createTextBlock(win.body, {
    text: "Hello from My App!",
    paddingLeft: 1,
    paddingTop: 1,
  });

  // Four required hooks:
  win.describeState(() => ({ summary: "My App — running." }));
  win.captureText(() => "Hello from My App!");
  win.onRestyle(() => { content.restyle(); host.screen.render(); });
  win.onCleanup(() => clearTimers(timers));

  win.focus();
}
```

> If you use any layout primitive (`createStack`, `createRow`, `createGrid`), add `win.onResize(render)` as a fifth required hook — without it the window never reflows on resize.

## 5. Verify

Command id reminder: use `microapp.<microapp.json:microapp.id>.open` (not the directory name) when writing gate commands.

```bash
bun run typecheck
wibwob cmd microapps.reload
bun run wibwob state | grep -i myapp
./scripts/screenshot-window.sh "My App"
```

If you changed `src/` host code instead of `microapps/*`, use `bash scripts/restart.sh`.

Optional, experimental loop:

```bash
bun run watch:microapp -- microapps/my-app --open
```

This now defaults to the safe path: restart the host, wait for `/health`, then
reopen the microapp. If you want to try the in-process path anyway, use:

```bash
bun run watch:microapp -- microapps/my-app --open --strategy reload
```

Treat `--strategy reload` as experimental. The reliable default is restart+reopen.

## Next steps

### Routing hints

- If your microapp uses animation → see `sdk-reference.md` §Animation
- If your microapp needs persistence → see `persistence.md`
- If you're building a custom component → see `component-contract.md`

### Further reading

- Full guide: `docs/building-custom-microapps.md`
- Pick an example by complexity: `examples-by-tier.md`
- Advanced SDK primitives: `sdk-reference.md`
- Workspace persistence: `persistence.md`
- Common mistakes: `pitfalls.md`
- Custom component SDK contract: `.agents/guides/microapp/component-contract.md` — required reading before building custom components
- Visual TUI proof: `tmux attach -t wibwob`
- Stable scaffold: `scripts/scaffold-microapp.sh`
- Experimental reload loop: `scripts/watch-microapp.ts`
