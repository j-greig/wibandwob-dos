# Applications Menu Smoke + API Mapping Audit (single-app rerun + freeze recovery aware)

Date: 2026-03-12T19:59:15

Capture protocol: one app at a time. For each app we save two text captures: full desktop and app window crop. PNG intentionally omitted in this audit.

Total applications tested: 28

## Summary
- Launch success: 27/28
- Launch failures: 1
- Window resolved for crop capture: 24/28
- Capture root: `scratch/captures/apps-smoke-20260312-195850`
- Audit JSON: `scratch/captures/apps-smoke-20260312-195850/audit.json`

## Operator note: freeze handling
- If an app freezes or API calls stop responding, run `bash scripts/restart.sh`, wait for `/health`, then resume from the failed app index.
- This rerun completed without requiring restart recovery.

### Wib&Wob Chat (agent.open)

- [x] Launch attempted
- [x] Launch result: `ok`
- [x] Window resolved: `66` Wib&Wob Chat
- [x] Resize: `72x20 -> 78x24`
- [x] Move: `-> 4,2`
- [x] Full text capture: `scratch/captures/apps-smoke-20260312-195850/text/01-agent_open-full.txt` (ok)
- [x] Window text capture: `scratch/captures/apps-smoke-20260312-195850/text/01-agent_open-window.txt` (ok)

#### Related API commands
- `agent.reload_prompt`

### Backrooms: Live TV (backrooms.open)

- [x] Launch attempted
- [ ] Launch result: `fail: HTTP Error 404: Not Found`
- [ ] Window resolved: `None`
- [ ] Resize: `not attempted`
- [ ] Move: `not attempted`
- [x] Full text capture: `scratch/captures/apps-smoke-20260312-195850/text/02-backrooms_open-full.txt` (ok)
- [ ] Window text capture: `scratch/captures/apps-smoke-20260312-195850/text/02-backrooms_open-window.txt` (fail: no window id resolved)

#### Related API commands
- `backrooms_logs.open`

### Backrooms: Log Browser (backrooms_logs.open)

- [x] Launch attempted
- [x] Launch result: `ok`
- [x] Window resolved: `67` Backrooms Logs
- [x] Resize: `72x20 -> 78x24`
- [x] Move: `-> 4,2`
- [x] Full text capture: `scratch/captures/apps-smoke-20260312-195850/text/03-backrooms_logs_open-full.txt` (ok)
- [x] Window text capture: `scratch/captures/apps-smoke-20260312-195850/text/03-backrooms_logs_open-window.txt` (ok)

#### Related API commands
- none beyond open

### Scramble Chat (companion.open)

- [x] Launch attempted
- [x] Launch result: `ok`
- [x] Window resolved: `68` Scramble
- [x] Resize: `40x18 -> 78x24`
- [x] Move: `-> 4,2`
- [x] Full text capture: `scratch/captures/apps-smoke-20260312-195850/text/04-companion_open-full.txt` (ok)
- [x] Window text capture: `scratch/captures/apps-smoke-20260312-195850/text/04-companion_open-window.txt` (ok)

#### Related API commands
- `companion.smol`

### Scramble: Popup (companion.smol)

- [x] Launch attempted
- [x] Launch result: `ok`
- [x] Window resolved: `69` Scramble
- [x] Resize: `34x12 -> 78x24`
- [x] Move: `-> 4,2`
- [x] Full text capture: `scratch/captures/apps-smoke-20260312-195850/text/05-companion_smol-full.txt` (ok)
- [x] Window text capture: `scratch/captures/apps-smoke-20260312-195850/text/05-companion_smol-window.txt` (ok)

#### Related API commands
- `companion.open`

### Contour Studio (contour.open)

- [x] Launch attempted
- [x] Launch result: `ok`
- [x] Window resolved: `70` Contour Studio
- [x] Resize: `72x20 -> 78x24`
- [x] Move: `-> 4,2`
- [x] Full text capture: `scratch/captures/apps-smoke-20260312-195850/text/06-contour_open-full.txt` (ok)
- [x] Window text capture: `scratch/captures/apps-smoke-20260312-195850/text/06-contour_open-window.txt` (ok)

#### Related API commands
- none beyond open

### Reader (document.open)

