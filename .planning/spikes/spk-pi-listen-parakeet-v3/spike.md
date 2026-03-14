---
title: "Spike: Local Parakeet V3 STT for pi-listen"
status: in-progress
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

## What was built (skipped Phase 1, went direct to Phase 2)

Skipped the Handy-as-backend approach entirely. Instead built a direct
sherpa-onnx-node integration using the OfflineRecognizer API.

### Proof of concept results

- sherpa-onnx-node v1.12.29 works in Bun (native addon, no issues)
- Parakeet V3 int8 model: 2.2s load time, 190ms to decode 3.8s of audio
- RTF 0.049 (20x faster than real-time on Apple Silicon)

### Files created/modified

- `~/.pi/agent/extensions/voice.ts` — modded pi-listen with local backend
- `~/.pi/agent/extensions/voice/sherpa.ts` — sherpa-onnx backend module
- `~/.pi/agent/extensions/voice/config.ts` — added backend/localModelPath fields
- `~/.pi/agent/extensions/voice/deepgram.ts` — unchanged (still available)
- `~/.pi/agent/extensions/voice/onboarding.ts` — unchanged
- `~/.pi/agent/extensions/node_modules/` — sherpa-onnx-node installed here
- `~/Library/Application Support/sherpa-onnx/parakeet-tdt-0.6b-v3-int8/` — model files
- `scratch/pi-listen-modded/` — backup of modded extension in repo
- `scratch/pi-listen-original/` — backup of original pi-listen source

### Architecture

- Config default backend changed from `"deepgram"` to `"local"`
- When backend is `"local"`:
  - Audio captured via sox/ffmpeg (same as Deepgram path)
  - PCM chunks accumulated in memory during recording
  - On stop: concatenate chunks, convert s16le to float32, run OfflineRecognizer
  - Model cached after first load (~2.2s), subsequent decodes are instant
  - No API key needed, fully offline
  - No streaming interim transcripts (batch decode on release)
  - "transcribing..." widget shown during decode
- When backend is `"deepgram"`: original behavior unchanged
- `/voice backend local` / `/voice backend deepgram` to switch
- `/voice info` and `/voice-settings` show backend-specific info
- Session start auto-activates if model found (no onboarding wizard)

## Checklist

### Phase 1: Handy backend proof-of-concept — SKIPPED

Went directly to sherpa-onnx-node integration (better architecture).

### Phase 2: sherpa-onnx bridge (production quality)

- [x] Install sherpa-onnx-node (npm, works in Bun)
- [x] Test: decode test WAV with Parakeet V3 model (190ms for 3.8s audio)
- [x] Download sherpa-onnx-compatible Parakeet V3 int8 model (464MB)
- [x] Install model to ~/Library/Application Support/sherpa-onnx/
- [x] Add `"local"` backend option to config
- [x] Implement sherpa.ts backend module (startLocalSession/stopLocalSession)
- [x] Wire into voice.ts (startLocalRecording, stopVoiceRecording branches)
- [x] Auto-activate on session start when model is available
- [x] `/voice backend` command to switch backends
- [x] Updated /voice info, /voice-settings, /voice test for local backend
- [x] Escape cancellation handles local sessions
- [x] Cleanup on session shutdown handles local sessions
- [x] Uninstalled original pi-listen package, removed from settings
- [ ] Test end-to-end: hold SPACE, speak, release, text appears in pi editor
- [ ] Benchmark latency in real usage (model load + decode)

### Phase 3: polish

- [x] Model auto-discovery from known paths
- [x] Config: localModelPath override for custom installs
- [ ] Fallback chain: try local first, fall back to Deepgram if model not found
- [ ] Language support: Parakeet V3 supports 25 European languages
- [ ] Docs: update README with local STT setup instructions
- [ ] Consider OnlineRecognizer for streaming interim transcripts
