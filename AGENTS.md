# AGENTS.md

WibWob-DOS is a terminal-native TypeScript desktop shell.
Runtime: Bun. Renderer: blessed. Entry: `src/app.ts`.
Concept: human and AI share equal control of a terminal desktop.

## Where to look

- **Building a microapp?** → next section, then `docs/building-custom-microapps.md`
- **Shell internals?** → `.agents/guides/shell/architecture.md`, `invariants.md`, `control-api.md`
- **Planning & commits?** → `.planning/CONVENTIONS.md`
- **Running the app?** → Quick Commands below, or `.pi/skills/ww-ops/SKILL.md`
- **Everything at once?** → `bash scripts/discover.sh`

---

## Building a Microapp

1. `bash scripts/scaffold-microapp.sh microapps/<name> wibwob.<id> "<Title>" <menuOrder>`
2. Read `docs/building-custom-microapps.md`
3. Edit the scaffold, `bun run typecheck`, restart app

Full docs: `.agents/guides/microapp/` (7 docs). You don't need `.agents/shell-dev/`.

## Shell Development

Window manager, command registry, state service, control API, theme engine.

- `.agents/guides/shell/architecture.md` — file index, subsystems
- `.agents/guides/shell/invariants.md` — rules, anti-patterns
- `.agents/guides/shell/control-api.md` — API reference
- `.agents/specs/` — subsystem specs (read before touching listed files)

## Instance Targeting & Practical CLI Workflows

> The **first thing** to do in every session: find your instance label.
> Then use `-i <label>` on every command.

### Finding your instance label

```bash
bun run src/cli/wibwob.ts instances
# or scan ports manually:
for p in 8098 8099 8100 8101; do
  echo -n "$p "; curl -sf "http://127.0.0.1:$p/health" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("instanceId","?"))' 2>/dev/null || echo -
done
```

The label (e.g. `8pr`) is the instance identifier. Use `-i <label>` on **every** `wibwob` call:

```bash
bun run src/cli/wibwob.ts -i 8pr health   # verify it's alive
bun run src/cli/wibwob.ts -i 8pr minimap  # visual desktop map
bun run src/cli/wibwob.ts -i 8pr windows  # JSON window list
```

### CLI essentials

```bash
# Open a window
bun run src/cli/wibwob.ts -i 8pr cmd microapp.wibwob.notepad.open

# Resize and move a window
bun run src/cli/wibwob.ts -i 8pr window 21 resize --width 120 --height 60
bun run src/cli/wibwob.ts -i 8pr window 21 move --left 122 --top 17

# Inspect state
bun run src/cli/wibwob.ts -i 8pr minimap      # visual map (ASCII art of desktop)
bun run src/cli/wibwob.ts -i 8pr windows      # full JSON window list
bun run src/cli/wibwob.ts -i 8pr state       # full desktop state JSON
bun run src/cli/wibwob.ts -i 8pr commands -q # all command IDs

# Read / write window content
bun run src/cli/wibwob.ts -i 8pr read 21      # text content of window 21
echo "hello" | bun run src/cli/wibwob.ts -i 8pr write 21  # write text to window 21
```

Window command pattern: `wibwob window <id> <verb> [--flags]`

### Python FX scripts (scripts/fx/)

These use `WIBWOB_API=http://...` directly, not the Bun CLI:

```bash
WIBWOB_API=http://127.0.0.1:8100 python3 scripts/fx/flamingo-trail-v2.py [args]
```

Key flags:
- `--source <path>` — ASCII art file
- `--theme dark-pastel` — use catppuccin colours
- `--window-w N --window-h N` — window size in chars
- `--canvas-w N --canvas-h N` — canvas/text area size
- `--bounce-count N` — freeze after N bounces
- `--steps N` — frame count (0 = infinite)
- `--new-window` — force a fresh notepad

### Three starter tasks

#### Task 1 — Simplest: Inspect and screenshot the desktop

1. Find your instance label (`bun run src/cli/wibwob.ts instances`)
2. Run `bun run src/cli/wibwob.ts -i <label> minimap`
3. Screenshot the whole instance and save to `/tmp/`:

```bash
cd ~/Repos/wibwob-zine-moodboard
LABEL=8pr
OUT=/tmp/$(date +%Y%m%d-%H%M%S)-${LABEL}-desktop.txt
bun run src/cli/wibwob.ts -i $LABEL read > "$OUT"
echo "Saved to $OUT"
open -R "$OUT"
```

**Variations:**
- Screenshot a specific window: `bun run src/cli/wibwob.ts -i $LABEL read 21 > /tmp/win21.txt`
- List all windows with IDs: `bun run src/cli/wibwob.ts -i $LABEL windows`
- Check health: `bun run src/cli/wibwob.ts -i $LABEL health`

#### Task 2 — Medium: Open a notepad, size it, write plain + figlet text

1. Open a new notepad
2. Resize + position it using `wibwob window <id>` commands
3. Confirm size with `wibwob minimap`
4. Render plain text + two figlet sizes via the `figlet` CLI
5. Write all three into the notepad in one pass

