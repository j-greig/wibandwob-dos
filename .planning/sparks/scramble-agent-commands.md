# Spark: Scramble as Agent — Desktop Command Ability

Status: spark
Origin: SPK-03 smoke parade session, 2026-02-27
Effort: medium (1-2 days)

## Idea

Scramble the cat currently receives chat messages and responds with
canned personality text. She has no ability to ACT on the desktop.
Wib and Wob can open windows, change themes, rearrange the desktop
via MCP tools and IPC commands. Scramble cannot.

Give Scramble the same command surface. She should be able to:

  - Open windows (spawn generative art, games, tools)
  - Rearrange the desktop (snap, tile, cascade)
  - Change theme and desktop appearance
  - Pet herself (why not)
  - Draw on paint canvases
  - Open primers and gallery items

## Why

1. Scramble is the most visible character in WibWob-DOS (always on
   screen, overlays everything). Giving her agency makes the desktop
   feel more alive for Twitch viewers.

2. It completes the "every inhabitant can act" principle. Right now
   only Wib and Wob can drive the desktop autonomously. Scramble is
   passive.

3. It creates emergent behaviour: Scramble and Wib/Wob could
   collaborate or interfere with each other. Scramble opens a game
   window, Wob closes it, Scramble opens it again. Comedy.

4. The command surface already exists (83 commands via IPC). This is
   purely about wiring Scramble's chat handler to dispatch commands,
   not building new infrastructure.

## Approach Options

### A: Slash commands in Scramble chat (simplest)

Scramble's chat input already parses /commands (see scramble_view.cpp).
Add new slash commands that map to IPC commands:

  /open life        -> open_life
  /theme dark       -> set_theme_mode dark
  /snap tl          -> snap focused window to top-left
  /tile             -> tile all windows

Pro: minimal code, uses existing chat parser.
Con: requires human to type commands. Not autonomous.

### B: LLM-driven Scramble with tool use (full agent)

Give Scramble her own LLM backend (like Wib/Wob) with access to the
same MCP tools. She interprets chat messages and decides whether to
act. "Scramble, open something pretty" -> she picks a generative art
window and opens it.

Pro: fully autonomous, emergent behaviour, great for Twitch.
Con: needs LLM integration, token cost, latency. Scramble currently
has no LLM — she uses canned responses from scramble_engine.cpp.

### C: Scripted behaviour patterns (middle ground)

Scramble gets a behaviour tick (every N seconds) where she randomly
or contextually does things: opens a window if the desktop is empty,
rearranges windows if they are piled up, spawns a game if nothing
has happened for a while.

Pro: no LLM cost, predictable, entertaining.
Con: not responsive to chat, less emergent.

## Recommendation

Start with A (slash commands) as a spike. It proves the wiring works
and gives immediate value. Then layer B on top if we want autonomous
Scramble. C is a fallback if LLM cost is a concern.

## Dependencies

- Command registry (exists, 83 commands)
- IPC socket dispatch from scramble context (needs wiring)
- Scramble chat input parser (exists, handles /commands)
- Actor attribution on commands (exists, would need "scramble" actor)

## Related

- SPK-03 agent experience audit (this came from the smoke parade)
- Wib/Wob MCP tools in sdk_bridge/mcp_tools.js
- scramble_view.cpp /command parser
- scramble_engine.cpp personality responses
