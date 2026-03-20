# COAT.md — Live proof of Command Once, Adapt Thin

> Every endpoint and command flows through the same registry. This file is that claim made concrete.
> Auto-generated — do not edit. Regenerate: `bun run .pi/skills/ww-primitives/scripts/gen-integration-surface.ts`

Generated: 2026-03-20
Endpoints: 24 · Commands: 84

---

## API Endpoints

Default: `http://127.0.0.1:8099`. **Prefer `wibwob` CLI over `curl`.**

### /

- `GET /` — Service info + endpoint list (this response)

### /help

- `GET /help` — Alias for /

### /health

- `GET /health` — Instance identity: id, label, pid, uptime, port, socketPath

### /config

- `GET /config` — Instance config: paths (scratch, captures, workspaces, state)

### /openapi.json

- `GET /openapi.json` — OpenAPI 3.0 spec

### /docs

- `GET /docs` — Interactive API docs (Scalar)

### /state

- `GET /state` — Full live desktop + window state

### /runtime

- `GET /runtime/inspection` — Structured runtime snapshot: desktop state, menu/overlay UI state, runtime stats, and Scramble inspection.
- `GET /runtime/stats` — Shell-level runtime stats: render FPS, frame time, RAM, and agent activity

### /commands

- `GET /commands/list` — All registered commands (optional ?surface=menu|palette|api|agent&includeUnavailable=1)

### /content

- `GET /content/primer-info` — Primer content metadata. ?path=/abs/path.txt

### /world-chat

- `GET /world-chat/state` — Structured world chat snapshot outside the TUI
- `GET /world-chat/channels` — List world chat channels outside the TUI
- `GET /world-chat/channel` — Read one world chat channel. ?id=%23world-ridge-overlook
- `GET /world-chat/channel/text` — Plain text export of one world chat channel. ?id=%23world-ridge-overlook

### /windows

- `GET /windows/text` — Raw text content of a window. ?id=N

### /screenshot

- `GET /screenshot` — Friendly screenshot alias. Defaults to clean text output.
- `GET /screenshot/text` — Clean readable text screenshot. ?id=N uses semantic captureText. Full screen strips ANSI + chrome.
- `GET /screenshot/ansi` — Raw ANSI text screenshot (blessed screen dump). ?id=N to crop to window rect.

### /view

- `GET /view/figlet/fonts` — List figlet fonts, default font, and metadata. Alias: figlet.fonts
- `GET /view/zine/canvases` — List selectable Zine canvases. Alias: microapp.wibwob.zine.list-canvases

### /scramble

- `GET /scramble/state` — Scramble brain state: status, model, sessionId, messageCount, lastMessage, sleeping, logPath
- `GET /scramble/history` — Full Scramble conversation history as JSON array

### /overlay

- `GET /overlay/info` — Check if a modal overlay is active. Returns { active, type?, selectedIndex?, count? }.

---

## Commands (command-catalog.ts)

Execute via `bun run wibwob cmd <id>` or `POST /commands/run {"id":"<id>"}`.

### primer

- `primer.browse` — Open the primer browser to discover and preview primer files.
- `primer.open` — Open a primer viewer. Menu use can open the file picker; API/agent callers should pass filePath. Optional: x, y, w, h for position and size.
- `primer.list` — List all available primers with content dimensions. Returns array of {name, lines, width, recommended_w, recommended_h, animated}.
- `primer.picker.open` — Open the shared primer file-browser overlay intentionally so API/agent callers can drive it with overlay.select/confirm/cancel.

### finder

