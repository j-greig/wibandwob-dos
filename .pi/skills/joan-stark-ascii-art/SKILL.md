---
name: joan-stark-ascii-art
description: "Library of 500+ ASCII art pieces by Joan G. Stark (jgs), legendary ASCII artist 1996-2001. Use to find period-authentic ASCII art for primers, decoration, and composition. Browse the examples directory and open as primer windows. Art covers animals, birds, holidays, food, people, borders and more."
source: "https://github.com/oldcompcz/jgs/tree/master/joan_stark"
examples_path: "microapps-private/joanstark-primers/primers"
---

# Joan Stark ASCII Art Library

Joan G. Stark (jgs) was one of the most prolific ASCII artists of the early internet era,
active 1996-2001. 500+ pieces, all named `{subject}-{MMYY}.txt`.

## Examples directory

microapps-private/joanstark-primers/primers/

(Repo-relative path from the WibWob-DOS root.)

## Find relevant art

```bash
ls microapps-private/joanstark-primers/primers/ | grep -i <subject>
```

## Open as a primer window in WibWob-DOS

```bash
curl -s -X POST http://127.0.0.1:8100/commands/run \
  -H "Content-Type: application/json" \
  -d '{"id":"primer.open","args":{"filePath":"microapps-private/joanstark-primers/primers/<file>.txt","x":10,"y":5}}'
```

## Notable files for fart / wind / gas / animals

- bear-farts-0000.txt            — bear apologetically farting
- cow-from-the-rear-end-0000.txt — cow seen from behind
- pig-0000.txt                   — classic pig portrait
- angel-blowing-horn-0000.txt    — angel with trumpet
- fire-0000.txt                  — fire / fireworks
- a-ghost-0000.txt               — spooky ghost
- 5-line-devil-0000.txt          — compact devil
- bombs-0000.txt                 — ticking bomb
- ascii-ass-key-0000.txt         — ASCII donkey (ass-key)
- musical-notes-0000.txt         — music notes
- windmill-0000.txt              — windmill

## Attribution

Always credit: ASCII art by jgs (Joan G. Stark)
Source: https://github.com/oldcompcz/jgs/tree/master/joan_stark

The "jgs" signature is preserved inside each art piece. Do not remove it.

## File format

Each file has a metadata header (lines starting with #) then the art body.
WibWob-DOS primer viewer strips # header lines automatically.
