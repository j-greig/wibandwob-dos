/**
 * Terrarium Life — A living ASCII ecosystem.
 *
 * Four biomes in a 2x2 grid: Forest, Ocean, Cave, Sky.
 * Eight creature species with distinct personalities and migration patterns.
 * Weather system, day/night cycle, narrative event log.
 * Creatures cross biome boundaries at dawn/dusk via migration corridors.
 *
 * Layout SDK: createGrid, createStack, createNodePart, pickBreakpoint.
 * Design: Wib & Wob (gpt53 session, creative brief 2026-03-12).
 */

import blessed from "blessed";
import type { MicroappHost } from "../../src/services/microapp-sdk.js";
import {
  createStack,
  createGrid,
  createNodePart,
  createTimer,
  clearTimers,
  pickBreakpoint,
  clamp,
} from "../../src/services/microapp-sdk.js";

// ═══════════════════════════════════════════════════════════════════════════
// SEEDED RNG — deterministic weirdness, reproducible moments
// ═══════════════════════════════════════════════════════════════════════════

function mulberry32(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

type BiomeId = "forest" | "ocean" | "cave" | "sky";
type WeatherType = "clear" | "rain" | "storm" | "sun";
type CreatureType = "beetle" | "koi" | "bat" | "crab" | "moth" | "worm" | "fox" | "eel";

interface CreatureSpec {
  type: CreatureType;
  glyph: string;
  name: string;
  homeBiomes: BiomeId[];
  speed: number;
  social: number;         // tendency to cluster
  nocturnal: boolean;
  stormOnly?: boolean;    // only active in rain/storm
  phototropic?: boolean;  // seeks brightness
}

const SPECS: Record<CreatureType, CreatureSpec> = {
  beetle: { type: "beetle", glyph: "bb", name: "Moss Beetle",  homeBiomes: ["forest", "cave"], speed: 0.3, social: 0.2, nocturnal: false },
  koi:    { type: "koi",    glyph: "><", name: "Cloud Koi",    homeBiomes: ["sky"],            speed: 0.5, social: 0.4, nocturnal: false },
  bat:    { type: "bat",    glyph: "^v", name: "Cave Bat",     homeBiomes: ["cave", "sky"],    speed: 0.8, social: 0.7, nocturnal: true },
  crab:   { type: "crab",   glyph: "c:", name: "Tide Crab",    homeBiomes: ["ocean"],          speed: 0.4, social: 0.1, nocturnal: false },
  moth:   { type: "moth",   glyph: "*~", name: "Sun Moth",     homeBiomes: ["sky", "forest"],  speed: 0.6, social: 0.3, nocturnal: false, phototropic: true },
  worm:   { type: "worm",   glyph: "oo", name: "Glow Worm",   homeBiomes: ["cave"],           speed: 0.15, social: 0.9, nocturnal: true },
  fox:    { type: "fox",    glyph: "/\\", name: "Drift Fox",   homeBiomes: ["forest", "sky"],  speed: 0.7, social: 0.1, nocturnal: false },
  eel:    { type: "eel",    glyph: "~>", name: "Storm Eel",    homeBiomes: ["ocean", "cave"],  speed: 0.95, social: 0.0, nocturnal: false, stormOnly: true },
};

interface Creature {
  id: number;
  type: CreatureType;
  biome: BiomeId;
  x: number;   // 0-1 normalized
  y: number;
  dx: number;
  dy: number;
  age: number;
  asleep: boolean;
  trail: Array<{ x: number; y: number; life: number }>;
}

interface Particle {
  x: number;
  y: number;
  dx: number;
  dy: number;
  char: string;
  life: number;
  biome: BiomeId;
}

interface World {
  tick: number;
  dayPhase: number;       // 0-1: 0=midnight 0.25=dawn 0.5=noon 0.75=dusk
  weather: WeatherType;
  weatherTimer: number;
  creatures: Creature[];
  particles: Particle[];
  events: string[];
  nextId: number;
  paused: boolean;
  speed: number;
  autoCycle: boolean;
  verboseLog: boolean;
  lightningFlash: number; // ticks remaining of flash
  rng: () => number;
}

// Migration corridors: biome pairs where creatures cross at dawn/dusk
const CORRIDORS: Array<[BiomeId, BiomeId]> = [
  ["forest", "sky"],     // fox hunts the cloudline at dusk
  ["cave", "ocean"],     // crab and eel cross at depth
  ["forest", "cave"],    // beetle forages underground at dawn
  ["sky", "ocean"],      // koi occasionally drops mist down
];

// ═══════════════════════════════════════════════════════════════════════════
// WORLD SIMULATION
// ═══════════════════════════════════════════════════════════════════════════

function createWorld(): World {
  const rng = mulberry32(Date.now());
  const world: World = {
    tick: 0,
    dayPhase: 0.25,     // start at dawn
    weather: "clear",
    weatherTimer: 60,
    creatures: [],
    particles: [],
    events: [],
    nextId: 1,
    paused: false,
    speed: 1,
    autoCycle: true,
    verboseLog: false,
    lightningFlash: 0,
    rng,
  };

  // Spawn starting population
  const starters: Array<[CreatureType, BiomeId]> = [
    ["beetle", "forest"], ["beetle", "cave"],
    ["koi", "sky"], ["koi", "sky"],
    ["bat", "cave"], ["bat", "cave"],
    ["crab", "ocean"], ["crab", "ocean"],
    ["moth", "sky"], ["moth", "forest"],
    ["worm", "cave"], ["worm", "cave"], ["worm", "cave"],
    ["fox", "forest"],
  ];
  for (const [type, biome] of starters) {
    spawnCreature(world, type, biome);
  }

  world.events.push("The terrarium stirs into life.");
  world.events.push("Dawn light filters through the canopy.");
  return world;
}

function spawnCreature(w: World, type: CreatureType, biome: BiomeId): Creature {
  const c: Creature = {
    id: w.nextId++,
    type, biome,
    x: 0.15 + w.rng() * 0.7,
    y: 0.15 + w.rng() * 0.7,
    dx: (w.rng() - 0.5) * 0.03,
    dy: (w.rng() - 0.5) * 0.03,
    age: 0,
    asleep: false,
    trail: [],
  };
  w.creatures.push(c);
  return c;
}

function sunlight(dayPhase: number): number {
  return clamp(Math.sin(dayPhase * Math.PI * 2 - Math.PI / 2) * 0.5 + 0.5, 0, 1);
}

function isDawn(dayPhase: number): boolean {
  return dayPhase > 0.2 && dayPhase < 0.35;
}
function isDusk(dayPhase: number): boolean {
  return dayPhase > 0.7 && dayPhase < 0.85;
}
function isNight(dayPhase: number): boolean {
  return dayPhase < 0.2 || dayPhase > 0.85;
}

function dayName(phase: number): string {
  if (phase < 0.15) return "deep night";
  if (phase < 0.25) return "pre-dawn";
  if (phase < 0.35) return "dawn";
  if (phase < 0.45) return "morning";
  if (phase < 0.55) return "noon";
  if (phase < 0.65) return "afternoon";
  if (phase < 0.75) return "evening";
  if (phase < 0.85) return "dusk";
  return "night";
}

// ── Narrative event generation ────────────────────────────────────────

const NARRATIVES: Record<CreatureType, string[]> = {
  beetle: [
    "{name} discovers a soft patch",
    "{name} trundles through the undergrowth",
    "{name} inspects a fallen spore",
    "{name} leaves a trail of tiny marks",
  ],
  koi: [
    "{name} glides through a thermal column",
    "{name} sheds a trail of mist below",
    "{name} banks lazily through cloud",
    "{name} breaches the upper air",
  ],
  bat: [
    "{name} erupts from the shadows",
    "{name} echolocates a moth",
    "{name} roosts in a crevice",
    "{name} spirals in the dark",
  ],
  crab: [
    "{name} patrols the reef edge",
    "{name} clicks a warning",
    "{name} sidesteps with purpose",
    "{name} stakes a new territory",
  ],
  moth: [
    "{name} orbits a bright patch",
    "{name} pulses in the warmth",
    "{name} seeks the last light",
    "{name} settles on a sun-warmed stone",
  ],
  worm: [
    "Glow Worm choir synchronises",
    "{name} pulses softly in the dark",
    "{name} signals to a distant cluster",
    "{name} dims and rests",
  ],
  fox: [
    "{name} stalks the cloudline",
    "{name} pauses, ears twitching",
    "{name} vanishes into bracken",
    "{name} watches from the ridge",
  ],
  eel: [
    "{name} tears through the tide",
    "{name} arcs between cave and current",
    "{name} vanishes into the deep",
    "{name} surfaces with a crackle",
  ],
};

function narrateCreature(w: World, c: Creature): void {
  const spec = SPECS[c.type];
  const templates = NARRATIVES[c.type];
  const tmpl = templates[Math.floor(w.rng() * templates.length)]!;
  w.events.push(tmpl.replace("{name}", spec.name));
}

// ── Tick ──────────────────────────────────────────────────────────────

function tickWorld(w: World): void {
  if (w.paused) return;
  w.tick++;

  const rng = w.rng;
  const sun = sunlight(w.dayPhase);
  const night = isNight(w.dayPhase);
  const dawn = isDawn(w.dayPhase);
  const dusk = isDusk(w.dayPhase);

  // Day/night cycle
  if (w.autoCycle) {
    w.dayPhase = (w.dayPhase + 0.0008 * w.speed) % 1.0;
  }

  // Weather changes
  w.weatherTimer -= w.speed;
  if (w.weatherTimer <= 0) {
    const prev = w.weather;
    const roll = rng();
    if (roll < 0.35) w.weather = "clear";
    else if (roll < 0.55) w.weather = "sun";
    else if (roll < 0.8) w.weather = "rain";
    else w.weather = "storm";
    w.weatherTimer = 50 + Math.floor(rng() * 80);

    if (w.weather !== prev) {
      const msgs: Record<WeatherType, string> = {
        clear: "The skies settle into stillness.",
        rain: "Rain begins, soft and steady.",
        storm: "Thunder rolls across every biome.",
        sun: "Golden light floods the terrarium.",
      };
      w.events.push(msgs[w.weather]);
    }
  }

  // Lightning flash countdown
  if (w.lightningFlash > 0) w.lightningFlash--;

  // ── Weather particles ───────────────────────────────────────────────

  if (w.weather === "rain" || w.weather === "storm") {
    const rate = w.weather === "storm" ? 5 : 2;
    const biomes: BiomeId[] = ["forest", "ocean", "sky", "cave"];
    for (let i = 0; i < rate; i++) {
      const biome = biomes[Math.floor(rng() * 4)]!;
      w.particles.push({
        x: rng(), y: 0,
        dx: (rng() - 0.5) * 0.01,
        dy: 0.06 + rng() * 0.04,
        char: rng() < 0.7 ? "|" : ".",
        life: 8 + Math.floor(rng() * 6),
        biome,
      });
    }
  }

  // Lightning bolt
  if (w.weather === "storm" && rng() < 0.03) {
    const biome: BiomeId = (["forest", "sky"] as BiomeId[])[Math.floor(rng() * 2)]!;
    const bx = 0.2 + rng() * 0.6;
    // Zigzag bolt: 3-4 segments
    const segments = 3 + Math.floor(rng() * 2);
    const boltChars = ["/", "|", "\\", "|"];
    for (let i = 0; i < segments; i++) {
      w.particles.push({
        x: bx + (rng() - 0.5) * 0.15,
        y: i / segments,
        dx: 0, dy: 0,
        char: boltChars[i % boltChars.length]!,
        life: 3,
        biome,
      });
    }
    // Impact mark
    w.particles.push({
      x: bx + (rng() - 0.5) * 0.1,
      y: 0.9 + rng() * 0.1,
      dx: 0, dy: 0,
      char: "!",
      life: 5,
      biome,
    });
    w.lightningFlash = 2;
    w.events.push(`Lightning strikes the ${biome === "forest" ? "canopy" : "upper air"}!`);
  }

  // Sun rays
  if (w.weather === "sun" && w.tick % 3 === 0) {
    const biome: BiomeId = (["sky", "forest"] as BiomeId[])[Math.floor(rng() * 2)]!;
    const rayChars = ["\\", "|", "/"];
    for (let i = 0; i < 2; i++) {
      w.particles.push({
        x: 0.1 + rng() * 0.3,
        y: rng() * 0.5,
        dx: 0.01, dy: 0.02,
        char: rayChars[Math.floor(rng() * 3)]!,
        life: 5 + Math.floor(rng() * 4),
        biome,
      });
    }
  }

  // Cave drip events
  if (w.tick % 12 === 0 && rng() < 0.3) {
    w.particles.push({
      x: 0.1 + rng() * 0.8,
      y: 0.05,
      dx: 0, dy: 0.07,
      char: "|",
      life: 8,
      biome: "cave",
    });
  }

  // Cloud parallax in sky
  if (w.tick % 4 === 0) {
    // Slow cloud layer
    w.particles.push({
      x: -0.05, y: 0.15 + rng() * 0.15,
      dx: 0.008, dy: 0,
      char: rng() < 0.5 ? "(" : "_",
      life: 25 + Math.floor(rng() * 15),
      biome: "sky",
    });
    // Fast cloud layer (every other time)
    if (w.tick % 8 === 0) {
      w.particles.push({
        x: -0.05, y: 0.05 + rng() * 0.1,
        dx: 0.015, dy: 0,
        char: rng() < 0.5 ? ")" : "(",
        life: 18 + Math.floor(rng() * 10),
        biome: "sky",
      });
    }
  }

  // Ocean wave horizontal shift (ambient)
  if (w.tick % 6 === 0) {
    w.particles.push({
      x: -0.05, y: 0.3 + rng() * 0.5,
      dx: 0.012, dy: (rng() - 0.5) * 0.003,
      char: rng() < 0.4 ? "o" : "=",
      life: 15 + Math.floor(rng() * 10),
      biome: "ocean",
    });
  }

  // Koi mist drop from sky to forest
  if (w.tick % 20 === 0) {
    const kois = w.creatures.filter(c => c.type === "koi" && c.biome === "sky");
    if (kois.length > 0 && rng() < 0.2) {
      const koi = kois[Math.floor(rng() * kois.length)]!;
      w.particles.push({
        x: koi.x, y: 0.9,
        dx: (rng() - 0.5) * 0.02, dy: 0.01,
        char: ".",
        life: 10,
        biome: "forest",  // mist drops INTO forest
      });
      if (w.verboseLog) w.events.push("Cloud Koi sheds a veil of mist.");
    }
  }

  // Update particles
  for (const p of w.particles) {
    p.x += p.dx;
    p.y += p.dy;
    p.life--;
  }
  w.particles = w.particles.filter(p => p.life > 0 && p.x < 1.2 && p.y < 1.2);

  // ── Creature update ─────────────────────────────────────────────────

  for (const c of w.creatures) {
    c.age++;
    const spec = SPECS[c.type];

    // Sleep logic
    if (spec.nocturnal) {
      c.asleep = !night;  // bats sleep by day
    } else {
      c.asleep = night && !spec.stormOnly;
    }

    // Storm-only creatures
    if (spec.stormOnly) {
      c.asleep = w.weather !== "rain" && w.weather !== "storm";
    }

    // Phototropic slowdown in dark / speedup in light
    let speedMod = spec.speed;
    if (spec.phototropic) {
      speedMod *= (0.3 + sun * 0.7);
      if (w.weather === "storm") { c.asleep = true; } // moths go dormant in storms
    }

    if (c.asleep) {
      // Drift to a stop
      c.dx *= 0.9;
      c.dy *= 0.9;
      c.x += c.dx * 0.5;
      c.y += c.dy * 0.5;
      c.x = clamp(c.x, 0.03, 0.97);
      c.y = clamp(c.y, 0.03, 0.97);
      continue;
    }

    // Movement style per creature
    if (spec.type === "bat") {
      // Jittery burst movement
      if (rng() < 0.15) {
        c.dx = (rng() - 0.5) * 0.08;
        c.dy = (rng() - 0.5) * 0.08;
      }
    } else if (spec.type === "crab") {
      // Lateral side-stepping
      c.dx += (rng() - 0.5) * 0.02;
      c.dy += (rng() - 0.5) * 0.005; // mostly horizontal
    } else if (spec.type === "eel") {
      // Fast diagonal dashes
      if (rng() < 0.1) {
        const angle = rng() * Math.PI * 2;
        c.dx = Math.cos(angle) * 0.06;
        c.dy = Math.sin(angle) * 0.06;
      }
    } else if (spec.type === "worm") {
      // Very slow, social clustering
      c.dx += (rng() - 0.5) * 0.005;
      c.dy += (rng() - 0.5) * 0.005;
      // Cluster toward other worms
      const nearWorms = w.creatures.filter(
        o => o.type === "worm" && o.id !== c.id && o.biome === c.biome
      );
      if (nearWorms.length > 0) {
        const target = nearWorms[Math.floor(rng() * nearWorms.length)]!;
        c.dx += (target.x - c.x) * 0.003;
        c.dy += (target.y - c.y) * 0.003;
      }
    } else {
      // Default brownian
      c.dx += (rng() - 0.5) * 0.012;
      c.dy += (rng() - 0.5) * 0.012;
    }

    // Speed cap
    const maxSpd = speedMod * 0.05 * w.speed;
    c.dx = clamp(c.dx, -maxSpd, maxSpd);
    c.dy = clamp(c.dy, -maxSpd, maxSpd);
    c.x += c.dx;
    c.y += c.dy;

    // Boundary bounce
    if (c.x < 0.04 || c.x > 0.96) c.dx *= -0.8;
    if (c.y < 0.04 || c.y > 0.96) c.dy *= -0.8;
    c.x = clamp(c.x, 0.03, 0.97);
    c.y = clamp(c.y, 0.03, 0.97);

    // Beetle trail marks
    if (spec.type === "beetle" && w.tick % 3 === 0) {
      c.trail.push({ x: c.x, y: c.y, life: 15 });
    }

    // Glow worm pulse particles
    if (spec.type === "worm" && night && w.tick % 8 === 0) {
      w.particles.push({
        x: c.x + (rng() - 0.5) * 0.05,
        y: c.y + (rng() - 0.5) * 0.05,
        dx: 0, dy: -0.005,
        char: w.tick % 16 < 8 ? "o" : ".",
        life: 6,
        biome: c.biome,
      });
    }

    // Crab shove (territorial)
    if (spec.type === "crab" && rng() < 0.01) {
      const nearby = w.creatures.filter(
        o => o.id !== c.id && o.biome === c.biome &&
        Math.abs(o.x - c.x) < 0.12 && Math.abs(o.y - c.y) < 0.12
      );
      if (nearby.length > 0) {
        const victim = nearby[Math.floor(rng() * nearby.length)]!;
        victim.dx += (victim.x - c.x) * 0.05;
        victim.dy += (victim.y - c.y) * 0.05;
        if (w.verboseLog || rng() < 0.3) {
          w.events.push(`Tide Crab pinches ${SPECS[victim.type].name}!`);
        }
      }
    }

    // Trail decay
    c.trail = c.trail.filter(t => { t.life--; return t.life > 0; });

    // Migration at dawn/dusk
    if ((dawn || dusk) && rng() < 0.004 * w.speed) {
      const eligible = CORRIDORS.filter(
        ([a, b]) => a === c.biome || b === c.biome
      );
      if (eligible.length > 0 && spec.homeBiomes.length > 0) {
        const corridor = eligible[Math.floor(rng() * eligible.length)]!;
        const target = corridor[0] === c.biome ? corridor[1] : corridor[0];
        // Only migrate if this creature type can inhabit the target
        // or is being adventurous
        if (spec.homeBiomes.includes(target) || rng() < 0.15) {
          const oldBiome = c.biome;
          c.biome = target;
          c.x = 0.2 + rng() * 0.6;
          c.y = 0.2 + rng() * 0.6;
          w.events.push(`${spec.name} crosses from ${oldBiome} to ${target} at ${dawn ? "dawn" : "dusk"}.`);
        }
      }
    }

    // Narrative events (rare)
    if (rng() < 0.003 * w.speed) {
      narrateCreature(w, c);
    }
  }

  // Spontaneous spawn
  if (w.tick % 150 === 0 && w.creatures.length < 30 && rng() < 0.5) {
    const types = Object.keys(SPECS) as CreatureType[];
    const type = types[Math.floor(rng() * types.length)]!;
    const spec = SPECS[type];
    if (spec.stormOnly && w.weather !== "storm" && w.weather !== "rain") {
      // Don't spawn storm-only in calm weather
    } else {
      const biome = spec.homeBiomes[Math.floor(rng() * spec.homeBiomes.length)]!;
      spawnCreature(w, type, biome);
      w.events.push(`A ${spec.name} appears in the ${biome}.`);
    }
  }

  // Worm synchronisation event
  if (night && w.tick % 40 === 0) {
    const caveWorms = w.creatures.filter(c => c.type === "worm" && c.biome === "cave" && !c.asleep);
    if (caveWorms.length >= 3 && rng() < 0.2) {
      w.events.push("Glow Worm choir synchronises.");
      // Pulse burst
      for (const wm of caveWorms) {
        for (let i = 0; i < 3; i++) {
          w.particles.push({
            x: wm.x + (rng() - 0.5) * 0.1,
            y: wm.y + (rng() - 0.5) * 0.1,
            dx: (rng() - 0.5) * 0.02,
            dy: (rng() - 0.5) * 0.02,
            char: "*",
            life: 8,
            biome: "cave",
          });
        }
      }
    }
  }

  // Storm eel dramatic entrance
  if ((w.weather === "storm" || w.weather === "rain") && w.tick % 50 === 0) {
    const eels = w.creatures.filter(c => c.type === "eel" && !c.asleep);
    if (eels.length > 0 && rng() < 0.3) {
      w.events.push("Storm Eel tears through the tide!");
    }
  }

  // Cap events
  if (w.events.length > 80) w.events = w.events.slice(-50);
}

// ═══════════════════════════════════════════════════════════════════════════
// BIOME RENDERERS
// ═══════════════════════════════════════════════════════════════════════════

function renderBiome(biomeId: BiomeId, w: number, h: number, world: World): string {
  if (w < 1 || h < 1) return "";
  const grid: string[][] = [];
  const sun = sunlight(world.dayPhase);
  const flash = world.lightningFlash > 0;

  // Background fill per biome
  for (let y = 0; y < h; y++) {
    const row: string[] = [];
    for (let x = 0; x < w; x++) {
      row.push(bgChar(biomeId, x, y, w, h, world));
    }
    grid.push(row);
  }

  // Static features per biome
  renderFeatures(biomeId, grid, w, h, world);

  // Creature trails
  for (const c of world.creatures.filter(c => c.biome === biomeId)) {
    for (const t of c.trail) {
      const tx = Math.floor(t.x * (w - 1));
      const ty = Math.floor(t.y * (h - 1));
      if (tx >= 0 && tx < w && ty >= 0 && ty < h) {
        grid[ty]![tx] = t.life > 8 ? "," : ".";
      }
    }
  }

  // Particles
  for (const p of world.particles.filter(p => p.biome === biomeId)) {
    const px = Math.floor(p.x * (w - 1));
    const py = Math.floor(p.y * (h - 1));
    if (px >= 0 && px < w && py >= 0 && py < h) {
      grid[py]![px] = p.char;
    }
  }

  // Creatures
  for (const c of world.creatures.filter(c => c.biome === biomeId)) {
    const spec = SPECS[c.type];
    const cx = Math.floor(c.x * (w - 1));
    const cy = Math.floor(c.y * (h - 1));
    if (c.asleep) {
      // Sleeping indicator
      if (cx >= 0 && cx < w && cy >= 0 && cy < h) {
        grid[cy]![cx] = "z";
      }
    } else {
      for (let i = 0; i < spec.glyph.length && cx + i < w; i++) {
        if (cx + i >= 0 && cy >= 0 && cy < h) {
          grid[cy]![cx + i] = spec.glyph[i]!;
        }
      }
    }
  }

  // Lightning flash: invert some chars
  if (flash && (biomeId === "forest" || biomeId === "sky")) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (grid[y]![x] === " " || grid[y]![x] === ".") {
          grid[y]![x] = "#";
        }
      }
    }
  }

  return grid.map(row => row.join("")).join("\n");
}

