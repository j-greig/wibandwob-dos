---
title: "Spike: Local Parakeet V3 STT for pi-listen"
status: not-started
created: 2026-03-14
---

# Spike: Local Parakeet V3 STT for pi-listen

## Context

pi-listen (`@codexstar/pi-listen` v4.0.1) currently uses Deepgram Nova-3 via
cloud WebSocket streaming for speech-to-text. This requires a DEEPGRAM_API_KEY
and an internet connection.

Handy (https://github.com/cjpais/Handy) is already installed and running on
this macOS system with Parakeet V3 active and loaded. The Parakeet V3 int8
ONNX model files live at:

    ~/Library/Application Support/com.pais.handy/models/parakeet-tdt-0.6b-v3-int8/

Model files (639MB total):
- `encoder-model.int8.onnx` (622MB) -- Conformer encoder
- `decoder_joint-model.int8.onnx` (17MB) -- TDT joint decoder
- `nemo128.onnx` (136KB) -- mel spectrogram preprocessor
- `config.json` -- model_type: nemo-conformer-tdt, features_size: 128, subsampling_factor: 8
- `vocab.txt` -- 8193 tokens (SentencePiece, includes special tokens)

## Repos

- pi-listen: https://github.com/codexstar69/pi-listen
- Handy: https://github.com/cjpais/Handy

## Goal

Mod the pi-listen voice extension to support a local Parakeet V3 backend as an
alternative to Deepgram cloud, using the model already on disk via Handy. No
API key needed. Fully offline.

## Two Candidate Paths

### Path A: Handy-as-backend (CLI + DB polling)

Use the running Handy process as a black-box STT service. pi-listen triggers
recording via Handy CLI, then polls its SQLite history DB for results.

Flow:
1. User holds SPACE in pi (existing hold-to-talk UX)
2. pi-listen spawns `handy --toggle-transcription` to start Handy recording
3. User releases SPACE
4. pi-listen spawns `handy --toggle-transcription` again to stop
5. Poll `~/Library/Application Support/com.pais.handy/history.db` for newest
   entry (compare timestamp to recording start)
6. Grab `transcription_text`, put it in pi editor

Pros:
- Minimal code. No ONNX runtime, no mel spectrogram math, no decoder logic
- Model already loaded in memory by Handy (fast inference)
- Handy handles VAD, audio capture, model lifecycle

Cons:
- No streaming/interim transcripts (Handy returns full text after recording)
- Handy captures its OWN mic audio, so pi-listen's sox/ffmpeg capture is unused
  (two processes fighting over the mic? need to test)
- Handy may try to type/paste result into the terminal (needs clipboard_handling
  set to `copy_to_clipboard` or equivalent, and paste_method disabled)
- Coupling to Handy process being running. Fragile: version changes, DB schema
- macOS only (Handy is a Tauri desktop app)
- No language control from pi-listen side (Handy has its own setting)
- Latency: DB polling adds delay vs streaming

Settings to tweak in Handy for this to work:
- `clipboard_handling`: change from `dont_modify` to `copy_to_clipboard`
- `paste_method`: need to suppress auto-paste entirely (Handy types into
  focused app by default -- would inject text into terminal)
- `push_to_talk`: already true, but pi-listen would be triggering via CLI
  not via Handy's own hotkey

Open question: can we suppress Handy's paste entirely and just read from the
DB? The `clipboard_handling: dont_modify` + no auto-paste might work if we
just trigger via CLI and read DB. Need to test.

### Path B: Direct ONNX inference (onnxruntime-node)

Run the Parakeet V3 ONNX model directly from Node/Bun using onnxruntime-node.
pi-listen captures audio (already does this), preprocesses it, runs inference.

Pipeline:
1. Audio capture via sox/ffmpeg (existing pi-listen code, 16kHz PCM)
2. Mel spectrogram: run audio through `nemo128.onnx` (128-dim mel features)
3. Encoder: feed mel frames into `encoder-model.int8.onnx`
4. Decoder: run `decoder_joint-model.int8.onnx` with TDT greedy decoding
5. Map token IDs to text via `vocab.txt`

Pros:
- Full control: streaming possible (chunk audio, run encoder incrementally)
- No dependency on Handy running
- Works on any OS with onnxruntime (not macOS-only)
- Can keep pi-listen's existing UX (hold-to-talk, warmup, live transcript)
- No API key needed, fully offline

Cons:
- Significant implementation effort (mel preprocessing, TDT decoding logic)
- onnxruntime-node compatibility with Bun unclear (may need Node subprocess)
- 622MB encoder model loaded into pi process memory
- Model loading time on first use (~2-5s)
- Need to understand NeMo Conformer TDT architecture for correct decoding
- Streaming requires chunked encoder inference (non-trivial with Conformer
  models that use full-context attention)

Technical details for TDT decoding:
- TDT (Token-and-Duration Transducer) is a variant of RNN-T
- Joint network takes encoder output + previous token
- Produces token logits + duration logits (how many frames to skip)
- Greedy: pick best token, advance by predicted duration, repeat
- Blank token = no output for this frame

Reference implementations:
- Handy uses `transcription-rs` (Rust, by cjpais) -- not open-sourced separately
- NeMo has Python reference: https://github.com/NVIDIA/NeMo
- sherpa-onnx has C++ Parakeet support: https://github.com/k2-fsa/sherpa-onnx

### Path C (hybrid): sherpa-onnx CLI bridge

sherpa-onnx provides pre-built CLI tools and C/C++ libraries for running
Parakeet ONNX models. Could use it as a subprocess bridge.

Flow:
1. pi-listen captures audio to temp WAV file (or pipes PCM)
2. Spawn sherpa-onnx CLI with the Handy model files
3. Parse text output
4. For streaming: use sherpa-onnx's streaming API via a small native addon or
   a Python bridge script

Pros:
- Correct inference guaranteed (sherpa-onnx team maintains Parakeet support)
- Available via brew or pre-built binaries
- Streaming support exists in the library
- Much less code than Path B

Cons:
- Extra dependency (sherpa-onnx)
- Subprocess overhead for non-streaming mode
- Streaming via subprocess requires IPC protocol design

## Recommendation

**Start with Path A (Handy-as-backend) as a quick proof-of-concept**, then
graduate to Path C (sherpa-onnx bridge) for production quality.

Path A can be built in a few hours and proves the concept: local STT in pi
with no API key. The UX tradeoff (no streaming transcripts) is acceptable for
a first cut since Parakeet V3 is fast enough that batch transcription feels
near-instant for short utterances.

Path C is the right production path because it gives streaming support and
doesn't couple to Handy being installed/running.

Path B is only worth it if we need zero external dependencies AND streaming,
and we're willing to invest significant time in TDT decoder implementation.

## Checklist

### Phase 1: Handy backend proof-of-concept

- [ ] Test Handy CLI control: verify `handy --toggle-transcription` starts/stops
      recording when Handy is already running
- [ ] Test Handy paste suppression: find settings combo that prevents Handy from
      typing into the active window (just transcribe + store in DB)
- [ ] Test DB polling: read newest entry from history.db after transcription
- [ ] Fork pi-listen extension locally (copy to ~/.pi/agent/extensions/ or
      project .pi/extensions/)
- [ ] Add `backend` config option: `"deepgram"` (default) or `"handy"`
- [ ] Implement Handy backend in voice extension:
  - [ ] On recording start: spawn `handy --toggle-transcription`
  - [ ] On recording stop: spawn `handy --toggle-transcription` (or --cancel)
  - [ ] Poll history.db for new entry (timeout after 10s)
  - [ ] Extract text, put in editor
- [ ] Skip Deepgram onboarding when backend is `"handy"`
- [ ] Test end-to-end: hold SPACE, speak, release, text appears
- [ ] Handle edge cases: Handy not running, model not loaded, empty transcription

### Phase 2: sherpa-onnx bridge (production quality)

- [ ] Install sherpa-onnx (`brew install sherpa-onnx` or build from source)
- [ ] Test CLI: pipe audio to sherpa-onnx with Handy's model files
- [ ] Add `"sherpa"` backend option
- [ ] Implement streaming: sherpa-onnx server mode or incremental CLI
- [ ] Wire streaming to pi-listen's existing live transcript widget
- [ ] Benchmark latency vs Deepgram
- [ ] Update /voice-setup to offer backend choice (Deepgram / Local Parakeet)

### Phase 3: polish

- [ ] Model auto-discovery: find Handy's model dir automatically
- [ ] Fallback chain: try local first, fall back to Deepgram if model not found
- [ ] Config: model path override for non-Handy installs
- [ ] Language support: Parakeet V3 supports 25 European languages
- [ ] Docs: update README with local STT setup instructions
