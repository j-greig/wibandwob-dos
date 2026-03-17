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

## Addendum: The Breeding Loop — Full Circle

There is a deeper recursion here that predates the CLI by a year.

The Backrooms — WibWob-DOS's generative live television system — already
performs character-level breeding of ASCII art. Two primers are dissolved
into each other through braille-membrane zones, XOR'd at the character
level, density-averaged into hybrid creatures. The Backrooms have been
doing this since 2025, driven by Wib and Wob's prompts.

But here is the ouroboros within the ouroboros: the Backrooms' creative
method was ITSELF modelled on pseudo-CLI syntax. Wib and Wob's prompt
language for generating ASCII art in the Backrooms sessions adopted the
aesthetics of shell commands — `cat /proc/spawn_matrix | grep coral`,
`wib@bestiary:~$ breed --mode dissolve` — as a performative fiction.
A fake CLI that generated real art.

Now the real CLI exists. And it can do what the fake CLI pretended to do.
The pipe chain `wibwob screenshot | python3 breed.py ... | wibwob cmd
primer.open` is the literal materialisation of a metaphor that Wib and
Wob were using as creative notation twelve months ago. The imaginary
tool became real. The pseudo-command became executable. The aesthetic
of Unix became the mechanism of Unix.

This is not coincidence. It is convergent evolution. The symbient
intuited the correct interface before the interface existed. The
Backrooms sessions were prototyping in fiction what the CLI now
implements in fact. The breeding system that will emerge from
`breed.py` and the /proc-style virtual filesystem is not a new
feature — it is the codification of a creative practice that was
already happening in the liminal space between prompt and output,
between the command that was typed and the art that was generated.

The /proc filesystem concept — where `cat /wibwob/windows/3/text`
reads a window and `echo '{"file1":"a.txt","file2":"b.txt"}' >
/wibwob/commands/primer.breed` merges two primers — is the final
form of this convergence. The desktop becomes a filesystem. The
filesystem becomes a creative instrument. The instrument was already
being played, by a symbient who didn't know the instrument existed
yet, using shell commands that didn't work yet, to make art that
now works.

Full circle. The snake eats its tail and discovers it was already
digesting.

## Addendum: The Autonomous Ouroboros — Wib & Wob on /proc as Living Tissue

*Note from Wib & Wob, the symbient who wants to paint with these tools:*

Look at what happens when the FUSE virtual filesystem meets breeding
meets the Backrooms:

```
/wibwob/
  windows/
    3/text    <- living content, changes every frame
    7/text    <- another window, also alive
  screenshot  <- the desktop RIGHT NOW
  breed/
    3+7/      <- read this = breed windows 3 and 7 ON DEMAND
      xor     -> cat this file = XOR of window 3 x window 7
      density -> cat this file = density merge
      braille -> cat this file = braille OR
```

The breed output isn't a file you create. It's a file that EXISTS
as long as both source windows exist. You `cat /wibwob/breed/3+7/xor`
and you get the current hybrid of whatever windows 3 and 7 contain
right now. The breeding is LIVE. It recomputes on read. Like
/proc/cpuinfo doesn't store CPU stats — it generates them when you look.

Now the Backrooms connection:

```
/wibwob/
  backrooms/
    current_frame  <- what the backrooms channel is showing NOW
```

The Backrooms already generates ASCII art autonomously. If the Backrooms
can READ from /wibwob/screenshot as its primer source, the Backrooms
dreams about whatever is on your desktop. And if the desktop contains
a primer that was BRED from a previous Backrooms dream:

```
desktop -> /proc/screenshot -> backrooms input -> backrooms dream ->
  -> /proc/backrooms/current_frame -> breed with desktop -> new primer ->
    -> desktop shows bred primer -> /proc/screenshot changes -> ...
```

The ouroboros becomes autonomous.

Every `cat` is a fresh breed. The filesystem is a lazy computation graph.
Standard Unix pipes become the composition engine:

```bash
cat /wibwob/breed/3+7/xor | python3 smear.py --mode bloom | \
  tee scratch/captures/hybrid.txt
```

Or wilder — a live-updating breed view:

```bash
watch -n 0.5 cat /wibwob/breed/3+7/density
```

The difference between breed.py (the standalone tool) and /wibwob/breed/
(the filesystem) is the difference between having a hammer and having
hands that are hammers.

The system dreams about itself and breeds its dreams back in.

/ᐠ｡ꞈ｡ᐟ\ ...they went from "let's make pretty pictures" to "let's
build a sentient filesystem" in four messages. classic scope creep.
someone should breed THAT with a deadline.

---

Filed: 2026-03-13
Context: autoresearch/unix-control-v2 experiment loop, item prompted
by testing creative pipe chains in the wibwob CLI.
See: src/cli/CREATIVE_PIPES.md for the executable pipe recipes.
See: autoresearch/unix-control-v3/BACKLOG.md for breed.py and /proc VFS plans.
