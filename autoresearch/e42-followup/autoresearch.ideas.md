# E042 Follow-Up — Ideas (pruned end of session)

## ✅ Done
- ~~createCanvas SDK component~~ → shipped, 5 render engines converted
- ~~sdk-showcase microapp~~ → shipped
- ~~COAT check for blessed imports~~ → not needed, manual migration working

## Next Session Priority

### 1. App-Controller Decomposition
- Host-window-registry at `src/core/host-window-registry.ts` ready
- Planning doc at `.planning/ideas/host-window-registry.md`
- 12 focusOrCreate window types to register
- Start with simplest openers (terrain-lab, companion-widget)
- Complex openers (file-manager, agent) have callbacks into controller — need dep injection

### 2. SDK Interactive Components (unblocks more blessed elimination)
- `createButton(parent, opts)` — mouse click + hover style + key shortcut
- Enhanced `createInputLine` — multi-line, keypress forwarding, cursor
- `createChatView(parent, opts)` — transcript + input combo
- These unblock: monster-cam, figlet-banner, world-chatroom, sy2-chronicles

### 3. as any Reduction
- 169 total. Target <50. By file:
  - control-api.ts — Hono request/response typing
  - chrome-browser-service.ts — puppeteer types
  - ui/containers.ts — blessed widget casting (use specific blessed types)
  - overlay-manager.ts — blessed event types

### 4. Plan 9 Plumber
- Brief at `.planning/ideas/plan9-plumber.md`
- Start with file-extension routing
- File-manager "open with" is first consumer

### 5. Ghost-Click Integration
- `scripts/ghost-click.sh` exists
- Spike at `.planning/spikes/spk-ghost-click/`
- Integrate with ops scripts in DRY way

## Parking Lot
- Structured logging (pino-style)
- Atomic writes in safe-fs.ts (tmp + rename)  
- Event bus redesign (TODO-b1ddb4ff)
- Music-player microapp migration (1224 lines)
- File-manager full microapp migration (complex, host-delegated pattern working)
