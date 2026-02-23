# SPK-808 — TR-808 Drum Machine TUI

Status: in-progress
GitHub issue: —
PR: —

## Goal

Port jonchoukroun/jc-808 synthesis engine into WibWob-DOS as a TUI drum machine window. Pure C++ synthesis (kick, snare, clap, closed hat) with 16-step sequencer, rendered as an interactive grid in Turbo Vision.

## Source

- https://github.com/jonchoukroun/jc-808 (MIT-style, ~1263 lines)
- Instruments: Kick, Snare, Clap, ClosedHat — all sine/noise synthesis with amp/pitch envelopes and filters
- 16-step sequencer at configurable BPM
- Original uses SDL2 for audio callback

## Design

### Synthesis (copied + adapted)
- Strip SDL types → standard C++ (`int16_t`, `double`)
- Keep: Instrument, Kick, Snare, Clap, ClosedHat, Sequencer, AmpEnv, PitchEnv, Filter
- Sequencer API: `setNote()`, `start()`, `stop()`, `updateBy()`, `getActiveSamples()`

### Audio Backend
- macOS: `AudioQueueNewOutput` (AudioToolbox framework, no new deps)
- Callback fills PCM buffer from sequencer, same pattern as SDL version
- Mono 16-bit signed, 44100 Hz

### TUI View (`TDrumMachineView`)
- 16 columns × 4 rows (kick / snare / clap / hat)
- Toggle cells with Enter/Space/mouse click
- Visual playhead (highlighted column) advances with sequencer
- Tempo display + adjust (left/right or +/-)
- Space to start/stop
- Timer-driven redraw for playhead animation

### Integration
- App launcher: Tools category, "808" or "Drum Machine"
- Command registry: `open_drum_machine`
- Accessible via `tui_menu_command`

## ACs

- [ ] AC-01: Drum machine window opens from menu/API
  - Test: `open_drum_machine` command succeeds
- [ ] AC-02: 16-step grid renders with 4 instrument rows
  - Test: visual inspection
- [ ] AC-03: Toggling cells adds/removes notes from sequencer
  - Test: toggle + play → hear difference
- [ ] AC-04: Start/stop produces audible 808-style output
  - Test: press space → hear kick/hat pattern
- [ ] AC-05: Playhead animates across grid while playing
  - Test: visual inspection
- [ ] AC-06: Tempo adjustable from TUI
  - Test: change tempo → audible speed change
