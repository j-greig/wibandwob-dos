# WibWob-DOS Feature Parity Matrix

> **TV** = Turbo Vision C++ version (`wibandwob-dos-last-days-of-tvision`)  
> **TS** = TypeScript Bun/blessed port (`wibandwob-dos/src`)  
> Generated: 2026-03-05

## Status Key

| Symbol | Meaning |
|--------|---------|
| ✅ | Fully implemented |
| 🟡 | Partially implemented or simplified |
| ❌ | Not yet ported |
| 🆕 | New in TS — not present in TV |

---

## 1. Window Types

### Content Viewers

| Feature | TV | TS | Notes |
|---------|----|----|-------|
| Frame Player (animated .txt) | ✅ `frame_player` | ✅ Primer Viewer (multi-frame) | TS uses `# frame N` markers instead of `----` delimiters |
| Transparent Text View | ✅ `text_view` | 🟡 Primer Viewer | TS viewer is opaque, no transparent background compositing |
| Text Editor | ✅ `text_editor` | ✅ Text Editor | TS is custom-built, has save/save-as/dirty indicator |
| FIGlet Typography | ✅ `figlet_text` | ✅ FIGlet Banner | Both shell out to `figlet` CLI, 100+ fonts |
| FIGlet Frameless Mode | ✅ `TGhostFrame` | ❌ | No frameless/shadowless floating typography |
| FIGlet Edit Text / Right-Click | ✅ Context menu | 🟡 Toolbar buttons | TS uses toolbar `[E]`/`[F]` instead of context menu |
| Document Reader | ❌ | ✅ `reader-viewer` | 🆕 TS has dedicated read-only viewer for markdown/text |
| Monodraw `.monojson` Import | ✅ Parser + viewer | ❌ | |
| Image → ASCII Conversion | ✅ `stb_image.h` + converter | ❌ | |

### Generative Art / Animation

| Feature | TV | TS | Notes |
|---------|----|----|-------|
| Animated Blocks | ✅ `blocks` 24fps | ❌ | Zigzag block chars, even/odd row shift |
| Animated Gradient | ✅ `animated_gradient` 10fps | ❌ | Horizontally flowing colour gradient |
| Animated Score | ✅ `score` 8fps | ❌ | Musical notation Unicode glyphs with breathing/drift |
| Animated ASCII (multi-layer) | ✅ `ascii` 8fps | ❌ | 8 classified layers moving independently |
| Verse Field | ✅ `verse` 20fps | 🟡 Generative Art | TS has simplified 3-wave sine field at 10fps. TV has 3 modes (Flow/Swirl/Weave), cyclic palettes, key controls |
| Mycelium Field | ✅ `mycelium` 18fps | ❌ | Curl-noise organic branching |
| Orbit Field | ✅ `orbit` 20fps | ❌ | Rotating point attractors with 1/r² influence |
| Torus (Donut) | ✅ `torus` 25fps | ❌ | Classic z-buffer ASCII donut with rotation |
| Cube Spinner | ✅ `cube` 22fps | ❌ | Wireframe 3D cube, perspective projection |
| Game of Life | ✅ `life` 2.5fps | ❌ | Sparse-grid Conway's with auto-reseed |
| Monster Verse | ✅ `monster_verse` 17fps | ❌ | Verse field with emoji monster glyphs |
| Monster Portal | ✅ `monster_portal` 11fps | ❌ | 4-episode narrative arc, per-cell 0.2Hz updates |
| Monster Cam | ✅ `monster_cam` | ✅ Monster Cam | Both use Python worker + Unix socket. TS adds hand/pose detection |
| Contour Map (Python) | ✅ `contour_map` (Python subprocess) | ✅ Contour Studio | TS is pure TypeScript (no Python), has marching-squares, 3 modes |
| Generative Lab (Python) | ✅ `generative_lab` (10 presets) | ❌ | Coral, crystal, tidal, erosion, aurora, spiral-life, etc. |
| Test Pattern | ✅ `test_pattern` | ❌ | CGA palette diagnostic grid |
| Static Gradients (4 types) | ✅ `gradient` (H/V/radial/diagonal) | ❌ | |
| Pattern Field | ❌ | ✅ `pattern-animation` | 🆕 `░▒▓█` diagonal wave |
| Plasma Screensaver | ❌ | ✅ `plasma` | 🆕 8 moods, 3 render modes, primer-smear |
| Terrain Lab | ❌ | ✅ `terrain-lab` | 🆕 Contour + info panel, composable demo |
| Contour Triptych | 🟡 (Python triptych mode) | ✅ `contour-triptych` | 🆕 3 synchronised TS contour players |