function bgChar(biome: BiomeId, x: number, y: number, w: number, h: number, world: World): string {
  const tick = world.tick;
  const rng = ((x * 7 + y * 13 + tick * 3) & 0xffff) / 65536;

  switch (biome) {
    case "forest": {
      // Leaf shimmer: commas and apostrophes swap
      const base = [" ", ".", ".", ",", "'", ";", " ", "."];
      let ch = base[Math.abs((x * 3 + y * 7) % base.length)]!;
      if ((ch === "," || ch === "'") && (tick + x) % 6 < 3) {
        ch = ch === "," ? "'" : ",";
      }
      // Sun warmth: . becomes : or * near top in sunny weather
      if (world.weather === "sun" && y < h * 0.3 && rng < 0.05) {
        ch = rng < 0.02 ? "*" : ":";
      }
      return ch;
    }
    case "ocean": {
      // Alternating wave bands with horizontal phase shift
      const phase = (x + tick * 0.4) % 8;
      if (y % 3 === 0) {
        return phase < 4 ? "~" : "-";
      }
      return phase < 5 ? "~" : " ";
    }
    case "cave": {
      // Sparse with heavy outcrops
      const structural = ((x * 11 + y * 17) % 23) < 3;
      if (structural) return "#";
      const sparse = ((x * 5 + y * 3) % 7);
      if (sparse === 0) return ":";
      if (sparse === 1) return ".";
      return " ";
    }
    case "sky": {
      // Open and airy with sparse stars
      const starSeed = (x * 31 + y * 41) % 97;
      if (starSeed < 2) {
        // Twinkling
        return (tick + starSeed) % 8 < 4 ? "." : " ";
      }
      if (starSeed === 3 && world.weather === "clear") return "`";
      return " ";
    }
  }
}