- `finder.open` — Open the file manager browser.
- `finder.search` — Search file contents in the focused Finder window. Args: query (string), glob (string, optional e.g. '*.ts').
- `finder.navigate` — Navigate the focused Finder to a directory. Args: path (string).
- `finder.toggle_view` — Toggle between list and icon view in the focused Finder window.
- `finder.advanced_search` — Semantic/keyword search via QMD in the focused Finder. Args: query (string), mode (lex|vec|hyde, optional). Requires QMD.
- `finder.bookmark_path` — Bookmark the current directory in the focused Finder for quick access.
- `finder.go_to_bookmark` — Navigate to a bookmarked path. Args: name (string).
- `finder.new_folder` — Create a new folder in the current Finder directory.
- `finder.refresh` — Reload the directory listing in the focused Finder.
- `finder.sort_by` — Change sort order. Args: field (name|size|modified|type).
- `finder.edit` — Open inline editor for the selected file. Args: path (optional).
- `finder.save` — Save the currently edited file in the Finder inline editor.
- `finder.yank_contents` — Copy the contents of the selected file to the clipboard.
- `finder.open_external` — Open selected file in Cursor, VS Code, Zed, or Sublime. Args: path (optional).
- `finder.share` — Copy file path or contents to clipboard. Args: mode (path|contents, default: path).
- `finder.export_listing` — Export the current directory tree as markdown. Args: filePath (output path).

### text

- `text.smear` — Run scripts/smear.py on a file-backed text surface. Args: filePath (string, optional; defaults to focused file-backed primer/reader/editor), mode (wipe|shear|glitch|stretch, default wipe), width (number, optional), at/tile/skew/seed/intensity (mode-specific options), openAs (primer|reader, optional). Returns {ok, filePath, windowId, sourcePath, kind, mode}.

### fx

- `fx.glitch` — Glitch a text file. Args: filePath (string), intensity (number 0-1, default 0.5), seed (number, optional). Opens result as primer.
- `fx.shear` — Shear a text file diagonally. Args: filePath (string), skew (number, default 2). Opens result as primer.
- `fx.breed` — Breed two text files at the character level. Args: file1 (string), file2 (string), mode (xor|density|blend|random|interleave, default xor), bias (number 0-1, default 0.5). Opens result as primer.
- `fx.flip` — Flip a text file. Args: filePath (string), direction (v|h|both, default v). Opens result as primer.

### editor

- `editor.open` — Open a text file in the editor. Menu use can open the file picker; API/agent callers should pass filePath or create an unsaved buffer with title/initial.
- `editor.picker.open` — Open the shared text-file browser overlay intentionally so API/agent callers can drive it with overlay.select/confirm/cancel.
- `editor.new` — Open a new empty text editor window.
- `editor.write` — Replace the content of the focused editor window. Args: text (string, required).

### markdown

- `markdown.open` — Open a markdown file with figlet headings and syntax-highlighted code blocks. Menu use can open the markdown picker; API/agent callers should pass filePath.
- `markdown.picker.open` — Open the shared markdown picker intentionally so API/agent callers can drive it with overlay.select/confirm/cancel.
- `markdown.toggle_figlet` — Toggle figlet/plain heading rendering in the focused markdown viewer.

### window

- `window.export_text` — Export a window's text content to scratch/captures/. Args: id (number, window id), name (string, optional label). Without args exports the focused window.
- `window.close` — Close a window by id. Args: { id: number }
- `window.set_chrome` — Set window chrome mode. Args: { id: number, mode: 'standard' | 'none' }. Mode 'none' removes all borders, title bar, and shadow — pure floating content.
- `window.focus` — Focus a window by id. Args: { id: number }
- `window.move` — Move a window by id. Args: { id: number, left: number, top: number }
- `window.resize` — Resize a window by id. Args: { id: number, width: number, height: number }
- `window.tile` — Arrange all windows in a tiled grid layout.
- `window.cascade` — Arrange all windows in a cascading stack layout.
- `window.toggle_maximize` — Maximize a window or restore it. Args: windowId (number, optional — defaults to focused window).

### web-reader

- `web-reader.open` — Open a Chrome browser window for web content extraction. Args: url (string, optional). Without args opens to default page.

### agent

- `agent.open` — Open (or focus) the native Wib&Wob Agent chat window.
- `agent.send` — Send a text message to the Wib&Wob agent chat. Args: text (string, required).
- `agent.reload_prompt` — Re-read system prompt files from disk and hot-swap into the running agent session. No restart needed.

