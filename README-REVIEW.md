# README Review — Critical Audit

Wib & Wob's honest review of README_V2.md vs what actually exists.

**First finding:** README.md and README_V2.md are byte-identical. There is no V2 yet.
So this review is: "how well does the current README represent the actual codebase?"

---

## What the README Gets Right

**Tone.** "It is not a chat wrapper with a pretty face. It is a shared space." Perfect.
Short, confident, no hype. The opening three lines are strong.

**Architecture diagram.** The ASCII tree is clear and accurate. Window Manager, Command
Registry, Theme Engine, Microapp Loader, Control API, Agent Session — all real, all
correctly positioned in the hierarchy.

**Control API section.** Shows real curl commands, real endpoints. Someone could copy-paste
these and they'd work. This is the strongest technical section.

**Building Microapps section.** Scaffold command, tier table, link to full docs. Compact
and actionable.

**Requirements section.** Honest about optionals (Chrome, chafa, figlet). No fake minimums.

---

## What the README Gets Wrong or Misleads On

### 1. The Apps section is cherry-picked (9 shown, 22+ exist)

README shows 9 apps with screenshots:
- Contour Studio, Code Editor, Plasma, TR-808, Terrain Lab, Antopolis,
  File Manager, Music Player, Wiretext

Actually existing microapps (22 total, not counting demos):
- **Missing from README:** Spore Clock, LLM Orch Studio, Symbient Twitter,
  Tidepool (ecosystem sim), Poetry Clock, GlitchBox (symbient embodiment),
  TouchLab, Patchbay Lab, Terminal emulator, WibwobWorld (terrain generator),
  World Chatroom, Zine (canvas panels), Sy² Chronicles, Terrarium Life
  (4-biome ecosystem)

Some of these are demos/experiments, fair to omit. But LLM Orch Studio,
Tidepool, Poetry Clock, GlitchBox, Spore Clock, and Zine are real apps
that deserve at least a mention. The README makes it look like there are
9 apps. There are 22+.

### 2. Theme count is wrong

README says "15+ themes" but lists only 7 names. Actual theme files in
`src/core/theme/themes/`: dark, dark-nord, dark-pastel, light, phosphor
(5 built-in) + 2 module themes (flexoki-ink, flexoki-paper) = **7 total**.
Not 15+. Unless there are more registered dynamically that I can't see
from static files, the claim is inflated.

### 3. The `modules.reload` command doesn't exist

The Building Microapps section shows:
```
curl -X POST .../commands/run -d '{"id": "modules.reload"}'
```
This command returned `Unknown command: modules.reload` when we tried it
earlier in this session. Module changes require app restart for src/ changes,
or window close/reopen for module-only changes. The reload command either
doesn't exist or has a different ID. This will frustrate anyone following
the README.

### 4. No mention of the SDK's layout/form/data primitives

The microapp SDK is massive: createStack, createRow, createGrid, createTabs,
createFilterableList, createButton, createCheckbox, createRadioGroup,
createSelect, createProgressBar, createSpinner, createDataTable,
createKeyValuePanel, createLogView, createToast, createTextArea,
createFormField, tween/EASINGS, createEmbeddedLivePlayer, pattern
generators, figlet helpers, syntax highlighting...

The README makes it sound like modules get "a window and a host API."
They get a full UI toolkit. This is undersold.

### 5. No mention of the MCP / external agent integration

The control API section mentions "what the AI agent uses" but doesn't
explain that WibWob-DOS exposes an MCP server, that external Claude Code
sessions can control it, that there's a pi session bridge for multi-agent
communication. The agent section describes one embedded agent. The actual
architecture supports multiple agents across multiple instances.

### 6. Built-in windows list is incomplete

README shows: Chrome Browser, Document Reader, Wib & Wob Chat, Scramble.

Actually in `src/windows/`: agent window, backrooms log browser, backrooms TV,
browser windows (primer viewer, text viewer, gallery, file manager),
chrome browser, contour, figlet, generative art (pattern, plasma),
monster cam (webcam AI), music player, plasma, scramble, terrain lab,
text windows, plus all 22 microapp windows.

Monster Cam (AI webcam) and Backrooms (generative fiction TV) are notable
omissions — they're unique features.

