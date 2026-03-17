# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "scipy", "mido", "python-rtmidi", "sounddevice"]
# ///
"""
Chiptune MIDI Synth — real-time synthesizer driven by signls (or any MIDI source).

Uses the chiptune-studio bricks oscillators + effects for sound generation,
sounddevice for audio output, and mido/rtmidi for MIDI input.

Usage:
    uv run vendor/signls/chiptune-synth.py [--preset PRESET] [--port PORT_NAME]

Presets: nes_pulse, fat_saw, acid_bass, soft_triangle, reese_bass, bitcrush_lead
"""

import argparse
import sys
import os
import threading
import time
import numpy as np

# Wire up bricks
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".pi", "skills", "chiptune-studio", "scripts"))
from bricks import osc, fx

import sounddevice as sd
import mido

# ── Audio engine constants ────────────────────────────────────────────────────

SR = 48000  # Match default macOS output device
BLOCK_SIZE = 512  # larger buffer = fewer underruns
MAX_VOICES = 8
VOICE_RELEASE = 0.15  # seconds of release tail after note-off

# ── MIDI helpers ──────────────────────────────────────────────────────────────

def midi_to_freq(note: int) -> float:
    return 440.0 * (2.0 ** ((note - 69) / 12.0))

NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
def midi_to_name(note: int) -> str:
    return f"{NOTE_NAMES[note % 12]}{note // 12 - 1}"

# ── Voice ─────────────────────────────────────────────────────────────────────

class Voice:
    """A single monophonic voice with ADSR envelope."""
    
    def __init__(self, note: int, velocity: int, preset: dict):
        self.note = note
        self.freq = midi_to_freq(note)
        self.velocity = velocity / 127.0
        self.preset = preset
        self.phase = 0.0
        self.active = True
        self.releasing = False
        self.release_time = 0.0
        self.age = 0.0  # seconds since note-on
        
        # ADSR state
        self.env_stage = 'attack'  # attack, decay, sustain, release
        self.env_level = 0.0
        self.attack = preset.get('attack', 0.005)
        self.decay = preset.get('decay', 0.1)
        self.sustain = preset.get('sustain', 0.7)
        self.release = preset.get('release', VOICE_RELEASE)
    
    def note_off(self):
        self.releasing = True
        self.env_stage = 'release'
        self.release_time = 0.0
    
    def render(self, n_samples: int) -> np.ndarray:
        """Render n_samples of audio for this voice."""
        if not self.active:
            return np.zeros(n_samples)
        
        t = np.arange(n_samples) / SR
        phase_array = self.phase + self.freq * t
        
        # Generate waveform based on preset
        wave_type = self.preset.get('wave', 'square')
        if wave_type == 'square':
            duty = self.preset.get('duty', 0.5)
            from scipy import signal as sp
            samples = sp.square(2 * np.pi * phase_array, duty=duty).astype(np.float64)
        elif wave_type == 'sawtooth':
            from scipy import signal as sp
            samples = sp.sawtooth(2 * np.pi * phase_array).astype(np.float64)
        elif wave_type == 'triangle':
            from scipy import signal as sp
            samples = sp.sawtooth(2 * np.pi * phase_array, width=0.5).astype(np.float64)
        elif wave_type == 'sine':
            samples = np.sin(2 * np.pi * phase_array)
        elif wave_type == 'reese':
            # Two detuned saws
            detune = self.preset.get('detune', 0.008)
            from scipy import signal as sp
            a = sp.sawtooth(2 * np.pi * phase_array).astype(np.float64)
            b = sp.sawtooth(2 * np.pi * phase_array * (1.0 + detune)).astype(np.float64)
            samples = (a + b) * 0.5
        elif wave_type == 'pulse_detune':
            # Two detuned squares for fat NES sound
            detune = self.preset.get('detune', 0.005)
            duty = self.preset.get('duty', 0.25)
            from scipy import signal as sp
            a = sp.square(2 * np.pi * phase_array, duty=duty).astype(np.float64)
            b = sp.square(2 * np.pi * phase_array * (1.0 + detune), duty=duty).astype(np.float64)
            samples = (a + b) * 0.5
        else:
            samples = np.sin(2 * np.pi * phase_array)
        
        # Update phase (keep it from growing unbounded)
        self.phase = (self.phase + self.freq * n_samples / SR) % 1.0
        
        # Apply ADSR envelope
        envelope = self._compute_envelope(n_samples)
        samples *= envelope
        
        # Apply effects from preset
        if 'bitcrush' in self.preset:
            samples = fx.bitcrush(samples, depth=self.preset['bitcrush'])
        
        if 'lowpass' in self.preset:
            cutoff = self.preset['lowpass']
            # Modulate cutoff with envelope for filter sweep
            if self.preset.get('filter_env', False):
                cutoff = cutoff * (0.3 + 0.7 * np.mean(envelope))
            try:
                samples = fx.lowpass(samples, cutoff, sr=SR)
            except Exception:
                pass
        
        # Apply velocity
        samples *= self.velocity * self.preset.get('volume', 0.4)
        
        self.age += n_samples / SR
        return samples
    
    def _compute_envelope(self, n_samples: int) -> np.ndarray:
        """Generate per-sample ADSR envelope — vectorized for performance."""
        envelope = np.empty(n_samples)
        pos = 0
        
        while pos < n_samples:
            remaining = n_samples - pos
            
            if self.env_stage == 'attack':
                if self.attack <= 0:
                    self.env_level = 1.0
                    self.env_stage = 'decay'
                    continue
                rate = 1.0 / (self.attack * SR)
                samples_to_peak = max(1, int((1.0 - self.env_level) / rate))
                n = min(remaining, samples_to_peak)
                envelope[pos:pos+n] = np.linspace(self.env_level, self.env_level + rate * n, n, endpoint=False)
                self.env_level += rate * n
                pos += n
                if self.env_level >= 1.0:
                    self.env_level = 1.0
                    self.env_stage = 'decay'
            
            elif self.env_stage == 'decay':
                if self.decay <= 0:
                    self.env_level = self.sustain
                    self.env_stage = 'sustain'
                    continue
                rate = (1.0 - self.sustain) / (self.decay * SR)
                samples_to_sustain = max(1, int((self.env_level - self.sustain) / rate))
                n = min(remaining, samples_to_sustain)
                envelope[pos:pos+n] = np.linspace(self.env_level, self.env_level - rate * n, n, endpoint=False)
                self.env_level -= rate * n
                pos += n
                if self.env_level <= self.sustain:
                    self.env_level = self.sustain
                    self.env_stage = 'sustain'
            
            elif self.env_stage == 'sustain':
                envelope[pos:n_samples] = self.sustain
                pos = n_samples
            
            elif self.env_stage == 'release':
                if self.release <= 0:
                    self.env_level = 0.0
                    self.active = False
                    envelope[pos:n_samples] = 0.0
                    pos = n_samples
                    continue
                rate = self.sustain / (self.release * SR)
                if rate <= 0:
                    self.active = False
                    envelope[pos:n_samples] = 0.0
                    pos = n_samples
                    continue
                samples_to_zero = max(1, int(self.env_level / rate))
                n = min(remaining, samples_to_zero)
                envelope[pos:pos+n] = np.linspace(self.env_level, max(0, self.env_level - rate * n), n, endpoint=False)
                self.env_level = max(0, self.env_level - rate * n)
                pos += n
                if self.env_level <= 0.0:
                    self.env_level = 0.0
                    self.active = False
                    envelope[pos:n_samples] = 0.0
                    pos = n_samples
        
        return envelope

