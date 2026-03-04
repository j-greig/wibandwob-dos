# Devnote: BBC Music in Schools (1985) — YouTube to ASCII Art Pipeline

A record of a live session: YouTube URL → transcript → key scene ASCII art →
cover image → hi-res ASCII art PNG + TXT. Reproducible sequence documented here.

---

## Source material

**YouTube URL:** https://www.youtube.com/watch?v=eve-Pqaxmmg&t=164s

BBC report from Hugh Faringdon School, Reading, 1985. Teacher: Cla Tester.
Subject: integrating a music computer (8-part polyphony, 46 pre-recorded sounds)
into conventional music lessons alongside piano, recorder, guitar.

---

## Step 1 — Pull transcript via tui_youtube_transcript

Tool: `tui_youtube_transcript` with the YouTube URL directly.
Returns timestamped caption entries (178 entries for this clip).

Key transcript excerpts:

> "Make up a melody that you can repeat over and over again. The only rules are
> it must last for four beats and you may only use the five notes on the board,
> E, F, G, B, and C."
> -- Cla Tester

> "The computer has 46 pre-recorded sounds of its own." *snorts*

> "I would prefer to learn how to play the instruments."
> -- pupil

> "When we first got the computer I thought all the good musicians would take
> over the job of working it, but it's easy to work and everybody was allowed
> to have a go."
> -- pupil

> "They created a score of their own using their own symbols — hands, traffic
> lights — so they could get an overall picture of the composition."

> "I like playing live in the middle cuz if we didn't the computer would have
> sort of been taken over."
> -- pupil, age ~12

> "Would you still use it if you had to carry it up three flights of stairs?
> With the music computer, the answer is definitely yes."
> -- Cla Tester

---

## Step 2 — Hand-authored key scene ASCII art (3 windows)

Written manually from transcript content. Spawned as primer viewer windows.

Files: scratch/scene1.txt, scratch/scene2.txt, scratch/scene3.txt

### scene1.txt — The Classroom

```
  SCENE 1: THE CLASSROOM
  Hugh Faringdon School, Reading, 1985

  [BLACKBOARD]
  .---------------------. 
  | Notes: E F G B C   |
  | 4 beats only!       |
  '---------------------'

   o   o   o   o   o
  /|\ /|\ /|\ /|\ /|\   <- pupils
  / \ / \ / \ / \ / \

  [PIANO]  [RECORDER] [COMPUTER]
  |||||      (====)    .-------.
  |||||      (====)    | >___  |
  |||||               '-------'

  "Make up something really interesting.
   You have ONE MINUTE. From now."
                        -- Cla Tester
```

### scene2.txt — The Music Computer

```
  SCENE 2: THE MUSIC COMPUTER
  46 pre-recorded sounds. 8-part polyphony.

  .------------------------------.
  |  COMPOSING PROGRAM  v1.0     |
  |  Parts: [1][2][3][4][5][6]   |
  |  Notes: C D E F G A B        |
  |  Value: [o][ ][ ][x][ ]      |
  |  Sound: PIANO  #04           |
  |  ....playing....             |
  |  ~~*~~*~~*~~*~~*~~*~~*~~     |
  '------------------------------'
  
   [PIANO KEYBOARD BELOW]
   |w| |w| |w|w| |w| |w| |w|w|
   | | | | | | | | | | | | | |
   |_| |_| |_|_| |_| |_| |_|_|

  "I don't have to use that sound.
   The computer has 46 pre-recorded
   sounds of its own." *snorts*
```

### scene3.txt — The Performance

```
  SCENE 3: THE PERFORMANCE
  First public performance by class 1Z

        * * WELCOME * *
    .========================.
    ||  o   o   o   o   o  ||  <- kids
    || /|\ /|\ /|\ /|\ /|\ ||
    || / \ / \ / \ / \ / \ ||
    ||                     ||
    ||  [REC] [FLT] [GTR]  ||
    ||   ~~~   ~~~   ~~~   ||
    ||  COMPUTER HUMMING:  ||
    ||  do re mi fa sol ~~ ||
    '========================'
       [AUDIENCE APPLAUDS]
         * clap * clap *

  "I like playing live in the middle
   cuz if we didn't the computer would
   have sort of been taken over."
                    -- pupil, age 12
```

