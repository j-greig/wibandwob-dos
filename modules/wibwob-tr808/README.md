# TR-808 Drum Machine

ASCII art Roland TR-808 Rhythm Composer for WibWob-DOS.

## Architecture

```
engine.ts     Pure state machine — patterns, transport, params
renderer.ts   Pure ASCII renderer — no blessed dependency
audio.ts      Analog drum synthesis in TypeScript (afplay on macOS)
index.ts      Microapp wiring — keyboard, commands, snapshot
```

Designed as a modular building block. The engine and renderer have no
UI dependencies — they could drive any text surface. The audio engine
generates WAV samples from scratch using pure TypeScript DSP.

## Instruments

13 voices matching the real TR-808:

| ID | Name | Controls |
|----|------|----------|
| BD | Bass Drum | Tune, Attack, Decay, Level |
| SD | Snare Drum | Tune, Tone, Snappy, Decay, Level |
| LT | Low Tom | Tune, Decay, Level |
| MT | Mid Tom | Tune, Decay, Level |
| HT | Hi Tom | Tune, Decay, Level |
| RS | Rim Shot | Level |
| CB | Cowbell | Level |
| CP | Hand Clap | Snappy, Level |
| MA | Maracas | Level |
| CL | Claves | Level |
| CY | Cymbal | Tune, Decay, Level |
| OH | Open Hi-Hat | Decay, Level |
| CH | Closed Hi-Hat | Level |
| AC | Accent | Level (global) |

## Pattern Storage

32 slots: 2 banks (A/B) × 8 patterns (1-8) × 2 variations (A/B).

## Preset Patterns

classic-house, electro, trap, bossa, breakbeat, reggaeton, minimal, afrobeat

## Keyboard Controls

| Key | Action |
|-----|--------|
| SPACE | Play/stop |
| ENTER | Toggle step at cursor |
| ←/→ | Move step cursor |
| 1-9, 0, -, = | Select instrument (BD through OH) |
| BKSP | Select CH |
| ` | Select Accent |
| a/z | Tempo +/-5 |
| A/Z | Tempo +/-1 |
| v | Toggle variation A/B |
| b | Toggle bank A/B |
| F1-F8 | Select pattern 1-8 |
| p | Cycle preset patterns |
| c | Clear selected instrument |
| C | Clear entire pattern |
| s | Cycle pre-scale (16th/32nd/8th-triplet) |
| m | Toggle audio mute |
| q/ESC | Close |

## API Commands

All via `POST /commands/run`:

```
microapp.wibwob.tr808.open
microapp.wibwob.tr808.play
microapp.wibwob.tr808.stop
microapp.wibwob.tr808.tempo          {bpm: 140}
microapp.wibwob.tr808.select         {instrument: "sd"}
microapp.wibwob.tr808.toggle-step    {step: 4, instrument?: "bd"}
microapp.wibwob.tr808.set-step       {instrument: "bd", step: 0, active: true}
microapp.wibwob.tr808.set-param      {instrument: "bd", param: "tune", value: 75}
microapp.wibwob.tr808.load-preset    {preset: "classic-house"}
microapp.wibwob.tr808.clear          {all?: true, instrument?: "bd"}
microapp.wibwob.tr808.set-pattern    {bank?: "A", number?: 1, variation?: "A"}
```

## Text Input Commands

Via `POST /windows/input {id: N, input: "command\r"}`:

```
play, stop, toggle
tempo 140
select bd
toggle 4        (toggle step on selected instrument)
toggle bd 4     (toggle step on specific instrument)
set bd 0 on     (set step explicitly)
param bd tune 75
bank a, bank b
variation a, variation b
pattern 3
preset classic-house
clear, clear all
scale 16th
accent 80
master 100
laststep 12
mute, unmute
```

## Sound Synthesis

Each voice is synthesised from mathematical primitives — no samples:

- **Percussive** (BD, Toms): pitch-sweeping sine with exponential decay
- **Noisy** (SD, CP, MA): filtered white noise with ADSR envelopes
- **Metallic** (CB): two detuned square waves through lowpass
- **Transient** (RS, CL): short tonal clicks
- **Cymbal/Hats** (CY, OH, CH): highpass-filtered noise with variable decay

Parameters affect synthesis in real-time — changing BD tune re-renders
the sample at the new pitch.

## Future Directions

- Song mode (pattern chaining)
- WAV export of pattern loops
- WebAudio playback (cross-platform)
- Modular connectivity (clock sync with other microapps)
- Visual pattern editing with mouse