# ── Presets ───────────────────────────────────────────────────────────────────

PRESETS = {
    'nes_pulse': {
        'wave': 'pulse_detune',
        'duty': 0.25,
        'detune': 0.004,
        'bitcrush': 5,
        'attack': 0.003,
        'decay': 0.08,
        'sustain': 0.6,
        'release': 0.1,
        'volume': 0.35,
    },
    'fat_saw': {
        'wave': 'sawtooth',
        'bitcrush': 6,
        'lowpass': 4000,
        'attack': 0.01,
        'decay': 0.15,
        'sustain': 0.7,
        'release': 0.2,
        'volume': 0.3,
    },
    'acid_bass': {
        'wave': 'sawtooth',
        'lowpass': 2000,
        'filter_env': True,
        'attack': 0.002,
        'decay': 0.2,
        'sustain': 0.3,
        'release': 0.08,
        'volume': 0.5,
    },
    'soft_triangle': {
        'wave': 'triangle',
        'attack': 0.02,
        'decay': 0.3,
        'sustain': 0.5,
        'release': 0.4,
        'volume': 0.5,
    },
    'reese_bass': {
        'wave': 'reese',
        'detune': 0.01,
        'lowpass': 1200,
        'bitcrush': 7,
        'attack': 0.01,
        'decay': 0.1,
        'sustain': 0.8,
        'release': 0.15,
        'volume': 0.45,
    },
    'bitcrush_lead': {
        'wave': 'square',
        'duty': 0.5,
        'bitcrush': 4,
        'attack': 0.005,
        'decay': 0.05,
        'sustain': 0.8,
        'release': 0.12,
        'volume': 0.3,
    },
    'bell': {
        'wave': 'sine',
        'attack': 0.001,
        'decay': 0.5,
        'sustain': 0.1,
        'release': 0.8,
        'volume': 0.5,
    },
    'chip_pad': {
        'wave': 'pulse_detune',
        'duty': 0.5,
        'detune': 0.008,
        'lowpass': 3000,
        'bitcrush': 6,
        'attack': 0.15,
        'decay': 0.3,
        'sustain': 0.6,
        'release': 0.5,
        'volume': 0.3,
    },
}

# ── Synth Engine ──────────────────────────────────────────────────────────────