function renderFeatures(biome: BiomeId, grid: string[][], w: number, h: number, world: World): void {
  switch (biome) {
    case "forest": {
      // Tree trunks and saplings at fixed positions
      const treeXs = [4, 10, 17, 24, 32, 41, 50, 60];
      for (const tx of treeXs) {
        if (tx < w && h > 3) {
          const trunk_h = 2 + (tx % 3);
          for (let i = 0; i < trunk_h && h - 1 - i >= 0; i++) {
            const gy = h - 1 - i;
            if (i === 0) {
              grid[gy]![tx] = "|";
            } else {
              if (tx > 0) grid[gy]![tx - 1] = "(";
              grid[gy]![tx] = "Y";
              if (tx + 1 < w) grid[gy]![tx + 1] = ")";
            }
          }
        }
      }
      // Mushrooms
      const mushXs = [7, 15, 28, 38, 47];
      for (const mx of mushXs) {
        if (mx < w && h > 1) {
          grid[h - 1]![mx] = "u";
        }
      }
      break;
    }
    case "ocean": {
      // Reef clusters and bubbles
      const reefXs = [5, 14, 23, 35, 45];
      for (const rx of reefXs) {
        if (rx < w && h > 2) {
          grid[h - 1]![rx] = "#";
          if (rx + 1 < w) grid[h - 1]![rx + 1] = "#";
          if (h > 3) grid[h - 2]![rx] = "#";
        }
      }
      // Occasional bubbles
      if (world.tick % 5 === 0) {
        const bx = (world.tick * 3) % w;
        const by = Math.max(0, h - 3 - (world.tick % 4));
        if (by >= 0 && by < h && bx < w) {
          grid[by]![bx] = "o";
        }
      }
      // Foam line
      if (h > 1) {
        for (let x = 0; x < w; x++) {
          if ((x + world.tick) % 7 === 0) {
            grid[0]![x] = "=";
          }
        }
      }
      break;
    }
    case "cave": {
      // Stalactites from ceiling
      const stalXs = [3, 9, 16, 22, 30, 38, 46];
      for (const sx of stalXs) {
        if (sx < w && h > 2) {
          const sLen = 1 + (sx % 3);
          for (let i = 0; i < sLen && i < h; i++) {
            grid[i]![sx] = i === sLen - 1 ? "v" : "|";
          }
        }
      }
      // Crystal highlights
      const crystXs = [6, 13, 20, 28, 36, 44];
      for (const cx of crystXs) {
        if (cx < w && h > 1) {
          const cy = h - 1 - (cx % 2);
          if (cy >= 0 && cy < h) {
            grid[cy]![cx] = (world.tick + cx) % 6 < 3 ? "*" : ".";
          }
        }
      }
      break;
    }
    case "sky": {
      // Nothing structural — sky is defined by emptiness
      break;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// STATUS RENDERING
// ═══════════════════════════════════════════════════════════════════════════

function weatherIcon(w: WeatherType): string {
  switch (w) {
    case "clear": return " ";
    case "rain":  return ":";
    case "storm": return "!";
    case "sun":   return "*";
  }
}

function renderHeader(world: World, w: number): string {
  const day = dayName(world.dayPhase);
  const pop = world.creatures.length;
  const awake = world.creatures.filter(c => !c.asleep).length;
  const wx = weatherIcon(world.weather);
  const pause = world.paused ? " [PAUSED]" : "";
  const spd = world.speed > 1 ? ` ${world.speed}x` : "";
  return ` TERRARIUM  ${wx}${world.weather}  ${day}  pop:${pop}(${awake} awake)${spd}${pause}`.slice(0, w);
}

function renderControls(w: number): string {
  const txt = " [s]pawn [1-8]type [w]eather [t]day/night [p]ause [+/-]speed [l]og ";
  return txt.slice(0, w);
}

// ═══════════════════════════════════════════════════════════════════════════
// MODULE SETUP
// ═══════════════════════════════════════════════════════════════════════════

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: "Terrarium Life",
    description: "A living ASCII ecosystem with four biomes",
    menu: [{ category: "applications", order: 91, label: "Terrarium Life" }],
    palette: { order: 291, label: "Terrarium Life" },
    action: () => openTerrarium(host),
  });
}