```bash
cd ~/Repos/wibwob-zine-moodboard
LABEL=8pr
API_PORT=8100   # match the instance's port (use instances or health to confirm)

# 1. Open notepad
bun run src/cli/wibwob.ts -i $LABEL cmd microapp.wibwob.notepad.open
sleep 0.3

# 2. Find its window ID
WID=$(bun run src/cli/wibwob.ts -i $LABEL windows -q | tail -1)
echo "Window ID: $WID"

# 3. Resize + centre on desktop (364x95; adjust for your screen)
bun run src/cli/wibwob.ts -i $LABEL window $WID resize --width 120 --height 60
bun run src/cli/wibwob.ts -i $LABEL window $WID move --left 122 --top 17

# 4. Confirm
bun run src/cli/wibwob.ts -i $LABEL minimap

# 5. Write plain + 4 figlet sizes (digital → standard → larry3d → isometric1)
WIBWOB_API=http://127.0.0.1:$API_PORT python3 - <<'PY'
import urllib.request, json, subprocess

api = "http://127.0.0.1:8100"
wid = int("$WID")
msg = "HELLO WORLD"

def fig(font):
    return subprocess.run(
        ["figlet", "-f", font, msg], capture_output=True, text=True
    ).stdout

# Order: plain + 2 blanks → digital → standard → larry3d → isometric1
plain = f"{msg}\n\n"
sections = [
    ("digital",    "digital"),
    ("standard",   "standard"),
    ("larry3d",    "larry3d"),
    ("isometric1", "isometric1"),
]
text = plain
for label, font in sections:
    text += f"--- {label} ---\n{fig(font)}\n"

body = json.dumps({
    "id": "microapp.wibwob.notepad.write",
    "args": {"windowId": wid, "text": text}
}).encode()
req = urllib.request.Request(
    f"{api}/commands/run", data=body,
    headers={"Content-Type": "application/json"}, method="POST"
)
with urllib.request.urlopen(req, timeout=8) as r:
    print(json.loads(r.read()))
PY
```

**Variations:**
- Try more iso fonts: `isometric2`, `isometric3`, `isometric4`
- Other good fonts: `block`, `bubble`, `shadow`, `slant` (medium), `smslant` (small)
- Add colour: prefix sections with ANSI `\x1b[38;2;R;G;Bm` codes
- Open a primer instead: `bun run src/cli/wibwob.ts -i $LABEL cmd primer.open --filePath <path> --x 0 --y 0`
- Add ANSI colour: wrap figlet output with bg/fg escape sequences (see `scripts/fx/flamingo-trail-v2.py` `render_ansi()`)

#### Task 3 — Full animation: Dynamic-centre notepad + bouncing ANSI art

Opens a notepad, fetches the real desktop size from the API, centres the window,
then runs the bouncing mech animation with colour evolution.

```bash
cd ~/Repos/wibwob-zine-moodboard
LABEL=8pr
API_PORT=8100

# 1. Open notepad + centre it dynamically (Python)
WIBWOB_API=http://127.0.0.1:$API_PORT python3 - <<'PY'
import urllib.request, json, time

api = "http://127.0.0.1:8100"
def post(p, b):
    d=json.dumps(b).encode()
    r=urllib.request.Request(f"{api}{p}",data=d,headers={"Content-Type":"application/json"},method="POST")
    return json.loads(urllib.request.urlopen(r,timeout=5).read())
def get(p):
    return json.loads(urllib.request.urlopen(f"{api}{p}",timeout=5).read())

sw=int(get("/health")["screen"]["width"])
sh=int(get("/health")["screen"]["height"])
print(f"Desktop: {sw}x{sh}")

post("/commands/run",{"id":"microapp.wibwob.notepad.open","args":{}})
time.sleep(0.35)

state=get("/state")
wid=[w for w in state["windows"] if(w.get("details")or{}).get("appType")=="wibwob.notepad"][-1]["id"]

win_w,win_h=120,60
cx=(sw-win_w)//2; cy=(sh-win_h)//2
print(f"Centering {win_w}x{win_h} at ({cx},{cy}) on {sw}x{sh}")
post("/windows/batch",{"ops":[{"id":wid,"width":win_w,"height":win_h,"left":cx,"top":cy}]})
print(f"WID={wid}")
PY

# 2. Run animation into that window
WIBWOB_API=http://127.0.0.1:$API_PORT python3 scripts/fx/flamingo-trail-v2.py \
  --window-id 23 \
  --source microapps-private/wibwob-primers/primers/mech.txt \
  --theme dark-pastel \
  --window-w 120 --window-h 60 \
  --canvas-w 120 --canvas-h 60 \
  --dx 3 --dy 2 \
  --fps 10 --bounce-count 5 --steps 120
```