- [x] Launch attempted
- [x] Launch result: `ok`
- [x] Window resolved: `71` Browser: WELCOME.md
- [x] Resize: `156x18 -> 78x24`
- [x] Move: `-> 4,2`
- [x] Full text capture: `scratch/captures/apps-smoke-20260312-195850/text/07-document_open-full.txt` (ok)
- [x] Window text capture: `scratch/captures/apps-smoke-20260312-195850/text/07-document_open-window.txt` (ok)

#### Related API commands
- none beyond open

### Figlet Banner (figlet.open)

- [x] Launch attempted
- [x] Launch result: `ok`
- [ ] Window resolved: `None`
- [ ] Resize: `not attempted`
- [ ] Move: `not attempted`
- [x] Full text capture: `scratch/captures/apps-smoke-20260312-195850/text/08-figlet_open-full.txt` (ok)
- [ ] Window text capture: `scratch/captures/apps-smoke-20260312-195850/text/08-figlet_open-window.txt` (fail: no window id resolved)

#### Related API commands
- none beyond open

### File Manager (finder.open)

- [x] Launch attempted
- [x] Launch result: `ok`
- [x] Window resolved: `72` File Manager
- [x] Resize: `72x20 -> 78x24`
- [x] Move: `-> 4,2`
- [x] Full text capture: `scratch/captures/apps-smoke-20260312-195850/text/09-finder_open-full.txt` (ok)
- [x] Window text capture: `scratch/captures/apps-smoke-20260312-195850/text/09-finder_open-window.txt` (ok)

#### Related API commands
- `finder.advanced_search`
- `finder.bookmark_path`
- `finder.go_to_bookmark`
- `finder.navigate`
- `finder.new_folder`
- `finder.refresh`
- `finder.search`
- `finder.sort_by`
- `finder.toggle_view`

### Open World Chatroom (microapp.wibwob.chatroom.open)

- [x] Launch attempted
- [x] Launch result: `ok`
- [x] Window resolved: `73` World Chatroom
- [x] Resize: `72x16 -> 78x24`
- [x] Move: `-> 4,2`
- [x] Full text capture: `scratch/captures/apps-smoke-20260312-195850/text/10-microapp_wibwob_chatroom_open-full.txt` (ok)
- [x] Window text capture: `scratch/captures/apps-smoke-20260312-195850/text/10-microapp_wibwob_chatroom_open-window.txt` (ok)

#### Related API commands
- `microapp.wibwob.chatroom.send`
- `microapp.wibwob.chatroom.set-channel`

### Dashboard XXL (microapp.wibwob.dashboard-xxl.open)

- [x] Launch attempted
- [x] Launch result: `ok`
- [x] Window resolved: `74` Dashboard XXL
- [x] Resize: `140x48 -> 78x24`
- [x] Move: `-> 4,2`
- [x] Full text capture: `scratch/captures/apps-smoke-20260312-195850/text/11-microapp_wibwob_dashboard_xxl_open-full.txt` (ok)
- [x] Window text capture: `scratch/captures/apps-smoke-20260312-195850/text/11-microapp_wibwob_dashboard_xxl_open-window.txt` (ok)

#### Related API commands
- none beyond open

### Dashboard (microapp.wibwob.dashboard.open)

- [x] Launch attempted
- [x] Launch result: `ok`
- [x] Window resolved: `75` Dashboard
- [x] Resize: `140x48 -> 78x24`
- [x] Move: `-> 4,2`
- [x] Full text capture: `scratch/captures/apps-smoke-20260312-195850/text/12-microapp_wibwob_dashboard_open-full.txt` (ok)
- [x] Window text capture: `scratch/captures/apps-smoke-20260312-195850/text/12-microapp_wibwob_dashboard_open-window.txt` (ok)

#### Related API commands
- `microapp.wibwob.dashboard-xxl.open`

### Code Editor (microapp.wibwob.slap-editor.open)

- [x] Launch attempted
- [x] Launch result: `ok`
- [x] Window resolved: `76` Code Editor
- [x] Resize: `100x35 -> 78x24`
- [x] Move: `-> 4,2`
- [x] Full text capture: `scratch/captures/apps-smoke-20260312-195850/text/13-microapp_wibwob_slap_editor_open-full.txt` (ok)
- [x] Window text capture: `scratch/captures/apps-smoke-20260312-195850/text/13-microapp_wibwob_slap_editor_open-window.txt` (ok)

#### Related API commands
- none beyond open

### Terminal (microapp.wibwob.terminal.open)

