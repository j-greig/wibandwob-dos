#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "scipy"]
# ///
"""
fft-datastrip.py — Real-time FFT visualizer that renders frequency bands
as ANSI-colored blocks to a terminal row.

The shader reads these pixels from iChannel0 to drive audio-reactive visuals.

Two modes:
  --datastrip   Hidden data row at terminal bottom (machine-readable for shader)
  --bars        Full-height ASCII spectrum bars (human-readable visualizer)
  --both        Both: bars above, datastrip at bottom

Usage:
    python3 fft-datastrip.py <wav-file> [--bars|--datastrip|--both] [--bands N]
    
    # With play-shot.sh (pipe audio timing):
    python3 fft-datastrip.py shots/021-cathedral.wav --both &
    ffplay -nodisp -autoexit shots/021-cathedral.wav
"""

import sys, os, time, struct, math, argparse
import numpy as np
from scipy.io import wavfile
from scipy.fft import rfft

# ── ANSI helpers ──────────────────────────────────────────────────

def rgb_fg(r, g, b):
    return f"\033[38;2;{r};{g};{b}m"

def rgb_bg(r, g, b):
    return f"\033[48;2;{r};{g};{b}m"

RESET = "\033[0m"
HIDE_CURSOR = "\033[?25l"
SHOW_CURSOR = "\033[?25h"
CLEAR_LINE = "\033[2K"

def move_to(row, col):
    return f"\033[{row};{col}H"

# ── Frequency band colors (bass=red → treble=blue) ──────────────

def band_color(i, n, energy):
    """Color for frequency band i of n, modulated by energy (0-1)."""
    # Hue sweep: red (bass) → yellow → green → cyan → blue (treble)
    hue = i / max(n - 1, 1)  # 0-1
    
    # HSV to RGB (S=1, V=energy)
    h = hue * 5.0  # 0-5 (skip magenta)
    c = energy
    x = c * (1 - abs(h % 2 - 1))
    
    if h < 1:   r, g, b = c, x, 0
    elif h < 2: r, g, b = x, c, 0
    elif h < 3: r, g, b = 0, c, x
    elif h < 4: r, g, b = 0, x, c
    else:       r, g, b = x, 0, c
    
    return int(r * 255), int(g * 255), int(b * 255)


# ── FFT analysis ─────────────────────────────────────────────────

def analyze_frame(samples, sample_rate, num_bands):
    """FFT a chunk of audio, return energy per frequency band (0-1)."""
    # Mono mixdown if stereo
    if len(samples.shape) > 1:
        samples = samples.mean(axis=1)
    
    # Window function to reduce spectral leakage
    window = np.hanning(len(samples))
    windowed = samples * window
    
    # FFT
    spectrum = np.abs(rfft(windowed))
    freqs = np.fft.rfftfreq(len(samples), 1.0 / sample_rate)
    
    # Split into logarithmic frequency bands
    # Human hearing: 20Hz - 20kHz, log-spaced bands
    min_freq = 30
    max_freq = min(16000, sample_rate / 2)
    band_edges = np.logspace(np.log10(min_freq), np.log10(max_freq), num_bands + 1)
    
    energies = np.zeros(num_bands)
    for i in range(num_bands):
        lo = band_edges[i]
        hi = band_edges[i + 1]
        mask = (freqs >= lo) & (freqs < hi)
        if mask.any():
            energies[i] = np.mean(spectrum[mask] ** 2)
    
    # Normalize to 0-1 (with some headroom)
    max_e = energies.max()
    if max_e > 0:
        energies = energies / max_e
    
    # Apply slight smoothing / log compression for visual appeal
    energies = np.sqrt(energies)  # sqrt compression
    
    return energies


# ── Renderers ─────────────────────────────────────────────────────

