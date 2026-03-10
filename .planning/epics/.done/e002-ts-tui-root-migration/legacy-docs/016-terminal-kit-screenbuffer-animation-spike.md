# Terminal Kit ScreenBuffer Animation Spike

Status: draft
Scope: animation/compositing research spike only

## Question

Can `terminal-kit`'s `ScreenBuffer` become a **special-purpose animation
surface** inside the TS spike for:

- animated ASCII primer movies
- figlet-based concrete poetry
- karaoke subtitle overlays
- layered clipart/collage scenes

without forcing a full renderer migration away from the current `blessed`
desktop shell?

## Short answer

Yes, it is worth a targeted spike.

Not as a replacement for the whole app.
As a **contained animation engine** it looks promising because `ScreenBuffer`
explicitly supports:

- rectangular cell buffers
- drawing a buffer into another buffer
- delta terminal redraws
- transparency/blending
- `put()` text writes with wrapping/clipping
- buffer resize and scrolling

That is much closer to "ASCII movie compositor" than the current per-window
string-concatenation approach.

## Primary source

- `ScreenBuffer` docs: [doc/ScreenBuffer.md](https://github.com/cronvel/terminal-kit/blob/master/doc/ScreenBuffer.md)
- raw doc: [raw ScreenBuffer.md](https://raw.githubusercontent.com/cronvel/terminal-kit/master/doc/ScreenBuffer.md)
- repo: [cronvel/terminal-kit](https://github.com/cronvel/terminal-kit)

Key lines from the raw doc that matter:

- it is "a buffer holding contents for a rectangular area"
- each cell stores character, fg/bg color, style, blending mask
- there are buffers that draw directly to the terminal and buffers that draw to
  another buffer
- recommended practice for "a lot of moving things" is one big terminal-mapped
  buffer plus smaller buffers for widgets/sprites/moving areas
- `.draw({ delta: true })` updates only changed cells when drawing to a terminal

That is almost exactly the compositing model we want for ASCII motion.

## Why this helps WibWob specifically

The current spike can open primer/text windows, figlet windows, art windows,
and chat windows, but animated text/art is still too ad hoc.

`ScreenBuffer` could give us one compositing model for:

1. **Primer movies**
- one primer frame per buffer
- sequence playback with frame timing
- optional transparent clipart over a background buffer

2. **Figlet poetry**
- render figlet output into its own buffer
- animate placement, reveal, or dissolve
- reuse the same measurement/composition rules as primer scenes

3. **Karaoke subtitles**
- one lower-third subtitle layer
- timed line swaps and word highlights
- composited over art or primer playback

4. **Collage scenes**
- background pattern buffer
- one or more clipart/primer sprite buffers
- optional figlet title layer
- optional subtitle strip layer

## What parts of ScreenBuffer look directly useful

### 1. Buffer-to-buffer composition

The docs explicitly describe:

- one terminal-sized root buffer
- smaller buffers that draw into it

This is the right mental model for:

- movie frame layer
- subtitle layer
- title/figlet layer
- optional HUD/status layer

### 2. Delta redraw

`.draw({ delta: true })` is valuable because ASCII movies will otherwise flood
the terminal with full-frame redraws.

That makes it realistic to test:

- 6-12 fps primer playback
- subtitle updates
- lyric highlighting

without brute-forcing the whole screen every tick.

### 3. Transparency / blending

The docs mention blending masks and transparent cells.

That matters for:

- overlaying clipart over a patterned background
- placing karaoke text over a movie frame
- composing figlet titles without manually rewriting background text

### 4. `createFromString()`

This looks promising for:

- turning a primer frame into a buffer
- turning figlet output into a buffer
- marking a transparency char for overlay composition

That is almost tailor-made for our current text/ASCII assets.

### 5. Resize and clipping

The docs expose:

- `.resize()`
- `.draw()` clipping
- wrapping and tiling modes

That is useful for:

- fitting a movie window to current desktop bounds
- cropping or letterboxing oversized primer frames
- keeping subtitles inside a safe region

## What this does **not** solve

This is not a replacement for the app shell.

It does **not** automatically solve:

- desktop window manager behavior
- z-order among blessed windows
- menu bar/status line ownership
- control API/state ownership
- generic text editor/chat/browser widgets

So the right shape is:

- keep `blessed` for the desktop shell
- spike `terminal-kit ScreenBuffer` as an internal animation engine
- only later decide whether to embed it, adapt it, or port its logic

## Integration options

### Option A: isolated parallel spike

Build a tiny standalone Node/Bun script under the spike folder that:

- opens a full terminal
- composes a root `ScreenBuffer`
- renders primer frames + subtitles + figlet overlays

Pros:

- fastest proof of concept
- no risk to existing `blessed` shell

Cons:

- not integrated into the current window system

### Option B: offscreen compositor feeding a blessed window

Use `ScreenBuffer` for composition, then export its visible cell grid into a
plain string/cell model rendered inside a `blessed` window.

Pros:

- stays inside the current TS app
- closer to real product direction

Cons:

- glue layer complexity
- two rendering models in one app

### Option C: steal the model, not the runtime

Read `ScreenBuffer` as design inspiration and reimplement only what we need:

- root surface
- sprite layers
- subtitle layer
- delta-ish invalidation

Pros:

- single renderer/runtime

Cons:

- more engineering upfront
- easy to recreate the same ad hoc mess if done too early

## Recommended spike path

Start with **Option A**, then decide whether to continue with B or C.

That means:

1. prove primer-frame playback
2. prove figlet overlay
3. prove karaoke subtitle timing
4. only then ask whether embedding into the `blessed` desktop is worth it

## Concrete spike deliverable

Create one standalone prototype, e.g.:

- `/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/scripts/screenbuffer-movie-spike.ts`

It should support:

- load a primer or primer sequence from `modules-private/wibwob-primers`
- convert frames to `ScreenBuffer`
- animate at a fixed frame rate
- optional figlet title overlay
- optional subtitle timeline from a small JSON file
- keyboard quit

## Suggested content tests

### Test A — primer frame player

Input:

- one multi-frame ASCII primer

Success:

- frames advance cleanly
- no full-screen terminal smear
- timing feels stable

### Test B — figlet title overlay

Input:

- primer background
- figlet title rendered as a separate overlay layer

Success:

- title composites cleanly
- title can animate in/out without corrupting the background

### Test C — karaoke subtitles

Input:

- fixed background or moving primer scene
- subtitle JSON:
  - start time
  - duration
  - line
  - optional word highlight timing

Success:

- line swaps cleanly
- subtitle remains legible and bounded
- highlight effect works at least crudely

### Test D — concrete poetry scene

Input:

- multiple figlet/text layers
- timed movement or reveal

Success:

- layered text composition works
- scene feels more like a "poem frame" than a static banner

## Proposed JSON inputs

### Subtitle timeline

```json
{
  "title": "Karaoke Test",
  "fps": 8,
  "lines": [
    { "startMs": 0, "endMs": 1800, "text": "hello from the hallway" },
    { "startMs": 1800, "endMs": 3600, "text": "fluorescent lights hum low" }
  ]
}
```

### Primer movie scene

```json
{
  "backgroundPrimer": "castle-tower-3d-cube.txt",
  "titleText": "WIB&WOB",
  "titleFont": "standard",
  "subtitleFile": "karaoke-test.json",
  "fps": 8
}
```

## Architectural rule if this succeeds

If `ScreenBuffer` proves good at animation, do **not** spread it everywhere.

Keep a clean split:

- `blessed` = desktop shell, windows, menus, control API, state
- `ScreenBuffer` compositor = specialized animation/movie engine only

That keeps the TS rebuild DRY and prevents a second parallel UI architecture.

## Risks

### Risk 1: dual renderer complexity

If we try to integrate too early, we may end up with:

- `blessed` window shell
- `ScreenBuffer` movie compositor
- ad hoc glue code between them

That is manageable only if the scope stays narrow.

### Risk 2: color/style mismatch

`ScreenBuffer` has its own attribute model. We need to confirm the result still
matches the WibWob visual language in the current terminal setup.

### Risk 3: Bun runtime fit

`terminal-kit` is Node-oriented. It may work under Bun, but that should be
verified in the first 30 minutes of the spike.

## Spike plan

### Epoch 1 — feasibility

- [ ] install `terminal-kit` in the spike
- [ ] write a standalone script that opens a terminal-sized `ScreenBuffer`
- [ ] draw one primer frame from a string
- [ ] redraw with `delta: true`
- [ ] verify it runs under Bun or note if Node is required

### Epoch 2 — primer playback

- [ ] parse a multi-frame primer or frame list
- [ ] animate 2-3 frames in a loop
- [ ] verify timing and redraw quality

### Epoch 3 — figlet overlay

- [ ] render figlet text to a second layer
- [ ] composite over the primer frame
- [ ] test a simple reveal or slide animation

### Epoch 4 — karaoke subtitles

- [ ] define a small subtitle JSON format
- [ ] render a subtitle strip layer near the bottom
- [ ] test timed line swaps and one simple highlight effect

### Epoch 5 — decision

- [ ] decide:
  - keep as standalone tool
  - embed into a `blessed` window
  - or just port the compositing ideas into our own renderer

## Recommendation

Do this spike.

It is one of the few external libraries that actually speaks in the same terms
as the feature we want:

- cell buffers
- composition
- transparency
- delta redraw
- moving areas/sprites

That makes it much more promising for ASCII movies and lyric overlays than most
generic TUI widget kits.