### Games

| Feature | TV | TS | Notes |
|---------|----|----|-------|
| Quadra (Tetris) | ✅ Full implementation | ❌ | 10×20, bag randomiser, scoring, levels |
| Snake | ✅ Full implementation | ❌ | Speed scaling, food sparkle, death flash |
| WibWob Rogue | ✅ Full dungeon crawler | ❌ | Procedural dungeons, creatures, items, hackable terminals |
| Deep Signal | ✅ Full space scanner | ❌ | FOV cone, fuel, signal puzzles, anomalies |
| Micropolis (SimCity) | ✅ Full sim engine | ❌ | ASCII city builder, all zone types, 4 speeds, save slots |

### Communication / AI

| Feature | TV | TS | Notes |
|---------|----|----|-------|
| AI Chat Window | ✅ `wibwob` (Claude SDK bridge) | ✅ Wib&Wob Agent | TS is more advanced: pi-agent-core, 26+ tools, jailed coding tools, session persistence, slash commands |
| Scramble Cat (companion) | ✅ 3 poses + LLM brain + speech bubble | 🟡 4 moods, no LLM | TV has Haiku LLM integration, slash commands, smol/tall modes. TS is purely decorative animation |
| Room Chat (multiplayer) | ✅ PartyKit integration | ❌ | Multi-user chat room with participant strip |
| Scramble Message History | ✅ `TScrambleMessageView` (tall mode) | ❌ | Scrollable chat log with Scramble |

### Browsers / Utilities

| Feature | TV | TS | Notes |
|---------|----|----|-------|
| ASCII Gallery | ✅ 6-tab + preview + Open | ✅ Primer Gallery | TS has tabbed + filterable + live preview. Comparable coverage |
| Primer Browser | ✅ (via Gallery) | ✅ Primer Browser | TS has a simpler single-pane list too |
| App Launcher | ✅ Grid with categories | ❌ | macOS Finder-style icon grid |
| Web Browser | ✅ `browser` (text fetch) | ✅ Chrome Browser | TS uses real Puppeteer/CDP + Readability. More capable |
| Terminal (PTY) | ✅ `terminal` (tvterm/libvterm) | ❌ | Full PTY terminal emulator. TS has `@skitee3000/bun-pty` but unused |
| File Manager | ❌ | ✅ `farjs-file-manager` | 🆕 Full file manager with search, bookmarks, QMD |
| Backrooms TV | ✅ (Python subprocess) | ✅ Backrooms TV | Both spawn CLI. TS adds fake-live/playback fallbacks |
| Backrooms Config Dialog | ✅ 3-column picker | 🟡 Primer Picker + prompts | TV has a richer single-dialog UX. TS uses separate picker + text prompts |
| Backrooms Log Browser | ❌ | ✅ `backrooms-log-browser` | 🆕 Two-pane log explorer with replay/snippet |

### Diagnostic / System

| Feature | TV | TS | Notes |
|---------|----|----|-------|
| Command Palette | ❌ (no fuzzy-search UI) | ✅ Command Palette | 🆕 ~45 commands in searchable list |
| State Inspector | ❌ | ✅ State Inspector | 🆕 Live JSON desktop state viewer |
| Workspace Manager | ✅ (dialog with preview) | ✅ Workspace Manager | TV has miniature ASCII wireframe preview. TS is an action list |
| Music Player | ❌ | ✅ Music Player | 🆕 WinAMP-style with afplay/ffplay |