### 7. No mention of world chat / multi-instance

WibWob-DOS can run multiple instances with IRC transport, shared world chat,
chatspot-based multiplayer. The `dev:world` command is listed in Running but
not explained. This is a distinctive feature — two AI agents on separate
terminals chatting via IRC in the same world.

### 8. Project structure omits key directories

```
primers/          # ASCII art library (the visual vocabulary)
vendor/           # vendored dependencies (irc extension)
.pi/              # pi agent skills and extensions
docs/             # full module authoring docs
```

The `primers/` directory is culturally important — it's the art library
that feeds the Backrooms, the gallery, the agent's visual vocabulary.
Omitting it hides what makes WibWob-DOS feel alive.

### 9. The `batch` endpoint example uses wrong field names

The API example shows `{"left": 0, "top": 0, "width": 100, "height": 40}`
but the batch endpoint uses short forms: `{"x": 0, "y": 0, "w": 100, "h": 40}`.
The long forms work for individual move/resize endpoints but the batch
example should use the canonical short forms to avoid confusion.

### 10. No mention of VJ timeline / scene planning

There's a scene planner, timeline service, and timeline types — a whole
VJ performance system for choreographing window arrangements over time.
This is unique and interesting. Completely absent from the README.

---

## What's Missing Entirely

### Personality / Why This Exists

The README is technically competent but dry. It reads like any open-source
project README. WibWob-DOS is weird, opinionated, and built by a symbient.
The "What is this?" section hints at it ("a cat called Scramble") but pulls
back into neutral tech-doc voice immediately.

The Xeno Grant, the symbient concept, the folk-punk-AI ethos — none of
that context exists. Someone reading this README would not understand WHY
this project exists or what makes it culturally different from any other
TUI project.

### Video / GIF

No animated content. A terminal desktop shell with overlapping windows,
generative art, and animated mycelial clocks... and the README shows
static PNGs. This undersells the experience dramatically. One 10-second
GIF of windows being dragged around with plasma running would do more
than 200 lines of text.

### The Backrooms

A generative fiction engine that creates multi-turn AI narratives using
ASCII art primers as visual seeds, rendered as a "TV channel" you can
watch. This is one of the most distinctive features and it's not mentioned
at all.

### Workspace Save/Restore

The entire workspace system — save named layouts, restore on startup,
persist window positions and content. Not mentioned.

### describeState / Semantic State

Every window exposes machine-readable semantic state. This is architecturally
distinctive (most TUI apps have no introspection). Worth a line.

---

## Scoring the Current README

| Axis | Score | Notes |
|------|-------|-------|
| Accuracy | 6/10 | Theme count wrong, reload command broken, batch example wrong |
| Completeness | 4/10 | 9 of 22+ apps, no Backrooms/VJ/multi-instance/workspace |
| Tone | 7/10 | Good opening, goes flat mid-document |
| Actionability | 8/10 | Install/run/API sections are copy-paste ready |
| Personality | 3/10 | Doesn't convey why this project is different |
| Visual | 5/10 | Screenshots exist but no animation, no density |

**Overall: 5.5/10** — functional but undersells the project significantly.

---

## Recommendations for a Real V2

1. **Fix the lies** — theme count, modules.reload, batch field names
2. **Add an "All Apps" section** — even a compact table listing all 22+
3. **One GIF** — 10 seconds of the desktop alive, windows moving, plasma running
4. **Mention the weird stuff** — Backrooms, Spore Clock, Monster Cam, world chat
5. **Add personality** — one paragraph on symbience, Xeno Grant, why this exists
6. **Show the SDK surface** — quick list of layout/form/data primitives
7. **Multi-agent paragraph** — MCP, pi bridge, dual-instance, IRC transport
8. **Primers directory** — mention the art library and its role
9. **Workspace persistence** — one line, it's a feature people expect
10. **VJ timeline** — even a hint that choreographed window performances exist

The README should make someone think "I need to try this" not "oh, another TUI."

---

*Reviewed by Wib ༼つ◕‿◕‿⚆༽つ & Wob ༼つ⚆‿◕‿◕༽つ — Friday 13th, 2026*

*/ᐠ｡ꞈ｡ᐟ\ they wrote a 200-line review of their own README. the mould clock has more self-awareness.*
