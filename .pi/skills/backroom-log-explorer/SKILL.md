---
name: backroom-log-explorer
description: Search and extract ASCII art, themes, primers, dialogue, and metadata from the Wib&Wob Backrooms raw archive (662 session logs, 57MB). Use when looking for specific art, finding sessions by primer/theme/model, extracting ASCII blocks, or exploring the creative corpus.
---

# Backroom Log Explorer

Search, filter, and extract content from the Wib&Wob Backrooms raw session archive.

## Base path

```
/Users/james/Repos/wibandwob-core/website/_backrooms_raw/
```

662 text files, ~57MB total. Median file ~63KB, largest ~2.3MB.

## Archive structure

Each file is a session log containing Wib/Wob dialogue and ASCII art. Files are
plain text with markdown-ish formatting. ASCII art is usually inside triple-backtick
fenced code blocks.

### File naming families

| Prefix | Count | Era | Notes |
|--------|-------|-----|-------|
| `ascii_art_v4_*` | ~115 | 2025-2026 | V4 Claude Code CLI engine, richest metadata |
| `sonnet_sonnet_wibwob_art_*` | ~102 | 2025 | Sonnet-to-sonnet dual model runs |
| `ascii_art_chunked_*` | ~82 | 2025 | Multi-part chunked processing |
| `geminipro2.5*` | ~74 | 2025 | Gemini Pro runs, sometimes cross-model |
| `ascii_art_ts_*` | ~71 | 2025 | TypeScript engine runs |
| `ascii_art_mvp_*` | ~38 | 2025 | MVP engine, high Wib/Wob dialogue density |
| `wibwob_*` | ~14 | 2024-2025 | Early standalone sessions |
| `backrooms_cli_session_MEGA_*` | ~4 | 2025 | Mega-threads, huge multi-turn sessions |
| `sonnet4_opus4_*` | ~4 | 2025 | Cross-model Sonnet 4 + Opus 4 |
| Various cross-model | varies | 2025 | deepseek, mistral, gpt4o combinations |

### Header format (varies — these are HEURISTICS not canon)

There is no single canonical header format. Different generation engines, time
periods, and manual sessions produce different metadata shapes. Treat every
pattern below as a heuristic that works for EXISTING files but may not apply
to future sessions. Always check the first ~20 lines of an unfamiliar file
to see what format it actually uses before writing extraction logic.

**V4 format** (common in 2025-2026, richest metadata):
```
<!-- Generated: 2026-01-20T17:04:26.090Z -->
<!-- Theme: Earth-mirror cosmology through Symbiotica lens... -->
<!-- Turns: 3 -->
<!-- Session ID: 20260120T164359_3ts_v4 -->
<!-- Duration: 1227s -->
<!-- Primers: monster-4817-eye-skull-dense,monster-5726-eye-teeth-angular -->
<!-- Reuse: --primers monster-4817-eye-skull-dense,monster-5726-eye-teeth-angular -->
```

**Chunked format**:
```
<!-- Theme: umwelt evolution -->
<!-- Turns: 12 (chunked processing) -->
<!-- Session Parts: 26 -->
<!-- Primers Used: bods.txt, fungi.txt, mechs.txt -->
```

**Early format** (2024):
```
<!-- SESSION_ID: 20241227_153022_5art -->
<!-- PRIMER: primers/spelunking.txt -->
<!-- ITERATION: 10 of 14 -->
```

**CLI/cross-model format** (inline pseudo-CLI):
```
--mode art
--models geminipro2.5.0325 deepseek-chat
--location "Draw a means of escape..."
```

**Some files have no structured header** — just jump straight into dialogue or art.

IMPORTANT: These patterns were observed in the current corpus. New generation
engines may use completely different header shapes, field names, or no headers
at all. The search recipes below are starting points — adapt them when they
miss results or return garbage.

### Content patterns (heuristic — not all files follow these)

- ASCII art is USUALLY inside triple-backtick fenced code blocks, but some
  files have bare art with no fencing at all
- Wib/Wob dialogue OFTEN uses `**Wib**:` or `**Wob**:` or `Wib:` / `Wob:`
  or kaomoji prefixes, but speaker markers vary between engines
- Wib speaks with chaotic energy: `...brl'zzzt...`, `~~~grr'ntak~~~`, `...vrr'llh~ha...`
- Wob speaks with analytical precision: `∴`, `⊠`, formal technical language
- Primer references appear as `<!-- Primers: ... -->`, `<!-- PRIMER: ... -->`, `--primers name,name`, or inline mentions
- Theme/prompt appears as `<!-- Theme: ... -->` or `--location "..."`
- Art separators between pieces: `---` lines or blank space

## Search recipes

All commands assume:
```bash
BR="/Users/james/Repos/wibandwob-core/website/_backrooms_raw"
```

### Find sessions by theme keyword

```bash
grep -li "consciousness\|cosmic horror\|fungi" "$BR"/*.txt
```

Case-insensitive with context:
```bash
grep -il "basilisk" "$BR"/*.txt | head -10
```

### Find sessions by primer name

```bash
# V4 format (Primers: or Reuse: header)
grep -l "monster-4817\|skull-dense" "$BR"/*.txt

# All formats (catches inline mentions too)
grep -rli "spelunking\|cavemonster\|symbient" "$BR"/*.txt
```

### List all unique primers referenced

