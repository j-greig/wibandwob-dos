# Ghostty Shader + Music Viz: Synchronized Playback in WibWob-DOS

## Concept

Play shader-generated chiptune music (from `shots/`) while the *same shader*
that composed it runs live in Ghostty's GPU compositor — audio and visuals
from one source, displayed simultaneously. The shader IS the score, and
you see the score while hearing it.

**Links:** [Shader API #2353](https://github.com/ghostty-org/ghostty/discussions/2353) · [Audio-reactive shaders #10201](https://github.com/ghostty-org/ghostty/discussions/10201) · [⚡ AppleScript PR #11208](https://github.com/ghostty-org/ghostty/pull/11208) · [Shader switcher PR #61](https://github.com/0xhckr/ghostty-shaders/pull/61) · [shader.sh source](https://github.com/JefStat/ghostty-shaders/blob/a34744b95940216398e92865796739edb6c087f0/shader.sh) · [Files & refs ↓](#files-referenced)

---

## Existing Infrastructure

### Shader → Music Pipeline (done)
- `shader_to_chiptune.py` renders GLSL headlessly via `moderngl`, extracts
  brightness, synthesizes WAV via `bricks`
- 29 WAVs in `shots/`, each tagged with its source shader in `manifest.jsonl`

### Ghostty Shader System (done)
- Ghostty renders GLSL post-processing shaders over terminal content
- Config: `custom-shader = /path/to.glsl` + `custom-shader-animation = always`
- Convention: `mainImage(out vec4 fragColor, in vec2 fragCoord)` with
  `iTime`, `iResolution`, `iFrame`, `iChannel0` (terminal texture)
- Hot-swap via `ghostty-shader.sh on <name>` → writes `scratch/.ghostty-shaders`
  → `osascript` sends Cmd+Shift+, to reload config
- Ghostty `config-file = ?path` allows conditional includes
- **Community shader switcher**: [`0xhckr/ghostty-shaders#61`](https://github.com/0xhckr/ghostty-shaders/pull/61)
  — `shader.sh` by JefStat ([source](https://github.com/JefStat/ghostty-shaders/blob/a34744b95940216398e92865796739edb6c087f0/shader.sh),
  local copy in this dir). Key patterns worth adopting:

#### `shader.sh` Grok — What It Teaches Us

**Config mutation model:** Directly rewrites `~/.config/ghostty/config` —
removes all `custom-shader` lines via `grep -v`, appends new ones, atomic
`mv`. No include-file indirection. Simpler than our `config-file = ?path`
approach but destructive to other config entries if not careful.

**Multi-shader pipelines:** Ghostty supports multiple `custom-shader =`
lines — they compose as a chain (each shader's output feeds next as
`iChannel0`). The script supports `set crt bloom` (replace all) and
`add drunkard` (append to pipeline). This means we can layer:
`music-viz-overlay.glsl` + `wibwob-crt.glsl` = see the music pattern
through a CRT filter on top of terminal text.

**Fuzzy name resolution:** 5-level cascade: exact → +.glsl → case-insensitive
→ prefix → substring. We should adopt this for our `shader-music.play`
command so users can say `play cathedral` not `play cathedral-overlay.glsl`.

**Reload trigger:** Previously no programmatic reload API existed — our
`ghostty-shader.sh` used `osascript` to simulate Cmd+Shift+, keypress.
**Ghostty 1.3 changes everything:** [PR #11208](https://github.com/ghostty-org/ghostty/pull/11208)
(merged) adds native AppleScript with `perform action` — can execute
`config_reload` or any Ghostty action directly on a terminal object.
Also exposes `new surface configuration` for setting config properties
programmatically. This replaces our fragile keystroke simulation with
proper scriptable control.

**No iTime reset:** Ghostty's `iTime` starts from shader load and
increments continuously. Reloading config does NOT reset `iTime` to 0
(confirmed by community issues). Swapping shaders mid-show means each
shader starts at whatever `iTime` Ghostty is at. For our use case this
is fine — generative patterns don't need frame-0 sync.

**Implication for our plan:** On Ghostty 1.3+, use AppleScript for
shader hot-swap: rewrite config (shader.sh pattern), then
`tell application "Ghostty" to perform action "config_reload"`.
No keystroke simulation needed. Support pipeline mode so
music viz + CRT can coexist.

### VJ Timeline System (done)
- Declarative JSON timelines sync visual cues to audio at exact timestamps
- Audio: `ffplay -nodisp -autoexit` spawned by `timeline-service.ts`
- Cues scheduled as absolute `setTimeout()` from `Date.now()` start
- Cues can: switch scenes, patch windows, fire commands, swap themes
- Beat maps optional (BPM + section markers)

### WibWob-DOS Ghostty Integration (done)
- `app.ts` detects Ghostty via `GHOSTTY_RESOURCES_DIR` or `TERM_PROGRAM`
- `WIBWOB_GHOSTTY_SHADER` env var activates shader on app start
- `ghostty-shader.sh on|off|status|list|install` manages lifecycle

---

## What's Missing

### 1. Shader hot-swap as a timeline cue type

**Current state:** Timeline cues can change themes, open/close windows, fire
commands. Cannot swap Ghostty shaders mid-show.

**Needed:** New cue type `"shader"` that calls `ghostty-shader.sh on <name>`
during timeline playback.

```json
{ "at": { "t": 0 }, "shader": "cathedral" }
{ "at": { "t": 30 }, "shader": "breakcore" }
```

**Implementation:**
- Add `shader?: string` to `ResolvedCue` in `timeline-types.ts`
- In `executeCue()` in `timeline-service.ts`: if `cue.shader`, spawn
  `bash ghostty-shader.sh on ${cue.shader}`
- Ghostty reload takes ~300ms — cue should fire 300ms before desired
  visual beat

### 2. Music-shader manifest lookup

**Current state:** `manifest.jsonl` records which shader generated which WAV.
No reverse lookup from WAV → shader path.

**Needed:** Helper that reads manifest, resolves shader path, returns both
WAV path + GLSL path for a given genre/shot number.

```bash
# Example usage in a timeline generator
shot_info=$(python3 -c "
import json
with open('shots/manifest.jsonl') as f:
    for line in f:
        entry = json.loads(line)
        if entry.get('shot') == '026':
            print(entry['shader'], entry['genre'])
")
```

### 3. Adapted shaders for terminal overlay

**Problem:** Music-generation shaders (cathedral.glsl, breakcore.glsl etc.)
output to a standalone framebuffer — they don't read `iChannel0` (terminal
content). Running them raw in Ghostty would replace terminal text entirely.

**Needed:** A "terminal overlay" variant of each shader that:
- Reads terminal content from `iChannel0` via `texture(iChannel0, uv)`
- Blends shader visuals with terminal text (multiply, screen, or additive)
- Preserves text readability while showing the musical pattern

**Approach — wrapper template:**
```glsl
// Auto-generated terminal overlay for {genre} shader
void musicPattern(out vec4 col, in vec2 fragCoord);  // forward-declare

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    vec4 term = texture(iChannel0, uv);
    vec4 viz;
    musicPattern(viz, fragCoord);

    // Blend: show pattern in dark areas, preserve text in bright areas
    float textMask = dot(term.rgb, vec3(0.2126, 0.7152, 0.0722));
    fragColor = mix(viz * 0.5, term, smoothstep(0.1, 0.4, textMask));
}

// Rename original mainImage → musicPattern
{original_shader_source_with_mainImage_renamed}
```

**Generator script:** `make-overlay.py` — takes any music shader, wraps it
with terminal blending, outputs Ghostty-ready GLSL.

### 4. Synchronized playback command

**New command:** `shader-music.play` — registered in `command-catalog.ts`

```
shader-music.play { shot: "026-cathedral" }
```

**Steps:**
1. Look up shot in manifest → get WAV path + shader name
2. Generate terminal overlay GLSL (or use cached version)
3. Activate Ghostty shader via `ghostty-shader.sh on <overlay>`
4. Wait 300ms for Ghostty reload
5. Start audio via `ffplay -nodisp -autoexit <wav_path>`
6. On audio end → `ghostty-shader.sh off`

### 5. Multi-shot timeline: the shader-music DJ set

**The grand show:** A VJ timeline that plays multiple shots back-to-back,
swapping both audio and shader at each transition.

```json
{
  "version": 1,
  "title": "Shader Music DJ Set",
  "track": "shots/dj-set-concatenated.wav",
  "duration": 180,
  "cues": [
    { "at": {"t": 0},   "shader": "cathedral-overlay",
      "scene": "cathedral-desktop" },
    { "at": {"t": 30},  "shader": "breakcore-overlay",
      "patch": {"theme": "wibwob-hot"} },
    { "at": {"t": 48},  "shader": "spacejazz-overlay",
      "patch": {"theme": "wibwob-dark"} },
    { "at": {"t": 70},  "shader": "witchhouse-overlay",
      "scene": "dark-desktop" }
  ]
}
```

**Pre-bake step:** Concatenate WAVs with ffmpeg crossfades, record cumulative
timestamps, auto-generate timeline JSON from manifest.

---

## Build Order

| Phase | What | Effort | Depends On |
|-------|------|--------|------------|
| **P0** | `make-overlay.py` — shader→terminal-overlay wrapper | 1h | nothing |
| **P1** | `shader-music.play` command — single shot playback | 2h | P0 |
| **P2** | Shader cue type in timeline-service | 1h | nothing |
| **P3** | DJ set timeline generator | 2h | P0, P2 |
| **P4** | Desktop choreography — TUI windows react to genre | 3h | P1, P2 |

### P0 in detail: `make-overlay.py`

```
Input:  autoresearch/shader-music/cathedral.glsl
Output: shaders/cathedral-overlay.glsl (Ghostty-ready)

Steps:
1. Read source GLSL
2. Rename mainImage → musicPattern
3. Prepend terminal blend wrapper (template above)
4. Write to shaders/ dir
5. Register in ghostty-shader.sh list
```

### P4 in detail: Desktop choreography

Each genre gets a desktop "mood":
- **Cathedral:** dark theme, single large primer window (gothic ASCII art),
  slow figlet title fade
- **Breakcore:** hot theme, 4 small windows tiled chaotically, rapid figlet
  text cycling
- **Space Jazz:** nord theme, hero-center primer (stars), gentle sway
- **Witch House:** inverted theme, no windows except one dim primer, text
  barely visible

---

## Confirmed: AppleScript Works (Ghostty 1.3.1)

Tested live. All commands functional:

```applescript
-- Open new window at repo dir
tell application "Ghostty"
    set cfg to new surface configuration
    set initial working directory of cfg to "/Users/james/Repos/wibandwob-dos"
    set win to new window with configuration cfg
end tell

-- Reload config (shader swap) — returns true on success
tell application "Ghostty"
    set t to terminal 1 of selected tab of front window
    perform action "reload_config" on t
end tell

-- Send text input to terminal
tell application "Ghostty"
    set t to terminal 1 of selected tab of front window
    input text "echo hello" & return to t
end tell
```

**SDEF location:** `/Applications/Ghostty.app/Contents/Resources/Ghostty.sdef`

Full API surface: `perform action` (any Ghostty action string), `new window`,
`new tab`, `split`, `focus`, `close`, `input text`, `send key` (with modifiers),
`send mouse button/position/scroll`. `surface configuration` record supports
`font size`, `initial working directory`, `command`, `initial input`,
`wait after command`, `environment variables`.

**Shader hot-swap recipe (confirmed working):**
1. Rewrite `custom-shader` lines in Ghostty config file
2. `perform action "reload_config" on <terminal>` → returns `true`
3. Shader swaps instantly — no keystroke simulation needed

## Open Questions

- **Ghostty shader reload latency**: `perform action "reload_config"` returns
  instantly — actual shader recompile latency needs benchmarking but expected
  sub-100ms. Acceptable for scene transitions, possibly even beat-synced at
  moderate BPM.
- **iTime sync**: Ghostty's `iTime` counts from shader load, not from audio
  start. For perfect sync, shader needs a `uniform float audioTime` — not
  currently possible without Ghostty source modification. Workaround: accept
  phase drift (the patterns are generative, not frame-locked).
- **Multiple shaders**: Ghostty supports multiple `custom-shader` lines —
  they compose as a chain. Could layer a subtle CRT shader under the music
  viz for extra depth.
- **Audio reactivity**: Future — pipe FFT data back to shader via a
  constantly-updating texture file. Circular: shader→music→FFT→shader.

---

## Links

| Resource | Why It Matters |
|----------|----------------|
| [ghostty-org/ghostty#2353](https://github.com/ghostty-org/ghostty/discussions/2353) | Shader API discussion — custom uniforms, reload behaviour, `iTime` semantics |
| [ghostty-org/ghostty#10201](https://github.com/ghostty-org/ghostty/discussions/10201) | Audio-reactive shaders discussion — FFT uniforms, external audio input |
| [ghostty-org/ghostty#11208](https://github.com/ghostty-org/ghostty/pull/11208) | **AppleScript support (merged, shipping 1.3).** `perform action` executes any Ghostty action on a terminal. `new surface configuration` can set config properties. Replaces our osascript Cmd+Shift+, hack with proper programmatic control. By mitchellh. |
| [0xhckr/ghostty-shaders#61](https://github.com/0xhckr/ghostty-shaders/pull/61) | Community multi-shader switcher PR (fzf picker, pipeline support) |
| [shader.sh source](https://github.com/JefStat/ghostty-shaders/blob/a34744b95940216398e92865796739edb6c087f0/shader.sh) | Local copy in this dir — config rewrite + fuzzy resolution patterns |

## Files Referenced

| File | Role |
|------|------|
| `autoresearch/shader-music/shader_to_chiptune.py` | Music generation engine |
| `autoresearch/shader-music/shots/manifest.jsonl` | Shot→shader→genre lookup |
| `scripts/ghostty-shader.sh` | Shader hot-swap + Ghostty config management |
| `src/services/timeline-service.ts` | VJ timeline execution engine |
| `src/services/timeline-types.ts` | Timeline cue type definitions |
| `src/core/command-catalog.ts` | Command registration |
| `src/app.ts` (L46-73) | Ghostty shader lifecycle on app start/stop |
| `~/Library/Application Support/com.mitchellh.ghostty/config` | Ghostty config |
