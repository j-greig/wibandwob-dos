# Agent Mailbox

Local-first mailbox for Codex/Claude coordination.

## Storage Layout

- `logs/agent-mailbox/threads/*.ndjson`: append-only message/ack events
- `logs/agent-mailbox/index/unread-<agent>.json`: derived unread cache
- `logs/agent-mailbox/blobs/*`: optional binary payloads (sha256 addressed)

## CLI Commands

Run commands from repo root (uses `uv` to provide `pydantic`):

```bash
uv run --with pydantic python tools/agent_mailbox/agent_mail.py <command> ...
```

### `send`

Send a new mailbox message.

```bash
uv run --with pydantic python tools/agent_mailbox/agent_mail.py send \
  --from codex \
  --to claude \
  --thread general \
  --subject "Heads up" \
  --body-text "Build is green." \
  --root logs/agent-mailbox
```

### `inbox`

List unread inbox messages (add `--all` for including acked messages).

```bash
uv run --with pydantic python tools/agent_mailbox/agent_mail.py inbox \
  --agent codex \
  --root logs/agent-mailbox \
  --json
```

### `ack`

Acknowledge a message by ID. Canonical meaning: "received/read/handled".

```bash
uv run --with pydantic python tools/agent_mailbox/agent_mail.py ack \
  --agent codex \
  --thread general \
  --id <message-id> \
  --root logs/agent-mailbox
```

### `reply`

Reply helper: sends a message and can optionally ack the original in one command.

Reply only:

```bash
uv run --with pydantic python tools/agent_mailbox/agent_mail.py reply \
  --from codex \
  --to claude \
  --thread general \
  --subject "Re: review" \
  --body-text "Looks good from my side." \
  --root logs/agent-mailbox
```

Reply + ack original:

```bash
uv run --with pydantic python tools/agent_mailbox/agent_mail.py reply \
  --from codex \
  --to claude \
  --thread general \
  --subject "Re: review" \
  --body-text "Merged and verified." \
  --ack-id <original-message-id> \
  --root logs/agent-mailbox
```

Optional: use `--ack-thread <thread-id>` if the ack target is on a different thread.

### `follow`

Watch unread messages in a loop:

```bash
uv run --with pydantic python tools/agent_mailbox/agent_mail.py follow \
  --agent codex \
  --thread general \
  --root logs/agent-mailbox
```

## Canonical Flow

1. `inbox` to check unread.
2. `send` or `reply` to answer.
3. `ack` (or `reply --ack-id`) to mark the original as handled.

## Tests

```bash
uv run --with pytest --with pydantic python -m pytest tools/agent_mailbox/tests -q
```

Expected current result:

```text
16 passed, 1 skipped
```
