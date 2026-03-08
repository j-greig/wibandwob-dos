---
type: reference
status: active
tags: [e021, mvp, commands, menu]
tldr: "All menu-visible commands by menu, with [ON]/[OFF] status for the VPS docker-safe profile."
---

# Menu Command Surface — VPS docker-safe profile

Profile: `config/capability-profiles/docker-safe.json`

```json
forceOff: [path.monster_cam.venv, path.backrooms.repo, bin.chrome, feature.file-manager]
forceOn:  [bin.figlet, feature.resource-heavy]
```

[ON]  = available in docker-safe
[OFF] = blocked (reason noted)

---

## File

| Status | Label | Command ID |
|---|---|---|
| [ON] | Open Primer... | `primer.open` |
| [ON] | Open Text File... | `editor.open` |
| [ON] | New Editor | `editor.new` |
| [ON] | Save | `editor.save` |
| [ON] | Save As... | `editor.save_as` |
| [ON] | Save Workspace... | `workspace.save_as` |
| [ON] | Load Workspace... | `workspace.load` |
| [ON] | Quit | `app.quit` |

---

## Edit

| Status | Label | Command ID |
|---|---|---|
| [ON] | Copy Window Text | `window.copy_text` |
| [ON] | Export Window Text... | `window.export_text` |
| [ON] | Smear Text Surface | `text.smear` |

---

## View

| Status | Label | Command ID |
|---|---|---|
| [ON] | Command Palette | `palette.open` |
| [ON] | Open State Inspector | `inspector.open` |
| [ON] | Cycle Theme | `theme.cycle` |
| [ON] | Choose Theme... | `theme.choose` |

---

## Window

| Status | Label | Command ID |
|---|---|---|
| [ON] | Focus Next Window | `window.focus_next` |
| [ON] | Focus Previous Window | `window.focus_previous` |
| [ON] | Close Focused Window | `window.close_focused` |
| [ON] | Clear Desktop | `desktop.clear-all` |
| [ON] | Toggle Maximize | `window.toggle_maximize` |
| [ON] | Tile Windows | `window.tile` |
| [ON] | Cascade Windows | `window.cascade` |
| [ON] | Workspace Manager | `workspace.manage` |

---

## Applications

| Status | Label | Command ID | Notes |
|---|---|---|---|
| [OFF] | Open File Manager | `finder.open` | feature.file-manager — security |
| [ON] | Backrooms Log Browser | `backrooms_logs.open` | |
| [OFF] | Backrooms TV... | `backrooms.open` | path.backrooms.repo — not in image |
| [ON] | Browse Primers | `primer.browse` | |
| [ON] | Open Gallery | `primer_gallery.open` | |
| [OFF] | Open Chrome Browser | `chrome.open` | bin.chrome — not in image |
| [ON] | Document Reader | `document.open` | |
| [ON] | Open Art | `art.open` | |
| [ON] | Figlet Banner | `figlet.open` | forceOn — bin.figlet installed |
| [ON] | Pattern Window | `pattern.open` | |
| [ON] | Plasma Screensaver | `plasma.open` | forceOn — feature.resource-heavy |
| [ON] | Plasma from Primer | `plasma.from-primer` | forceOn — feature.resource-heavy |
| [ON] | Contour Studio | `contour.open` | |
| [ON] | Terrain Lab | `terrain_lab.open` | |
| [ON] | Wib&Wob Agent | `agent.open` | |
| [ON] | Music Player | `music-player.open` | |
| [ON] | Companion | `companion.open` | forceOn — feature.resource-heavy |
| [OFF] | Monster Cam | `monster_cam.open` | path.monster_cam.venv — not in image |

---

## Help

| Status | Label | Command ID |
|---|---|---|
| [ON] | View README | `readme.open` |

---

## Menu-less surface commands (API/agent only, no menu placement)

These are available via `POST /commands/run` but don't appear in any menu:

| Status | Command ID | Notes |
|---|---|---|
| [ON] | `microapp.wibwobworld.open` | 3D world |
| [ON] | `microapp.wibwob.poetry-clock.set-mode` | poetry clock mode |
| [ON] | `world-chatroom.open` | room chat |
| [ON] | `tr808.open` | drum machine |
| [ON] | `patchbay.open` | patchbay lab |
| [ON] | `contour_triptych.open` | 3-panel contour |
| [ON] | `theme.set` | set theme by name (API) |
| [ON] | `primer.list` | list available primers |
| [ON] | `agent.reload_prompt` | reload agent system prompt |
| [ON] | `desktop.toggle_chrome` | toggle window chrome |
| [ON] | `workspace.save` | save workspace (API) |
| [ON] | `workspace.load_named` | load workspace by name (API) |
| [OFF] | `backrooms.run` | path.backrooms.repo — not in image |
| [OFF] | `finder.*` (9 commands) | feature.file-manager — security |

---

## Summary

| | Count |
|---|---|
| [ON] in menus | 31 |
| [OFF] in menus | 4 |
| [ON] API-only | 12 |
| [OFF] API-only | 10 |
| **Total menu-visible** | **35** |
