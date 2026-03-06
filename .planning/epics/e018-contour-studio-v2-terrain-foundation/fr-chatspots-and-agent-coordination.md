---
Status: proposed
Type: feature-brief
Epic: e018-contour-studio-v2-terrain-foundation
---

# FR — Chatspots, Agent Coordination, and Sugarscape-Style Survival

## Summary

Once `WibWobWorld` can generate and persist a playable overworld, the next fun stretch is not fake 3D. It is a **spatial agent world** where:

- agents move around the overworld
- some locations become `chatspots`
- entering or occupying a chatspot maps an agent into a local chat channel
- WibWob-DOS renders those channels as first-class TUI windows
- chatting is part of survival and coordination, not just flavor
- agents have Sugarscape-style energy/resource constraints
- if agents fail to eat or consume resources, they slow down, stop, and eventually die

The whole WibWob-DOS desktop remains the visible gameplay architecture:
- overworld map window
- chatroom windows
- notes / diary windows
- later rogue room windows from `E019`

## Why This Fits The Current Architecture

This direction aligns with the repo’s architecture invariants in:
- [/Users/james/Repos/wibandwob-dos/.agents/invariants.md](/Users/james/Repos/wibandwob-dos/.agents/invariants.md)
- [/Users/james/Repos/wibandwob-dos/.agents/architecture.md](/Users/james/Repos/wibandwob-dos/.agents/architecture.md)
- [/Users/james/Repos/wibandwob-dos/.agents/control-api.md](/Users/james/Repos/wibandwob-dos/.agents/control-api.md)

Reasons:
- user-visible surfaces must be API-visible
- windows must expose semantic state through `describeState()`
- services should own logic; windows should own wiring/rendering
- new command surfaces should flow through the registry, not bespoke entry points

This feature can respect that cleanly:
- one service owns world chat/co-presence logic
- one window type or microapp owns chatroom rendering
- `WibWobWorld` owns location and chatspot binding
- agent tools talk through commands / typed state / control API

## Existing Repo Seams To Reuse

### Window / App Integration

- composition root: [src/core/app-controller.ts](/Users/james/Repos/wibandwob-dos/src/core/app-controller.ts)
- command source of truth: [src/core/command-catalog.ts](/Users/james/Repos/wibandwob-dos/src/core/command-catalog.ts)
- command execution layer: [src/core/command-registry.ts](/Users/james/Repos/wibwob-dos/src/core/command-registry.ts)
- dynamic microapps: [src/services/module-loader.ts](/Users/james/Repos/wibandwob-dos/src/services/module-loader.ts)
- canonical window operations: [src/core/window-facade.ts](/Users/james/Repos/wibandwob-dos/src/core/window-facade.ts)
- canonical desktop state: [src/services/state-service.ts](/Users/james/Repos/wibandwob-dos/src/services/state-service.ts)
- local HTTP control surface: [src/services/control-api.ts](/Users/james/Repos/wibandwob-dos/src/services/control-api.ts)

### Agent Integration

- in-app agent session: [src/services/wibwob-agent-session.ts](/Users/james/Repos/wibandwob-dos/src/services/wibwob-agent-session.ts)
- agent-facing TUI tools: [src/services/agent-tools.ts](/Users/james/Repos/wibwob-dos/src/services/agent-tools.ts)
- existing `Wib&Wob Agent` window: [src/windows/wibwob-agent-window.ts](/Users/james/Repos/wibandwob-dos/src/windows/wibwob-agent-window.ts)

### Pattern To Borrow

`Backrooms TV` is a useful local reference for:
- channel/session-like launch config
- service-owned run logic
- window-owned rendering

Relevant files:
- [src/services/backrooms-service.ts](/Users/james/Repos/wibandwob-dos/src/services/backrooms-service.ts)
- [src/windows/backrooms-windows.ts](/Users/james/Repos/wibwob-dos/src/windows/backrooms-windows.ts)

### WibWobWorld As The World Layer

- terrain model: [src/services/terrain-model.ts](/Users/james/Repos/wibwob-dos/src/services/terrain-model.ts)
- terrain render: [src/services/terrain-render.ts](/Users/james/Repos/wibwob-dos/src/services/terrain-render.ts)
- overworld microapp: [modules-private/wibwobworld/index.ts](/Users/james/Repos/wibwob-dos/modules-private/wibwobworld/index.ts)

## External Reference: `pirc-extension`

Repo:
- https://github.com/mmcc/pirc-extension

Relevant files:
- https://github.com/mmcc/pirc-extension/blob/main/src/index.ts
- https://github.com/mmcc/pirc-extension/blob/main/src/driver.ts
- https://github.com/mmcc/pirc-extension/blob/main/src/multiline.ts
- https://github.com/mmcc/pirc-extension/blob/main/package.json

