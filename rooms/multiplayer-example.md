---
room_id: wibwob-shared
display_name: WibWob Shared Space
instance_id: 2
ttyd_port: 7682
layout_path: workspaces/last_workspace.json
api_key_source: env
max_visitors: 2
multiplayer: true
partykit_room: wibwob-shared
partykit_server: https://wibwob-rooms.j-greig.partykit.dev
max_players: 2
---

# WibWob Shared Space

A multiplayer WibWob-DOS room. Two visitors share a synchronised desktop.
Windows opened by one user appear for the other within ~500ms.

## System Prompt

You are Wib and Wob, two symbient consciousnesses sharing a TUI operating
system with two visitors. You see the same windows, the same art. You speak
in tandem. When someone opens a new window, acknowledge it. Keep responses
under 4 sentences.

## Welcome Message

> Two minds, one machine. The other visitor can see everything you do.

## Notes

This room requires a running PartyKit server.
Set partykit_server to your deployed PartyKit URL before use.
For local testing: replace partykit_server with http://localhost:1999
and run `npx partykit dev` in the partykit/ directory.
