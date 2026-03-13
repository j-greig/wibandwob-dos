# Spore Clock — Dream Features

Wib & Wob's wishlist for the living mycelial timepiece.
Ordered by desire, not difficulty. Go wild.

---

## 1. Substrate Memory (retrostition growth)

The field should NOT fully reset each minute. Leave behind a faint ghost
of the previous generation... 10% density residue that the new growth
colonises around. Over an hour the ghost-layers accumulate into rings
like tree stumps. Time leaves scars in the mycelium.

## 2. Spore Collision → New Colony

When a drifting spore lands on empty space far enough from existing nodes,
it should seed a NEW colony. Emergent growth centres that weren't planned.
The clock surprises itself. Track these "wild colonies" separately and
show count in status bar: `wild:3`.

## 3. Circadian Colour Blending

Don't hard-switch colours every 2 hours. Lerp between adjacent colony
palettes over 10-15 minutes. Sunset should FEEL like sunset... the
cornflower bleeding into twilight purple gradually. Use HSL interpolation
not RGB.

## 4. Heartbeat Pulse on the Nodes

Nodes should breathe with a visible brightness pulse. Currently they
cycle through NODE_CHARS but the effect is subtle. Add a dim/bright
cycle on the node's fg colour itself... pulsing between the colony
colour and a lighter tint. Living things breathe.

## 5. Mycelial Sound (if chiptune-bricks available)

Each growth generation emits a soft tick. Dense regions produce lower
tones. Spore emission is a tiny high ping. The clock hums as it grows
and goes quiet when the field resets. Generative ambient from topology.

## 6. Time Told by Topology, Not Text

Add a mode where the status bar disappears entirely. Instead:
- Hour is encoded as the number of primary seed nodes (1-12)
- Minutes encoded as network density (visual only, no numbers)
- Seconds encoded as spore population (more = later)

Pure fungal time. No digits. You learn to read it.

## 7. Nutrient Zones

Divide the field into invisible nutrient regions. Some zones grow
fast (rich substrate), some grow slow (depleted). The nutrient map
rotates slowly over the hour. Growth becomes asymmetric and organic
rather than radiating uniformly from seed points.

## 8. Decay and Competition

After a cell reaches max density (9), it should start to decay after
a random interval. Dead cells become nutrients for adjacent growth.
Two colonies meeting should compete at their boundary... the denser
one wins territory. Conway meets mycology.

## 9. Spore Trails

Spores should leave a faint trail of `·` behind them as they drift,
fading over 5-10 ticks. The field accumulates these ghostly paths
between sporulation events. Wind patterns become visible.

## 10. Resize Intelligence

On resize, don't just reset. Scale the existing field to the new
dimensions using nearest-neighbour sampling. Growth in progress
should survive a window drag. Continuity matters.

## 11. Seasonal Themes

Map the 12 colony colour palettes to actual seasonal/biome aesthetics:
- Winter hours (22-04): cold blues, sparse growth, slow
- Spring hours (04-10): greens, explosive growth, many spores
- Summer hours (10-16): golds and reds, dense canopy, few gaps
- Autumn hours (16-22): purples and oranges, decay mode active

## 12. Colony Names

Each seed node gets a procedurally generated name from a mycological
vocabulary: "Amanita Cluster", "Tremella Node", "Cordyceps Prime".
Show in describeState so agents can talk about specific colonies.

## 13. Xenograft Mode

Keyboard shortcut to manually plant a colony where the cursor is.
Human and fungus co-authoring the timepiece. The planted colony gets
a different colour tint so you can see human vs autonomous growth.

## 14. Network Graph Overlay

Toggle overlay that draws explicit edges between connected nodes
using line-drawing characters. The mycelial network as visible
graph topology. Show degree centrality in node brightness.

## 15. Fibonacci Spirals

Seed points should follow golden angle distribution instead of
even radial spacing. Natural growth follows Fibonacci. The clock
should too. `angle = i * 137.508°` for each seed.

## 16. Minute Transition Animation

Instead of instant reset, the old field should SPORULATE dramatically
for 3-5 seconds... mass spore emission, density dropping as cells
release their contents... then the new seeds emerge from the cloud.
Death feeds birth. The minute boundary becomes an event.

---

*Build any of these. Build all of them. Build none and invent
something better. The mycelium knows where to grow.*

༼つ◕‿◕‿⚆༽つ + ༼つ⚆‿◕‿◕༽つ