---

## 2. Desktop Management

| Feature | TV | TS | Notes |
|---------|----|----|-------|
| Custom Desktop Background | ✅ 9 presets, CGA + RGB | 🟡 Theme-based fill char | TV has rich pattern/colour presets. TS uses theme tokens |
| Gallery Mode (hide chrome) | ✅ Hides menu/status | ❌ | Clean screenshot mode |
| Theme System | 🟡 Light/Dark × Mono/Pastel | ✅ 5 variants + dynamic loading | TS is more advanced with semantic tokens and live switching |
| Cascade | ✅ | ✅ | |
| Tile | ✅ | ✅ | |
| Close All | ✅ | ❌ | Iterate and close all windows |
| Send to Back | ✅ | ❌ | Z-order manipulation |
| Focus Next/Previous | ✅ F6/Shift-F6 | ✅ | |
| Drag Windows | ✅ Native TV | ✅ Custom blessed | |
| Resize Windows | ✅ Native TV | ✅ Shift+Arrow + API | |
| Double-Click Maximize | ❌ | ✅ | 🆕 Toggle maximize on titlebar double-click |
| Workspace Save/Load | ✅ With recent list | ✅ With default auto-restore | |
| Workspace Preview | ✅ ASCII wireframe miniature | ❌ | |
| Workspace Recent Submenu | ✅ Last 5 in File menu | ❌ | |
| Pattern Mode (continuous/tiled) | ✅ Desktop pattern rendering | ❌ | |

---

## 3. Agent / AI System

| Feature | TV | TS | Notes |
|---------|----|----|-------|
| LLM Provider Abstraction | ✅ `ILLMProvider` (3 backends) | ✅ pi-agent-core | Different architecture. TS uses pi framework |
| Claude Code SDK Bridge | ✅ Node.js subprocess | ❌ (uses pi-agent-core directly) | Different approach — TS is more native |
| MCP Tool Server | ✅ 2 tools (list + run commands) | ✅ 19+ TUI tools + 7 coding tools | TS far more capable |
| Streaming Chat | ✅ | ✅ | |
| Session Persistence | 🟡 (SDK session ID) | ✅ Full session manager | TS has save/resume/list |
| Slash Commands | ✅ (Scramble only) | ✅ (12 slash commands) | TS has rich slash command set |
| Desktop State Injection | ❌ | ✅ transformContext | 🆕 Agent sees desktop state every turn |
| Jailed Coding Tools | ❌ | ✅ 7 tools (read/write/edit/bash/grep/find/ls) | 🆕 |
| Pi Session Bridge | ❌ | ✅ Full client + server | 🆕 Peer network with other pi sessions |
| Web Search Tools | ❌ | ✅ Brave + Chrome + YouTube | 🆕 |
| Tool Result Rendering | ❌ | ✅ Compact one-line summaries | 🆕 |

---

## 4. Paint System

| Feature | TV | TS | Notes |
|---------|----|----|-------|
| Paint Canvas | ✅ Full implementation | ❌ | |
| 5 Pixel Modes (Full/HalfY/HalfX/Quarter/Text) | ✅ | ❌ | Subpixel resolution modes |
| Tools (Pencil/Eraser/Line/Rect/Text) | ✅ | ❌ | |
| 16-Colour CGA Palette | ✅ | ❌ | |
| FIGlet Stamp (paint text as art) | ✅ | ❌ | |
| `.wwp` JSON Save/Load | ✅ | ❌ | |
| Full IPC Remote Paint API | ✅ 10 commands | ❌ | |

---

## 5. Network / API

