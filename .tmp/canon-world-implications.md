# Canon World — Implications

*What "fixed landscape" changes about everything.*

---

This resolves several things at once and opens one new question.

## What it fixes

**The worldKey problem disappears.** Right now worldKey encodes seed + terrainName. Every reseed generates a new world and flushes all channel state. If the world is canon — one fixed terrain, agreed upon and saved — the worldKey never changes. Channel state persists across sessions naturally. The ensureWorld resize fix we shipped today becomes less important because the world never gets regenerated anyway.

**Chatspot positions become stable addresses.** Right now chatspots are calculated on every render from viewport dimensions and a seed. If the world is canon, chatspot positions can be fixed in a config file — named places with known coordinates. `#world-lowland-camp` stops being a procedurally placed point and becomes a real named location with a canonical grid position, a description, maybe a lore entry. That's a much stronger foundation for the spatial filesystem idea because the address (`/srv/wibwob/lowland-camp/`) is now permanent, not session-dependent.

**Navigation becomes meaningful.** A fixed world means agents and humans can build up spatial memory. "The tower is northeast of the crossroads" becomes true and stays true. You can write docs that reference locations. Agents can have hardcoded waypoints. The map is a map, not a noise function.

**The IRC channel-to-folder mapping becomes a stable schema.** You can commit a `chatspots.json` to the repo that defines the canon world's named places, their coordinates, their channelIds, and their VPS paths. That file becomes the source of truth for both the renderer and the filesystem.

---

## What it opens

**How do you canonise a world?** Right now you reseed until you get terrain you like, then what? You need a "freeze this" command that:
1. Captures the current seed + terrainName
2. Writes it to a config file as the canon world definition
3. Optionally saves chatspot positions at their current rendered coordinates (or you define them manually after the fact)

That config file then gets committed to the repo. From that point on, `ensureWorld` doesn't accept arbitrary seeds — it loads from canon. The reseed button could be disabled or hidden in canon mode.

**The terrain export we already have (`save-terrain-export`) is probably the seed of this.** That command exists. The missing piece is the other end — a "load from saved terrain" path on startup rather than always regenerating from seed.

---

## One practical note

The current WibWobWorld generates terrain on every render pass from seed + noise functions. For a canon world you'd want to cache the heightmap — generate once, store, load from disk on startup. Otherwise every session re-derives the same terrain (which is deterministic so it'd look identical, but it's wasted work and means the "canon" is only as canon as the noise function being stable across code changes).

If the noise function ever changes — a dependency update, a precision change — the terrain shifts even with the same seed. A saved heightmap is immune to that. Worth doing before canonising anything.

---

## Short version

Fixed world = stable addresses = coherent spatial filesystem = agents can actually build up knowledge of where things are. This is the right call and it makes the whole vision more tractable. The procedural generation was always a worldbuilding tool, not the product. The product is the world you choose to keep.