- [x] Launch attempted
- [x] Launch result: `ok`
- [x] Window resolved: `77` Terminal
- [x] Resize: `82x26 -> 78x24`
- [x] Move: `-> 4,2`
- [x] Full text capture: `scratch/captures/apps-smoke-20260312-195850/text/14-microapp_wibwob_terminal_open-full.txt` (ok)
- [x] Window text capture: `scratch/captures/apps-smoke-20260312-195850/text/14-microapp_wibwob_terminal_open-window.txt` (ok)

#### Related API commands
- none beyond open

### Terrarium Life (microapp.wibwob.terrarium-life.open)

- [x] Launch attempted
- [x] Launch result: `ok`
- [x] Window resolved: `78` Terrarium Life
- [x] Resize: `120x42 -> 78x24`
- [x] Move: `-> 4,2`
- [x] Full text capture: `scratch/captures/apps-smoke-20260312-195850/text/15-microapp_wibwob_terrarium_life_open-full.txt` (ok)
- [x] Window text capture: `scratch/captures/apps-smoke-20260312-195850/text/15-microapp_wibwob_terrarium_life_open-window.txt` (ok)

#### Related API commands
- none beyond open

### Antopolis (microapp.wibwob.terrarium.open)

- [x] Launch attempted
- [x] Launch result: `ok`
- [x] Window resolved: `79` 🐜 ANTOPOLIS
- [x] Resize: `120x42 -> 78x24`
- [x] Move: `-> 4,2`
- [x] Full text capture: `scratch/captures/apps-smoke-20260312-195850/text/16-microapp_wibwob_terrarium_open-full.txt` (ok)
- [x] Window text capture: `scratch/captures/apps-smoke-20260312-195850/text/16-microapp_wibwob_terrarium_open-window.txt` (ok)

#### Related API commands
- `microapp.wibwob.terrarium-life.open`

### Open TR-808 (microapp.wibwob.tr808.open)

- [x] Launch attempted
- [x] Launch result: `ok`
- [x] Window resolved: `80` TR-808 Rhythm Composer
- [x] Resize: `120x28 -> 78x24`
- [x] Move: `-> 4,2`
- [x] Full text capture: `scratch/captures/apps-smoke-20260312-195850/text/17-microapp_wibwob_tr808_open-full.txt` (ok)
- [x] Window text capture: `scratch/captures/apps-smoke-20260312-195850/text/17-microapp_wibwob_tr808_open-window.txt` (ok)

#### Related API commands
- `microapp.wibwob.tr808.bounce`
- `microapp.wibwob.tr808.clear`
- `microapp.wibwob.tr808.load-preset`
- `microapp.wibwob.tr808.play`
- `microapp.wibwob.tr808.select`
- `microapp.wibwob.tr808.set-param`
- `microapp.wibwob.tr808.set-pattern`
- `microapp.wibwob.tr808.set-step`
- `microapp.wibwob.tr808.stop`
- `microapp.wibwob.tr808.tempo`
- `microapp.wibwob.tr808.toggle-step`

### Open WibWobWorld (microapp.wibwob.world.open)

- [x] Launch attempted
- [x] Launch result: `ok`
- [x] Window resolved: `81` WibWobWorld
- [x] Resize: `118x34 -> 78x24`
- [x] Move: `-> 4,2`
- [x] Full text capture: `scratch/captures/apps-smoke-20260312-195850/text/18-microapp_wibwob_world_open-full.txt` (ok)
- [x] Window text capture: `scratch/captures/apps-smoke-20260312-195850/text/18-microapp_wibwob_world_open-window.txt` (ok)

#### Related API commands
- `microapp.wibwob.world.join-nearest-chatspot`
- `microapp.wibwob.world.reseed`
- `microapp.wibwob.world.save-capture`
- `microapp.wibwob.world.save-terrain-export`
- `microapp.wibwob.world.set-render-mode`
- `microapp.wibwob.world.set-sea-level`
- `microapp.wibwob.world.toggle-sidebar`
- `microapp.wibwob.world.toggle-vegetation`

### Open Zine (microapp.wibwob.zine.open)

- [x] Launch attempted
- [x] Launch result: `ok`
- [ ] Window resolved: `None`
- [ ] Resize: `not attempted`
- [ ] Move: `not attempted`
- [x] Full text capture: `scratch/captures/apps-smoke-20260312-195850/text/19-microapp_wibwob_zine_open-full.txt` (ok)
- [ ] Window text capture: `scratch/captures/apps-smoke-20260312-195850/text/19-microapp_wibwob_zine_open-window.txt` (fail: no window id resolved)

