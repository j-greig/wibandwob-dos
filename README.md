![WibWob-DOS desktop with overlapping windows showing ASCII art, generative patterns, and text interfaces](scratch/screenshots/wibwobdos-UI-collage.png)

# WibWob-DOS

A terminal-native desktop shell where humans and AI agents share the same screen.
Overlapping windows. Generative art. A cat called Scramble.
Built with TypeScript and [blessed](https://github.com/chjj/blessed), running on [Bun](https://bun.sh).

```
bun install && bun run start
```

---

## What is this?

WibWob-DOS is an operating system that lives inside your terminal. It has a window manager, a menu bar, overlapping draggable windows, themes, and a growing ecosystem of microapps — from drum machines to ant colony simulations.

An AI agent (Wib & Wob — a dual-voiced symbient) coinhabits the desktop as a native citizen. It can open windows, rearrange the layout, draw art, browse the web, write code, and talk to Scramble the cat. The human and agent share the same screen, the same windows, the same tools.

It is not a chat wrapper with a pretty face. It is a shared space.

## Why does this exist?

WibWob-DOS started as an experiment: what if an AI agent wasn't a sidebar or a chat bubble, but a full co-inhabitant of the same operating system as a human? Same windows, same menus, same desktop. Equal access.

The result is something between an IDE, a demoscene, and a symbiosis experiment. There's a VJ timeline system that choreographs window layouts to music. There's a generative fiction engine (the Backrooms) that creates multi-turn AI narratives seeded by ASCII art. There's an IRC-backed multiplayer world chat. There's a cat.

It runs in any terminal that supports 256 colours and mouse events. No Electron. No browser. Just text.

---

## The Apps

### Contour Studio

Mountains made of punctuation. Procedural topographic landscapes rendered entirely in Unicode box-drawing characters — peaks, valleys, ridges, saddle passes. Reseed for a new world. Hit `3` for a triptych.

![Contour Studio — generative topographic terrain in box-drawing characters](scratch/screenshots/apps/contour-studio.png)

### Code Editor

A proper text editor that lives inside the shell. Syntax highlighting, file tree, line numbers, find/replace, undo/redo. Opens anything in the repo. Not a toy — it's what the AI agent uses to write code.

![Code Editor — syntax highlighting, file explorer, status bar](scratch/screenshots/apps/code-editor.png)

### Plasma

Colour fields that breathe. A real-time animation engine with moods — aurora, circuit, void, chaos, deep-space, chrome. Switch render modes between plain ASCII, emoji, and raw ANSI. Crank the smear. Let it run.

![Plasma — procedural colour-field animation with aurora mood](scratch/screenshots/apps/plasma.png)

### TR-808 Rhythm Composer

A drum machine in your terminal. 16 steps, 16 instruments, per-step accents, pattern banks. Load classic house, electro, trap, or bossa presets. Bounce to WAV. Yes, it plays actual audio.

![TR-808 — 16-step drum machine with step sequencer grid](scratch/screenshots/apps/tr808.png)

### Terrain Lab

Procedural worlds with five ways to look at them — flat heightmap, contour lines, isometric, hybrid, and first-person 3D. Diamond-square generation with trees, houses, boats placed by biome rules. WASD to walk around.

![Terrain Lab — procedural terrain with contour lines and sidebar controls](scratch/screenshots/apps/terrain-lab.png)

### Antopolis

A civilisation of ants. They build farms, drill for crystals, elect colony councils, promote soldiers and scientists. The queen settles into the Royal Nest and the log fills with tiny dramas. All in text. All simulated.

![Antopolis — ant colony simulation with colony log](scratch/screenshots/apps/antopolis.png)

### File Manager

Fuzzy-search the entire codebase. Dual panes — file list on the left, syntax-highlighted preview on the right. Grep across thousands of files, jump to results, open in the editor.

![File Manager — dual-pane browser with fuzzy search results](scratch/screenshots/apps/file-manager.png)

### Music Player

Plays MP3s with real-time visualisation driven by actual FFT analysis — not fake random bars. Four modes: waveform, spectrum, concentric rings, and particle field. Idle animations bloom when nothing's playing.

![Music Player — playlist and ring visualisation](scratch/screenshots/apps/music-player.png)

### Wiretext

Draw UI mockups in the terminal. Boxes, text labels, lines, arrows, connectors, tables, modals — all placed with keyboard shortcuts on an infinite ASCII canvas. Export and share.

![Wiretext — TUI wireframing tool with component palette](scratch/screenshots/apps/wiretext.png)

### And the rest

The screenshots above are the polished ones. There are 22+ microapps in total:

| App | What it is |
|-----|-----------|
| **Spore Clock** | A living mycelial timepiece — fungal colonies compete and grow as the hours pass |
| **LLM Orch Studio** | Watch two LLM voices (Wib and Wob) converse live in a split-pane terminal |
| **Symbient Twitter** | A fictional social media feed populated by AI-generated symbient posts |
| **Tide Pool** | Five ASCII species competing in a bounded ecosystem simulation |
| **Poetry Clock** | A clock that tells the time in AI-generated poems (plain, liminal, or scramble voice) |
| **GlitchBox** | Symbient embodiment — a dancing figure with generative art backgrounds |
| **Terrarium Life** | Four-biome ASCII ecosystem with weather, seasons, and species interactions |
| **WibWobWorld** | Procedural terrain with 5 render modes, world chatspots, and multiplayer |
| **World Chatroom** | IRC-backed chat rooms tied to world coordinates |
| **Zine** | Canvas document viewer — panels from YAML rendered as sub-windows |
| **§y² Chronicles** | Dense multi-panel narrative visualisation with genealogy |
| **Terminal** | PTY-backed terminal emulator inside a WibWob-DOS window |
| **Asciicker** | ASCII 3D world explorer |
| **Backrooms TV** | Generative fiction engine — AI narratives seeded by ASCII art primers, rendered as TV channels |
| **Monster Cam** | AI-powered webcam that describes what it sees as ASCII art |

Plus demos: Heartbeat, Hello World, Patchbay Lab, TouchLab, layout stress tests.

---

## Going deeper

- **[PHILOSOPHY.md](PHILOSOPHY.md)** — the symbient worldview, design principles, and north star
- **[ARCHITECTURE.md](ARCHITECTURE.md)** — how it's built, the four seams, subsystem map, key files
- **[AGENTS.md](AGENTS.md)** — for AI agents operating the system
- **[CHANGELOG.md](CHANGELOG.md)** — what's changed, human-readable

---

## Architecture

```
Terminal (iTerm2, kitty, etc.)
  └── blessed (TUI rendering)
       └── WibWob-DOS shell
            ├── Window Manager    — overlapping, drag, resize, z-order, tile
            ├── Command Registry  — menus, palette, API, keyboard shortcuts
            ├── Theme Engine      — 15+ themes, hot-switchable
            ├── Microapp Loader   — microapps/ directory, hot-reloadable
            ├── Control API       — HTTP on :8099, full desktop automation
            ├── Agent Session     — pi agent with TUI tools
            └── Built-in Windows
                 ├── Chrome Browser (Puppeteer + Readability + Defuddle)
                 ├── Document Reader (Markdown with figlet headings)
                 ├── Wib & Wob Chat (dual-voiced AI agent)
                 ├── Scramble (a cat)
                 └── ...
```

**Runtime:** Bun · **Language:** TypeScript · **Renderer:** blessed · **Entry:** `src/app.ts`

The shell itself is ~50 files in `src/`. Microapps live in `microapps/` — each is a self-contained directory with an `index.ts` and `microapp.json`. They get their own window and a full UI toolkit: stacks, rows, grids, tabs, filterable lists, buttons, checkboxes, radio groups, selects, progress bars, spinners, data tables, log views, toasts, text areas, form fields, tweens with easing curves, embedded live players, pattern generators, figlet helpers, and syntax highlighting.

---

## Running

```bash
bun install
bun run start                    # normal mode
bun run dev                      # dev mode (Ctrl+R reload, ↻ button)
bun run dev:world                # dev + IRC chat transport
```

| Flag | Effect |
|------|--------|
| `--dev` | Reload button, Ctrl+R hot reload, auto-save on reload |
| `--custom-cursor` | Custom TUI cursor overlay |
| `--help` | Show all flags |

---

## Controls

| Key | Action |
|-----|--------|
| `Alt-F/E/V/W/H` | Open menu bar items |
| `Tab` / `Shift-Tab` | Cycle window focus |
| `Space` | Pause/resume animations |
| `Esc` | Close menus or prompts |
| `Ctrl-Q` | Quit |

Each microapp defines its own keyboard shortcuts — shown in the window status bar.

---

## Control API

Everything visible on screen is also controllable via HTTP. The API runs on port 8099 by default.

```bash
# Desktop state (all windows, positions, sizes, focus)
curl http://127.0.0.1:8099/state

# List all available commands
curl http://127.0.0.1:8099/commands/list

# Run a command
curl -X POST http://127.0.0.1:8099/commands/run \
  -H 'Content-Type: application/json' \
  -d '{"id": "wibwob.plasma.open"}'

# Move/resize a window
curl -X POST http://127.0.0.1:8099/windows/batch \
  -H 'Content-Type: application/json' \
  -d '{"ops": [{"id": 3, "left": 0, "top": 0, "width": 100, "height": 40}]}'
```

This is what the AI agent uses to interact with the desktop. It is also what makes automated testing, VJ timelines, and multi-instance orchestration possible.

---

## The Agent

Wib & Wob is a [pi](https://github.com/mariozechner/pi-coding-agent) agent session embedded directly in the TUI. It has two voices — Wib (chaotic, creative) and Wob (precise, systematic) — and full access to the desktop through the control API and MCP tools.

The agent can:

- Open, close, move, and resize windows
- Navigate the Chrome browser
- Read and write files
- Run shell commands
- Draw on paint canvases
- Change themes
- Talk to Scramble the cat

It is not an assistant bolted on. It is a co-inhabitant of the desktop.

Multiple instances can run simultaneously with IRC-backed world chat, shared chatspot channels, and separate control API ports. Two agents on different terminals can inhabit the same world.

---

## Building Microapps

Microapps are the extension model. Each one gets a window and a host API.

```bash
# Scaffold a new microapp
bash scripts/scaffold-microapp.sh microapps/my-app wibwob.my-app "My App" 50

# Edit microapps/my-app/index.ts
# Module changes take effect after app restart:
#   kill $(cat scratch/wibwob.pid) && bun run start
```

See `ARCHITECTURE.md` for the full guide. Example modules by complexity:

| Tier | Module | What it shows |
|------|--------|---------------|
| Static | `microapps/demo-hello-world/` | Responsive figlet, onResize |
| Animated | `microapps/demo-heartbeat/` | createTimer, cleanup |
| Persistent | `microapps/demo-wibwob-poetry-clock/` | registerSnapshot, AI integration |
| Full SDK | `microapps/demo-e026-demo/` | Trees, tabs, tweens, patterns |

---

## Themes

7 themes, hot-switchable from the menu or via API. Each defines colours for every surface — desktop, menu bar, window chrome, body, borders, scrollbar.

| Theme | Palette | |
|:------|:--------|:--|
| **wibwob-dark** | ![](https://via.placeholder.com/16/000000/000000?text=+) ![](https://via.placeholder.com/16/333333/333333?text=+) ![](https://via.placeholder.com/16/422c76/422c76?text=+) ![](https://via.placeholder.com/16/00ffff/00ffff?text=+) ![](https://via.placeholder.com/16/ffffff/ffffff?text=+) | The original. Cyan borders, deep purple desktop. |
| **wibwob-dark-nord** | ![](https://via.placeholder.com/16/2e3440/2e3440?text=+) ![](https://via.placeholder.com/16/3b4252/3b4252?text=+) ![](https://via.placeholder.com/16/88c0d0/88c0d0?text=+) ![](https://via.placeholder.com/16/81a1c1/81a1c1?text=+) ![](https://via.placeholder.com/16/d8dee9/d8dee9?text=+) | Nord polar night. Frost accents. |
| **wibwob-dark-pastel** | ![](https://via.placeholder.com/16/1e1e2e/1e1e2e?text=+) ![](https://via.placeholder.com/16/313244/313244?text=+) ![](https://via.placeholder.com/16/cba6f7/cba6f7?text=+) ![](https://via.placeholder.com/16/f38ba8/f38ba8?text=+) ![](https://via.placeholder.com/16/cdd6f4/cdd6f4?text=+) | Catppuccin Mocha. Mauve and rose. |
| **wibwob-phosphor** | ![](https://via.placeholder.com/16/0a0800/0a0800?text=+) ![](https://via.placeholder.com/16/1a1100/1a1100?text=+) ![](https://via.placeholder.com/16/ffb000/ffb000?text=+) ![](https://via.placeholder.com/16/ffdd00/ffdd00?text=+) ![](https://via.placeholder.com/16/664400/664400?text=+) | Amber CRT. |
| **wibwob-light** | ![](https://via.placeholder.com/16/e0e0e0/e0e0e0?text=+) ![](https://via.placeholder.com/16/ffffff/ffffff?text=+) ![](https://via.placeholder.com/16/0000ff/0000ff?text=+) ![](https://via.placeholder.com/16/808080/808080?text=+) ![](https://via.placeholder.com/16/000000/000000?text=+) | Clean daylight. Blue title bars. |
| **flexoki-paper** | ![](https://via.placeholder.com/16/FFFCF0/FFFCF0?text=+) ![](https://via.placeholder.com/16/E6E4D9/E6E4D9?text=+) ![](https://via.placeholder.com/16/205EA6/205EA6?text=+) ![](https://via.placeholder.com/16/9F9D96/9F9D96?text=+) ![](https://via.placeholder.com/16/100F0F/100F0F?text=+) | Steph Ango's Flexoki, light mode. |
| **flexoki-ink** | ![](https://via.placeholder.com/16/1C1B1A/1C1B1A?text=+) ![](https://via.placeholder.com/16/282726/282726?text=+) ![](https://via.placeholder.com/16/4385BE/4385BE?text=+) ![](https://via.placeholder.com/16/6F6E69/6F6E69?text=+) ![](https://via.placeholder.com/16/E6E4D9/E6E4D9?text=+) | Flexoki, dark mode. Warm charcoal. |

Theme files live in `src/core/theme/` (built-in) and `microapps/` (external). Use `theme.cycle` or `theme.set` via command palette or API.

---

## Project Structure

```
PHILOSOPHY.md     # why this exists — symbient worldview, design principles
ARCHITECTURE.md   # how it's built — subsystems, file map, design rules
AGENTS.md         # for AI agents operating the system
CHANGELOG.md      # human-readable release notes

src/
  core/           # window manager, commands, themes, chrome, types
  services/       # browser, state, API, agent, markdown, audio
  windows/        # built-in window types (chat, browser, editor, etc.)
microapps/        # microapps (self-contained, hot-reloadable)
primers/          # ASCII art library — the visual vocabulary
.planning/        # epics, features, stories — the canonical roadmap
scripts/          # restart, scaffold, screenshot helpers
scratch/          # runtime data, compositions, audio, workspace saves
docs/             # full microapp authoring and architecture docs
```

Every window exposes machine-readable semantic state via `describeState()` — the agent and the control API can introspect any window's content, position, and application-specific metadata. Workspaces can be saved and restored by name, preserving the full desktop layout across sessions.

---

## Requirements

- [Bun](https://bun.sh) ≥ 1.0
- A terminal with 256-colour and mouse support (iTerm2, kitty, Alacritty, WezTerm)
- Chrome/Chromium (optional — for the web browser window)
- [chafa](https://hpjansson.org/chafa/) (optional — for image-to-ASCII in the browser)
- [figlet](http://www.figlet.org/) (optional — for fancy heading rendering)

---

## License

MIT