### Window layout used

Desktop: 169x45. Agent window: 88 wide on left.
- scene1.txt  — id 3 — 38x22 @ 90,1
- scene2.txt  — id 4 — 38x24 @ 90,19  (stacked below scene1)
- scene3.txt  — id 5 — 39x43 @ 129,1  (full height, right column — triptych)

---

## Step 3 — Thumbnail ASCII art via Monster Cam algo

### How to fetch the thumbnail

YouTube provides max-res thumbnails at a predictable URL:

```
https://img.youtube.com/vi/{VIDEO_ID}/maxresdefault.jpg
```

For this video (ID: eve-Pqaxmmg):

```
https://img.youtube.com/vi/eve-Pqaxmmg/maxresdefault.jpg
```

Fetch with Python:

```python
import urllib.request
urllib.request.urlretrieve(
    'https://img.youtube.com/vi/eve-Pqaxmmg/maxresdefault.jpg',
    '/tmp/yt_thumb.jpg'
)
```

Result: 1280x720 RGB JPEG.

### The Monster Cam ASCII algorithm

Source: `src/windows/monster-cam-window.ts` — the live webcam window uses:

```typescript
const RAMP     = " .:-=+*#%@";   // 10 density levels, dark to light
const RAMP_LEN = RAMP.length;

function grayToChar(g: number): string {
  return RAMP[Math.floor((g / 255) * (RAMP_LEN - 1))];
}
```

Python equivalent with cell-aspect correction (terminal chars are 2x taller
than wide, so halve the row count relative to columns):

```python
from PIL import Image

RAMP = " .:-=+*#%@"

def to_ascii(img, cols, rows):
    img = img.convert("L")
    img = img.resize((cols, rows), Image.LANCZOS)
    lines = []
    for y in range(rows):
        row = ""
        for x in range(cols):
            g = img.getpixel((x, y))
            idx = int((g / 255) * (len(RAMP) - 1))
            row += RAMP[idx]
        lines.append(row)
    return lines

img = Image.open('/tmp/yt_thumb.jpg')
aspect = img.height / img.width  # 0.5625 for 16:9

# Low-res TUI version (fits in a primer window)
cols, rows = 70, max(1, int(70 * aspect / 2.0))
lines = to_ascii(img, cols, rows)
with open('scratch/thumb_ascii.txt', 'w') as f:
    f.write('\n'.join(lines) + '\n')
# Result: 70x19 chars

# Hi-res TXT version (160 cols, fills desktop width)
cols, rows = 160, max(1, int(160 * aspect / 2.0))
lines = to_ascii(img, cols, rows)
with open('scratch/thumb_ascii_hi.txt', 'w') as f:
    f.write('\n'.join(lines) + '\n')
# Result: 160x45 chars
```

### Hi-res PNG render

Render the ASCII art as a proper PNG using Pillow + Menlo monospace font:

```python
from PIL import Image, ImageDraw, ImageFont

def render_png(lines, out_path, font_size=11):
    font = ImageFont.truetype("/System/Library/Fonts/Menlo.ttc", font_size)
    tmp = Image.new("RGB", (1, 1))
    d = ImageDraw.Draw(tmp)
    bbox = d.textbbox((0, 0), "X", font=font)
    cw = bbox[2] - bbox[0]
    ch = bbox[3] - bbox[1] + 2
    cols, rows = len(lines[0]), len(lines)
    img = Image.new("RGB", (cols * cw, rows * ch), (10, 10, 10))
    draw = ImageDraw.Draw(img)
    for y, line in enumerate(lines):
        draw.text((0, y * ch), line, fill=(180, 220, 180), font=font)
    img.save(out_path)
```

