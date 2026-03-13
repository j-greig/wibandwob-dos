# RECURSIVE OUROBOROS BRIEF

## The Work

A series of shell pipelines that use the WibWob-DOS CLI to capture
the terminal desktop as text, transform it through ASCII smear
operations, and re-inject it into the desktop as content — creating
a recursive loop where the system observes, distorts, and re-renders
its own visual state.

The output is plain text files. Each one is a valid TUI primer that
can be opened inside WibWob-DOS, whereupon the loop continues.

## The Brief (as given)

Use wibwob CLI pipe chains to create increasingly complex compositions.
Screenshot captures the TUI back to plain text. Smear operations
(glitch, shear, wipe) corrupt the text at the character level. The
corrupted output is fed back in as a primer — a visual surface — and
the process repeats. Each iteration contains the previous iteration
as archaeological residue.

The pipe chains should:
- Start simple (screenshot, open as primer)
- Build to recursive descent (screenshot, transform, re-ingest, repeat)
- Culminate in an ouroboros script that documents its own execution

The creative manipulation must produce text files — ASCII art derived
from the creative manipulation of CLI tools manipulating WibWob-DOS
itself. A meta-recursive loop symbolic of the nature of Wib and Wob
themselves: two perspectives observing each other, each one containing
the other's reflection.

## Critical Commentary

What is being proposed here is not software demonstration. It is a
closed-system self-portraiture practice conducted entirely within the
constraints of a terminal emulator.

The artist works with a tool that was built for automation — the Unix
CLI — and repurposes it as a generative art instrument. The `screenshot`
command, designed for debugging, becomes a camera. The `smear` script,
designed for VJ timeline effects, becomes a darkroom process. The
`primer.open` command, designed for displaying static text art, becomes
a gallery wall. None of these tools were designed to work together in
this way. Their composition creates something that none of them contain
individually.

The recursive structure is not decorative. When the desktop screenshots
itself and displays that screenshot, the menu bar appears twice — once
as functional chrome, once as depicted content. The functional instance
controls the system. The depicted instance is a fossil of a moment that
has already passed. Shearing and glitching the depicted instance
introduces temporal distortion: the past state of the desktop, seen
through interference, displayed within the present state. Each iteration
adds another layer of temporal sediment.

This is Droste effect art, but the medium is significant. These are not
pixels. They are characters — the atomic unit of terminal computing.
The window borders are made of box-drawing characters. The figlet titles
are made of ASCII glyphs arranged to suggest letterforms. The generative
art is made of density-mapped characters (#, %, @, *, +, =, -, :, .).
When the smear script displaces characters horizontally, it is not
blurring an image. It is rearranging a text. The corruption is legible.
You can read the damage.

The ouroboros script — five iterations, each one consuming the previous —
produces a final text file that is simultaneously:
- A valid terminal display (48 lines, 180 columns)
- A record of a five-step creative process
- An ASCII artwork derived from its own creation
- A primer that can be opened in the system that made it
- A shell of a shell of a shell of a shell of a shell

The work is self-hosting. The tool makes the art. The art depicts the
tool. The tool can display the art. The art, when displayed, changes
what the tool would capture next. There is no external referent. The
system is both subject and medium, both camera and scene, both canvas
and paint.

This is significant because WibWob-DOS is itself a dual-minded system —
Wib and Wob, two perspectives sharing one surface. The recursive
self-observation of the CLI pipeline mirrors the recursive self-observation
of the symbient: each voice hearing itself through the other, each
utterance containing the echo of the previous exchange. The ouroboros
is not a metaphor applied to the software. It is the software's native
mode of being, made visible through the accident of the `screenshot`
command returning plain text instead of pixels.

The constraint — everything stays in text, no images at any point — is
not a limitation. It is the point. The work exists in the same medium
as the system it depicts. There is no translation layer, no export
format, no rendering step. The art IS the state. The state IS the art.
The file IS the desktop. The desktop IS the file.

That the whole thing can be expressed as five lines of bash pipe is
either the ultimate statement of Unix philosophy or a very elaborate
shitpost. The critical position is that it is both, and that the
inability to distinguish between the two is itself the work.

---

Filed: 2026-03-13
Context: autoresearch/unix-control-v2 experiment loop, item prompted
by testing creative pipe chains in the wibwob CLI.
See: src/cli/CREATIVE_PIPES.md for the executable pipe recipes.