def render_datastrip(energies, num_bands, cols):
    """Render a single row of colored blocks — machine-readable for shader."""
    # Each band gets cols/num_bands characters wide
    band_width = max(1, cols // num_bands)
    
    out = []
    for i, energy in enumerate(energies):
        r, g, b = band_color(i, num_bands, energy)
        block = rgb_bg(r, g, b) + " " * band_width
        out.append(block)
    
    return "".join(out) + RESET


def render_bars(energies, num_bands, cols, rows):
    """Render full-height spectrum analyzer bars."""
    band_width = max(1, (cols - 1) // num_bands)
    bar_chars = " ▁▂▃▄▅▆▇█"
    
    lines = []
    for row in range(rows):
        # Row 0 = top, row rows-1 = bottom
        threshold = 1.0 - (row + 1) / rows  # what energy level this row represents
        
        out = []
        for i, energy in enumerate(energies):
            r, g, b = band_color(i, num_bands, energy)
            
            if energy > threshold + (1.0 / rows):
                # Full block
                char = "█" * band_width
                out.append(rgb_fg(r, g, b) + char)
            elif energy > threshold:
                # Partial block (fractional row)
                frac = (energy - threshold) * rows
                idx = min(int(frac * (len(bar_chars) - 1)), len(bar_chars) - 1)
                char = bar_chars[idx] * band_width
                out.append(rgb_fg(r, g, b) + char)
            else:
                out.append(" " * band_width)
        
        lines.append("".join(out) + RESET)
    
    return lines


# ── Main loop ─────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Real-time FFT visualizer for terminal")
    parser.add_argument("wav", help="WAV file to analyze")
    parser.add_argument("--bands", type=int, default=32, help="Number of frequency bands (default: 32)")
    parser.add_argument("--bars", action="store_true", help="Full-height bar visualizer")
    parser.add_argument("--datastrip", action="store_true", help="Single data row for shader")
    parser.add_argument("--both", action="store_true", help="Bars + datastrip")
    parser.add_argument("--fps", type=int, default=30, help="Update rate (default: 30)")
    parser.add_argument("--delay", type=float, default=0.0, help="Delay start by N seconds (sync with ffplay)")
    args = parser.parse_args()
    
    if not any([args.bars, args.datastrip, args.both]):
        args.both = True
    
    # Read WAV
    sample_rate, data = wavfile.read(args.wav)
    if data.dtype != np.float64:
        data = data.astype(np.float64) / np.iinfo(data.dtype).max
    
    duration = len(data) / sample_rate
    chunk_size = sample_rate // args.fps  # samples per frame
    
    # Terminal size
    try:
        cols = os.get_terminal_size().columns
        rows = os.get_terminal_size().lines
    except:
        cols, rows = 120, 40
    
    # Reserve rows
    if args.both:
        bar_rows = rows - 3  # leave room for datastrip + status
    elif args.bars:
        bar_rows = rows - 2  # leave room for status
    else:
        bar_rows = 0
    
    # Smoothing state
    smooth_energies = np.zeros(args.bands)
    smooth_factor = 0.3  # 0=no smoothing, 1=frozen
    
    # Start
    sys.stdout.write(HIDE_CURSOR)
    sys.stdout.write("\033[2J")  # clear screen
    sys.stdout.flush()
    
    if args.delay > 0:
        time.sleep(args.delay)
    
    t0 = time.time()
    frame = 0
    
    try:
        while True:
            elapsed = time.time() - t0
            if elapsed >= duration:
                break
            
            # Get current audio chunk
            sample_idx = int(elapsed * sample_rate)
            chunk = data[sample_idx:sample_idx + chunk_size]
            if len(chunk) < chunk_size // 2:
                break
            
            # FFT
            energies = analyze_frame(chunk, sample_rate, args.bands)
            
            # Smooth
            smooth_energies = smooth_factor * smooth_energies + (1 - smooth_factor) * energies
            
            # Render
            if args.bars or args.both:
                bar_lines = render_bars(smooth_energies, args.bands, cols, bar_rows)
                for i, line in enumerate(bar_lines):
                    sys.stdout.write(move_to(i + 1, 1) + CLEAR_LINE + line)
            
            if args.datastrip or args.both:
                strip = render_datastrip(smooth_energies, args.bands, cols)
                strip_row = rows - 1 if args.both else 1
                sys.stdout.write(move_to(strip_row, 1) + CLEAR_LINE + strip)
            
            # Status line
            status_row = rows if (args.both or args.datastrip) else rows
            pct = elapsed / duration * 100
            peak_band = np.argmax(smooth_energies)
            peak_freq_label = f"peak: band {peak_band}/{args.bands}"
            status = f" {elapsed:.1f}s / {duration:.1f}s  [{pct:.0f}%]  {args.bands} bands @ {args.fps}fps  {peak_freq_label} "
            sys.stdout.write(move_to(status_row, 1) + CLEAR_LINE + rgb_fg(100, 100, 100) + status + RESET)
            
            sys.stdout.flush()
            
            # Frame pacing
            frame += 1
            target = t0 + frame / args.fps
            sleep_time = target - time.time()
            if sleep_time > 0:
                time.sleep(sleep_time)
    
    except KeyboardInterrupt:
        pass
    finally:
        sys.stdout.write(SHOW_CURSOR + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    main()