### microapps

- `microapps.reload` — Reload dynamic microapp modules from disk without restarting the shell.

### theme

- `theme.cycle` — Cycle to the next theme variant.
- `theme.choose` — Open an interactive theme picker.
- `theme.set` — Set theme by name. Args: name (wibwob-dark, wibwob-dark-nord, wibwob-dark-pastel, wibwob-phosphor, wibwob-light).

### desktop

- `desktop.clear-all` — Emergency escape hatch: cancel active overlays, close menus, and close all non-agent windows. Pass all=true to nuke every window.
- `desktop.toggle_chrome` — Hide/show the top menu bar and bottom status bar. Turns the desktop into a clean canvas — useful for screensaver/display mode. Right-click desktop to toggle.

### menu

- `menu.close` — Close any open dropdown menu (File, Edit, View, etc.) or popup context menu.

### overlay

- `overlay.confirm` — Confirm the active modal overlay (equivalent to OK/Enter). Returns ok:false if no overlay is active.
- `overlay.cancel` — Cancel the active modal overlay (equivalent to Cancel/Escape). Returns ok:false if no overlay is active.
- `overlay.select` — Select an item index in the active overlay when supported (browser/list/file-browser). Args: index (number).
- `overlay.info` — Check if a modal overlay is active and its type. Returns { active: true/false, type? }.

### backrooms

- `backrooms.open` — Open Backrooms TV with an interactive channel picker.
- `backrooms.picker.info` — Inspect Backrooms primer picker state (active, selected index, selected primers).
- `backrooms.picker.select` — Select an index in Backrooms primer picker. Args: index (number).
- `backrooms.picker.confirm` — Confirm Backrooms primer picker and continue to run options prompts.
- `backrooms.picker.cancel` — Cancel and close Backrooms primer picker.

### primer-gallery

- `primer-gallery.open` — Open the primer gallery with tabbed categories and preview.

### document

- `document.open` — Open a local file in the document reader. Args: filePath (string). Without args opens the default document.

### terrain-lab

- `terrain-lab.open` — Contour map with info panel — demonstrates composable ContourPlayer embedding.

### music-player

- `music-player.open` — Open the music player. Pass filePath to auto-load a track.

### companion

- `companion.open` — Open Scramble the cat as a full floating window.
- `companion.smol` — Open Scramble as a smol popup anchored to the bottom-right corner.

### scramble

- `scramble.say` — Send a message to Scramble. Args: { text: string }
- `scramble.expand` — Toggle Scramble popup between smol and tall.
- `scramble.pop-out` — Pop Scramble out of smol/tall popup into a full floating window.
- `scramble.pet` — Pet Scramble (/pet slash command — she allows it).
- `scramble.sleep` — Put Scramble to sleep (/sleep — silences idle quips).
- `scramble.wake` — Wake Scramble up (/wake — re-enables responses).
- `scramble.meow` — Make Scramble meow (/meow — no LLM call).

### workspace

- `workspace.manage` — Open the workspace manager for saving and loading desktop layouts.
- `workspace.save` — Save the current workspace. Args: name (string). Without args saves to 'default'.
- `workspace.load_named` — Load a named workspace. Args: name (string). Without args loads 'default'.

### palette

- `palette.open` — Open the command palette for quick command access.

### inspector

- `inspector.open` — Open the live desktop state inspector.

### canvas

- `canvas.load` — Load a .canvas.yaml document. Args: filePath (string, absolute path to .canvas.yaml file).
- `canvas.export` — Export current desktop to a .canvas.yaml file. Args: filePath (string), title (string, optional).

### ghostty

- `ghostty.shader.set` — Activate a Ghostty GPU shader by name, or 'off' to disable. Available: wibwob-crt, wibwob-glow, wibwob-nord-tint. Requires Ghostty terminal.
- `ghostty.shader.list` — List available Ghostty shaders.
- `ghostty.shader.status` — Show current Ghostty shader state.