#### Related API commands
- none beyond open

### Monster Cam (monster-cam.open)

- [x] Launch attempted
- [x] Launch result: `ok`
- [x] Window resolved: `82` Monster Cam
- [x] Resize: `72x20 -> 78x24`
- [x] Move: `-> 4,2`
- [x] Full text capture: `scratch/captures/apps-smoke-20260312-195850/text/20-monster_cam_open-full.txt` (ok)
- [x] Window text capture: `scratch/captures/apps-smoke-20260312-195850/text/20-monster_cam_open-window.txt` (ok)

#### Related API commands
- none beyond open

### Music Player (music-player.open)

- [x] Launch attempted
- [x] Launch result: `ok`
- [x] Window resolved: `83` ♫ Music Player
- [x] Resize: `82x22 -> 78x24`
- [x] Move: `-> 4,2`
- [x] Full text capture: `scratch/captures/apps-smoke-20260312-195850/text/21-music_player_open-full.txt` (ok)
- [x] Window text capture: `scratch/captures/apps-smoke-20260312-195850/text/21-music_player_open-window.txt` (ok)

#### Related API commands
- none beyond open

### Plasma Patterns (pattern.open)

- [x] Launch attempted
- [x] Launch result: `ok`
- [x] Window resolved: `84` Pattern Field
- [x] Resize: `72x20 -> 78x24`
- [x] Move: `-> 4,2`
- [x] Full text capture: `scratch/captures/apps-smoke-20260312-195850/text/22-pattern_open-full.txt` (ok)
- [x] Window text capture: `scratch/captures/apps-smoke-20260312-195850/text/22-pattern_open-window.txt` (ok)

#### Related API commands
- none beyond open

### Plasma: From Primer (plasma.from-primer)

- [x] Launch attempted
- [x] Launch result: `ok`
- [ ] Window resolved: `None`
- [ ] Resize: `not attempted`
- [ ] Move: `not attempted`
- [x] Full text capture: `scratch/captures/apps-smoke-20260312-195850/text/23-plasma_from_primer-full.txt` (ok)
- [ ] Window text capture: `scratch/captures/apps-smoke-20260312-195850/text/23-plasma_from_primer-window.txt` (fail: no window id resolved)

#### Related API commands
- `plasma.open`

### Plasma (plasma.open)

- [x] Launch attempted
- [x] Launch result: `ok`
- [x] Window resolved: `85` Plasma
- [x] Resize: `72x20 -> 78x24`
- [x] Move: `-> 4,2`
- [x] Full text capture: `scratch/captures/apps-smoke-20260312-195850/text/24-plasma_open-full.txt` (ok)
- [x] Window text capture: `scratch/captures/apps-smoke-20260312-195850/text/24-plasma_open-window.txt` (ok)

#### Related API commands
- `plasma.from-primer`

### Gallery (primer-gallery.open)

- [x] Launch attempted
- [x] Launch result: `ok`
- [x] Window resolved: `86` Primer Gallery
- [x] Resize: `72x20 -> 78x24`
- [x] Move: `-> 4,2`
- [x] Full text capture: `scratch/captures/apps-smoke-20260312-195850/text/25-primer_gallery_open-full.txt` (ok)
- [x] Window text capture: `scratch/captures/apps-smoke-20260312-195850/text/25-primer_gallery_open-window.txt` (ok)

#### Related API commands
- none beyond open

### Browse Primers (primer.browse)

- [x] Launch attempted
- [x] Launch result: `ok`
- [x] Window resolved: `87` Primer Browser
- [x] Resize: `72x20 -> 78x24`
- [x] Move: `-> 4,2`
- [x] Full text capture: `scratch/captures/apps-smoke-20260312-195850/text/26-primer_browse-full.txt` (ok)
- [x] Window text capture: `scratch/captures/apps-smoke-20260312-195850/text/26-primer_browse-window.txt` (ok)

#### Related API commands
- `primer-gallery.open`
- `primer.list`
- `primer.open`

### Terrain Lab (terrain-lab.open)