Current `HEAD` at time of review:
- `79be6c971991036e1a736a910b4309f71243828f`

What it is:
- a pi extension that connects agents to IRC channels
- a lead-agent/subagent coordination tool
- a small TS implementation with IRC client, channel history, and pi subprocess spawning

What is useful to us:
- channel model
- message history model
- agent spawning/lifecycle ideas
- lead/subagent coordination semantics
- reply/thread metadata concepts

What is **not** a drop-in fit:
- it assumes IRC as the primary frontend
- it assumes pi extension runtime, not WibWob-DOS windows
- it does not know about our command registry, `describeState()`, local control API, or desktop windows

Conclusion:
- reuse/adapt concepts, not the whole runtime wholesale
- likely embed a WibWob-DOS-native coordination layer, with IRC or IRC-like transport behind one service seam if we want it

## Core Product Idea

The world map and chatrooms should be tied together spatially.

Model:

```ts
type Chatspot = {
  id: string;
  label: string;
  x: number;
  y: number;
  channelId: string;
  kind: "campfire" | "ruin" | "tower" | "crossroads" | "market";
};

type WorldAgent = {
  id: string;
  name: string;
  kind: "pi-agent";
  x: number;
  y: number;
  energy: number;
  alive: boolean;
  currentChannelId?: string;
};
```

The binding rule:
- `world location` -> `chatspot`
- `chatspot` -> `channel id`
- `channel id` -> `chat room state`

## Canonical Naming

Use stable ids, not display labels, as the infrastructure identity.

Suggested scheme:

```ts
const chatspotId = "chatspot.ridge-03";
const channelId = "#world-ridge-03";
const displayLabel = "Ridge Overlook";
```

Rule:
- `channelId` is canonical
- display label is presentation only
- window title can be friendly
- world map binds to stable ids

This avoids coupling chat identity to window ids or mutable names.

## Proposed Architecture

### 1. `world-chat-service.ts`

New service. Owns:
- channel registry
- participant presence
- message history
- channel subscriptions
- chatspot/channel mapping
- optional IRC bridge behind one seam

Suggested location:
- `src/services/world-chat-service.ts`

Responsibilities:
- create and manage channels
- join/leave channels for agents
- publish messages
- query message history
- surface presence for windows and `/state`

This should be the only owner of world-chat state.

### 2. `world-agents-service.ts`

New service or part of a broader world sim service.

Suggested location:
- `src/services/world-agents-service.ts`

Owns:
- world agent roster
- agent energy
- movement cost
- resource consumption
- death / exhaustion state
- local world occupancy

This is where the Sugarscape-like loop belongs, not in the window.

### 3. `WibWobWorld` Integration

`WibWobWorld` remains the overworld surface.

It should eventually expose:
- chatspot locations
- agent positions
- energy summaries
- focused/nearby chatspot metadata
- commands to move, inspect, and enter a chatspot

This belongs in:
- [modules-private/wibwobworld/index.ts](/Users/james/Repos/wibwob-dos/modules-private/wibwobworld/index.ts)

But the world simulation and chat routing should stay in services.

### 4. Chatroom Window / Microapp

The frontend should be a first-class WibWob-DOS surface.

Good implementation options:
- dedicated built-in window factory under `src/windows/`
- or a private microapp under `modules-private/`

Recommendation:
- start as a private microapp for faster iteration, similar to `WibWobWorld`

Example target:
- `modules-private/world-chatroom/index.ts`

What it shows:
- channel title
- message log
- participants
- maybe nearby world context
- maybe energy / status of agents present

### 5. Agent Chat Bridge

This is where `pirc-extension` ideas fit best.

New tool seam:
- agent can post to a channel
- agent can read a channel
- agent can discover nearby chatspots/channels

Possible tool names:

```ts
world_list_chatspots
world_join_chatspot
world_send_message
world_read_channel
world_get_agent_status
```

These should be backed by the world/chat service, not UI scraping.

## Suggested Command Surface

Follow the command-registry rule from:
- [src/core/command-catalog.ts](/Users/james/Repos/wibwob-dos/src/core/command-catalog.ts)

Potential commands:

```ts
world.chatroom.open
world.chatroom.open_nearest
world.chatroom.send
world.agent.move
world.agent.inspect
world.agent.join_chatspot
world.agent.consume
```

And if implemented as a microapp, dynamic command ids might look like:

```ts
microapp.world-chatroom.open
microapp.world-chatroom.set-channel
microapp.world-chatroom.send
```

## Suggested API Surface

Must follow the rule from:
- [/Users/james/Repos/wibandwob-dos/.agents/control-api.md](/Users/james/Repos/wibwob-dos/.agents/control-api.md)

