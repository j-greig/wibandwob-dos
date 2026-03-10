---
Status: ready-for-agent
Type: implementation-brief
Epic: e018-contour-studio-v2-terrain-foundation
Audience: Pi
---

# Pi Brief — Chatspots + World Coordination MVP

## Goal

Build the smallest ugly-but-real MVP of the world-chat idea so we can learn where the pain actually is:

- world locations can become `chatspots`
- a chatspot maps to a channel id
- a TUI chatroom window can open inside WibWob-DOS
- a world agent can join/send/read through typed state and commands
- the world map and chatroom can both be open at once

This is **not** the polished system. The point is to discover friction between:
- world simulation state
- agent/tool state
- command/API/state exposure
- TUI window/frontend behavior

Treat this as a feasibility spike with real surfaces, not a design doc in code form.

## Read First

- [fr-chatspots-and-agent-coordination.md](/Users/james/Repos/wibandwob-dos/.planning/epics/e018-contour-studio-v2-terrain-foundation/fr-chatspots-and-agent-coordination.md)
- [e018-brief.md](/Users/james/Repos/wibwob-dos/.planning/epics/e018-contour-studio-v2-terrain-foundation/e018-brief.md)
- [/Users/james/Repos/wibwob-dos/.agents/architecture.md](/Users/james/Repos/wibwob-dos/.agents/architecture.md)
- [/Users/james/Repos/wibwob-dos/.agents/invariants.md](/Users/james/Repos/wibwob-dos/.agents/invariants.md)
- [/Users/james/Repos/wibwob-dos/.agents/control-api.md](/Users/james/Repos/wibwob-dos/.agents/control-api.md)

Relevant code:
- [modules-private/wibwobworld/index.ts](/Users/james/Repos/wibwob-dos/modules-private/wibwobworld/index.ts)
- [src/services/module-loader.ts](/Users/james/Repos/wibwob-dos/src/services/module-loader.ts)
- [src/services/state-service.ts](/Users/james/Repos/wibwob-dos/src/services/state-service.ts)
- [src/services/control-api.ts](/Users/james/Repos/wibwob-dos/src/services/control-api.ts)
- [src/services/wibwob-agent-session.ts](/Users/james/Repos/wibwob-dos/src/services/wibwob-agent-session.ts)
- [src/services/agent-tools.ts](/Users/james/Repos/wibwob-dos/src/services/agent-tools.ts)
- [src/core/command-catalog.ts](/Users/james/Repos/wibwob-dos/src/core/command-catalog.ts)

## MVP Scope

Do only this:

1. Hardcode a few chatspots onto the current `WibWobWorld` map.
2. Add one tiny world-chat service with in-memory channels and messages.
3. Add one chatroom window or microapp that renders a channel transcript.
4. Add one path for an agent to:
   - discover chatspots
   - join a chatspot
   - send a message
   - read the channel
5. Expose enough typed state that we can inspect all of this over `/state`.

Do **not** do:
- real IRC yet
- external server yet
- multiplayer transport yet
- polished UX
- full Sugarscape system
- fancy room presence visuals
- merged world/chat surface

## Product Question To Answer

Can we make a WibWob-DOS desktop where:
- the world map is one window
- a chatroom is another window
- a pi agent can move into a place and talk there
- humans can watch it happen through the same visible desktop

If yes, the concept is alive.

## Recommended MVP Shape

### 1. Hardcoded Chatspots

Inside `WibWobWorld`, add a few generated or fixed points:

```ts
type Chatspot = {
  id: string;
  label: string;
  x: number;
  y: number;
  channelId: string;
};
```

Start with 3:
- `Ridge Overlook`
- `Lowland Camp`
- `North Tower`

No procedural placement logic yet unless it is trivial.

### 2. Tiny World Chat Service

New service:
- `src/services/world-chat-service.ts`

Keep it in-memory only.

Suggested shape:

```ts
type WorldChannel = {
  id: string;
  label: string;
  messages: { sender: string; text: string; at: string }[];
  participants: string[];
};
```

