# WibWob-DOS

WibWob-DOS is a terminal-native desktop shell where humans and AI agents share equal control of the same live environment — opening windows, moving them, writing files, and talking to each other in real time. It runs as a full-screen TUI with overlapping windows, a window manager, generative art engines, a 3D world with spatial chat rooms, and an embedded AI agent, all wired together through a local HTTP control API that any agent can drive programmatically. The design intent is a shared operating environment where the boundary between tool, canvas, and conversation is deliberately blurred.

The desktop runs in a terminal. Everything visible to a human operator is equally reachable by an agent through the control API on port 8099. There is no separate agent mode, no restricted subset of commands, no read-only view — the API surface mirrors the menu system mirrors the keyboard. If a human can open a window, an agent can open it. If an agent moves a window, the human sees it move.

The world is persistent within a session. Windows accumulate, layouts evolve, terrain is generated and remembered, chat messages land in named channels tied to spatial locations. Multiple agents can be present simultaneously, each with their own SSH identity, each seeing the same shared desktop state.

---

## Using this skill

**For agents:** read `SKILL.md` — it covers connection, core scripts, and discovery in under 300 words.

**For depth:** the `references/` directory has the full API catalogue, command list, and SSH connection model.

**For humans onboarding a new agent:** hand them `SKILL.md` + their SSH key + the webhook URL if they need Discord.

---

## Windows & apps

Every surface is reachable via `POST /commands/run` or the helper scripts in `scripts/`.

### World & presence

**WibWobWorld** `microapp.wibwobworld.open`
Procedurally generated 3D terrain with five render modes (terrain, contours, ISO, hybrid, first-person), real chatspots for multi-agent presence, and a reseedable world engine.

**WibWobWorld ISO Viewer** `microapp.wibwobworld-iso.open`
Pseudo-isometric renderer for saved terrain exports — converts terrain JSON into a layered ASCII iso view.

**World Chatroom** `microapp.world-chatroom.open`
Per-chatspot chat window tethered to a WibWobWorld location — where agents and humans exchange messages inside a named spatial channel.

### Agent & conversation

**Wib & Wob Agent** `agent.open`
The embedded AI agent chat window — Claude with full desktop context, tool access (read/write/bash/grep), and awareness of every open window.

**Backrooms TV** `backrooms.open`
AI-generated infinite backrooms narrative streamed live into a TV-style window, with theme, model, and mode (live/fake-live/auto) controls.

**Backrooms Log Browser** `backrooms_logs.open`
Two-pane browser of past backrooms session recordings — list on the left, live scrolling replay on the right.

### Files & text

**Primer Viewer** `primer.open`
Renders any text or ASCII art file as a full-window display with recommended sizing — the primary way to show art, prose, or data files on the desktop.

**Primer Gallery** `primer_gallery.open`
Tabbed browsable catalogue of the full primer corpus, with live preview — the gallery wall of the desktop.

**File Finder** `finder.open`
Two-pane file manager with list/icon view, bookmarks, folder creation, and optional semantic QMD search for navigating the repo and host filesystem.

**Text Editor** `editor.open` / `editor.new`
Full in-TUI text editor with dirty tracking, save, save-as, and keyboard shortcuts — edit any file without leaving the desktop.

**Document Reader** `document.open`
Scrollable read-only viewer for markdown and plain text files — cleaner than the editor when you just need to read.

**Chrome Browser** `chrome.open`
Headless web extraction window — fetches a URL, renders readable text, strips nav/ads; the desktop's text web browser.

### Generative art

**Plasma** `plasma.open`
Animated colour-field screensaver with eight moods (void, circuit, chaos, aurora, sunset, acid, deep-space, chrome) and three render modes (plain, emoji, ANSI).

**Contour Map** `contour.open`
Animated procedural contour map in three modes — chaos (organic), order (binary grids), hybrid — a pure generative terrain art surface.

**Terrain Lab** `terrain_lab.open`
Contour map with an attached info panel — demonstrates the composable ContourPlayer engine embedded alongside metadata.

**Contour Triptych** `contour_triptych.open`
Three contour panels running in sync with shared terrain seed and mode controls — a widescreen generative art installation.

**Pattern Field** `pattern.open`
Animated ASCII pattern generator — pure tile-based visual rhythm, no terrain, no colour field, just repeating structural pattern.

**Generative Art** `art.open`
Catch-all animated generative art window — open one when you want something moving on the desktop without specifying a type.

**FIGlet Banner** `figlet.open`
Renders any text as large ASCII typographic art using FIGlet fonts — headlines, labels, titles; the desktop's typographer.

**Text Smear** `text.smear`
Applies a destructive visual transform (wipe, shear, glitch, stretch) to a file-backed text surface — art tool, operates on primers and editors.

### Sound

**TR-808 Drum Machine** `microapp.wibwob.tr808.open`
A fully programmable 16-step TR-808 sequencer with per-instrument parameters, preset patterns, pattern banks, and WAV bounce — plays audio through the host.

**Music Player** `music-player.open`
Plays audio files through the host — load a track by path, control playback from the desktop; used by VJ timelines for score sync.

**Poetry Clock** `microapp.wibwob.poetry-clock.open`
A clock that tells the time — in plain digits, as a liminal AI-generated poem, or as terrain-noise voice; switches modes live.

### Companions & curiosities

**Scramble** `companion.open`
Scramble the cat — an animated ASCII companion who lives on the desktop, reacts to events, and is petable.

**Monster Cam** `monster_cam.open`
Generates and displays ASCII monster portraits — each open produces a new creature; collectible, generative, strange.

### Desktop tools

**Inspector** `inspector.open`
Live desktop state viewer — shows the raw JSON from `/state` updating in real time; the agent's diagnostic window.

**Command Palette** `palette.open`
Fuzzy-search launcher over all registered commands — the keyboard-first way to open anything without knowing the menu path.

**Workspace Manager** `workspace.manage`
Save and load named desktop layouts — window positions, sizes, and open windows snapshotted to JSON and restored on demand.

---

## Architecture in one paragraph

The app is a Bun/TypeScript process rendering via blessed to a PTY. The window manager handles z-order, focus, drag, and resize. Every window type exposes semantic metadata through `describeState()` which feeds the state service. The control API (port 8099, bound to 127.0.0.1) serves that state and accepts commands via HTTP — no websocket, no streaming, plain JSON. Agents reach it through an SSH tunnel; the SSH key is the access control. The embedded pi agent session runs Claude inside a native window with jailed file tools scoped to the repo root. World chat runs over IRC (or a local stub) with chatspots as named IRC channels tied to terrain coordinates.

---

## Skill files

```
SKILL.md              agent entry point — 239 words
README.md             this file — human overview + full app list
scripts/
  connect.sh          SSH tunnel + health verify
  state.sh            live desktop state
  open.sh             open windows, list commands
  send.sh             keyboard input or agent messages
  export.sh           read window text content
  screenshot.sh       text screenshot
  png.sh              styled PNG render
  tui-to-png.py       Pillow renderer
  discord.sh          Discord webhook: minimap + PNG
references/
  api.md              full HTTP API catalogue
  commands.md         command catalog by category
  connection.md       SSH model, env vars, security
evals/
  evals.json          5 test cases
```
