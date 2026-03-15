---
id: spk-ghostty-shader-menu
title: "Ghostty Shader Menu Module"
status: proposed
created: 2026-03-15
---

# Ghostty Shader Menu Module

## Problem

Shader management is CLI-only (`ghostty-shader.sh`, manual config edits).
Agents and users have no TUI-native way to browse, preview, or swap shaders.
Proved in session: AppleScript `perform action "reload_config"` makes instant
hot-swap possible — needs a UI surface.

## Proposal

Opt-in microapp module that adds a **Shaders** menu category to the menu bar
(before Help) with browse/set/disable commands.

## Architecture

```
microapps/shader-menu/
├── index.ts          # register commands, menu category
└── shader-service.ts # discover, swap, reload, track current
```

### Commands

| ID | Label | Surface | What |
|----|-------|---------|------|
| `shader.list` | Browse Shaders... | menu, palette, api | Picker window with all discovered shaders |
| `shader.set` | — | api, agent | Set shader by name. Args: `{ name: string }` |
| `shader.off` | Disable Shader | menu, api | Remove `custom-shader` line, reload config |
| `shader.current` | Current Shader | menu, api | Flash overlay showing active shader name |
| `shader.reload` | Reload Shader | menu, api | Re-run `perform action "reload_config"` |

### Shader Discovery

Scan directories for `*.glsl`:
- `shaders/` (repo wibwob shaders)
- `autoresearch/shader-music/ghostty-shaders/` (community shaders)
- `~/.config/ghostty/shaders/` (user shaders)

Return `{ name, path, hasTerminalInput }` — detect `iChannel0` usage to flag
whether shader reads terminal content or replaces it.

### Hot-swap Mechanism

```typescript
import { execSync } from "node:child_process";

function setShader(glslPath: string): boolean {
  const config = `${process.env.HOME}/Library/Application Support/com.mitchellh.ghostty/config`;
  // sed replace custom-shader line
  execSync(`sed -i '' "s|^custom-shader = .*|custom-shader = ${glslPath}|" "${config}"`);
  // AppleScript reload (Ghostty 1.3+)
  const result = execSync(
    `osascript -e 'tell application "Ghostty" to perform action "reload_config" on terminal 1 of selected tab of front window'`
  );
  return result.toString().trim() === "true";
}
```

### Picker Window

Reuse primer-browser pattern — list on left, preview info on right:
- Shader name (derived from filename)
- Source dir badge (wibwob / ghostty / user)
- `iChannel0` badge (terminal overlay vs standalone)
- File size, line count
- **Live preview on highlight**: swap shader on cursor move, revert on Esc

### Menu Placement

Commands register with `menuCategories: ["shaders"]`. Menu bar category
ordering defined in `src/core/menu-categories.ts` (or equivalent) — insert
"Shaders" before "Help".

## Requirements

- **Ghostty 1.3+** — AppleScript `perform action` support
- **macOS only** — AppleScript + sed config path. Linux would need different
  reload mechanism (Ghostty doesn't support AppleScript on Linux).
- Graceful no-op if not running in Ghostty (`GHOSTTY_RESOURCES_DIR` check)

## References

- [Ghostty AppleScript PR #11208](https://github.com/ghostty-org/ghostty/pull/11208)
- [Audio-reactive shaders discussion #10201](https://github.com/ghostty-org/ghostty/discussions/10201)
- [Community shader switcher PR #61](https://github.com/0xhckr/ghostty-shaders/pull/61)
- `scripts/ghostty-shader.sh` — existing CLI shader manager
- `autoresearch/shader-music/ghostty-shader-music-viz/PLAN.md` — broader shader+music viz plan
- SDEF: `/Applications/Ghostty.app/Contents/Resources/Ghostty.sdef`

## Open Questions

- [ ] Multi-shader pipelines — Ghostty supports multiple `custom-shader` lines
      that compose. Should the picker support building chains?
- [ ] Shader parameters — some shaders have `#define` tunables. Could expose
      as sliders in the picker? Would require rewriting the GLSL and reloading.
- [ ] Linux support — what's the reload mechanism on Linux Ghostty?
- [ ] Should this module also manage `custom-shader-animation` (always/when-focused/false)?