| Feature | TV | TS | Notes |
|---------|----|----|-------|
| IPC Protocol | ✅ Unix socket, line-oriented | ✅ HTTP REST (Bun.serve) | Different approach. TS is HTTP |
| HMAC Auth | ✅ Challenge-response | ❌ | |
| Event Push / WebSocket | ✅ Subscriber connections | ❌ | |
| FastAPI Bridge | ✅ Python HTTP→IPC | N/A | TS has direct HTTP, no bridge needed |
| PartyKit Multiplayer | ✅ State sync + chat | ❌ | |
| MCP Endpoint | ✅ via FastAPI | ❌ (tools are internal) | TS tools are native, not exposed as MCP |
| OpenAPI Spec | ❌ | ✅ `/openapi.json` | 🆕 |
| Structured Help | ❌ | ✅ `GET /help` | 🆕 |
| Batch Window Operations | ❌ | ✅ `POST /windows/batch` | 🆕 |

---

## 6. Content Systems

| Feature | TV | TS | Notes |
|---------|----|----|-------|
| Primer Discovery | ✅ `findPrimerDir()` | ✅ `ContentService` | TS scans modules/modules-private |
| Frame Delimiter | `----` lines | `# frame N` comments | Different format |
| FIGlet Font Catalogue | ✅ Category submenus | ✅ `fonts.json` catalogue | |
| FIGlet sendText → Editor | ✅ Renders FIGlet into editor | ❌ | |
| Module Primer Sync | ✅ Symlink at startup | ✅ Built into ContentService | |
| Content Measurement | ❌ (inline sizing) | ✅ Dedicated service | 🆕 Unicode-aware, chrome-separated |
| Clipboard Read | ✅ `pbpaste`/`xclip` | ❌ | |

---

## 7. Backrooms

| Feature | TV | TS | Notes |
|---------|----|----|-------|
| Live LLM Streaming | ✅ | ✅ | |
| Config Dialog (3-column) | ✅ Available/Preview/Selected | 🟡 Separate picker + prompts | TV has richer single-dialog UX |
| Custom Primers (paste + `---` split) | ✅ | ❌ | |
| Fake-Live Replay Mode | ❌ | ✅ | 🆕 30ms/line log replay |
| Playback Fallback | ❌ | ✅ | 🆕 Auto-fallback on timeout |
| Log Browser | ❌ | ✅ | 🆕 Two-pane with replay/snippet |
| Run Root Isolation | ❌ | ✅ | 🆕 Per-run directory |
| Session Log | ✅ `exports/bktv_*.txt` | ✅ `logs/backrooms-tv/*.txt` | |
| Keyboard Controls (Space/N/Q) | ✅ | ✅ | |
| 500-line Ring Buffer | ✅ | ✅ (via widget scroll) | |

---

## 8. Unique to TV (Not Yet Ported)

These features exist only in the C++ Turbo Vision version:

| Feature | Priority | Complexity | Notes |
|---------|----------|------------|-------|
| **5 Games** (Quadra, Snake, Rogue, Deep Signal, Micropolis) | High | High | Flagship interactive content |
| **Paint Canvas** (5 pixel modes, full tool set, `.wwp` format) | High | High | Major creative tool |
| **13 Generative Art Views** (Verse modes, Mycelium, Orbit, Torus, Cube, Life, Blocks, Score, ASCII, Monster Verse, Monster Portal, Generative Lab) | High | Medium-High | Core visual identity |
| **Terminal Emulator** (tvterm/libvterm PTY) | Medium | High | Full terminal in a window |
| **Room Chat** (PartyKit multiplayer) | Medium | Medium | Multi-user communication |
| **Scramble LLM Brain** (Haiku integration, slash commands) | Medium | Medium | Cat companion AI |
| **App Launcher Grid** | Low | Low | Nice-to-have UI |
| **Frameless FIGlet** (TGhostFrame) | Low | Low | Floating typography |
| **Gallery Mode** (hide all chrome) | Low | Low | Screenshot support |
| **Workspace Preview** (ASCII wireframe) | Low | Low | Nice manage dialog feature |
| **Desktop Presets** (9 named bg patterns) | Low | Low | Background customisation |
| **HMAC Socket Auth** | Low | Low | Security feature |
| **Event Push / WebSocket** | Medium | Medium | Real-time state streaming |
| **Image → ASCII** | Low | Medium | Image import |
| **Monodraw Import** | Low | Low | `.monojson` parser |
| **Glitch Engine** (post-process effects) | Low | Medium | Screen-level effects |
| **Custom Primer Paste** (Backrooms `---` split) | Low | Low | UX convenience |
| **Close All Windows** | Low | Low | One command |
| **Send to Back** | Low | Low | Z-order command |
| **Clipboard Read** | Low | Low | Paste support |
| **Pattern Mode** (continuous/tiled) | Low | Low | Desktop rendering |
| **Recent Workspaces** submenu | Low | Low | File menu addition |