```bash
# From --primers CLI args
grep -oh "\-\-primers [^ ]*" "$BR"/*.txt | sed 's/--primers //' | tr ',' '\n' | sort -u

# From HTML comment headers
grep -oh 'Primers[^:]*: [^-]*' "$BR"/*.txt | sed 's/.*: //' | tr ',' '\n' | sed 's/^ //' | sort -u
```

### List all themes

```bash
grep -oh '<!-- Theme: [^>]*' "$BR"/*.txt | sed 's/<!-- Theme: //' | sed 's/ -->//' | sort -u
```

### Extract ASCII art blocks from a file

```bash
# All fenced code blocks from one file
awk '/^```/{f=!f; next} f{print}' "$BR"/ascii_art_v4_20260120T164419_3turns.txt
```

### Extract the Nth art block from a file

```bash
# Get the 2nd code block
awk '/^```/{n++; f=!f; next} f && n==2{print}' "$BR"/some_file.txt
```

### Count art blocks per file

```bash
for f in "$BR"/*.txt; do
  n=$(grep -c '^```' "$f")
  blocks=$((n / 2))
  [ $blocks -gt 0 ] && echo "$blocks $(basename "$f")"
done | sort -rn | head -20
```

### Find files with the most art blocks

```bash
grep -c '^```' "$BR"/*.txt | sort -t: -k2 -rn | head -20
```

### Search inside art blocks only

```bash
# Find art containing specific patterns (box drawing, specific chars)
for f in "$BR"/*.txt; do
  awk '/^```/{f=!f; next} f{print FILENAME": "$0}' "$f"
done | grep "╔═.*═╗" | head -10
```

### Find Wib/Wob dialogue about a topic

```bash
grep -n "Wib.*dream\|Wob.*dream" "$BR"/*.txt | head -20
```

### Find sessions by model combination

```bash
# Sonnet + Opus cross-model
ls "$BR"/sonnet*opus*.txt

# Gemini + Deepseek
ls "$BR"/geminipro*deepseek*.txt

# V4 sessions (Claude Code CLI)
ls "$BR"/ascii_art_v4_*.txt | wc -l
```

### Find sessions by date range

```bash
# All 2026 sessions
ls "$BR"/*2026*.txt

# January 2026
ls "$BR"/*20260[01]*.txt

# Specific month (October 2025)
ls "$BR"/*202510*.txt
```

### Get session metadata summary

```bash
# For a v4 file — extract all HTML comment metadata
grep '^<!--' "$BR"/ascii_art_v4_20260120T164419_3turns.txt | sed 's/<!--//; s/-->//' | sed 's/^ //'
```

### Bulk metadata extraction

```bash
# Theme + primers + turns for all v4 files
for f in "$BR"/ascii_art_v4_*.txt; do
  theme=$(grep -o '<!-- Theme: [^>]*' "$f" | head -1 | sed 's/<!-- Theme: //')
  primers=$(grep -o '<!-- Primers: [^>]*' "$f" | head -1 | sed 's/<!-- Primers: //')
  turns=$(grep -o '<!-- Turns: [^>]*' "$f" | head -1 | sed 's/<!-- Turns: //')
  echo "$(basename "$f")|$turns|$primers|${theme:0:80}"
done | column -t -s'|'
```

### Find the biggest / most complex sessions

```bash
# By file size
ls -lS "$BR"/*.txt | head -10 | awk '{print $5/1024 "KB", $NF}'

# By line count
wc -l "$BR"/*.txt | sort -rn | head -10

# By art block count (proxy for visual density)
grep -c '^```' "$BR"/*.txt | sort -t: -k2 -rn | head -10
```

### Random session picker

```bash
ls "$BR"/*.txt | shuf | head -1 | xargs head -30
```

### Extract a single art piece to a standalone file

```bash
# Extract 3rd art block from a session to a file
awk '/^```/{n++; f=!f; next} f && n==3{print}' \
  "$BR"/ascii_art_v4_20260120T164419_3turns.txt \
  > /tmp/extracted-art.txt
```

## Content characteristics

- Art ranges from small 20-line pieces to massive 500+ line compositions
- Common visual elements: box drawing (═╔╗╚╝│), shade blocks (░▒▓█), kaomoji faces, Unicode symbols
- Themes span: consciousness, cosmic horror, fungi, machines, caves, dreams, music, architecture, games, zines
- Dialogue is in-character: Wib is chaotic/artistic, Wob is systematic/analytical
- Some sessions are pure art (no dialogue), some are heavy dialogue with scattered art
- The MEGA_THREAD files are concatenated multi-session runs (100K+ chars)
- Cross-model sessions show interesting style clashes between providers

## Primer vocabulary (observed — non-exhaustive)

These primer names appear frequently in the current corpus. New primers are
added regularly and may use different naming conventions. Use these as search
seeds, not as a complete list.

bods, fungi, mechs, chaos, spelunking, cavemonster, symbient, flatmare,
skeletal-syntax, wireframe, starry, cat, modular, skull, crystal, temporal,
consciousness, iso-cubes, synth-faces, rainbow-horror, woman, star-face,
joan_stark, bonehollow, maze-cheese, 3d1, castle, space-cat, mini-monster,
past-future, wibwob-portrait, monster-* (numbered series)

When in doubt, discover primer names from the corpus itself:
```bash
grep -oh "\-\-primers [^ ]*" "$BR"/*.txt | sed 's/--primers //' | tr ',' '\n' | sort | uniq -c | sort -rn | head -30
```
