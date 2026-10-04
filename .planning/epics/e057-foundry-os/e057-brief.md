---
id: e057
title: "FOUNDRY.EXE — a breeding foundry that obeys the window manager, and sounds like its own state"
status: not-started
branch: epic/e057-foundry-os
created: 2026-10-04
issue: —
pr: —
reference_engine: ~/Repos/wibandwob-heartbeat/scripts/foundryos/
reference_films: ~/Repos/wibandwob-heartbeat/output/foundry-os-2026-10-04/
---

# E057 — FOUNDRY.EXE

## Status

Status: not-started
GitHub issue: —
PR: —

A set of WibWob-DOS microapps that breed, mutate, manufacture and move genome
creatures between real windows, and play live audio derived from that state.
The offline engine `foundryos` (heartbeat repo) is the reference implementation:
the films it renders are the behavioural spec. Port its laws, not its code.

## Target runtime

The C++ Turbo Vision build (`~/Repos/wibandwob-dos-tvision`). Map the laws onto
it as follows; port this brief there when work starts.

- L1 is native: each `TView::draw()` writes a `TDrawBuffer` clipped to its own
  extent and the group composites by Z-order. Add an owner-map dump to the API
  for the AC test only.
- Register each foundry window type once in `WindowTypeRegistry` (`k_specs[]`).
- Channel and WM events go through the existing IPC event push
  (`publish_event`), so the Python bridge and agents see the same bus.
- Audio: an in-process mixer (e.g. miniaudio, single header) fed by the bus,
  stems keyed by window id, gain and low-pass from visible area per frame.
- Timers: evBroadcast tick (reaches all views without focus, see MEMORY.md).

Where the sections below name blessed, Bun or `afplay`, read them as the
TypeScript build's equivalents; the laws and ACs stand unchanged.

## Problem

The worldsim lab films let creatures fly across window borders. A terminal does
not allow that: every cell belongs to exactly one window, and data moves between
programs only through channels (pipes, process fork, files, clipboard, network).
Sound in the labs is mapped from event kind; it does not follow the genome, the
population, the machines or the window layout.

## Laws (every story is tested against these)

- **L1 Ownership.** A window draws only into its own client buffer. The
  compositor paints buffers by z-order. Nothing but the window manager (frames,
  shadows, drag outlines, menu bar, taskbar) draws outside a client rect.
  Test: no creature cell ever appears in a cell owned by a different window id
  (`/state` exposes the owner map; an assertion runs per frame in dev builds).
- **L2 Transit.** A creature leaves window A only by being serialised into a
  channel and re-materialised in window B. Every channel is itself a visible
  window with state. Allowed channels: pipe, fork, file copy, clipboard, packet
  bus. Test: each transit produces matching `channel.write` and `channel.read`
  events with the same creature id, and the creature is absent from A before it
  is complete in B (except fork, where both exist by design).
- **L3 One state.** Picture and audio read the same simulation state. No audio
  path reads anything the screen does not show. Test: muting audio and diffing
  `/state` snapshots gives identical results with audio on and off.
- **L4 The arrangement is the mix.** Each window is an audio stem. Gain follows
  the window's visible cell fraction; occluded cells low-pass the stem; the
  focused window is the lead (brighter, +6 dB); a minimised window collapses to a
  taskbar tick. Test: tiling four windows then maximising one changes stem gains
  as reported in `/state.audio.stems`.
- **L5 Pleasant.** One gamut and root per session (pentatonic default), every
  pitch snapped, harmonic partials, sustained onset density <= 8/s.

## Components