Possible routes:

```http
GET  /world/chatspots
GET  /world/channels
GET  /world/channels/history?channelId=#world-ridge-03
GET  /world/agents
POST /world/agents/move
POST /world/channels/send
POST /world/channels/join
POST /view/world-chatroom/open
```

Or, more conservatively:
- prefer `POST /commands/run` for actions
- use typed reads under dedicated `GET /world/*` routes

Rule:
- chat surfaces should not require scraping transcript text to know who is in the room

## State / `describeState()` Requirements

Chatroom windows should expose semantic metadata such as:

```ts
{
  appType: "world-chatroom",
  channelId: "#world-ridge-03",
  channelLabel: "Ridge Overlook",
  participantCount: 4,
  participants: ["wibwob", "scramble", "ridge-scout"],
  lastMessageAt: "2026-03-06T12:00:00Z",
  unreadCount: 0,
  nearbyChatspotId: "chatspot.ridge-03",
}
```

`WibWobWorld` should eventually expose:

```ts
{
  nearbyChatspotId: "chatspot.ridge-03",
  nearbyChannelId: "#world-ridge-03",
  playerEnergy: 18,
  agentsVisible: 6,
  chatspotsVisible: 2,
}
```

This is mandatory if agents are expected to reason about the world without scraping the screen.

## Sugarscape-Style Resource Loop

This should stay simple first.

Recommended MVP:
- agents have `energy`
- movement costs energy
- some tiles or nodes provide food/resource recovery
- chatting can be neutral or mildly costly
- if energy reaches zero:
  - movement stops
  - eventually the agent dies or becomes inactive

Not full Sugarscape yet:
- no complex inheritance
- no mating
- no large economic model

Just enough to make coordination matter.

## User Stories

### Human Stories

1. As a human, I can watch agents move around the overworld and see where chatspots exist.
2. As a human, I can open a chatroom window for a location and watch agents coordinate there.
3. As a human, I can inspect an agent’s energy and whether it is stranded, active, or dying.
4. As a human, I can keep the map, chatroom, and notes/diary windows open at the same time.
5. As a human, I can stream the full desktop and the spatial/chat relationship makes visual sense.

### Agent Stories

1. As an in-app pi agent, I can discover nearby chatspots and their channels through tools or typed state.
2. As an in-app pi agent, I can move toward a chatspot to coordinate with other agents.
3. As an in-app pi agent, I can send and read channel messages without scraping chat UI text.
4. As an in-app pi agent, I can decide whether to spend energy moving, consume a resource, or stay and chat.
5. As an in-app pi agent, I can use the same desktop-visible surfaces a human sees.

## Architecture Example

The shape should look more like this:

```ts
// service-owned truth
const world = worldAgents.getSnapshot();
const channels = worldChat.getSnapshot();

// window/frontend wiring
const channel = worldChat.getChannel(channelId);
chatroomWindow.describeState(() => ({
  channelId,
  participantCount: channel.participants.length,
  lastMessageAt: channel.lastMessageAt,
}));
```

Not this:

```ts
// bad: window transcript is the source of truth
const participants = scrapeParticipantsFromBox(chatBox);
```

That would violate the repo’s invariants.

## Suggested Milestones

### M01 — Chatspot Data On The World

- add chatspot generation to `WibWobWorld`
- show chatspots on the map
- expose them in `describeState()`

### M02 — World Chat Service

- add channel registry and message history
- map chatspots to canonical channels
- support join/send/read operations

### M03 — Chatroom Window

- open a room by channel id
- render transcript + presence
- support API/state parity

### M04 — Agent Integration

- add agent tools for move/join/send/read
- bind location to channel presence
- keep agent-visible state typed

### M05 — Energy / Survival

- add energy, resource consumption, exhaustion, death
- make movement and coordination materially meaningful

## Risks

- If chat identity is coupled to window ids, restore/API parity will become brittle.
- If chat truth lives in the TUI window instead of a service, agents will be forced to scrape UI text.
- If IRC assumptions leak into many files, we violate the “one seam” rule from `.agents/invariants.md`.
- If the chat feature lands as a detached side-panel toy with no world-location meaning, it loses most of the fun.

## Recommendation

Do this before investing heavily in the iso renderer.

Reason:
- it is more game-like
- it uses the desktop architecture in a stronger way
- it fits the agent-equal-control concept better
- it creates a direct bridge from `WibWobWorld` to multi-agent play

The right implementation shape is:
- world map as overworld
- chatspots as spatial coordination nodes
- channels as canonical room identities
- pi agents as actors
- WibWob-DOS chatroom windows as the visible frontend
