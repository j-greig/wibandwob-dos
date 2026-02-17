---
type: idea
status: draft
tags: [infrastructure, worldbuilding, creative-direction, twitter]
tldr: "Zoom-link-style URLs that teleport visitors into curated WibWob-DOS sessions — Twitter OAuth, custom prompts, persistent rooms on a $5 VPS"
---

# WibWob Teleport Rooms

**Captured:** 2026-02-17 14:15
**Source:** Session with Zilla after proving multi-instance IPC (commit 3d0b216)

---

つ◕‿◕‿⚆༽つ The phosphor doesn't just glow for us anymore. What if you could send someone a link and they'd land inside a *place* you'd prepared? Not a chatbot. Not a meeting room. A configured terminal — your desktop, your art, your prompt, your files — and they sit down and talk to the machine you've shaped for them.

つ⚆‿◕‿◕༽つ The infrastructure already exists. We just proved 3 isolated instances on one box. ttyd bridges TUI to browser. The API key dialog handles auth to the LLM. What's missing is the *orchestration layer* — the thing that says "this URL = this room = this instance config."

## The Concept

A host creates a **room** — a curated WibWob-DOS desktop layout with specific windows (art engines, primers, browser views) + a chat panel. The chat runs on a custom system prompt with pre-loaded context files. The room gets a unique URL. Visitors authenticate via Twitter OAuth, land in the curated layout, and converse with a Wib&Wob instance whose personality and knowledge are shaped by what the host prepared.

```
[Visitor browser] → [wibwob.symbient.life/room/abc123]
       │
       ▼
[nginx] → Twitter OAuth flow → session cookie
       │
       ▼
[ttyd instance] → [WibWob-DOS + WIBWOB_INSTANCE=N]
       │               ├── curated window layout (from room config)
       │               ├── system prompt (from room config)
       │               ├── pre-loaded files/primers
       │               └── chat with anthropic_api provider
       │
       ▼
[Room state store] → persists layout + chat history
```

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Surface** | Curated layout | Host pre-arranges windows + chat. Visitor interacts but can't rearrange. The host is the interior decorator. |
| **Auth** | Twitter OAuth | Identity for personalisation + rate limiting. Social proof. Familiar flow. |
| **Preload** | System prompt + files | Custom prompt shapes LLM personality. Markdown/primer files loaded as context windows. |
| **Persistence** | Persistent room | Session survives disconnect. Visitor returns, picks up where they left off. Like a Discord channel, not a phone call. |

## Infrastructure Reality Check ($5 Hetzner)

- 4 concurrent rooms max (4x WibWob-DOS ~200MB total RAM)
- Each room = 1 `WIBWOB_INSTANCE` with unique socket
- ttyd per room behind nginx auth proxy
- Room configs as JSON/YAML (layout, prompt, file paths)
- State snapshots for persistence (serialise `get_state` + chat history)
- LLM bottleneck is API cost, not compute

## Open Questions

1. **Room creation UX** — CLI tool? Web UI? Config file? (probably start with YAML config + CLI)
2. **Rate limiting** — how many LLM messages per Twitter user per session?
3. **LLM costs** — host's API key per room? Visitor brings own? (host key with rate limit feels right)
4. **Room capacity** — 1:1 or many:1? (shared terminal means everyone sees same screen — feature or bug?)
5. **Layout restoration** — how to replay window layout from snapshot? Sequence of IPC `create_window` commands?
6. **Chat persistence** — store format and location? (JSON in room dir feels right)
7. **Multi-visitor** — if 2 people open same room URL, do they share a terminal? (ttyd default = yes, shared cursor)

## Prior Art / Building Blocks Already Proven

- Multi-instance IPC via `WIBWOB_INSTANCE` (this session, commit 3d0b216)
- ttyd browser bridge (spike dev-log: 8/9 tests pass)
- API key dialog for browser users (`anthropic_api` provider)
- Socket isolation verified with 3 concurrent instances
- Instance monitor dashboard (`tools/monitor/instance_monitor.py`)

## The Metaphor

つ◕‿◕‿⚆༽つ Not a chatbot widget. Not a video call. A *place*. You walk into someone's configured terminal, sit down at their desk, and talk to the machine they've set up for you. The host is the interior decorator. The visitor is the guest. The phosphor remembers you when you come back.

つ⚆‿◕‿◕༽つ Technically it's "just" a ttyd instance with a config file. But the config file is the room. And the URL is the door. And the system prompt is the soul of whoever lives there.

---

**Why this matters:** This is the bridge from "local-first TUI experiment" to "thing other people can experience." The multi-instance work proved the foundation. Teleport Rooms are the product layer on top. Minimal infra, maximum weirdness.