| id | window | state it owns | how it sounds |
|----|--------|---------------|---------------|
| C1 | `PEN.EXE` (n instances) | creatures, positions, census | each creature sings its genome motif round-robin; the census bar graph in the footer is the chord bed (bar height = voice gain) |
| C2 | `PROC.EXE` | process table: pid, ppid, state (R/S/Z), cpu | fork = two-voice split; page faults = ticks; zombie = held low note until reaped |
| C3 | `PIPE` | ring buffer of bytes, read/write pointers, blocked flag | each byte = one click pitched from byte value; fill level = drone; blocked = held tone |
| C4 | `NC.EXE` (dual-panel file manager) | two directory panels, cursor, copy job | cursor hops tick; copy progress = rising scale per block |
| C5 | `CLIPBRD` | selection rect, clipboard text | marquee = sweep per cell; paste = chord |
| C6 | `NET` | segment, nodes, packets (src, dst, seq, crc, payload) | packet hop ticks; collision = jam (noise allowed, low); crc error flips a nybble = audible note change |
| C7 | factory machines (`GENCC`, `MUTATOR`, `BREEDER`, `ASSEMBLER`, `QA`) | queues, throughput, backlog | each machine is an ostinato; tempo subdivision follows throughput; backlog adds ratchets |
| C8 | window manager hooks | layout mode, z-order, focus, rects | layout transitions animate outlines cell by cell (each hop voiced); tile/cascade/stack select ensemble/canon/solo (see L4 and F03) |

## Genome

16 hex nybbles. `n[0..7]` motif degrees, `n[8..11]` a 16-step rhythm mask,
`n[12]` timbre family, `n[13]` octave, `n[14..15]` body plan (indices into a
part library). Breeding is one-point crossover drawn on the genome strip;
mutation flips one nybble. The body is built from the genome, so a visible
change and an audible change share a cause.

## Features

### F01 — Window ownership and compositor
- [ ] Owner map per frame in WindowManager (cell -> window id), exposed on `/state`.
- [ ] Per-window client buffer API in the microapp SDK (`win.buffer.put`, clipped).
- [ ] Dev assertion: L1 test on every render when `WIBWOB_STRICT_OWNERSHIP=1`.

AC-1: With two overlapping PEN windows, no creature glyph from the back window
renders inside the front window's rect.
Test: `wibwob arrange cascade`; `GET /state` owner map; compare against
`captureText` of each window.

### F02 — Live audio bus
- [ ] Event bus in the foundry module: `{t, kind, win, r, c, freq, amp, part}`.
- [ ] Audio backend: one long-running sink process fed PCM blocks (a single
      `ffplay -f f32le -` or `sox` pipe; per-hit `afplay`, as the TR-808 uses,
      cannot hold a mix bus or per-stem filters).
- [ ] Block renderer (20 ms) mixing stems with L4 gains and filters.
- [ ] `/state.audio` reports stems, gains, cutoff, onset rate.

AC-2: `wibwob foundry mute` silences output and `/state` snapshots stay
identical to the unmuted run for the same seed (L3).

### F03 — Arrangement as music
- [ ] Tile: every pen sings (ensemble).
- [ ] Cascade: pen k starts its motif k steps late. The canon offset is the
      cascade offset, applied in state, never as an audio delay.
- [ ] Stack / maximise: front window solo, others muffled.
- [ ] Minimise: the window's events route to its taskbar button.
- [ ] Move/resize: drag outline hops cell by cell, each hop a tick; resize sets
      the pen's octave from client area (bigger window = lower).

AC-3: `wibwob arrange tile|cascade|stack` each produce the stem gain pattern in
L4 within 500 ms.

### F04 — Channels
- [ ] Pipe, fork, file copy, clipboard, packet bus as five microapps sharing
      one foundry state service.
- [ ] Packet crc error mutates the creature on arrival (seeded probability).

AC-4: A creature sent A -> B by each channel arrives in B and is gone from A
(fork excepted), and `/state` shows the channel's intermediate state during
transfer.

### F05 — Factory line
- [ ] Machines with queues; backlog visible; throughput drives subdivision.
- [ ] The OS writes a tool: `EDIT.COM` types source, `GENCC` compiles, a new
      window type registers via WindowTypeRegistry and opens.

## Out of scope

- Cross-instance creature travel (E021 owns multi-instance).
- Persisting creatures between sessions (file copy already writes files; a
  loader is a later story).

## Open questions

- Audio sink: `sox` is not installed by default on macOS. Choose between
  bundling, `ffplay`, or a Bun native audio module. Spike before F02.
- Frame budget: the reference engine ticks at ~30 Hz; blessed redraw at that
  rate across 6+ windows needs measuring (spike).