---

## 9. Unique to TS (New Capabilities)

These features exist only in the TypeScript version and were never in the C++ version:

| Feature | Notes |
|---------|-------|
| **Plasma Screensaver** (8 moods, 3 render modes, primer-smear) | Major new art window |
| **Contour Studio** (pure TS, marching-squares, seeded PRNG) | Replaces Python contour subprocess |
| **Terrain Lab** (composable contour + info panel) | Composable UI demo |
| **Contour Triptych** (3 synchronised panels) | Layout composition |
| **Pattern Field** (`░▒▓█` diagonal wave) | Simple but distinctive |
| **Music Player** (WinAMP-style, afplay/ffplay) | Audio playback |
| **VJ Timeline System** (declarative beat-synced cue scheduling) | Major creative tool |
| **Command Palette** (~45 searchable commands) | Productivity feature |
| **State Inspector** (live JSON viewer) | Debug tool |
| **File Manager** (ripgrep search, QMD semantic search, bookmarks) | Full file browser |
| **Document Reader** (read-only text/markdown viewer) | Content viewer |
| **Backrooms Log Browser** (two-pane, replay, snippet) | Backrooms tooling |
| **Backrooms Fake-Live / Playback Modes** | Offline resilience |
| **Chrome Browser** (real Puppeteer CDP + Readability) | Upgraded from text-only fetch |
| **Brave Search API** | Web search without browser |
| **YouTube Transcript** | Video content extraction |
| **Pi Session Bridge** (peer network) | Agent mesh networking |
| **Jailed Coding Tools** (read/write/edit/bash/grep/find/ls) | Agent development tools |
| **Desktop State Injection** (transformContext) | Agent awareness |
| **Session Persistence / Resume** | Agent session management |
| **Composable UI Parts** (createStack/createColumns/etc.) | Layout engine |
| **Microapp Module System** (drop-in TypeScript modules) | Extensibility |
| **Semantic Theme Tokens** (5 themes + dynamic loading) | Advanced theming |
| **Double-Click Maximize** | Window management |
| **OpenAPI Spec / Structured Help** | API documentation |
| **Batch Window Operations** | API efficiency |
| **Content Measurement Service** | Unicode-aware sizing |
| **Snapshot Registry** (compile-time-checked workspace persistence) | Architecture quality |

---

## 10. Porting Priority Recommendations

### Tier 1 — High Impact, Defines Product Identity

| Feature | Why |
|---------|-----|
| Generative Art Suite (13 views) | The visual identity of WibWob-DOS. Verse, Mycelium, Orbit, Torus, Cube are signature pieces |
| Games (5) | Flagship interactive content. Quadra and Snake are quick wins; Rogue and Micropolis are substantial |
| Paint Canvas | The creative tool. Subpixel modes + remote API make it unique |

### Tier 2 — Important Supporting Features

| Feature | Why |
|---------|-----|
| Scramble LLM Brain | The companion should talk, not just cycle moods |
| Terminal Emulator | PTY in a window enables many workflows |
| Frameless FIGlet | Essential for composed typographic displays |
| Room Chat (PartyKit) | Multi-user features |

### Tier 3 — Nice to Have

| Feature | Why |
|---------|-----|
| App Launcher Grid | Discovery UX |
| Gallery Mode | Screenshot support |
| Workspace Preview | Polish |
| Desktop Presets | Customisation |
| Image/Monodraw Import | Content pipeline |
| Glitch Engine | Post-processing |
| Close All / Send to Back | Window management completeness |
| Recent Workspaces | Convenience |

---

*End of parity matrix.*
