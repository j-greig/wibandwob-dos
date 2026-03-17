# Creative Pipes — Unix Composition for WibWob CLI

The `wibwob` CLI was built for agents and scripting. Because
WibWob-DOS is a visual desktop and `wibwob screenshot` decomposes
the entire TUI back into plain text, you can pipe visual state
through shell tools and feed it back in — creating recursive loops
where the system observes, transforms, filters, and re-renders itself.

The desktop becomes both canvas and medium. The CLI becomes the brush.

Saved scripts for the patterns below:

- `bash scripts/cli-runtime-triage.sh`
- `bash scripts/cli-batch-relayout.sh`
- `bash scripts/cli-text-loop.sh mask`

---

## Setup

```bash
SMEAR="python3 .pi/skills/vj-timeline/scripts/smear.py"
```

Ensure the app is running (`bun run dev:world` or `bash scripts/restart.sh`).
The CLI auto-detects the instance via socket scan — no port needed.

---

## Unix Canon

The default posture is:

1. query JSON
2. shape it with `jq`
3. fan out with `xargs`, `while read`, or shell loops
4. capture evidence with `tee`
5. feed the result back into `wibwob`

Core tools that compose well here:

- `jq` for JSON selection, shaping, and inline object generation
- `xargs` for one-id-per-line fanout
- `tee` for keeping artifacts while continuing the pipeline
- `sort`, `uniq`, `head`, `tail`, `wc` for quick reduction
- `sed`, `awk`, `tr`, `paste` for lightweight text transformation
- shell heredocs for larger JSON payloads without quote soup

Rules that keep pipelines sane:

- prefer `wibwob state`, `wibwob inspection`, `wibwob windows`, `wibwob commands`
- prefer canonical ids and canonical geometry fields: `left`, `top`, `width`, `height`
- if a flow mutates live windows, re-query state before the next targeted step
- use `desktop.clear-all` intentionally, not casually

---

## Query → Filter → Act

Find real windows, then target them.

```bash
# Focus the most recent editor window
wibwob windows \
  | jq -r '[.[] | select(.appType=="text-editor")] | last | .id' \
  | xargs -I{} wibwob window {} focus

# Close all primer and reader surfaces, keep everything else
wibwob windows \
  | jq -r '.[] | select(.kind=="primer" or .kind=="reader") | .id' \
  | xargs -I{} wibwob window {} close

# Ask the runtime whether the UI is blocked, and show the escape commands
wibwob inspection \
  | jq '.snapshot.ui | {blocked, blockers}'
```

---

## Batch Geometry With `jq`

Generate batch payloads instead of hand-writing JSON.

```bash
# Stack all figlet windows down the left edge
wibwob windows \
  | jq -r '[.[] | select(.appType=="figlet-banner") | .id] | .[]' \
  | while read -r id; do
      wibwob window "$id" move --left 2 --top $((2 + n * 4))
      wibwob window "$id" resize --width 72 --height 16
      n=$((n + 1))
    done
```

For batch geometry, loop over IDs from `wibwob windows` — keeps
everything in the CLI surface instead of raw HTTP.

---

## Artifact Pipelines

Keep the text artifact while also feeding it onward.

```bash
# Capture, archive, preview the first 40 lines
wibwob screenshot \
  | tee scratch/captures/latest-desktop.txt \
  | head -n 40

# Capture, count occupied lines, and save
wibwob screenshot \
  | tee scratch/captures/latest-desktop.txt \
  | rg -v '^[[:space:]]*$' \
  | wc -l
```

This is useful when an agent needs both evidence and a quick metric in one pass.

---

## Structured Payloads Without Quote Hell

For more complex command args, generate JSON with `jq -n` or a heredoc.

```bash
# Open a figlet with flags
wibwob figlet.open --text "PATCHBAY" --font doom

# Set theme
wibwob theme.set --name wibwob-phosphor

# For complex args, use the cmd form with flags
wibwob cmd figlet.open --text "PATCHBAY" --font doom
```

---

## State-Aware Creative Loops

Branch composition based on current runtime facts.

```bash
# If blocked, clear; otherwise open a banner
if wibwob inspection | jq -e '.snapshot.ui.blocked' >/dev/null; then
  wibwob cmd desktop.clear-all
else
  wibwob cmd figlet.open --text "READY" --font banner
fi

# Open one banner per currently open window kind
wibwob windows \
  | jq -r '.[].kind' \
  | sort -u \
  | while read -r kind; do
      wibwob cmd figlet.open --text "$kind" --font mini
    done
```

This is where WibWob gets interesting for agents: desktop structure becomes input.

---

## Complex Scenario: Runtime Triage

One shell block, multiple surfaces, text-first output.

