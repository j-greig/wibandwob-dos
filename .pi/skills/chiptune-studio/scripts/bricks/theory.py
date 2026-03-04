"""Music theory — notes, scales, chords, frequencies. The shared vocabulary."""

NOTES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]

# Build chromatic frequency table (A4=440Hz)
_FREQ = {}
for _oct in range(0, 8):
    for _i, _name in enumerate(NOTES):
        _midi = (_oct + 1) * 12 + _i
        _FREQ[f"{_name}{_oct}"] = 440.0 * (2.0 ** ((_midi - 69) / 12.0))

# Enharmonic mapping
_ENHARMONIC = {"Db": "C#", "D#": "Eb", "Gb": "F#", "G#": "Ab", "A#": "Bb",
               "Cb": "B", "Fb": "E", "B#": "C", "E#": "F"}

SCALES = {
    "major":      [0, 2, 4, 5, 7, 9, 11],
    "minor":      [0, 2, 3, 5, 7, 8, 10],
    "dorian":     [0, 2, 3, 5, 7, 9, 10],
    "mixolydian": [0, 2, 4, 5, 7, 9, 10],
    "pentatonic": [0, 2, 4, 7, 9],
    "minor_pent": [0, 3, 5, 7, 10],
    "whole_tone": [0, 2, 4, 6, 8, 10],
    "chromatic":  list(range(12)),
    "blues":      [0, 3, 5, 6, 7, 10],
}

def note_freq(name):
    """Get frequency for a note name like 'D3', 'Ab4', etc."""
    if name in _FREQ:
        return _FREQ[name]
    import re
    m = re.match(r"([A-G][#b]?)(\d+)", name)
    if m:
        pitch, octave = m.group(1), m.group(2)
        equiv = _ENHARMONIC.get(pitch)
        if equiv and f"{equiv}{octave}" in _FREQ:
            return _FREQ[f"{equiv}{octave}"]
    return _FREQ.get("C3", 130.81)  # fallback

def scale_notes(root, scale_type, octaves=(2, 5)):
    """Get list of (name, freq) for a scale across octaves."""
    intervals = SCALES.get(scale_type, SCALES["minor"])
    root_idx = NOTES.index(root) if root in NOTES else 0
    result = []
    for oct in range(octaves[0], octaves[1]):
        for interval in intervals:
            idx = (root_idx + interval) % 12
            name = f"{NOTES[idx]}{oct}"
            if name in _FREQ:
                result.append((name, _FREQ[name]))
    return result

def chord_notes(root, quality, octave=3):
    """Get triad note names for a chord. quality: 'major', 'minor', 'dim', 'aug'."""
    intervals_map = {
        "major": [0, 4, 7],
        "minor": [0, 3, 7],
        "dim":   [0, 3, 6],
        "aug":   [0, 4, 8],
        "sus2":  [0, 2, 7],
        "sus4":  [0, 5, 7],
        "7":     [0, 4, 7, 10],
        "maj7":  [0, 4, 7, 11],
        "min7":  [0, 3, 7, 10],
    }
    intervals = intervals_map.get(quality, [0, 3, 7])
    root_idx = NOTES.index(root) if root in NOTES else 0
    names = []
    for iv in intervals:
        idx = (root_idx + iv) % 12
        names.append(f"{NOTES[idx]}{octave}")
    return names