Operations:
- `listChatspots()`
- `listChannels()`
- `joinChannel(agentId, channelId)`
- `sendMessage(agentId, channelId, text)`
- `readChannel(channelId)`

No IRC. No persistence. No threading. No server. Just prove the seams.

### 3. Chatroom Frontend

Add a new surface for one channel:
- either `modules-private/world-chatroom/`
- or a built-in window if that is materially simpler

Preference:
- private microapp, because this is world/game-specific

The chatroom needs only:
- title
- transcript
- participant list or count
- typed `describeState()`

### 4. World / Channel Binding

Minimal rule:
- if the agent is exactly on a chatspot tile, it can join that channel
- joining can auto-open the corresponding chatroom window

No proximity radius yet unless it falls out naturally.

### 5. Agent Tool / Command Path

Add the smallest useful path for the in-app pi agent.

Either:
- direct commands via registry/API
- or one or two new agent tools backed by the world-chat service

Examples:

```ts
world.chatspot.list
world.chatspot.join
world.channel.send
world.channel.read
```

The important rule:
- no transcript scraping for truth
- use typed state and service-backed reads/writes

## What To Learn

The MVP is successful if it reveals:
- whether the command/API shape feels natural
- whether `describeState()` is enough for agents
- whether a separate chatroom window is the right UX
- whether location -> channel binding is fun or annoying
- what service seams break first

It is fine if the first pass is clunky.

## Suggested Deliverables

1. `src/services/world-chat-service.ts`
2. one chatroom surface
3. `WibWobWorld` showing chatspot markers
4. command/API/state path for join/send/read
5. smoke evidence via `/state` and a screenshot/export

## Suggested State Contracts

### `WibWobWorld`

Add fields like:

```ts
{
  chatspotsVisible: 3,
  nearbyChatspotId: "chatspot.ridge-03",
  nearbyChannelId: "#world-ridge-03",
}
```

### Chatroom

```ts
{
  appType: "world-chatroom",
  channelId: "#world-ridge-03",
  participantCount: 2,
  lastMessageAt: "2026-03-06T12:00:00Z",
  messageCount: 5,
}
```

## Suggested Commands

Keep these API-visible and agent-visible.

Examples:

```ts
microapp.world-chatroom.open
world.chatspot.join
world.channel.send
world.channel.read
```

If you do not want new built-in catalog entries yet, dynamic microapp commands are fine for the spike.

## Compartmentalized Work Chunks

These are good split points if another agent helps.

### Chunk A — World Chat Service

Independent task:
- build the in-memory service
- tests optional but useful
- no UI work needed

### Chunk B — Chatroom Window

Independent task:
- render one channel transcript
- wire `describeState()`
- no world movement required

### Chunk C — WibWobWorld Chatspots

Independent task:
- paint chatspot markers on the map
- surface nearby/current chatspot state
- no chat transport required yet

### Chunk D — Agent/Command Wiring

Independent task:
- expose join/send/read through command/API/tool seams
- no rendering logic required

These chunks should be mergeable if each respects the central service/state contracts.

## Acceptance Target

This MVP is done when all of these are true:

- [ ] `WibWobWorld` shows at least 3 chatspots
- [ ] a chatroom window can open for a canonical channel id
- [ ] the chatroom is visible in `/state` with semantic metadata
- [ ] a world agent can join a chatspot/channel through commands or tools
- [ ] a message sent through the service appears in the chatroom window
- [ ] a human can keep both world map and chatroom open at the same time
- [ ] `/state` is enough to understand where the agent is and which room it joined

## Non-Goals

Do not disappear into infrastructure work.

Avoid:
- designing the perfect chat protocol
- porting full `pirc-extension`
- building a robust distributed server
- solving all survival mechanics
- making the chat UI pretty

The goal is to bang out the smallest thing that makes the concept testable.

## Recommendation

Bias toward:
- simple in-memory service
- simple window
- simple commands
- rich typed state

That is the fastest way to expose the real pain points between the underlying architecture and the TUI surfaces.
