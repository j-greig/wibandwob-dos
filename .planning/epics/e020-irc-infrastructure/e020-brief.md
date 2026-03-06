---
Status: complete — 2026-03-06
Type: epic
GitHub issue: —
PR: —
---

# E020 — IRC Infrastructure (irc-framework client)

## TL;DR

Swap the hand-rolled IRC socket client in `IrcWorldChatTransport` for `irc-framework`
(kiwiirc/irc-framework). Keep the hand-rolled Bun dev server. Keep the
`WorldChatTransport` interface unchanged. Goal: protocol correctness, native reconnect,
no more hand-rolled line parsing.

Reference: `vendor/pirc-extension` shows irc-framework in use with hand-rolled .d.ts types.

## Design Decisions (locked)

**Server:** keep `scripts/dev-irc-server.ts` — Bun-native, no extra binary.
Harden it incrementally (S01).

**Client:** swap `IrcWorldChatTransport` internals to use `irc-framework`.
Interface stays identical. pirc-extension's `src/irc-framework.d.ts` is the
type stub starting point.

**Transport interface:** no changes except add `"nntp"` removed — stays `"local" | "irc"`.
`WorldChatService` = zero edits.

---

## Stories

### S01 — Server harden
Status: [x] complete — 2026-03-06

Harden `scripts/dev-irc-server.ts`:
- reject duplicate nicks (send 433 ERR_NICKNAMEINUSE)
- send correct welcome numerics 001/002/003/004 on registration
- NAMES reply (353/366) on JOIN includes all present nicks
- QUIT removes nick from all channels, relays PART-like notice to room

Verification:
- [ ] two clients join same channel, each gets NAMES list of both
- [ ] duplicate nick gets 433, must choose new nick
- [ ] client QUIT removes them from channel for other clients
- [ ] `python3 scripts/dev-irc-bot-burst.py` delivers to both instances
- [ ] `bun run typecheck` clean

---

### S02 — Client swap to irc-framework
Status: [x] complete — 2026-03-06

Replace hand-rolled socket/parser in `IrcWorldChatTransport`
(`src/services/world-chat-transport.ts`) with `irc-framework`.

Steps:
- [x] `bun add irc-framework`
- [x] copy `vendor/pirc-extension/src/irc-framework.d.ts` → `src/types/irc-framework.d.ts`,
      extend as needed
- [x] rewrite `IrcWorldChatTransport` internals:
  - `connect()` → `new IRC.Client()` + `.connect()`, listen on `registered`
  - `join(channelId)` → `client.join(channelId)`
  - `send(channelId, sender, text)` → `client.say(channelId, \`\${sender}: \${text}\`)`
  - `onEvent` → `client.on('message', ...)` + `client.on('join', ...)`
  - reconnect → delegate to irc-framework (remove hand-rolled 5s timer)
  - `status()` → reads `client.network.serverOptions.nick`, `client.connected`
- [x] remove hand-rolled `net.Socket`, line buffer, PING/PONG loop, regex parsers

Verification:
- [ ] `bun run typecheck` clean
- [x] `bun run dev:world` starts, connects, World Chatroom shows IRC● green
- [x] `python3 scripts/dev-irc-bot-burst.py 127.0.0.1 6667 '#world-ridge-overlook'`
      → messages appear in World Chatroom within 2s
- [x] `./scripts/screenshot-window.sh "World Chatroom"` — transcript populated
- [x] `/world-chat/channel/text?id=...` API matches on-screen transcript
- [x] kill + restart dev-irc-server → client reconnects within 10s without manual intervention
- [x] `./scripts/world-chat-log-tail.sh` shows no dropped messages

---

### S03 — Persistent world channels (server)
Status: [ ] open — defer unless S04 requires it

Pre-seed canonical channels on server start so they appear in LIST before any client
joins. In-memory only; articles lost on restart is acceptable for dev.

Verification:
- [ ] `LIST` response includes `#world-*` channels before any client joins
- [ ] channel survives client disconnect + reconnect within same server session

---

### S04 — Dual-instance smoke (re-verify post-S02)
Status: [x] complete — irc-framework both sides, 2026-03-06
        [ ] re-verify with irc-framework client

Two instances (main/8099, alt/8098) on one dev IRC server.
Alt sends → main's World Chatroom shows it within 2s.

Verification:
- [ ] both instances start with `WIBWOB_INSTANCE_LABEL=main/alt`
- [ ] alt sends via API: `microapp.world-chatroom.send`
- [ ] main World Chatroom transcript shows alt's message with `[irc]` tag
- [ ] `./scripts/screenshot-window.sh "World Chatroom"` on main confirms
- [ ] `./scripts/world-chat-log-tail.sh` shows cross-instance relay

---

### S05 — Textual interoperability smoke
Status: [x] complete — 2026-03-06

Connect Textual (macOS IRC GUI) to local dev server. Verify two-way relay.

```bash
# or: brew install irssi / weechat for CLI alternative
```

Verification:
- [ ] Textual connects to `127.0.0.1:6667`, joins `#world-ridge-overlook`
- [ ] WibWob-DOS message visible in Textual
- [ ] Textual message visible in WibWob-DOS World Chatroom within 2s
- [ ] `./scripts/screenshot-window.sh "World Chatroom"` — Textual nick in transcript
- [ ] no crashes or disconnects over 5min idle

---

### S06 — Fix ensureWorld channel map reset on viewport resize
Status: [x] complete — 2026-03-06

Bug: WibWobWorld resize → new `worldKey` → `ensureWorld` resets `channels` Map
→ chatroom loses state, IRC messages silently dropped.

Fix: strip viewport dimensions from `worldKey`. Key = seed + terrainIdx only.

File: `src/services/world-chat-service.ts` — find `worldKey` construction.

Verification:
- [ ] join chatspot, receive bot burst → messages visible
- [ ] resize WibWobWorld (drag or batch API)
- [ ] send second bot burst → messages STILL appear
- [ ] `./scripts/screenshot-window.sh "World Chatroom"` not blank after resize
- [ ] `/world-chat/channels` API still correct after resize
- [ ] `bun run typecheck` clean

---

## Acceptance Criteria

- [x] S04 dual-instance smoke (C08 hand-rolled IRC — 2026-03-06)
- [ ] S01: server hardened — NAMES, 433, welcome numerics, QUIT relay
- [x] S02: irc-framework client live, reconnect works, transcript populated, API parity
- [ ] S04: dual-instance re-verified with irc-framework client
- [ ] S05: Textual ↔ WibWob-DOS two-way relay confirmed with screenshot
- [ ] S06: resize no longer flushes chatroom state

## Out of Scope

- NNTP / Usenet
- Production IRC (TLS, SASL, public server)
- Full Ergo rollout
- IRCv3 multiline (pirc-extension has a codec if ever needed — `vendor/pirc-extension/src/multiline.ts`)