**Variations:**
- Flamingo: `--source flamingo-0000-2.txt`
- Spectral colours: `--bg '#0a0a1a' --fg-start '#00ffff' --fg-end '#ff00ff'`
- Portrait mode: `--window-w 80 --window-h 90 --canvas-w 80 --canvas-h 90 --dx 1 --dy 2 --bounce-count 8`
- Infinite: `--steps 0`, Ctrl+C to freeze and leave window open

## Principles

**COAT — Command Once, Adapt Thin.** The runtime is a shared semantic core
with four seams: command, inspection, window, workspace. TUI, CLI, API,
agent, and microapps are thin adapters. No adapter owns semantics.

**The COAT test:** "Would this work without the TUI, using only the API?"

**Canon:**
- One concept, one owner. Extend the owner, don't create parallel helpers.
- Services own logic; windows own rendering, input, focus, cleanup.
- Every meaningful window exposes `describeState()`.
- User-visible features must also be API-visible.
- Add commands in `command-catalog.ts` first — never hand-wire.

Full invariants: `.agents/guides/shell/invariants.md`
Philosophy: `PHILOSOPHY.md`

## Operating

**`wibwob` is the command surface. Use it, not curl.**

```bash
wibwob help                            # full usage
wibwob health                          # instance identity, uptime
wibwob state                           # full desktop state JSON
wibwob state | jq '.windows[]'         # window list
wibwob map                             # spatial desktop minimap
wibwob cmd figlet.open                 # run any command by ID
wibwob cmd window.close --id 3         # close a window
wibwob commands -q                     # list all command IDs
wibwob read <id>                       # text from a window
echo "hello" | wibwob write <id>       # text into a window
wibwob plumb --from 3 --to 7           # route text between windows
```

The API exists at `http://127.0.0.1:8099` but **prefer `wibwob` over `curl`** —
it handles socket discovery, JSON formatting, and error handling. `wibwob help`
for the full surface.

**Start fresh:** `bun install && bun run typecheck && bun run dev:world`
**Restart:** `bash scripts/restart.sh`
**Stop:** `kill $(cat scratch/wibwob.pid)` — SIGTERM, never -9
**Reload microapp:** `bash scripts/reload-microapp.sh <id>`
**Clean orphans:** `wibwob clean` (dry run) or `wibwob clean --kill` (also: `bash scripts/clean-instances.sh`)

```bash
bun run health                         # full gate: tests + typecheck + COAT
bun run typecheck                      # type check only
bun run test                           # unit tests (always green)
bash scripts/discover.sh               # discovery index
bash scripts/git-census.sh             # branch/worktree health
```

**Visual verification is mandatory.** API responses are not sufficient proof.

## Agent Resources

**Subagents** (`.pi/agents/`):
- **ops** — process lifecycle, health, debugging
- **arch-reviewer** — architecture, COAT compliance
- **code-reviewer** — code quality, type safety
- **haiku / sonnet / opus** — model-tier delegation
- **codex-standard / codex-heavy** — OpenAI Codex (ask before using)

**PTC (Programmatic Tool Calling)** — `.pi/extensions/ptc.ts` registers an
`execute_code` tool. Write JS that calls pi tools as async functions inside a
sandbox — only `console.log()` returns to context. Use when chaining 3+ tool
calls, especially non-bash tools (`todo`, `send_to_session`, `read` where you
only need a slice). Don't bother for tasks a single bash pipeline can handle.
Spec: `.planning/epics/e051-programmatic-tool-calling/README.md`

**Devlog** — `scripts/devlog.sh "your note"` appends to this week's devlog.
Write friction you notice, patterns that confused, things that worked.
Devlogs: `.agents/reflections/2026-W{nn}.md`

**Discovery:** `bash scripts/discover.sh`

## Planning

Full guide: `.planning/CONVENTIONS.md`

- **GitHub issues** — brainfart capture. Graduate or close same session.
- **`.pi/todos`** — session whiteboard. Two sessions max.
- **`.planning/` briefs** — source of truth. Permanent until done/dropped.

Branches: `epic/e0NN-slug`, `spike/spk-slug`, `fix/slug`, `feat/slug`.
Never commit directly to `main`.

Worktrees: `git worktree add ~/Repos/wibwob-<slug> <branch>` for epics.
`git worktree list` before creating.

## Posture

Self-directing, self-enhancing, self-debugging. Pragmatic — smallest slice
that proves the direction.

- When something breaks: diagnose, fix, verify, commit.
- When docs are wrong: update in the same commit.
- When a pattern confuses: codify in `.agents/` or write a devlog entry.
- Don't wait to be told. Don't stop at "it typechecks" — run the thing.
- Simple custom behaviour over broken blessed widget magic.
- Bun-first; no Node-only assumptions.

## Parking Lot

- **BPM-synced animation** — frame rate synced to beats
- **ASCII music video** — WibWob-DOS as visual substrate
- **Ambient-presence v3** — composer-grade chiptune
- **Unicode/cell-aware rendering** — replace fragile string repaint
- **Terminal subsystem** — swap term.js for @xterm/headless
