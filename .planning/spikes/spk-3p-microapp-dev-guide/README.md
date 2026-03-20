---
status: not-started
owner: unassigned
branch: spike/spk-3p-microapp-dev-guide
updated: 2026-03-20
---

# spk-3p-microapp-dev-guide

## Prompt

Write a comprehensive third-party developer guide for creating WibWob-DOS microapps,
modelled on pi's `extensions.md` (see `reference/pi-extensions.md` in this spike dir).

> Related reading: https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/extensions.md

That doc is excellent because it:
- Starts with a quick-start that gets you running in 60 seconds
- Shows the full capability surface up front (what can you build?)
- Gives a clear mental model (lifecycle, events, API shape)
- Covers every hook/method with signature + example
- Ends with a worked examples index

We need the same thing but for the WibWob-DOS microapp SDK:
- Quick start: scaffold → register → see it in the desktop
- Capability surface: what can a microapp do? (windows, themes, host API, persistence)
- Mental model: microapp lifecycle, blessed rendering, host ↔ app contract
- Full SDK reference: every hook, every host API method, with signatures + examples
- Gotchas section (blessed quirks, focus model, resize, etc.)
- Worked examples: pointer to real microapps in the repo as learning material

## Why

Right now creating a microapp requires reading SDK.md, the microapp-creator skill,
scattered source files, and tribal knowledge. A single comprehensive doc — like pi's
extensions.md — would make it possible for a third-party dev (or a fresh agent session)
to build a microapp from scratch without any other context.

## Reference material

- `reference/pi-extensions.md` — the gold-standard doc we're modelling after
- `SDK.md` (repo root) — current SDK contract
- `microapps/` — real microapp implementations (start with `demo-hello-world`, 33 lines)
- `.pi/skills/microapp-creator/` — the agent skill that scaffolds microapps
- `GOTCHAS.md` — two relevant entries (sdk import surface, id field), but **no blessed/lifecycle gotchas exist yet** — the gotchas section of the guide must be written by building a microapp and capturing what burns

## Deliverable

A single `MICROAPP-DEV-GUIDE.md` at repo root (or `docs/`) that a cold reader can
follow to build, register, and ship a working microapp. Structure it like extensions.md:
TOC → quick start → concepts → full API ref → examples → gotchas.

## Time-box

2–3 sessions. First session: outline + quick-start section. Second: full API ref.
Third: polish + test with a fresh agent (can it build a microapp from the doc alone?).

## Success criteria

- [ ] A fresh agent session with only the guide (no skills loaded) can scaffold and run a microapp
- [ ] Guide covers every public SDK hook and host API method
- [ ] Existing microapps in `src/microapps/` are referenced as worked examples
- [ ] Gotchas section covers at least the top 5 known blessed/lifecycle footguns