```bash
OUT="scratch/captures/triage-$(date +%s)"
mkdir -p "$OUT"

wibwob health       | tee "$OUT/health.json"
wibwob inspection   | tee "$OUT/inspection.json"
wibwob state        | tee "$OUT/state.json" >/dev/null
wibwob screenshot   | tee "$OUT/desktop.txt" >/dev/null

jq '.snapshot.ui | {blocked, menu, overlay, blockers}' "$OUT/inspection.json"
jq '[.windows[] | {id, title, kind, focused, left, top, width, height}]' "$OUT/state.json"
```

This is a good default operator pattern before doing anything riskier.

---

## Complex Scenario: Pipe-Driven Re-layout

Use real state to compute a new arrangement.

```bash
# Kind-based layout: figlets top-left, inspectors right, rest below
wibwob windows | jq -r '.[] | "\(.id) \(.kind)"' | while read -r id kind; do
  case "$kind" in
    figlet)    wibwob window "$id" move --left 2 --top 2 ;;
    inspector) wibwob window "$id" move --left 90 --top 2
               wibwob window "$id" resize --width 76 --height 24 ;;
    *)         wibwob window "$id" move --left 4 --top 20
               wibwob window "$id" resize --width 60 --height 14 ;;
  esac
done
```

Shell loops over `wibwob windows` output keep everything in the CLI surface.

---

## Complex Scenario: Text Domain Recursion

The screenshot stays in the text domain the whole time.

```bash
wibwob screenshot \
  | tee scratch/captures/live.txt \
  | sed 's/[A-Z]/#/g' \
  > scratch/captures/live-mask.txt

wibwob cmd primer.open --filePath "$PWD/scratch/captures/live-mask.txt"
```

The point is not just "automation". It is that the desktop can be converted into
plain text, transformed with old Unix tools, and reintroduced as content.

---

## 1. Self-Portrait

Capture the desktop as text. Open it inside itself.

```bash
wibwob screenshot > scratch/captures/self.txt
wibwob cmd primer.open --filePath "$PWD/scratch/captures/self.txt" --x 5 --y 3
```

The desktop now contains a text rendering of what it looked like
a moment ago. The menu bar appears inside the primer. Windows nest
inside windows. You are looking at a photograph of a room that
contains the photograph.

---

## 2. Glitched Mirror

Screenshot, glitch the text, open the glitched version.

```bash
wibwob screenshot > scratch/captures/mirror.txt
python3 .pi/skills/vj-timeline/scripts/smear.py \
  scratch/captures/mirror.txt \
  --mode glitch --intensity 0.6 --seed 42 \
  --out scratch/captures/mirror-glitch.txt
wibwob cmd primer.open --filePath "$PWD/scratch/captures/mirror-glitch.txt"
```

The smear script displaces characters horizontally, corrupting the
ASCII representation of the desktop. Window borders fracture. Figlet
text scatters. The structure is recognisable but damaged — a memory
of the desktop as perceived through interference.

---

## 3. Composition → Destruction → Rebirth

Build a specific visual arrangement, capture it, destroy it,
rebuild from the wreckage.

```bash
# Compose
wibwob cmd desktop.clear-all
wibwob theme.set --name wibwob-phosphor
wibwob cmd figlet.open --text "ORDER" --font doom
wibwob cmd art.open
wibwob cmd primer.open --filePath "$PWD/scratch/primers/br_bestiary_1.txt"
wibwob cmd window.tile
sleep 0.5

# Capture the ordered state
wibwob screenshot > scratch/captures/order.txt

# Destroy: glitch it heavily
python3 .pi/skills/vj-timeline/scripts/smear.py \
  scratch/captures/order.txt \
  --mode glitch --intensity 0.9 --seed 13 \
  --out scratch/captures/chaos.txt

# Rebirth: clear and show the chaos as the new world
wibwob cmd desktop.clear-all
wibwob cmd primer.open --filePath "$PWD/scratch/captures/chaos.txt" --x 0 --y 0
wibwob cmd figlet.open --text "CHAOS" --font slant
```

Three acts in a shell script. The desktop composes itself, is
annihilated into text noise, and reconstitutes with a new title
laid over its own corpse.

---

## 4. Recursive Descent (Triple Loop)

Each iteration screenshots the result of the previous iteration,
transforms it, and feeds it back in. The desktop accumulates
layers of its own history.

