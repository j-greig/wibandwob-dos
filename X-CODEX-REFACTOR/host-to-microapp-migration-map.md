# Host → Microapp Migration Map (COAT)

Every built-in surface in `src/windows/` assessed for migration to a proper
`microapps/` package consuming the SDK. The COAT principle applies: commands
register via manifest, all four seams (command, inspection, window, workspace)
go through shared services, adapters stay thin.

## Classification

### Already microapps (no migration needed)

These already live under `microapps/` with `microapp.json` and SDK consumption:

| Microapp | ID | Notes |
|----------|----|-------|
| runtime-inspector | wibwob.runtime-inspector | Proof microapp from refactor |
| command-lab | wibwob.command-lab | Proof microapp from refactor |
| workspace-beacon | wibwob.workspace-beacon | Proof microapp from refactor |
| layout-probe | wibwob.layout-probe | Proof microapp from refactor |
| sy2-chronicles | wibwob.sy2chronicles | Migrated, has shim in app-controller |
| wibwobworld | wibwob.world | Born as microapp |
| world-chatroom | wibwob.chatroom | Born as microapp |
| terminal | wibwob.terminal | Born as microapp (spike quality) |
| wibwob-tr808 | wibwob.tr808 | Born as microapp |
| terrarium / terrarium-life | wibwob.terrarium / wibwob.terrarium-life | Born as microapp |
| spore-clock | wibwob.spore-clock | Born as microapp |
| slap-editor | wibwob.slap-editor | Born as microapp |
| wiretext | wibwob.wiretext | Born as microapp |
| zine | wibwob.zine | Born as microapp |
| + all demos | various | Born as microapps |

### Migration candidates (src/windows/ → microapps/)

Listed by estimated complexity (simplest first).

| File | Lines | Catalog commands | Migration complexity | Notes |
|------|-------|-----------------|---------------------|-------|
| `figlet-windows.ts` | 231 | `figlet.open`, `figlet.list-fonts` | **Low** | Stateless text renderer. Clean boundary. |
| `contour-window.ts` | 397 | `contour.open` | **Low** | Self-contained animation. Already has composable engine pattern via terrain-lab. |
| `plasma-window.ts` | 314 | `plasma.open`, `plasma.from-primer` | **Low** | Self-contained animation. |
| `monster-cam-window.ts` + `monster-cam-model.ts` | 261 | `monster-cam.open` | **Low-Med** | Webcam + ffmpeg. External process management. |
| `generative-windows.ts` | 327 | `pattern.open` | **Low-Med** | Generative art. Uses pattern generators already in SDK. |
| `terrain-lab-window.ts` | 253 | `terrain.open` | **Low-Med** | Composes ContourPlayer. Depends on composable-engine extraction. |
| `text-windows.ts` | 335 | `text.open`, `editor.open`, `editor.save`, `editor.save-as`, `markdown.open`, `markdown.picker`, `markdown.toggle-figlet` | **Medium** | Core text/editor surface. Many commands. Multi-mode (edit/view/markdown). |
| `backrooms-log-browser-window.ts` | 279 | `backrooms.log-browser` | **Medium** | File-browsing + session log parsing. |
| `backrooms-windows.ts` | 705 | `backrooms.open`, `backrooms.tv`, `backrooms.picker.*` | **Medium-High** | Multi-window (prompt, TV, picker). Picker has blocking overlay flow. |
| `music-player-window.ts` | 1224 | `music.open` | **High** | ffplay/ffmpeg process management, PCM analysis, complex UI. |
| `browser-windows.ts` | 2082 | `primer.browse`, `primer.open`, `primer.picker`, `primer.list`, `text.open`, `finder.*` (10+ commands), `gallery.open` | **High** | God-file. Primer browser, gallery, file manager, text viewer factory. Many interleaved concerns. |
| `chrome-browser-window.ts` | 476 | `browser.reader`, `browser.chrome` | **High** | CDP integration. Image hydration. External process. |

### Not candidates (core host surfaces)

| File | Lines | Reason |
|------|-------|--------|
| `wibwob-agent-window.ts` | 556 | Core host feature — the agent is the shell's primary peer interface |
| `wibwob-agent-render.ts` | 234 | Rendering for agent window — inseparable from host |
| `agent-slash-commands.ts` | 134 | Agent command dispatch — host-internal |
| `scramble-window.ts` | 573 | Deeply host-integrated companion. Owns complex lifecycle, multiple entry points, host state coupling. |

## Migration order (recommended)

Start with the cleanest boundaries, build confidence, tackle the god-files last.

1. **figlet-windows.ts** — simplest, stateless, clean command set
2. **contour-window.ts** — self-contained animation
3. **plasma-window.ts** — same pattern as contour
4. **generative-windows.ts** — pattern generators already in SDK
5. **monster-cam-window.ts** — first external-process candidate
6. **terrain-lab-window.ts** — depends on contour being done first
7. **text-windows.ts** — core surface, many commands, needs care
8. **backrooms-log-browser-window.ts** — file browsing, moderate
9. **backrooms-windows.ts** — multi-window, blocking flows
10. **music-player-window.ts** — complex external process
11. **browser-windows.ts** — god-file, decompose first then migrate
12. **chrome-browser-window.ts** — CDP, last

## Migration pattern per built-in (COAT-compliant)

1. `bash scripts/scaffold-microapp.sh microapps/<name> wibwob.<id> "<Title>" <order>`
2. Move rendering/logic from `src/windows/*.ts` into `microapps/<name>/index.ts`
3. Consume SDK (`microapp-sdk.ts`) — no direct `src/core/*` imports
4. Commands register via `microapp.json` manifest, not hardcoded in command-catalog
5. Remove the `actionKey` + handler from `app-controller.ts` and `command-catalog.ts`
6. Verify: command discovery (`GET /commands/list`), execution (`POST /commands/run`),
   inspection (`GET /runtime/inspection`), workspace save/restore if `persist: true`
7. Delete the old `src/windows/*.ts` file
8. `bun run typecheck` + restart + smoke

## Command parity checklist (per migration)

Before deleting the old file, confirm:

- [ ] All commands from catalog appear in `GET /commands/list`
- [ ] Menu placement matches (category, order)
- [ ] Palette placement matches
- [ ] `agent: true` / `api: true` flags preserved
- [ ] `POST /commands/run` with the command id works
- [ ] `GET /state` shows correct `appType` for open windows
- [ ] `describeState()` returns equivalent semantic metadata
- [ ] `captureText()` returns equivalent text snapshot
- [ ] Workspace save/restore works if the original supported it
- [ ] No orphaned `actionKey` in `AppMenuActions` interface
