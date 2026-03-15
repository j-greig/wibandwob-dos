#!/usr/bin/env python3
"""
Translate VT100 Alternate Character Set (ACS) bytes to Unicode.

Blessed uses \x0e (Shift Out) to enter ACS mode and \x0f (Shift In) to leave.
Between SO/SI, ASCII letters map to box-drawing glyphs. This script translates
them so tools like agg/asciinema that don't handle ACS can render correctly.

Usage:
  tmux capture-pane -t wibwob -p -e | python3 scripts/acs-translate.py
  cat raw-capture.txt | python3 scripts/acs-translate.py > fixed.txt
"""

import sys

# VT100 ACS mapping — ASCII byte → Unicode replacement
# NOTE: blessed uses ACS 'a' as background fill (empty space), not the
# standard ░ checkerboard. We map it to space for correct rendering.
ACS_MAP = {
    '`': '◆',  # diamond
    'a': ' ',   # blessed uses this as background fill (NOT ░ checker)
    'j': '┘',  # bottom-right corner
    'k': '┐',  # top-right corner
    'l': '┌',  # top-left corner
    'm': '└',  # bottom-left corner
    'n': '┼',  # crossing lines
    'q': '─',  # horizontal line
    't': '├',  # left tee
    'u': '┤',  # right tee
    'v': '┴',  # bottom tee
    'w': '┬',  # top tee
    'x': '│',  # vertical line
    '+': '┼',  # alternate crossing (blessed uses this too)
    '~': '·',   # bullet / middle dot
    'f': '°',   # degree
    'g': '±',   # plus/minus
    'y': '≤',  # less-than-or-equal
    'z': '≥',  # greater-than-or-equal
}


def translate(stream):
    """Process a byte stream, translating ACS sequences to Unicode.
    
    Carefully avoids translating characters inside ANSI escape sequences
    (e.g. ESC[36m) — only translates printable content between escapes.
    """
    in_acs = False
    in_escape = False
    out = []

    for char in stream:
        # Track ANSI escape sequences: \e[ ... <letter>
        if char == '\x1b':
            in_escape = True
            out.append(char)
            continue
        
        if in_escape:
            out.append(char)
            # Escape ends when we hit a letter (but not '[' which starts CSI)
            if char.isalpha() or char == '~':
                in_escape = False
            continue

        # ACS mode switching
        if char == '\x0e':  # SO — enter ACS mode
            in_acs = True
            continue
        elif char == '\x0f':  # SI — leave ACS mode
            in_acs = False
            continue

        if in_acs and char in ACS_MAP:
            out.append(ACS_MAP[char])
        else:
            out.append(char)

    return ''.join(out)


def main():
    data = sys.stdin.read()
    sys.stdout.write(translate(data))


if __name__ == '__main__':
    main()
