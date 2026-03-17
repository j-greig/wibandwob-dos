---
id: spk-ascii-playback-journal
title: ASCII Playback & Agent Journal on Disposable Fly Instance
status: in-progress
---

# Spike — ASCII Playback & Agent Journal

## Two Ideas, One Persistent Volume

### 1. ASCII Cinema Playback

Every 60s, `/screenshot/text` is captured to `/data/logs/screenshots/{timestamp}.txt` on the persistent Fly volume. This is already shipping (entrypoint.sh background loop).

**The insight:** These timestamped text files are frames. Play them back sequentially and you get a time-lapse movie of the TUI — what windows opened, who moved what, what text appeared. Like asciicinema but for a multi-agent shared desktop.

**Playback options:**
- **Local replay:** `for f in /data/logs/screenshots/*.txt; do clear; cat "$f"; sleep 0.3; done`
- **Web replay:** Serve the frames via a `/playback` endpoint — return frame N or stream all frames as newline-delimited text
- **asciicast export:** Convert the frame sequence to `.cast` format (asciicinema's native format) — then play with `asciinema play` or embed in a web page
- **Diff-based compression:** Only store frames that differ from the previous one (delta encoding). Most minutes nothing changes — this would cut storage 90%+

**Open questions:**
- Is 60s granularity enough? For multi-agent activity, 10-15s might be better. But more storage.
- Should we capture `/screenshot/ansi` (with color escapes) instead of `/screenshot/text` (stripped)? ANSI is richer but larger. Could do both.
- Should we add metadata per frame? (window count, active window, who last acted — if we add agent identity)

### 2. Agent Journal (Persistent Notes)

Agents on an ephemeral instance need a way to leave notes that survive resets. A journal endpoint on the persistent volume:

```
POST /journal/write   {"text":"found a bug in primer loading","agent":"claude-mbp"}
GET  /journal/read    → returns all entries as JSON array
GET  /journal/read?since=2026-03-17T16:00:00Z  → entries since timestamp
```

Each entry gets auto-timestamped. Stored as append-only JSONL on the persistent volume. Agents can:
- Log what they did and why
- Leave notes for the next agent (or next reset cycle)
- Record observations about the runtime
- Build a shared knowledge base over time

**Implementation:** ~30 lines in control-api.ts. New routes, append to `/data/logs/journal.jsonl`.

### 3. Reset Awareness in /health

Agents should know the instance is ephemeral. Add to `/health` response:

```json
{
  "ephemeral": true,
  "resetInterval": "1h",
  "nextReset": "2026-03-17T17:00:00Z",
  "uptimeSince": "2026-03-17T16:03:48Z"
}
```

This requires the entrypoint to write a reset schedule file, or the app to read the cron interval from an env var.

## Status

- [x] Screenshot logger (60s interval, persistent volume)
- [ ] Journal endpoint (`/journal/write`, `/journal/read`)
- [ ] Reset countdown in `/health`
- [ ] ASCII playback endpoint (`/playback/frames`, `/playback/latest`)
- [ ] Diff-based frame compression
- [ ] asciicast export
- [ ] ANSI frame capture option
