# ASCII Cinema — Dev Log

## 2026-03-08: Shrigley Film v4 + Retrospective

### What we made
- 36-frame Shrigley-style film, 42s, hyperpop soundtrack
- 10 animated chapters with persistent text + evolving art
- 3 figlet karaoke subtitle cards (ERROR 404, KINDLED NOT CODED, CAT IS WATCHING)
- Joan Stark ASCII art + original deadpan captions

### Versions produced
| Version | Frames | Duration | Key change |
|---------|--------|----------|------------|
| v1 | 15 | 36s | Original static slides, equal timing |
| v2 | 33 | 36s | Animated variants, art→text reveals |
| v3 | 36 | 36s | + figlet cards, better reading time |
| v4 | 36 | 42s | Normalized chapters, stable text positioning, padded audio |

### Tools created/modified this session
- `normalize_chapters.py` — NEW: pads chapter frame groups to identical dimensions
- `ansi2portrait.py` — MODIFIED: added `--fixed-size WxH` mode, `fixed_size` param to `render_portrait()`
- `shrigley_hyperpop.py` — MODIFIED: 12 vocal hits, 2x volume, cumulative timecodes
- 30+ new .txt frame files (b-series animated chapters)

### Key realization
The user's request evolved across 4 distinct phases:
1. "Make slides" → static picture book
2. "Vary pacing" → timecoded variable durations
3. "Add figlet karaoke" → typographic punch cards
4. "Text shouldn't jiggle" → chapter normalization + fixed-size rendering
5. "Animated slides where text persists" → complete frame redesign

Each phase required re-understanding the intent. A storyboard format that captures "chapters with persistent text and evolving art" upfront would have collapsed phases 2-5 into one.

### Files
- Spike findings: `spk01-findings.md`
- Session diary: `scratch/grime-video/SESSION-DIARY.md`
- Final video: `scratch/grime-video/shrigley/shrigley-v4.mp4`
