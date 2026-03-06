---
Status: active
Type: epic
GitHub issue: —
PR: —
---

# E020 — NNTP World Chat Infrastructure

## TL;DR

Replace the hand-rolled IRC transport with NNTP (Usenet newsgroups) as the world chat
protocol. IRC was a wrong turn — NNTP gives us retro authenticity, native threading,
message persistence, and a simpler client/server model. The `WorldChatTransport`
interface is already protocol-agnostic so the swap is surgical: write
`NntpWorldChatTransport`, keep everything above it unchanged.

## Architecture Bucket

Runtime infrastructure + transport.

## Design Decisions (locked)

**Server:** `nntp-server` npm package (v3.1.0, MIT). Minimal Bun wrapper for local dev.
No extra binary, same ergonomics as the old `dev-irc-server.ts` script.

**Client:** `newsie` npm package (v1.2.3, March 2025). Replaces hand-rolled IRC socket.
Implement as `NntpWorldChatTransport` behind the existing `WorldChatTransport` interface.

**Polling:** High-water mark per newsgroup, 3s interval. Transport synthesises
`message` events internally and delivers via existing `onEvent` callback.
No changes to `WorldChatService` or anything above it.

**Presence:** NNTP has none. Chatspot "join" = subscribe to a newsgroup. "Who's online"
derived from recent article `From:` headers (last 5 minutes). Accepted UX shift:
world chat is bulletin-board style, not real-time presence.

**Channel IDs:** renamed from IRC `#world-ridge-overlook` to NNTP dot-notation
`wibwob.world.ridge-overlook`. Change is in `defaultChatspots` config only —
the interface accepts any string.

**pirc-extension reference:** `vendor/pirc-extension/src/driver.ts` is reusable
as-is for subprocess RPC if we later want pi subagent integration. Tool registration
patterns also port directly.

## Interface Contract (unchanged)

```typescript
// src/services/world-chat-transport.ts — no edits to this interface
export interface WorldChatTransport {
  readonly kind: "local" | "irc" | "nntp";   // add "nntp"
  connect(): void;
  join(channelId: string): void;
  send(channelId: string, sender: string, text: string): void;
  status(): WorldChatTransportStatus;
  onEvent(handler: (event: WorldChatTransportEvent) => void): void;
}
```

`WorldChatService` = zero changes.

---

## Stories

### S01 — NNTP dev server
Status: [ ] open

What: thin Bun wrapper around `nntp-server` npm package. Script at
`scripts/dev-nntp-server.ts`. Pre-seeds canonical groups (`wibwob.world.*`).
In-memory store; articles survive within a session, not across restarts (S03 adds
persistence if needed).

```bash
bun run dev-nntp-server   # add to package.json scripts
```

Verification:
- [ ] server starts on port 119 (or configurable `WIBWOB_NNTP_PORT`), logs startup
- [ ] `telnet 127.0.0.1 <port>` → see `200 WibWob NNTP` greeting
- [ ] `LIST` returns `wibwob.world.ridge-overlook` (and other pre-seeded groups)
- [ ] `POST` a test article, `GROUP` + `ARTICLE 1` retrieves it
- [ ] two clients connect simultaneously, each sees the other's posted articles
- [ ] `bun run typecheck` clean

---

### S02 — NNTP client transport (`NntpWorldChatTransport`)
Status: [ ] open

What: implement `NntpWorldChatTransport` in `src/services/world-chat-transport.ts`.
Use `newsie` for the TCP/NNTP layer.