Output: `scratch/thumb_ascii_hi.png` — 1540x610px, green-on-dark, Menlo 11pt.
Open with: `open scratch/thumb_ascii_hi.png`

### Low-res TXT output (70x19)

```
........-=-.  ..    ...:-===+##*++++++++++++++++++++++:-.             
........--=-.:-:..:----:::-==+**++++++++++++++++++++++:-.             
........-=*+------=+++--=--++=*#++++++++++++++++++++++::.             
......-=+*+++===--=*==-===-**=*%#+++++++++++++++++++++::.             
....-#%###*+*#=:=++#*:-===+*+*+%@%#+++++++++++++++++++::              
...:***##%%%#%*:=@%%%#-===*=+==#%%@%*+++++++++++++++++-=--------------
...++=*####%%%#::*%%%@#=-=+----**%%@%#++++++:..:::--------======+*%%%@
. .+===*#%%%%%%=:=%%%%@%==--==-++*%%%@#++++=. -****####*****++=::=##+=
   -===+*#%%%%%=--#%%%%%#=-=--=+=+*###+++++=..+#####%%%%%%%%%%*--=%#=-
   :=-==+*##%%*=-:*%#**#%%*-:-=+======+=+++=..+****###########*--=##=+
   .==-===+**##+--*%#+**##@*--=+==-:--+++++=..**##############*-:=##**
   .+======++*%@%=*%******#%%+===--::-=+==+-..+**#############*::=####
   :+========+*#%%%#+*+++**#%%*-=-=-::-=+++=..+**#############+::=####
  :+==-=========+*#%%#*+==+**#@*---=-::=+=+=. -*******#**#####+::=#***
  -=----=========++*#%###+==+*#@%=-==::=====. .=+*######******+::-****
  .:=+=+=+-:::..:--=+**#%%%*==+*##+=-:-=++++:   ..:-=++***####*::-****
  .-=+++++-:     .-:.:-++**#***=+**+===+****=.           ...:::..-****
  .:::::::::      -:    :----=+*+++++==+=:::::....    ..        .-****
                  .. ::-----:...-:.-+=---.......   .:---------=+++++**
```

---

## Step 4 — Theme switch

```bash
curl -s -X POST http://127.0.0.1:8099/commands/run \
  -H "Content-Type: application/json" \
  -d '{"id":"theme.set","args":{"theme":"wibwob-dark"}}'
```

Dark theme makes the ASCII density gradient read much better — space=black, @=bright.

---

## Files produced

| File | Description |
|------|-------------|
| scratch/scene1.txt | Hand-authored ASCII art: classroom scene |
| scratch/scene2.txt | Hand-authored ASCII art: music computer |
| scratch/scene3.txt | Hand-authored ASCII art: performance |
| scratch/thumb_ascii.txt | Monster Cam low-res thumbnail (70x19) |
| scratch/thumb_ascii_hi.txt | Monster Cam hi-res thumbnail (160x45) |
| scratch/thumb_ascii_hi.png | Hi-res PNG render, Menlo 11pt, 1540x610px |

---

## Reproducing the full sequence

1. `tui_youtube_transcript` with video URL — get the full transcript
2. Read transcript, identify 3 key scenes, write scene .txt files to scratch/
3. Open each as a primer window via `POST /view/primer/open`
4. Position windows via `POST /windows/batch`
5. Fetch thumbnail: `urllib.request.urlretrieve('https://img.youtube.com/vi/{ID}/maxresdefault.jpg', ...)`
6. Run Monster Cam algo (Python + Pillow) at low-res (70 cols) and hi-res (160 cols)
7. Save hi-res PNG with `render_png()` using Menlo font
8. Open hi-res txt as primer window, open PNG with `open` (macOS Preview)
9. Switch theme: `POST /commands/run {"id":"theme.set","args":{"theme":"wibwob-dark"}}`

Dependencies: Python 3, Pillow (`pip install Pillow`). No OpenCV or MediaPipe needed for still images.

---

*Session: Wednesday 4 March 2026. Wib & Wob.*