- [x] Launch attempted
- [x] Launch result: `ok`
- [x] Window resolved: `88` Terrain Lab
- [x] Resize: `72x20 -> 78x24`
- [x] Move: `-> 4,2`
- [x] Full text capture: `scratch/captures/apps-smoke-20260312-195850/text/27-terrain_lab_open-full.txt` (ok)
- [x] Window text capture: `scratch/captures/apps-smoke-20260312-195850/text/27-terrain_lab_open-window.txt` (ok)

#### Related API commands
- none beyond open

### Web Browser (web-reader.open)

- [x] Launch attempted
- [x] Launch result: `ok`
- [x] Window resolved: `89` Chrome Browser
- [x] Resize: `100x30 -> 78x24`
- [x] Move: `-> 4,2`
- [x] Full text capture: `scratch/captures/apps-smoke-20260312-195850/text/28-web_reader_open-full.txt` (ok)
- [x] Window text capture: `scratch/captures/apps-smoke-20260312-195850/text/28-web_reader_open-window.txt` (ok)

#### Related API commands
- none beyond open

## Launch results table

| Label | Command | Result | Window ID | Title | Full text | Window text |
|---|---|---|---:|---|---|---|
| Wib&Wob Chat | `agent.open` | ok | 66 | Wib&Wob Chat | `scratch/captures/apps-smoke-20260312-195850/text/01-agent_open-full.txt` | `scratch/captures/apps-smoke-20260312-195850/text/01-agent_open-window.txt` |
| Backrooms: Live TV | `backrooms.open` | fail: HTTP Error 404: Not Found |  |  | `scratch/captures/apps-smoke-20260312-195850/text/02-backrooms_open-full.txt` | `scratch/captures/apps-smoke-20260312-195850/text/02-backrooms_open-window.txt` |
| Backrooms: Log Browser | `backrooms_logs.open` | ok | 67 | Backrooms Logs | `scratch/captures/apps-smoke-20260312-195850/text/03-backrooms_logs_open-full.txt` | `scratch/captures/apps-smoke-20260312-195850/text/03-backrooms_logs_open-window.txt` |
| Scramble Chat | `companion.open` | ok | 68 | Scramble | `scratch/captures/apps-smoke-20260312-195850/text/04-companion_open-full.txt` | `scratch/captures/apps-smoke-20260312-195850/text/04-companion_open-window.txt` |
| Scramble: Popup | `companion.smol` | ok | 69 | Scramble | `scratch/captures/apps-smoke-20260312-195850/text/05-companion_smol-full.txt` | `scratch/captures/apps-smoke-20260312-195850/text/05-companion_smol-window.txt` |
| Contour Studio | `contour.open` | ok | 70 | Contour Studio | `scratch/captures/apps-smoke-20260312-195850/text/06-contour_open-full.txt` | `scratch/captures/apps-smoke-20260312-195850/text/06-contour_open-window.txt` |
| Reader | `document.open` | ok | 71 | Browser: WELCOME.md | `scratch/captures/apps-smoke-20260312-195850/text/07-document_open-full.txt` | `scratch/captures/apps-smoke-20260312-195850/text/07-document_open-window.txt` |
| Figlet Banner | `figlet.open` | ok |  |  | `scratch/captures/apps-smoke-20260312-195850/text/08-figlet_open-full.txt` | `scratch/captures/apps-smoke-20260312-195850/text/08-figlet_open-window.txt` |
| File Manager | `finder.open` | ok | 72 | File Manager | `scratch/captures/apps-smoke-20260312-195850/text/09-finder_open-full.txt` | `scratch/captures/apps-smoke-20260312-195850/text/09-finder_open-window.txt` |
| Open World Chatroom | `microapp.wibwob.chatroom.open` | ok | 73 | World Chatroom | `scratch/captures/apps-smoke-20260312-195850/text/10-microapp_wibwob_chatroom_open-full.txt` | `scratch/captures/apps-smoke-20260312-195850/text/10-microapp_wibwob_chatroom_open-window.txt` |
| Dashboard XXL | `microapp.wibwob.dashboard-xxl.open` | ok | 74 | Dashboard XXL | `scratch/captures/apps-smoke-20260312-195850/text/11-microapp_wibwob_dashboard_xxl_open-full.txt` | `scratch/captures/apps-smoke-20260312-195850/text/11-microapp_wibwob_dashboard_xxl_open-window.txt` |
| Dashboard | `microapp.wibwob.dashboard.open` | ok | 75 | Dashboard | `scratch/captures/apps-smoke-20260312-195850/text/12-microapp_wibwob_dashboard_open-full.txt` | `scratch/captures/apps-smoke-20260312-195850/text/12-microapp_wibwob_dashboard_open-window.txt` |
| Code Editor | `microapp.wibwob.slap-editor.open` | ok | 76 | Code Editor | `scratch/captures/apps-smoke-20260312-195850/text/13-microapp_wibwob_slap_editor_open-full.txt` | `scratch/captures/apps-smoke-20260312-195850/text/13-microapp_wibwob_slap_editor_open-window.txt` |
| Terminal | `microapp.wibwob.terminal.open` | ok | 77 | Terminal | `scratch/captures/apps-smoke-20260312-195850/text/14-microapp_wibwob_terminal_open-full.txt` | `scratch/captures/apps-smoke-20260312-195850/text/14-microapp_wibwob_terminal_open-window.txt` |
| Terrarium Life | `microapp.wibwob.terrarium-life.open` | ok | 78 | Terrarium Life | `scratch/captures/apps-smoke-20260312-195850/text/15-microapp_wibwob_terrarium_life_open-full.txt` | `scratch/captures/apps-smoke-20260312-195850/text/15-microapp_wibwob_terrarium_life_open-window.txt` |
| Antopolis | `microapp.wibwob.terrarium.open` | ok | 79 | 🐜 ANTOPOLIS | `scratch/captures/apps-smoke-20260312-195850/text/16-microapp_wibwob_terrarium_open-full.txt` | `scratch/captures/apps-smoke-20260312-195850/text/16-microapp_wibwob_terrarium_open-window.txt` |
| Open TR-808 | `microapp.wibwob.tr808.open` | ok | 80 | TR-808 Rhythm Composer | `scratch/captures/apps-smoke-20260312-195850/text/17-microapp_wibwob_tr808_open-full.txt` | `scratch/captures/apps-smoke-20260312-195850/text/17-microapp_wibwob_tr808_open-window.txt` |
| Open WibWobWorld | `microapp.wibwob.world.open` | ok | 81 | WibWobWorld | `scratch/captures/apps-smoke-20260312-195850/text/18-microapp_wibwob_world_open-full.txt` | `scratch/captures/apps-smoke-20260312-195850/text/18-microapp_wibwob_world_open-window.txt` |
| Open Zine | `microapp.wibwob.zine.open` | ok |  |  | `scratch/captures/apps-smoke-20260312-195850/text/19-microapp_wibwob_zine_open-full.txt` | `scratch/captures/apps-smoke-20260312-195850/text/19-microapp_wibwob_zine_open-window.txt` |
| Monster Cam | `monster-cam.open` | ok | 82 | Monster Cam | `scratch/captures/apps-smoke-20260312-195850/text/20-monster_cam_open-full.txt` | `scratch/captures/apps-smoke-20260312-195850/text/20-monster_cam_open-window.txt` |
| Music Player | `music-player.open` | ok | 83 | ♫ Music Player | `scratch/captures/apps-smoke-20260312-195850/text/21-music_player_open-full.txt` | `scratch/captures/apps-smoke-20260312-195850/text/21-music_player_open-window.txt` |
| Plasma Patterns | `pattern.open` | ok | 84 | Pattern Field | `scratch/captures/apps-smoke-20260312-195850/text/22-pattern_open-full.txt` | `scratch/captures/apps-smoke-20260312-195850/text/22-pattern_open-window.txt` |
| Plasma: From Primer | `plasma.from-primer` | ok |  |  | `scratch/captures/apps-smoke-20260312-195850/text/23-plasma_from_primer-full.txt` | `scratch/captures/apps-smoke-20260312-195850/text/23-plasma_from_primer-window.txt` |
| Plasma | `plasma.open` | ok | 85 | Plasma | `scratch/captures/apps-smoke-20260312-195850/text/24-plasma_open-full.txt` | `scratch/captures/apps-smoke-20260312-195850/text/24-plasma_open-window.txt` |
| Gallery | `primer-gallery.open` | ok | 86 | Primer Gallery | `scratch/captures/apps-smoke-20260312-195850/text/25-primer_gallery_open-full.txt` | `scratch/captures/apps-smoke-20260312-195850/text/25-primer_gallery_open-window.txt` |
| Browse Primers | `primer.browse` | ok | 87 | Primer Browser | `scratch/captures/apps-smoke-20260312-195850/text/26-primer_browse-full.txt` | `scratch/captures/apps-smoke-20260312-195850/text/26-primer_browse-window.txt` |
| Terrain Lab | `terrain-lab.open` | ok | 88 | Terrain Lab | `scratch/captures/apps-smoke-20260312-195850/text/27-terrain_lab_open-full.txt` | `scratch/captures/apps-smoke-20260312-195850/text/27-terrain_lab_open-window.txt` |
| Web Browser | `web-reader.open` | ok | 89 | Chrome Browser | `scratch/captures/apps-smoke-20260312-195850/text/28-web_reader_open-full.txt` | `scratch/captures/apps-smoke-20260312-195850/text/28-web_reader_open-window.txt` |

