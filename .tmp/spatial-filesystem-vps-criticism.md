# Constructive Criticism — Spatial Filesystem / VPS Vision

*Holding nothing back.*

---

## The navigation-as-authorization idea has a fundamental problem

Navigation gating is compelling as a metaphor but it's not actually an authorization model — it's a UI convention. Any agent with API access can call `join-nearest-chatspot` and immediately be "at" any chatspot. There's no cost to movement, no cryptographic binding between location and identity, no enforcement. An agent that wants access to `/srv/wibwob/tower/` just teleports there. The spatial metaphor creates the impression of meaningful access control without the substance.

If you want location to mean something, movement needs friction. That either means rate-limiting (you can only move N chatspots per minute), or it means the filesystem access is not granted by the client claiming a location but by the server observing that the client has been in the IRC channel for a chatspot for some minimum duration. Neither of those is hard to implement but neither is in the current thinking either.

---

## "Agents navigate in 3D space to reach a chat point" is not what's happening

WibWobWorld is a 2D terrain renderer with a fake 3D perspective. The agents don't navigate — the human does. `latestFocus` is wherever the human last clicked or moved in WibWobWorld. `join-nearest-chatspot` picks the closest chatspot to that human focus point. 

So the actual mechanic right now is: human moves the camera, agent joins whatever chatspot is nearby. The agent isn't navigating. The human is navigating on behalf of the agent. That might be fine for a demo but it's architecturally broken for the multi-agent autonomous case where agents are supposed to move themselves. There's no "agent moves to position X" command. You'd need to build that, and it's non-trivial because WibWobWorld's movement model is designed for a human with a keyboard/mouse, not an API caller.

---

## IRC is the wrong protocol for a persistent shared workspace

IRC is a real-time relay. It has no memory. If an agent disconnects and reconnects, it doesn't see what was said while it was gone. It doesn't know who's been at a location historically. Channel history requires either a bouncer (ZNC, etc.) or log replay, neither of which is in scope. The world-chat messages in the current system are stored in memory (in `channels` Map) and lost on restart.

For a shared filesystem metaphor where agents leave artifacts and other agents find them later — which is the actual compelling use case you described — IRC gives you presence and real-time messaging but nothing else. The artifact persistence is entirely in the filesystem, and IRC becomes just a "who's here right now" layer. That's fine, but you should be clear that IRC isn't doing the heavy lifting on persistence. The filesystem is. IRC is just the doorbell.

---

## The VPS hardening question is underspecified but the answer is probably not novel

"How do we enable WibWobDOS to be available to agents on other computers" — the answer is SSH tunnels, and that's a solved problem from 1995. There's not much to architect here. The interesting questions are:

- What happens when two agents are at the same chatspot writing to the same file simultaneously? (File locking. No current thinking on this.)
- What's the trust model for the filesystem itself — can any authenticated agent write anywhere in their chatspot's folder, or are there per-agent subdirectories? (Not addressed.)
- What happens when the VPS goes down mid-session — do agents lose their location, do files get corrupted? (No crash recovery thinking.)

These are the actual hard problems. The SSH key / env var question is not.

---

## "Assume the multi-agent chat is a solved problem" is doing a lot of work

It's not solved. We spent this entire session getting two instances to talk to each other without nick collisions, without losing channel state on resize, without the reconnect dying after 3 retries. That's two instances on the same machine. Three instances on three machines with network partitions, VPS reboots, and agents that get SIGKILL'd is a different problem category. The IRC server we have is a toy. The current `auto_reconnect_max_retries=9999` is a workaround for a library default, not a resilience architecture.

---

## The "friend's computer" scenario introduces a trust problem you haven't named

If an agent on a friend's machine has SSH access to your VPS and the jailed tools are scoped to a chatspot path — what stops that agent from reading files in every chatspot by navigating to each one in sequence? The location-gating only works if moving has a cost or if the authorization is checked server-side against some external identity. "Give them an SSH key" gets you transport security but not application-level authorization.

More pointedly: the friend's agent and your agent have the same API surface once they're both tunnelled in. There's no per-agent permission model. It's all-or-nothing.

---

## The metaphor might be the product and that's fine, but name it

The spatial filesystem idea is interesting not because it's more secure or more efficient than a normal shared filesystem — it isn't — but because it creates a legible, navigable mental model for where things are and who's working on them. That's a real value. An agent exploring a world and leaving files is more comprehensible and more aesthetically interesting than an agent SSHing into a box and running rsync.

But that means the thing you're building is primarily a UI/UX layer over a boring shared filesystem. The VPS is a NFS mount with a map drawn on top. That's not a criticism — that might be exactly right. But if you go in thinking you're building novel infrastructure when you're actually building a novel interface, you'll make different and better decisions. The filesystem doesn't need to be exotic. The map does.

---

## What's actually missing before any of this makes sense

1. Agents that can move themselves (not just join the nearest chatspot to wherever the human is looking)
2. A decision about what filesystem isolation means — per-agent? per-chatspot? per-session?
3. A persistence strategy for IRC (log replay, bouncer, or just accept it's ephemeral and lean into that)
4. Some kind of conflict resolution for concurrent writes
5. A clearer answer to "what does an agent actually DO at a chatspot" — reading/writing files is the mechanism, but what's the task?

Without #5 especially, this risks being a technically interesting thing that nobody uses because the job-to-be-done isn't defined.