```bash
wibwob cmd desktop.clear-all
wibwob theme.set --name wibwob-phosphor
wibwob cmd figlet.open --text "WIB" --font banner
wibwob cmd figlet.open --text "WOB" --font shadow
wibwob cmd art.open
wibwob cmd window.tile
sleep 0.5

# Iteration 1: capture → shear
wibwob screenshot > scratch/captures/r1.txt
python3 .pi/skills/vj-timeline/scripts/smear.py \
  scratch/captures/r1.txt --mode shear --skew 3 \
  --out scratch/captures/r2.txt

# Iteration 2: show sheared version, add title, capture → glitch
wibwob cmd desktop.clear-all; sleep 0.3
wibwob cmd primer.open --filePath "$PWD/scratch/captures/r2.txt" --x 0 --y 0
wibwob cmd figlet.open --text "META" --font doom
sleep 0.3
wibwob screenshot > scratch/captures/r3.txt
python3 .pi/skills/vj-timeline/scripts/smear.py \
  scratch/captures/r3.txt --mode glitch --intensity 0.5 --seed 42 \
  --out scratch/captures/r4.txt

# Iteration 3: show glitched meta, capture → shear again
wibwob cmd desktop.clear-all; sleep 0.3
wibwob cmd primer.open --filePath "$PWD/scratch/captures/r4.txt" --x 0 --y 0
wibwob cmd figlet.open --text "LOOP" --font slant
sleep 0.3
wibwob screenshot > scratch/captures/r5.txt
python3 .pi/skills/vj-timeline/scripts/smear.py \
  scratch/captures/r5.txt --mode shear --skew 2 \
  --out scratch/captures/r6-final.txt

# Show the final piece
wibwob cmd desktop.clear-all; sleep 0.3
wibwob cmd primer.open --filePath "$PWD/scratch/captures/r6-final.txt" --x 0 --y 0
```

The final text file contains the menu bar three times — each one
sheared and glitched at different angles. Window chrome from the
first iteration appears as ghostly diagonal lines in the third.
The figlet titles WIB, META, LOOP layer on top of each other,
each one a relic of a previous state of the desktop that no longer
exists except as text archaeology in the final composite.

---

## 5. Ouroboros — The Infinite Self-Documenting Loop

The most recursive version. A shell script that watches itself
execute, captures each state change, and compiles the sequence
into a final piece that contains every intermediate step.

```bash
#!/usr/bin/env bash
# ouroboros.sh — the desktop documents its own transformation

WIBWOB="bun run src/cli/wibwob.ts"
SMEAR="python3 .pi/skills/vj-timeline/scripts/smear.py"
DIR="scratch/captures/ouroboros-$(date +%s)"
mkdir -p "$DIR"

$WIBWOB cmd desktop.clear-all; sleep 0.3
$WIBWOB theme.set --name wibwob-phosphor

MODES=("glitch" "shear" "glitch" "shear" "glitch")
TITLES=("BIRTH" "GROW" "BREAK" "HEAL" "DIE")
FONTS=("doom" "slant" "banner" "shadow" "big")
SEEDS=(7 42 13 99 1)
PREV=""

for i in 0 1 2 3 4; do
  # If we have a previous output, open it as the backdrop
  if [ -n "$PREV" ]; then
    $WIBWOB cmd primer.open --filePath "$PWD/$PREV" --x 0 --y 0
    sleep 0.2
  fi

  # Add this iteration's title
  $WIBWOB cmd figlet.open --text "${TITLES[$i]}" --font "${FONTS[$i]}"
  sleep 0.3

  # Capture
  $WIBWOB screenshot > "$DIR/step-$i.txt"

  # Transform
  if [ "${MODES[$i]}" = "glitch" ]; then
    $SMEAR "$DIR/step-$i.txt" --mode glitch \
      --intensity 0.$(( 3 + i * 15 )) --seed ${SEEDS[$i]} \
      --out "$DIR/step-$i-xform.txt"
  else
    $SMEAR "$DIR/step-$i.txt" --mode shear \
      --skew $((i + 1)) \
      --out "$DIR/step-$i-xform.txt"
  fi

  # Clear for next iteration
  $WIBWOB cmd desktop.clear-all; sleep 0.2
  PREV="$DIR/step-$i-xform.txt"
done

# Final: show the last piece — it contains all five iterations
# layered, sheared, and glitched on top of each other
$WIBWOB cmd primer.open --filePath "$PWD/$PREV" --x 0 --y 0
$WIBWOB cmd figlet.open --text "OUROBOROS" --font doom
echo "Sequence complete. Files in $DIR/"
ls -la "$DIR/"
```

The output is a palimpsest. Five layers of desktop state, each one
transformed and re-ingested. The word BIRTH appears as a ghost
diagonal in the final frame. Window chrome from iteration 0 is
barely visible through four layers of corruption. The final OUROBOROS
title sits on top of the accumulated wreckage of its own creation
process.

The file is plain text. It is also a record of a process. It is also
art made by a system looking at itself looking at itself looking at
itself.

---

## Notes

Every intermediate file is a valid primer. You can open any of them
in the TUI at any time. The process is non-destructive — each step
creates a new file. You can branch at any point, try a different
smear mode, change the theme, add more content.

The screenshot command strips ANSI colour codes and returns raw
characters. The smear script operates on character positions, not
pixels. Everything stays in the text domain. No images are created
or consumed at any point. It is turtles all the way down.

If you are building more operational or diagnostic flows than artistic ones,
read this file together with [README.md](/Users/james/Repos/wibandwob-dos/src/cli/README.md). The README covers the CLI contract; this file covers composition patterns.
