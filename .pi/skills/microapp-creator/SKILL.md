---
name: microapp-creator
description: >
  Scaffold, register, and dev-loop a new WibWob-DOS microapp end-to-end.
  Use when: "create a microapp", "new microapp", "scaffold a microapp",
  "add a microapp", "build a new app for wibwob", "make a wibwob app".
---

# Microapp Creator

Workflow: scaffold → implement → register tier → reload → verify.

**Read `SDK.md` first** — it has the full host API, required hooks, and manifest reference.

---

## 1. Scaffold

No scaffold script. Copy the canonical minimal example:

```bash
cp -r microapps/demo-hello-world microapps/<your-name>
```

Then update `microapp.json`:
- `name` — directory name
- `microapp.id` — `wibwob.<your-id>` (must be unique)
- `microapp.title` / `microapp.description`

---

## 2. Implement

Entry point is `index.ts`, default export is `setup(host)`:

```typescript
import type { MicroappHost } from "../../src/services/microapp-sdk.js"

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: "My App",
    description: "Open My App",
    palette: { order: 100 },
    action: () => {
      const win = host.createWindow({ title: "My App" })
      // ... your logic
    }
  })
}
```

See `SDK.md` for the four required hooks, full host API, and manifest field reference.

---

## 3. Register tier

Microapps default to `beta` (palette + API visible, hidden from menu). To promote:

```typescript
// src/core/microapp-registry.ts → REGISTRY
"wibwob.<your-id>": "core",   // menu + palette + API + agent
"wibwob.<your-id>": "beta",   // palette + API (default — no entry needed)
"wibwob.<your-id>": "internal", // API only, dev/test
```

Only add an entry if you need something other than `beta`.

---

## 4. Reload and verify

```bash
bash scripts/reload-microapp.sh <id>         # close → reload → reopen
curl -s localhost:8099/state | jq            # window in state?
wibwob read <windowId>                       # captureText working?
```

Visual verification is mandatory — API response alone is not proof.
