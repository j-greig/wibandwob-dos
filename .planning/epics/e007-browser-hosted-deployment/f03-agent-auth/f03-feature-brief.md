# F03: Agent Auth (Challenge-Response)

## Parent

- Epic: `e007-browser-hosted-deployment`
- Epic brief: `.planning/epics/e007-browser-hosted-deployment/e007-epic-brief.md`

## Objective

HMAC challenge-response authentication over IPC sockets. Orchestrator generates a shared secret at spawn time. When agent A connects to agent B's socket, B issues a challenge, A responds with HMAC(challenge, shared_secret), B verifies. Challenges are single-use. After verification, both sides derive an ephemeral session key from HMAC(old_secret, "session") for the interaction lifetime.

## Design

```
Orchestrator spawns Instance A + Instance B
  -> both receive WIBWOB_AUTH_SECRET=<random 32 bytes hex>

Agent A connects to B's socket:
  B -> A: {"type":"challenge","nonce":"<random 16 bytes hex>"}
  A -> B: {"type":"auth","hmac":"HMAC-SHA256(nonce, secret)"}
  B verifies HMAC, marks nonce as used
  Both derive: session_key = HMAC-SHA256(secret, "session")
  Subsequent commands in this connection use session_key

Single-use nonces prevent replay. Session key rotation per connection.
```

## Scope

**In:**
- C++ IPC changes: challenge-response handshake before accepting commands
- Auth bypass when WIBWOB_AUTH_SECRET not set (backward compat, local dev)
- Python orchestrator passes secret at spawn (wired in F02)
- ~75 LOC C++ for challenge/verify, ~25 LOC Python for HMAC generation

**Out:**
- Network transport auth (parked — sockets-as-auth sufficient for local)
- Ring-based trust levels (future — all authed agents get equal access for now)
- Token refresh/revocation (session key per connection is sufficient)

## Stories

- [ ] `s05-ipc-challenge-response` — add challenge-response handshake to IPC socket accept loop
- [ ] `s06-auth-bypass-local` — skip auth when no secret set (dev mode backward compat)

## Acceptance Criteria

- [ ] **AC-1:** IPC socket rejects commands from unauthenticated connections when secret is set
  - Test: connect to socket without auth, send command, get rejected
- [ ] **AC-2:** Authenticated connection succeeds with correct HMAC response
  - Test: Python test client completes handshake, sends command, gets response
- [ ] **AC-3:** Replayed nonce is rejected (single-use enforcement)
  - Test: capture nonce+HMAC from first connection, replay on second, get rejected
- [ ] **AC-4:** No auth required when WIBWOB_AUTH_SECRET is unset (backward compat)
  - Test: existing IPC tests pass without env var set
- [ ] **AC-5:** Session key derived after auth and used for connection lifetime
  - Test: Python test verifies session key derivation matches expected HMAC output

## Status

Status: not-started
GitHub issue: —
PR: —