class ChiptuneSynth:
    def __init__(self, preset_name='nes_pulse'):
        self.preset = PRESETS.get(preset_name, PRESETS['nes_pulse'])
        self.preset_name = preset_name
        self.voices: list[Voice] = []
        self.lock = threading.Lock()
    
    def note_on(self, note: int, velocity: int):
        with self.lock:
            # Kill ALL existing voices on this note immediately
            self.voices = [v for v in self.voices if v.note != note]
            
            # Add new voice
            voice = Voice(note, velocity, self.preset)
            self.voices.append(voice)
            
            # Voice stealing — hard kill oldest if too many
            if len(self.voices) > MAX_VOICES:
                self.voices = self.voices[-MAX_VOICES:]
            
            print(f"  ♪ ON  {midi_to_name(note):>4s} vel={velocity:3d}  voices={len(self.voices)}")
    
    def note_off(self, note: int):
        with self.lock:
            for v in self.voices:
                if v.note == note and v.active and not v.releasing:
                    v.note_off()
            # Also hard-kill any voice on this note that's been releasing too long
            self.voices = [v for v in self.voices if not (v.note == note and not v.active)]
    
    def render(self, n_samples: int) -> np.ndarray:
        with self.lock:
            if not self.voices:
                return np.zeros(n_samples)
            
            output = np.zeros(n_samples)
            for v in self.voices:
                if v.active:
                    output += v.render(n_samples)
            
            # Remove dead voices
            self.voices = [v for v in self.voices if v.active]
            
            # Mix down and soft clip — prevent distortion
            output *= 0.4
            output = np.tanh(output)
            
            return output

# ── Main ──────────────────────────────────────────────────────────────────────

def list_midi_ports():
    inputs = mido.get_input_names()
    if not inputs:
        print("No MIDI input ports found.")
        print("Make sure signls is running (it creates 'Signls Default Midi Output')")
    else:
        print("Available MIDI input ports:")
        for i, name in enumerate(inputs):
            print(f"  [{i}] {name}")
    return inputs

def find_signls_port(ports: list[str], preferred: str | None = None) -> str | None:
    if preferred:
        for p in ports:
            if preferred.lower() in p.lower():
                return p
    # Auto-detect signls
    for p in ports:
        if 'signls' in p.lower():
            return p
    # Fall back to first port
    return ports[0] if ports else None

def main():
    parser = argparse.ArgumentParser(description="Chiptune MIDI Synth — bricks-powered")
    parser.add_argument('--preset', default='nes_pulse', choices=list(PRESETS.keys()),
                        help='Synth preset to use')
    parser.add_argument('--port', default=None, help='MIDI input port name (partial match)')
    parser.add_argument('--list-ports', action='store_true', help='List MIDI ports and exit')
    parser.add_argument('--list-presets', action='store_true', help='List presets and exit')
    args = parser.parse_args()
    
    if args.list_presets:
        print("Available presets:")
        for name, p in PRESETS.items():
            print(f"  {name:20s}  wave={p['wave']}", end="")
            if 'bitcrush' in p: print(f"  crush={p['bitcrush']}", end="")
            if 'lowpass' in p: print(f"  lp={p['lowpass']}Hz", end="")
            print()
        return
    
    ports = list_midi_ports()
    
    if args.list_ports:
        return
    
    port_name = find_signls_port(ports, args.port)
    if not port_name:
        print("\n✗ No MIDI port found. Is signls running?")
        print("  Launch it: signls { action: 'launch' }")
        sys.exit(1)
    
    synth = ChiptuneSynth(args.preset)
    
    print(f"""
╔══════════════════════════════════════════════╗
║  🎵 Chiptune MIDI Synth                     ║
║                                              ║
║  Preset:  {args.preset:<34s} ║
║  MIDI:    {port_name:<34s} ║
║  Audio:   {SR}Hz / {BLOCK_SIZE} samples              ║
║                                              ║
║  Ctrl+C to quit                              ║
╚══════════════════════════════════════════════╝
""")
    
    # Start audio stream
    def audio_callback(outdata, frames, time_info, status):
        if status:
            pass  # Ignore underflow warnings
        audio = synth.render(frames)
        outdata[:, 0] = audio.astype(np.float32)
    
    stream = sd.OutputStream(
        samplerate=SR,
        blocksize=BLOCK_SIZE,
        channels=1,
        dtype='float32',
        callback=audio_callback,
    )
    
    try:
        stream.start()
        
        with mido.open_input(port_name) as midi_in:
            print(f"Listening on '{port_name}'... press space in signls to play!")
            print(f"All incoming MIDI messages will be logged below:\n")
            msg_count = 0
            
            for msg in midi_in:
                msg_count += 1
                # Log ALL messages so we can see what's arriving
                print(f"  [{msg_count:4d}] {msg}")
                
                if msg.type == 'note_on':
                    if msg.velocity > 0:
                        synth.note_on(msg.note, msg.velocity)
                    else:
                        synth.note_off(msg.note)
                elif msg.type == 'note_off':
                    synth.note_off(msg.note)
    
    except KeyboardInterrupt:
        print("\n\n✓ Synth stopped.")
    finally:
        stream.stop()
        stream.close()

if __name__ == '__main__':
    main()