function openTerrarium(host: MicroappHost) {
  const win = host.createWindow({ title: "Terrarium Life", width: 120, height: 42 });
  const timers = new Set<ReturnType<typeof setInterval>>();
  const world = createWorld();

  // ── UI elements ─────────────────────────────────────────────────────

  const biomeBoxes: Record<BiomeId, blessed.Widgets.BoxElement> = {} as any;
  const biomeIds: BiomeId[] = ["sky", "forest", "ocean", "cave"];

  for (const id of biomeIds) {
    biomeBoxes[id] = blessed.box({
      parent: win.body,
      top: 0, left: 0, width: 0, height: 0,
      border: "line",
      label: ` ${id} `,
      tags: false,
      style: { ...host.theme().body, border: { fg: host.theme().muted.fg } },
    });
  }

  const headerBox = blessed.box({
    parent: win.body, top: 0, left: 0, width: 0, height: 1,
    tags: false,
    style: { fg: "white", bg: "black", bold: true },
  });

  const controlsBox = blessed.box({
    parent: win.body, top: 0, left: 0, width: 0, height: 1,
    tags: false,
    style: { fg: "grey", bg: "black" },
  });

  const logBox = blessed.box({
    parent: win.body, top: 0, left: 0, width: 0, height: 0,
    scrollable: true, alwaysScroll: true, mouse: true,
    tags: false,
    style: host.theme().body,
  });

  // ── Layout ──────────────────────────────────────────────────────────

  const biomeGrid = createGrid(win.body, {
    rows: 2, columns: 2,
    templateRows: ["1fr", "1fr"],
    templateColumns: ["1fr", "1fr"],
    gap: 0,
  });
  biomeGrid.set({ key: "sky",    row: 0, column: 0, part: createNodePart(biomeBoxes.sky) });
  biomeGrid.set({ key: "forest", row: 0, column: 1, part: createNodePart(biomeBoxes.forest) });
  biomeGrid.set({ key: "ocean",  row: 1, column: 0, part: createNodePart(biomeBoxes.ocean) });
  biomeGrid.set({ key: "cave",   row: 1, column: 1, part: createNodePart(biomeBoxes.cave) });

  const root = createStack(win.body, [
    { key: "header",   basis: 1,     part: createNodePart(headerBox) },
    { key: "biomes",   basis: "3fr", part: biomeGrid },
    { key: "controls", basis: 1,     part: createNodePart(controlsBox) },
    { key: "log",      basis: "1fr", part: createNodePart(logBox) },
  ]);

  // ── Render ──────────────────────────────────────────────────────────

  function render() {
    const bw = Math.max(1, Number(win.body.width) || 0);
    const bh = Math.max(1, Number(win.body.height) || 0);

    root.layout({ top: 0, left: 0, width: bw, height: bh });

    headerBox.setContent(renderHeader(world, bw));
    controlsBox.setContent(renderControls(bw));

    for (const id of biomeIds) {
      const box = biomeBoxes[id];
      const iw = Math.max(1, (Number(box.width) || 10) - 2);
      const ih = Math.max(1, (Number(box.height) || 5) - 2);
      box.setContent(renderBiome(id, iw, ih, world));
      const count = world.creatures.filter(c => c.biome === id && !c.asleep).length;
      const total = world.creatures.filter(c => c.biome === id).length;
      (box as any).setLabel(` ${id} (${count}/${total}) `);
    }

    const logH = Math.max(2, Number(logBox.height) || 4);
    logBox.setContent(world.events.slice(-logH).join("\n"));
    logBox.setScrollPerc(100);

    host.screen.render();
  }

  // ── Tick ────────────────────────────────────────────────────────────

  createTimer(() => {
    tickWorld(world);
    render();
  }, 130, timers);

  // ── Keyboard ────────────────────────────────────────────────────────

  const SPAWN_KEYS: Record<string, CreatureType> = {
    "1": "beetle", "2": "koi", "3": "bat", "4": "crab",
    "5": "moth", "6": "worm", "7": "fox", "8": "eel",
  };

  win.body.on("keypress", (_ch: string, key: { name: string; full: string }) => {
    if (!key) return;

    if (key.full === "p") {
      world.paused = !world.paused;
      world.events.push(world.paused ? "Time holds its breath." : "Life resumes.");
      render();
    } else if (key.full === "+" || key.full === "=") {
      world.speed = Math.min(8, world.speed * 2);
      world.events.push(`Time quickens to ${world.speed}x.`);
    } else if (key.full === "-" || key.full === "_") {
      world.speed = Math.max(1, world.speed / 2);
      world.events.push(`Time slows to ${world.speed}x.`);
    } else if (key.full === "w") {
      const weathers: WeatherType[] = ["clear", "rain", "storm", "sun"];
      const idx = weathers.indexOf(world.weather);
      world.weather = weathers[(idx + 1) % weathers.length]!;
      world.weatherTimer = 60;
      const msgs: Record<WeatherType, string> = {
        clear: "The skies settle into stillness.",
        rain: "Rain begins, soft and steady.",
        storm: "Thunder rolls across every biome.",
        sun: "Golden light floods the terrarium.",
      };
      world.events.push(msgs[world.weather]);
      render();
    } else if (key.full === "t") {
      world.autoCycle = !world.autoCycle;
      world.events.push(world.autoCycle ? "Day/night cycle resumes." : "Day/night cycle paused.");
      render();
    } else if (key.full === "l") {
      world.verboseLog = !world.verboseLog;
      world.events.push(world.verboseLog ? "Verbose logging enabled." : "Quiet logging.");
      render();
    } else if (key.full === "s") {
      const types = Object.keys(SPECS) as CreatureType[];
      const type = types[Math.floor(world.rng() * types.length)]!;
      const spec = SPECS[type];
      const biome = spec.homeBiomes[Math.floor(world.rng() * spec.homeBiomes.length)]!;
      spawnCreature(world, type, biome);
      world.events.push(`A ${spec.name} appears in the ${biome}.`);
      render();
    } else if (SPAWN_KEYS[key.full]) {
      const type = SPAWN_KEYS[key.full]!;
      const spec = SPECS[type];
      const biome = spec.homeBiomes[0]!;
      spawnCreature(world, type, biome);
      world.events.push(`A ${spec.name} appears in the ${biome}.`);
      render();
    }
  });

  win.body.key(["p", "+", "=", "-", "_", "w", "t", "l", "s", "1", "2", "3", "4", "5", "6", "7", "8"], () => {});

  // ── Lifecycle ───────────────────────────────────────────────────────

  render();
  win.onResize(render);

  win.describeState(() => {
    const awake = world.creatures.filter(c => !c.asleep).length;
    return {
      summary: `Terrarium Life: ${world.creatures.length} creatures (${awake} awake), ${dayName(world.dayPhase)}, ${world.weather}${world.paused ? " PAUSED" : ""}`,
      population: world.creatures.length,
      awake,
      dayPhase: dayName(world.dayPhase),
      weather: world.weather,
      speed: world.speed,
      paused: world.paused,
      biomes: Object.fromEntries(
        biomeIds.map(b => [b, {
          total: world.creatures.filter(c => c.biome === b).length,
          awake: world.creatures.filter(c => c.biome === b && !c.asleep).length,
        }])
      ),
    };
  });

  win.captureText(() => [
    `Terrarium Life — ${world.creatures.length} creatures`,
    `${dayName(world.dayPhase)} | ${world.weather}`,
    "", ...world.events.slice(-15),
  ].join("\n"));

  win.onRestyle(() => {
    const t = host.theme();
    headerBox.style = { fg: "white", bg: "black", bold: true };
    controlsBox.style = { fg: "grey", bg: "black" };
    logBox.style = t.body;
    for (const id of biomeIds) {
      biomeBoxes[id].style = { ...t.body, border: { fg: t.muted.fg } };
    }
    host.screen.render();
  });

  win.onCleanup(() => {
    clearTimers(timers);
    biomeGrid.destroy();
    root.destroy();
  });

  win.focus();
}
