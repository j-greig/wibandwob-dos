# Microapp Examples — Hero 7

Seven reference microapps ordered by complexity. Each teaches specific SDK patterns.

## Progression

| # | App | Lines | Teaches |
|---|-----|-------|---------|
| 1 | **hello-world** | ~30 | Minimum viable: `createWindow`, `describeState`, `captureText` |
| 2 | **notepad** | ~100 | Read/write buffer, `captureText`, plumb, SDK helpers (`createTextViewer`, `createStatusBar`) |
| 3 | **runtime-inspector** | ~425 | Live state polling, tree views, command introspection, `/runtime/inspection` API |
| 4 | **figlet-banner** | ~450 | Multi-command registration, font picker, prompts, `writeHandlers` pattern |
| 5 | **layout-stress-test** | ~460 | Responsive layout, breakpoints, contrib grid, animation loops |
| 6 | **data-dashboard** | ~130 | `createSplitView`, `createTextViewer`, `createStatusBar`, timers, `os` module |
| 7 | **file-manager** | ~44+1623 | Full app: search, preview, sort, icon/list modes. Host-delegated microapp — thin wrapper at `microapps/file-manager/`, complex implementation at `src/windows/file-manager-window.ts` |

## Required Hooks

Every hero implements:
- **`describeState()`** — structured JSON for API consumers and agents
- **`captureText()`** — plain text snapshot of window content
- **`onCleanup()`** — release timers, listeners, handlers
- **`onRestyle()`** — update theme colours when user switches themes

## Pattern: Minimum Viable Microapp

```typescript
import type { MicroappHost } from "../../src/services/microapp-sdk.js";

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: "Open My App",
    action: () => {
      const win = host.createWindow({ title: "My App", width: 40, height: 10 });
      win.body.setContent("Hello!");
      win.captureText(() => "Hello!");
      win.describeState(() => ({ appType: "wibwob.my-app" }));
      return { ok: true };
    },
  });
}
```

## Pattern: SDK Helpers

```typescript
import { createTextViewer, createStatusBar } from "../../src/services/microapp-sdk.js";

const viewer = createTextViewer(win.body, { bottomOffset: 1, wrap: false });
const status = createStatusBar(win.body, { left: " Title" });

win.setFocusTarget(viewer.element);
win.onRestyle(() => { viewer.update({}); status.update({}); });
win.onCleanup(() => { viewer.destroy(); status.destroy(); });
```

## Pattern: Live Updates with Timer

```typescript
const timer = setInterval(() => {
  viewer.update({ content: getNewData() });
  host.screen.render();
}, 2000);

win.onCleanup(() => clearInterval(timer));
```

## Where to Find Them

| App | Directory |
|-----|-----------|
| hello-world | `microapps/demo-hello-world/` |
| notepad | `microapps/notepad/` |
| runtime-inspector | `microapps/runtime-inspector/` |
| figlet-banner | `microapps/figlet-banner/` |
| layout-stress-test | `microapps/demo-layout-stress-test-pi/` |
| data-dashboard | `microapps/data-dashboard/` |
| file-manager | `microapps/file-manager/` (delegates to `src/windows/file-manager-window.ts`) |
