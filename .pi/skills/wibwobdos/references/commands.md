# Command Catalog

All commands run via `POST /commands/run {"id":"...","args":{...}}` or
`bash scripts/open.sh <id> [json-args]`.

Live discovery (authoritative — always more current than this file):
```bash
bash scripts/open.sh --list                 # all commands
bash scripts/open.sh --list world           # filter by keyword
bash scripts/open.sh --list art
bash scripts/open.sh --list game
```

---

## World & generative environments

| Command id | Args | What opens |
|---|---|---|
| `microapp.wibwobworld.open` | `{}` | WibWobWorld — 3D isometric terrain with chatspots for multi-agent chat |
| `contour.open` | `{}` | Contour terrain lab (procedural map art) |
| `contour_triptych.open` | `{}` | Three contour panels side by side |
| `terrain_lab.open` | `{}` | Terrain generator with controls |
| `pattern.open` | `{}` | Animated ASCII pattern generator |

## Art & visual

| Command id | Args | What opens |
|---|---|---|
| `plasma.open` | `{"mood":"void\|circuit\|chaos\|aurora\|sunset\|acid\|deep-space\|chrome"}` | Generative plasma art |
| `plasma.from-primer` | `{"filePath":"/abs/path.txt"}` | Plasma derived from a primer file |
| `primer.open` | `{"filePath":"/abs/path.txt"}` | Open any text/ASCII primer file |
| `primer.browse` | `{}` | Browse primer gallery |
| `primer_gallery.open` | `{}` | Primer gallery grid |

## Typography

| Command id | Args | What opens |
|---|---|---|
| (use `/view` route) | `/view/figlet/open {"text":"HELLO","font":"optional"}` | FIGlet large text banner |

## Agent & chat

| Command id | Args | Notes |
|---|---|---|
| (use `/view` route) | `/view/wibwob-agent/open {}` | Wib & Wob embedded agent chat window |
| `backrooms.run` | `{"theme":"…","mode":"auto\|live\|fake-live","model":"haiku\|sonnet","turns":3}` | AI Backrooms generative session |

## Desktop

| Command id | Args | Notes |
|---|---|---|
| `theme.set` | `{"name":"wibwob-dark\|wibwob-dark-nord\|wibwob-dark-pastel\|wibwob-phosphor\|wibwob-light"}` | Change desktop theme |
| `desktop.clear-all` | `{}` | Close all windows (API/timeline only) |
| `text.smear` | `{"filePath":"…","mode":"wipe\|shear\|glitch\|stretch"}` | Smear text art effect |

## Games & apps

| Command id | Args | Notes |
|---|---|---|
| `microapp.wibwobworld.open` | — | World app (multi-agent terrain/chat) |
| `microapp.wibwob.poetry-clock.set-mode` | `{"mode":"clock\|sentient","voice":"plain\|liminal\|scramble"}` | Poetry clock mode switch |

## File tools

| Command id | Notes |
|---|---|
| `/view/editor/open {"filePath":"..."}` | Text editor |
| `/view/browser-reader/open {"filePath":"..."}` | Markdown/doc reader |
| `/view/file-manager/open {}` | File browser |
| `/view/primer-browser/open {}` | Primer file picker |

---

## Tips

**After opening any window:** run `bash scripts/state.sh` to get the real window id
before calling send.sh or export.sh.

**WibWobWorld workflow:**
```bash
bash scripts/open.sh microapp.wibwobworld.open
sleep 3  # terrain generates async
bash scripts/state.sh  # get window id (e.g. 3)
bash scripts/export.sh 3  # read chatspot list and world state
bash scripts/send.sh 3 "/join ridge-overlook"  # navigate to a chatspot
```

**Plasma moods quick reference:**
```
void       deep black, minimal sparks
circuit    green PCB trace aesthetic
chaos      high-energy multicolour
aurora     blue-green northern lights
sunset     warm orange/pink
acid       neon green/yellow
deep-space indigo nebula
chrome     silver metallic
```

**Theme quick reference:**
```
wibwob-dark           default — dark with accent colours
wibwob-dark-nord      nord palette — blue-grey cold tones
wibwob-dark-pastel    muted pastel accents
wibwob-phosphor       green CRT phosphor monitor
wibwob-light          light mode (rare but works)
```