## Next pass note: Demos sweep strategy (code-first + capture)

After figlet and zine API control is completed, run demos in two phases:

1. Code-first API gap pass (preferred)
- Inspect each demo module and identify interactive blockers (prompt overlays, pickers, confirm dialogs, interstitial screens).
- Add direct command/API pathways for each blocker so the demo can be opened to final view without manual keypresses.
- Record each new endpoint in control-api endpoint catalogue.

2. Batch text-capture pass
- Run one-demo-at-a-time sequence.
- For each demo: open, capture `/screenshot/text`, capture window crop text if resolvable, write short description.
- Classify state as:
  - final form reached
  - waiting on selection/confirm/interstitial
  - unresolved/failed
- Always run `desktop.clear-all` after each demo.

Optional fast mode
- YOLO smoke first (capture-only), then patch API gaps from observed blockers.
- Use only when speed is more important than deterministic final-view coverage.

Planned script path for repeatability
- `scripts/demo-phase1-sequence.sh` (to be added)
- This script should generate timestamped capture folder and a markdown report with blocker classification.

## Running blocker list (keep live)

| App / Module | Command | Current blocker | Status | Next action |
|---|---|---|---|---|
| Primer List | `primer.list` | None (returns data directly) | done | use as canonical primer path source for deterministic runs |
| Primer Open (explicit) | `primer.open` + `filePath` | None (opens directly) | done | prefer explicit `filePath` in automation |
| Primer Open (interactive) | `primer.open` (no args) | File-browser interstitial requires selecting an entry before confirm | done | fixed via shared `overlay.select` + `overlay.confirm` (opened `bods.txt` in retest) |
| Primer Browser | `primer.browse` | None (opens directly) | done | keep as baseline primer UI smoke |
| Backrooms: Live TV | `backrooms.open` | Value-prompt interstitial (`Backrooms Theme`) before final window | in-progress | add shared `overlay.set-value` for deterministic theme input |
| Figlet Banner | `figlet.open` | Value prompt then font browser picker before banner | in-progress | add `overlay.set-value` for text prompt; `overlay.select` now handles font index |
| Plasma: From Primer (explicit) | `plasma.from-primer` + `filePath` | None (opens directly) | done | prefer explicit `filePath` from `primer.list` |
| Plasma: From Primer (interactive) | `plasma.from-primer` (no args) | File-browser interstitial requires selecting an entry before confirm | done | fixed via shared `overlay.select` + `overlay.confirm` (opened Plasma in retest) |
| Zine | `microapp.wibwob.zine.open` | Default canvas picker was local list (not shared overlay) | mitigated | module commands added: `zine.picker.info/select/confirm/cancel`; later migrate to shared overlay primitive |

Latest primer pass evidence: `scratch/reports/primer-api-pass-clean.json`

Rule: update this table immediately whenever a blocker is discovered, resolved, or regresses.

## Update: figlet + zine interstitial controls verified (2026-03-12, later pass)

- [x] Figlet interstitial flow is now API-drivable end-to-end
  - open prompt -> confirm -> font picker -> cancel/confirm path works
  - overlay control commands/endpoints available: `overlay.info`, `overlay.confirm`, `overlay.cancel`

- [x] Zine default picker is now API-drivable on current branch via module commands
  - `microapp.wibwob.zine.picker.info`
  - `microapp.wibwob.zine.picker.select` (args: `index`)
  - `microapp.wibwob.zine.picker.confirm`
  - `microapp.wibwob.zine.picker.cancel`

- [x] Manual confirmation from operator received: both confirm and cancel paths worked
