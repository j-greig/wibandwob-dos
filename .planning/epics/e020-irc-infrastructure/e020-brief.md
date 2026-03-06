---
Status: active
Type: epic
GitHub issue: —
PR: —
---

# E020 — IRC Infrastructure

## TL;DR

Lock one ownership decision per layer: keep hand-rolled Bun IRC server, upgrade client to `irc-framework`. Goal: reliable dual-instance local chat + Textual visibility without over-scoping.

## Architecture Bucket

Runtime infrastructure + transport reliability.

## Design Decisions (locked)

**Server:** keep `scripts/dev-irc-server.ts` — Bun-native, zero extra binary, hardened incrementally.
**Client:** swap `IrcWorldChatTransport` to `irc-framework` — maintain `WorldChatTransport` interface, delegate protocol + reconnect to a maintained library.

---

## Stories

### S01 — Server layer decision + harden path
Status: [ ] open

What: Document decision in `dev-irc-server.ts` header. Harden:
- safer nick/user guard (reject duplicate nicks, send 433)
- correct `001/002/003/004` welcome numerics
- `NAMES` reply on `JOIN` includes all present nicks
- `QUIT` removes nick from all channels, sends `PART`-like relay to room

Verification:
- [ ] `bun run dev-irc-server` starts clean, no crashes on two clients joining
- [ ] `python3 scripts/dev-irc-bot-burst.py` delivers messages to both instances
- [ ] `./scripts/world-chat-log-tail.sh` shows no dropped messages
- [ ] `./scripts/screenshot-window.sh "World Chatroom"` confirms transcript populated
- [ ] typecheck clean: `bun run typecheck`

---

### S02 — Client transport upgrade to `irc-framework`
Status: [ ] open

What: Replace hand-rolled socket/parser in `IrcWorldChatTransport` (`src/services/world-chat-transport.ts`) with `irc-framework`. Keep `WorldChatTransport` interface unchanged. Map events:
- `message` → `privmsg`
- `join` → `join`
- `system` → `join/kick/nick change notices`
- `connected`/`disconnected` state preserved
- reconnect delegated to irc-framework (remove hand-rolled retry timer)

Verification:
- [ ] `bun add irc-framework` — install resolves, no Bun compat errors
- [ ] `WIBWOB_CHAT_TRANSPORT=irc bun run src/app.ts` starts, connects to dev IRC server
- [ ] WibWobWorld → join chatspot → chatroom shows IRC●  indicator green
- [ ] bot burst: `python3 scripts/dev-irc-bot-burst.py 127.0.0.1 6667 '#world-ridge-overlook'`
  - messages appear in World Chatroom TUI within 2s
- [ ] `./scripts/screenshot-window.sh "World Chatroom"` — transcript visible, no blank window
- [ ] `/world-chat/channel/text?id=...` API response matches what's on screen
- [ ] dual-instance: alt instance (port 8098) also receives bot messages
- [ ] disconnect/reconnect: kill and restart dev-irc-server, client reconnects within 10s
- [ ] typecheck clean: `bun run typecheck`

---

### S03 — Persistent world channels for local dev
Status: [ ] open

What: IRC server keeps channel registry in memory (never resets on join/part). Optionally: replay last N messages to joining client (`329`/`TOPIC` + replay). Canonical channels (`#world-*`) are pre-seeded on server start so they appear in `LIST` before any client joins.

Verification:
- [ ] client 1 joins `#world-ridge-overlook` and sends 3 messages
- [ ] client 1 disconnects, reconnects — channel is still present, no extra `323`/`LIST` errors
- [ ] `bun run dev-irc-server` SIGTERM + restart — channel names still visible after reconnect
- [ ] `./scripts/screenshot-window.sh "World Chatroom"` shows channel label correct
- [ ] typecheck clean: `bun run typecheck`

---

### S04 — Dual-instance smoke  ✓ DONE (C08 from E018)
Status: [x] complete — verified 2026-03-06

C08 result: `zuk` (alt/8098) sent "hiya", `hle` (main/8099) received with `[irc]` tag in transcript and world-chat.log. Both instances connected, cross-relay confirmed. Marking done. Re-run after S02 lands to confirm irc-framework swap doesn't break parity.

Re-verification gate (post-S02):
- [ ] same dual-instance smoke passes with irc-framework client
- [ ] `./scripts/screenshot-window.sh "World Chatroom"` on both instances shows cross messages

---

### S05 — Textual desktop-client interoperability smoke
Status: [ ] open

What: Connect Textual (macOS IRC GUI client) to `127.0.0.1:6667`. Join `#world-ridge-overlook`. Verify:
- WibWob-DOS messages appear in Textual
- Textual messages appear in WibWob-DOS World Chatroom

Verification:
- [ ] `bun run dev-irc-server` running
- [ ] WibWob-DOS connected via IRC, chatspot joined
- [ ] Textual: add server `127.0.0.1:6667`, connect, `/join #world-ridge-overlook`
- [ ] send message from Textual → appears in WibWob-DOS World Chatroom TUI
- [ ] send message from WibWob-DOS → appears in Textual
- [ ] `./scripts/screenshot-window.sh "World Chatroom"` — Textual nick visible in transcript
- [ ] no server crashes or connection drops during 5min idle

---

### S06 — Fix ensureWorld channel map reset on viewport resize
Status: [ ] open

Bug: WibWobWorld resize → viewport dimensions change → new `worldKey` → `ensureWorld` blows away `channels` Map → chatroom loses all participant state, incoming IRC messages silently dropped.

Root cause: `worldKey` encodes viewport size. Any resize creates a new key and resets the world.

Fix options (pick one):
- A: strip viewport dimensions from worldKey — key = terrain seed + terrainIdx only
- B: ensureWorld merges existing channels/participants into new world instead of resetting

Option A is cleaner. Verify there are no cases where same seed+terrain should produce different channel maps.

Verification:
- [ ] `bun run dev:world`, WibWobWorld open, join chatspot, bot burst → messages visible
- [ ] resize WibWobWorld window (drag or API batch resize)
- [ ] send second bot burst → messages STILL appear in chatroom
- [ ] `./scripts/screenshot-window.sh "World Chatroom"` — transcript not blank after resize
- [ ] `/world-chat/channels` API response still shows correct channel after resize
- [ ] typecheck clean: `bun run typecheck`

---

## Acceptance Criteria

- [x] S04 dual-instance smoke passes (C08 verified 2026-03-06)
- [ ] S01: server decision documented, 4 hardening items shipped
- [ ] S02: irc-framework client live, dual-instance + Textual smoke both pass
- [ ] S03: channel names survive restart and `LIST` before first join
- [ ] S05: Textual ↔ WibWob-DOS relay confirmed with screenshot evidence
- [ ] S06: resize mid-session does not flush chatroom state

## Out of Scope

- Production internet-facing IRC
- Full Ergo rollout (TLS, SASL, persistent network policy)
- Federated identity across machines
- Non-IRC chat protocol work

## Risks

- `irc-framework` Bun edge cases under reconnect/load — mitigated by dual-instance + Textual smoke before close
- Custom server hardening drifting toward full IRC daemon — mitigated by strict scope: local-dev only
- Channel persistence format lock-in — keep format simple, document for later migration
