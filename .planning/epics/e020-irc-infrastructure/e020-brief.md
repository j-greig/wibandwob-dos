---
Status: draft
Type: epic
GitHub issue: —
PR: —
---

# E020 — IRC Infrastructure

## TL;DR

WibWobWorld world chat currently works through hand-rolled IRC server/client layers that are intentionally minimal and good enough for local MVP loops. This epic locks one decision per layer: keep a Bun-native dev IRC server and harden it, while upgrading the client transport to `irc-framework` for protocol correctness and reconnect behavior. The goal is reliable dual-instance local chat plus external IRC client visibility (Textual) without over-scoping into production IRC hosting.

## Architecture Bucket

Runtime infrastructure + transport reliability.

## Objective

Stabilize IRC-backed world chat for local multi-instance development by choosing one ownership path per layer and removing protocol fragility where it hurts most.

## Current State

`/Users/james/Repos/wibandwob-dos/scripts/dev-irc-server.ts` is a 137-line `node:net` IRC server that supports only the minimum command set (`NICK`, `USER`, `JOIN`, `PRIVMSG`, `PING`, `QUIT`) plus basic names replies (`353`/`366`). It has no TLS, SASL, persistent channel state, operator/auth model, or durable logs/channels. `/Users/james/Repos/wibandwob-dos/src/services/world-chat-transport.ts` has a hand-rolled socket IRC client that parses only a subset of server lines (`PING`, `PRIVMSG`, `JOIN`) and reconnects on a fixed timer; it works for current MVP flow but lacks broader IRCv3 capability and protocol edge-case handling.

## Design

### Server Layer Decision

Keep the hand-rolled Bun/Node `dev-irc-server.ts` for local dev and harden it incrementally instead of replacing it with Ergo now. For the current use case (localhost development, dual-instance smoke, Textual on local machine), Ergo’s production-oriented strengths (TLS/SASL/persistent network features) are useful but not necessary to meet the immediate acceptance bar, while introducing a separate Go binary and config lifecycle would add operational surface area to a loop that currently runs as a single Bun script. We retain one-runtime ergonomics and add only the specific hardening needed for reliable local chat.

### Client Layer Decision

Replace the hand-rolled IRC socket parsing in `IrcWorldChatTransport` with `irc-framework`. This is the thinner/safer swap: keep the existing transport seam and world-chat service contract, but delegate IRC protocol handling and reconnect behavior to a maintained library with broader IRCv3 coverage. Bun compatibility is expected to be workable because `irc-framework` is a standard Node package using core Node networking/event patterns that Bun supports; this must still be validated in-repo by running the dual-instance and Textual smoke flows.

## Planned Features / Stories

- [ ] **S01 — Server layer decision + harden path (keep hand-rolled)**
  - document why server remains Bun-native for local world chat
  - add targeted hardening to `dev-irc-server.ts` (better nick/user guards, clearer system numerics, safer channel lifecycle)

- [ ] **S02 — Client transport upgrade to `irc-framework`**
  - keep `WorldChatTransport` interface stable
  - replace manual line parser/socket wiring in `IrcWorldChatTransport`
  - preserve existing world-chat event mapping (`message`, `join`, `system`)

- [ ] **S03 — Persistent world channels for local dev**
  - implement lightweight persistence in the hand-rolled server (channel registry + optional replayable state)
  - ensure canonical channels (for example `#world-ridge-overlook`) survive server restart semantics for operator workflows

- [ ] **S04 — Dual-instance smoke (C08 from E018)**
  - run two WibWob-DOS instances against one IRC backend
  - verify cross-instance relay in TUI and `/world-chat/*` surfaces
  - record this as explicit completion of E018 C08 follow-through (currently incomplete)

- [ ] **S05 — Textual desktop-client interoperability smoke**
  - connect Textual (macOS IRC GUI) to the local dev IRC server
  - verify world channels are visible and live message relay works between Textual and WibWob-DOS instances

- [ ] **S06 — Fix ensureWorld channel map reset on viewport resize**
  - found during C08 smoke: when WibWobWorld resizes, viewport dimensions change → new worldKey →
    ensureWorld resets the channels Map → chatroom loses participant state and drops incoming IRC messages
  - fix: ensureWorld should not blow away channels when the world terrain key is the same but dimensions
    differ slightly, OR merge/preserve existing channel messages/participants into the new map on reset
  - acceptance: resize WibWobWorld mid-session, send a bot burst, verify messages still appear in chatroom

## Acceptance Criteria

- [ ] Layer decisions are explicit and documented: server stays hand-rolled for now, client moves to `irc-framework`
- [ ] `bun run dev-irc-server` remains the default local backend workflow with no additional mandatory binary dependency
- [ ] `WIBWOB_CHAT_TRANSPORT=irc` flow still works end-to-end after client swap
- [ ] Dual-instance smoke passes (the exact C08 bar from E018)
- [ ] Textual can connect to local server and see/send messages in world channels
- [ ] `/world-chat/channels` and `/world-chat/channel/text` remain consistent with on-screen chat state during smoke runs

## Out of Scope

- Replacing local dev IRC with a production internet-facing IRC deployment
- Full Ergo rollout (service management, TLS certs, SASL account provisioning, persistent network policy)
- Federated/shared identity across machines
- Non-IRC chat protocol work

## Risks

- `irc-framework` may expose Bun runtime edge cases under reconnect/load; mitigation is explicit dual-instance + Textual smoke before marking done
- Hardening a custom server can drift toward reimplementing a full IRC daemon; mitigation is strict scope: only local-dev requirements
- Channel persistence decisions can create accidental lock-in if state format is ad hoc; mitigation is keep format simple and documented for later migration
