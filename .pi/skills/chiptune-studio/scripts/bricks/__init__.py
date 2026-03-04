# Chiptune Lego Bricks
# Composable audio primitives for building music from scratch.
# Import what you need, assemble how you want.
#
# Three layers:
#   osc / fx / canvas / theory  — raw materials (numpy)
#   patterns                    — compositional gestures (numpy)
#   pipeline                    — file mixing, splicing, voice (pydub bridge)

from .osc import sine, square, triangle, sawtooth, noise, silence, pad, reese
from .fx import (bitcrush, tremolo, reverb, lowpass, highpass, delay,
                 env, fade_in, fade_out, chain, trim_silence)
from .canvas import (make, place, normalize, crossfade, save_wav,
                     mix_with_voice, to_pydub, from_pydub)
from .theory import note_freq, scale_notes, chord_notes, NOTES, SCALES
from .patterns import (arp, sequencer, sparkle, drone, ghost_echo,
                       noise_breath, sub_rumble, stinger_hits, resolve,
                       drums_from_string, vocal_from_score)
from .pipeline import (splice_at, mix_layers, match_length, duck_envelope,
                       say_to_segment, export_mp3, preview_wrap,
                       preview, render)