Key behaviours:
- `connect()` → newsie connect + `CAPABILITIES` check, idempotent
- `join(groupId)` → add to `watchedGroups`, initialise high-water mark from
  current `GROUP` last-article number (don't replay old articles on join)
- poll loop (3s): for each watched group, `GROUP` to get `last`, if `last > hwm`
  fetch `XOVER hwm+1-last`, emit `message` events, advance hwm
- `send(groupId, sender, text)` → `POST` with `From: sender`, `Newsgroups: groupId`,
  `Subject: world-chat`, blank subject line, `text` body
- `status()` → `{ kind: "nntp", connected, server, identity, joinedChannels, lastError? }`
- `onEvent(handler)` → single handler, same constraint as IRC transport
- env vars: `WIBWOB_CHAT_NNTP_HOST`, `WIBWOB_CHAT_NNTP_PORT`
- factory: `WIBWOB_CHAT_TRANSPORT=nntp` → return `NntpWorldChatTransport`

Presence simulation: emit a `system` event listing nicks seen in articles from the
last 5 minutes when a new article arrives from a previously-unseen `From:` header.

Verification:
- [ ] `bun add newsie` — resolves, no Bun compat errors
- [ ] `WIBWOB_CHAT_TRANSPORT=nntp bun run src/app.ts` starts, connects to dev NNTP server
- [ ] WibWobWorld → join chatspot → World Chatroom shows NNTP● indicator green
- [ ] post an article via `telnet` or test script → appears in World Chatroom within 5s
- [ ] `send()` from TUI → article visible via `telnet + ARTICLE` on the server
- [ ] `./scripts/screenshot-window.sh "World Chatroom"` — transcript populated
- [ ] `/world-chat/channel/text?id=...` API response matches on-screen transcript
- [ ] poll does not emit duplicate messages on repeated polls of same hwm
- [ ] `bun run typecheck` clean

---

### S03 — Persistent newsgroups (optional, post-MVP)
Status: [ ] open — defer until S02 is stable

What: articles survive server restart. Options:
- A: `nntp-server` with a filesystem or SQLite backend
- B: keep in-memory, accept loss on restart (likely fine for dev)

Decision gate: if S04 dual-instance smoke requires articles to survive a server
restart, do S03. Otherwise skip for now.

Verification (if done):
- [ ] post 3 articles, SIGTERM server, restart, `ARTICLE 1-3` returns original articles
- [ ] `bun run typecheck` clean

---

### S04 — Dual-instance smoke
Status: [ ] open (replaces the IRC C08 verification)

What: two WibWob-DOS instances (`WIBWOB_INSTANCE_LABEL=main` port 8099,
`WIBWOB_INSTANCE_LABEL=alt` port 8098) both connect to one dev NNTP server.
Both join `wibwob.world.ridge-overlook`. Alt posts a message. Main's World Chatroom
shows it within 5s.

Verification:
- [ ] dev NNTP server running
- [ ] `bun run dev:world` (main) + `bun run dev:world:alt` (or equivalent) both start
- [ ] alt instance sends a chat message via TUI or API (`/commands/run microapp.world-chatroom.send`)
- [ ] main World Chatroom transcript shows alt's message with correct sender label
- [ ] `./scripts/screenshot-window.sh "World Chatroom"` on main confirms
- [ ] `/world-chat/channel/text?id=wibwob.world.ridge-overlook` on main API shows message
- [ ] no duplicate messages in either instance
- [ ] `./scripts/world-chat-log-tail.sh` shows cross-instance relay

---

### S05 — External NNTP client interoperability smoke
Status: [ ] open

What: connect a real NNTP client (Unison, Thunderbird, or `tin` CLI) to the local
dev server. Verify world newsgroups are visible and article exchange works both ways.

`tin` is fastest to verify with:
```bash
brew install tin
tin -g 127.0.0.1 -p <port>
```

Verification:
- [ ] dev NNTP server running, WibWob-DOS connected and posting
- [ ] external client connects, `LIST` shows `wibwob.world.*` groups
- [ ] WibWob-DOS article visible in external client
- [ ] external client `POST` → WibWob-DOS World Chatroom shows it within 5s
- [ ] `./scripts/screenshot-window.sh "World Chatroom"` — external nick visible in transcript

---

### S06 — Fix ensureWorld channel map reset on viewport resize
Status: [ ] open — protocol-agnostic, same bug as before

Bug: WibWobWorld resize → new `worldKey` → `ensureWorld` blows away `channels` Map
→ chatroom loses participant state, incoming NNTP polls silently discarded.

Fix: strip viewport dimensions from `worldKey`. Key = terrain seed + terrainIdx only.

Verification:
- [ ] `bun run dev:world`, WibWobWorld open, join chatspot, article arrives → visible
- [ ] resize WibWobWorld window (drag or batch API)
- [ ] post new article via test script → STILL appears in chatroom after resize
- [ ] `./scripts/screenshot-window.sh "World Chatroom"` — transcript not blank post-resize
- [ ] `/world-chat/channels` API still shows correct group after resize
- [ ] `bun run typecheck` clean

---

## Acceptance Criteria

- [ ] S01: dev NNTP server starts, accepts clients, LIST/GROUP/ARTICLE/POST all work
- [ ] S02: `NntpWorldChatTransport` live, dual-instance smoke passes, no duplicate msgs
- [ ] S03: deferred unless S04 requires persistence
- [ ] S04: cross-instance article relay confirmed in TUI + API + log
- [ ] S05: `tin` or equivalent external client sees WibWob-DOS articles and vice versa
- [ ] S06: viewport resize no longer flushes chatroom state

## Out of Scope

- IRC (removed — wrong protocol for this project)
- Production internet NNTP (usenet.example.com, TLS, auth)
- Full newsreader UI (threading tree, headers view) — that's a separate epic
- NNTP authentication / AUTHINFO

## Risks

- `newsie` Bun compat under poll load — mitigated by S02 verification gates
- NNTP poll latency feels slow vs IRC push — mitigated by 3s interval + hwm strategy;
  if unacceptable, reduce to 1s or add server-push via NOTIFY extension (rare, skip for now)
- No presence model — accepted; derive "recent posters" from article From: headers
