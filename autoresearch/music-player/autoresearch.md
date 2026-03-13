# Autoresearch — Music Player UI Quality

## Objective

Improve the Music Player window (src/windows/music-player-window.ts, function openMusicPlayerWindow).
Score screenshots against a 5-axis rubric. Higher is better. Target: beat baseline convincingly.

## Files in Scope

ONLY `src/windows/music-player-window.ts` may be modified. No other source files.

## Rubric — Five Axes (each 1-10)

### LAYOUT (L)
Use of space, balance between visualizer/controls/track info.
Good: visualizer fills available space, controls clear and accessible, track info prominent.
Bad: cramped, wasted space, controls squished.

### READABILITY (R)
Text legibility, information hierarchy, scannable content.
Good: track name clear, time display prominent, volume level visible.
Bad: tiny text, no hierarchy, information buried.

### AESTHETIC (A)
Colour harmony via theme tokens, visual interest, visualizer quality.
Good: theme-consistent, visualizer engaging, transport buttons polished.
Bad: monochrome, flat, no visual energy.

### COHERENCE (Co)
Feels like one designed thing. Controls, visualizer, track info connected.
Good: unified chrome, consistent spacing, everything feels intentional.
Bad: widgets feel bolted on, visualizer disconnected from controls.

### CHARACTER (Ch)
Personality, charm. Does it feel like a proper music player worth using?
Good: thoughtful details, now-playing display, responsive to playback state.
Bad: bare-minimum player, no personality.

## Primary Metric

ui_score = (L + R + A + Co + Ch) / 5

## Scoring Discipline

- Score EACH axis independently before averaging
- Compare against baseline screenshot, not memory
- Same score = discard (no neutral keeps)

## Constraints

- No new npm dependencies
- Must pass `bun run typecheck`
- Must load and appear in app
- Use theme tokens — never hardcode colours

## What's Been Tried

(none yet)
