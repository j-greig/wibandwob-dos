/**
 * ANTOPOLIS — A Micro-City for Ants with Ant Technology
 *
 * Four districts in a grid: Industrial Zone, Residential Burrows,
 * Grand Plaza (with fountains!), Crystal Mines.
 * Ants build, work, explore, and occasionally blow things up.
 *
 * Uses the full E035 layout SDK: createGrid, createStack, createRow,
 * pickBreakpoint, createNodePart.
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
  renderFiglet,
  createHeaderBar,
  createStatusBar,
  createLogView,
} from "../../src/services/microapp-sdk.js";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

type DistrictId = "industrial" | "residential" | "plaza" | "mines";
type AntCaste = "worker" | "soldier" | "engineer" | "queen" | "scientist";
type BuildingType =
  | "nest" | "farm" | "factory" | "reactor" | "fountain"
  | "barracks" | "lab" | "silo" | "beacon" | "shrine"
  | "drill" | "refinery" | "tavern" | "library" | "catapult";

type ResourceType = "food" | "crystals" | "energy" | "science";

interface Building {
  type: BuildingType;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  age: number;
  powered: boolean;
  district: DistrictId;
}

interface Ant {
  id: number;
  caste: AntCaste;
  district: DistrictId;
  x: number;
  y: number;
  dx: number;
  dy: number;
  task: string;
  carrying: string;
  mood: string;
  energy: number;
  age: number;
}

interface Particle {
  x: number;
  y: number;
  dx: number;
  dy: number;
  char: string;
  life: number;
  district: DistrictId;
  color?: string;
}

type EventSeverity = "calm" | "warn" | "chaos";

interface WorldEvent {
  text: string;
  severity: EventSeverity;
}

type DecreeType = "festival" | "lockdown" | "rush" | "science_push" | "none";

interface World {
  tick: number;
  resources: Record<ResourceType, number>;
  ants: Ant[];
  buildings: Building[];
  particles: Particle[];
  events: WorldEvent[];
  nextId: number;
  paused: boolean;
  speed: number;
  dayPhase: number;
  dangerLevel: number;
  happiness: number;
  techLevel: number;
  decree: DecreeType;
  decreeTicks: number;
  decreeHistory: string[];
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const DISTRICTS: Record<DistrictId, { label: string; subtitle: string; bg: string[]; borderFg: string }> = {
  industrial: {
    label: "Industrial Zone",
    subtitle: "where sparks fly and progress grinds",
    bg: [" ", " ", "░", " ", " ", "·", " ", " ", " ", "░", " ", " "],
    borderFg: "yellow",
  },
  residential: {
    label: "Residential Burrows",
    subtitle: "cosy tunnels, warm hearths",
    bg: [" ", " ", "~", " ", " ", " ", " ", "~", " ", " ", " ", " "],
    borderFg: "green",
  },
  plaza: {
    label: "Grand Plaza",
    subtitle: "the beating heart of Antopolis",
    bg: [" ", " ", " ", " ", "·", " ", " ", " ", " ", " ", "·", " "],
    borderFg: "cyan",
  },
  mines: {
    label: "Crystal Mines",
    subtitle: "deep and glittering",
    bg: ["▪", " ", "·", "▪", " ", " ", "▪", " ", "·", " ", " ", "▪"],
    borderFg: "magenta",
  },
};

const CASTE_GLYPHS: Record<AntCaste, string> = {
  worker:    "ö·",
  soldier:   "Ö>",
  engineer:  "ê=",
  queen:     "♛*",
  scientist: "ë?",
};

// Single-char glyphs for census display
const CASTE_GLYPH_SHORT: Record<AntCaste, string> = {
  worker: "ö", soldier: "Ö", engineer: "ê", queen: "♛", scientist: "ë",
};

const CASTE_NAMES: Record<AntCaste, string> = {
  worker: "Worker", soldier: "Soldier", engineer: "Engineer",
  queen: "Queen", scientist: "Scientist",
};

const BUILDING_ART: Record<BuildingType, string[]> = {
  nest:      ["  /\\  ", " |♛ | ", " |__| ", " ════ "],
  farm:      ["  ♣♣  ", " [  ] ", " [__] ", " ···· "],
  factory:   ["  /|  ", " |▓▓| ", " |▓▓| ", " ▀▀▀▀ "],
  reactor:   [" ╔══╗ ", " ║☢☢║ ", " ╚══╝ ", " ···· "],
  fountain:  ["  ::  ", " (  ) ", " (~~) ", " ·  · "],
  barracks:  ["  ††  ", " |░░| ", " |__| ", " ···· "],
  lab:       ["  ◊◊  ", " |⚗ | ", " |__| ", " ···· "],
  silo:      [" ╔══╗ ", " ║▒▒║ ", " ╚══╝ ", " ···· "],
  beacon:    ["  **  ", " -||- ", "  ||  ", "  ··  "],
  shrine:    ["  /\\  ", " /  \\ ", " ║══║ ", " ···· "],
  drill:     ["  ▼▼  ", " -╫╫- ", " -╨╨- ", " ···· "],
  refinery:  ["  ▄▄  ", " █░░█ ", " ▀██▀ ", " ···· "],
  tavern:    ["  ♪♪  ", " |☺ | ", " |__| ", " ···· "],
  library:   ["  ══  ", " |▤▤| ", " |__| ", " ···· "],
  catapult:  [" /--\\ ", " \\●●/ ", "  ┴┴  ", " ···· "],
};

const BUILDING_DISTRICT: Record<BuildingType, DistrictId> = {
  nest: "residential", farm: "residential", tavern: "residential",
  factory: "industrial", reactor: "industrial", refinery: "industrial", catapult: "industrial",
  fountain: "plaza", barracks: "plaza", beacon: "plaza", shrine: "plaza", library: "plaza",
  lab: "mines", silo: "mines", drill: "mines",
};

const TASKS = [
  "hauling crystals", "tending farm", "patrolling", "building",
  "researching", "napping", "dancing", "digging", "guarding",
  "cooking", "philosophising", "inventing", "gossiping",
  "calibrating reactor", "polishing shrine", "fountain maintenance",
];

const MOODS = [
  "chipper", "grumpy", "ecstatic", "nervous", "zen",
  "caffeinated", "sleepy", "heroic", "confused", "inspired",
];

const EXPLOSION_CHARS = ["*", "✷", "◉", "●", "⊕", "✸", "★", "#", "×", ".", " "];
const FOUNTAIN_CHARS = ["·", ":", "∴", "°", "'", "`", "˙", ".", "·"];
const SPARK_CHARS = ["*", "✦", "+", "·", ".", "'"];

const SEVERITY_PREFIX: Record<EventSeverity, string> = {
  calm:  "  ",
  warn:  "~ ",
  chaos: "! ",
};

function evt(w: World, text: string, severity: EventSeverity = "calm") {
  w.events.push({ text, severity });
}

const DECREE_NAMES: Record<DecreeType, string> = {
  festival: "FESTIVAL",
  lockdown: "LOCKDOWN",
  rush: "PRODUCTION RUSH",
  science_push: "SCIENCE MANDATE",
  none: "",
};

const DECREE_ANNOUNCE: Record<Exclude<DecreeType, "none">, string> = {
  festival: "The Queen decrees: LET THERE BE FESTIVITIES! All ants dance!",
  lockdown: "The Queen decrees: LOCKDOWN! All ants shelter in place!",
  rush: "The Queen decrees: PRODUCTION RUSH! Double resource output!",
  science_push: "The Queen decrees: SCIENCE MANDATE! All labs work overtime!",
};

// ═══════════════════════════════════════════════════════════════════════════
// WORLD SIMULATION
// ═══════════════════════════════════════════════════════════════════════════

function createWorld(): World {
  const world: World = {
    tick: 0,
    resources: { food: 50, crystals: 30, energy: 20, science: 0 },
    ants: [],
    buildings: [],
    particles: [],
    events: [],
    nextId: 1,
    paused: false,
    speed: 1,
    dayPhase: 0.25,
    dangerLevel: 0,
    happiness: 70,
    techLevel: 1,
    decree: "none",
    decreeTicks: 0,
    decreeHistory: [],
  };

  // Starting buildings
  placeBuilding(world, "nest", "residential", 0.5, 0.4);
  placeBuilding(world, "farm", "residential", 0.2, 0.7);
  placeBuilding(world, "fountain", "plaza", 0.5, 0.5);
  placeBuilding(world, "factory", "industrial", 0.3, 0.4);
  placeBuilding(world, "drill", "mines", 0.5, 0.6);

  // Starting ants
  for (let i = 0; i < 6; i++) spawnAnt(world, "worker");
  for (let i = 0; i < 2; i++) spawnAnt(world, "soldier");
  for (let i = 0; i < 2; i++) spawnAnt(world, "engineer");
  spawnAnt(world, "queen");
  spawnAnt(world, "scientist");

  evt(world, "ANTOPOLIS founded! The colony begins...");
  evt(world, "Queen settles into the Royal Nest.");
  evt(world, "Engineers survey the land.");
  evt(world, `Engineers built a new farm! (${DISTRICTS.residential.label})`);
  evt(world, `Engineers built a new factory! (${DISTRICTS.industrial.label})`);
  evt(world, "Worker #1 begins hauling crystals.");
  evt(world, "Scientist #1 calibrates the drill sensors.");
  evt(world, "Soldier #2 patrols the Grand Plaza perimeter.");
  return world;
}

function placeBuilding(w: World, type: BuildingType, district: DistrictId, x: number, y: number): Building {
  const hp = type === "reactor" ? 30 : type === "fountain" ? 50 : 20;
  const b: Building = { type, x, y, hp, maxHp: hp, age: 0, powered: true, district };
  w.buildings.push(b);
  return b;
}

function spawnAnt(w: World, caste: AntCaste): Ant {
  const districts: DistrictId[] = ["industrial", "residential", "plaza", "mines"];
  const district = caste === "queen" ? "residential"
    : caste === "soldier" ? "plaza"
    : caste === "scientist" ? "mines"
    : districts[Math.floor(Math.random() * 4)]!;

  const ant: Ant = {
    id: w.nextId++,
    caste,
    district,
    x: 0.2 + Math.random() * 0.6,
    y: 0.2 + Math.random() * 0.6,
    dx: (Math.random() - 0.5) * 0.04,
    dy: (Math.random() - 0.5) * 0.04,
    task: TASKS[Math.floor(Math.random() * TASKS.length)]!,
    carrying: "",
    mood: "chipper",
    energy: 80 + Math.floor(Math.random() * 20),
    age: 0,
  };
  w.ants.push(ant);
  return ant;
}

function emitFountain(w: World) {
  const fountains = w.buildings.filter(b => b.type === "fountain" && b.powered);
  for (const f of fountains) {
    for (let i = 0; i < 3; i++) {
      w.particles.push({
        x: f.x + (Math.random() - 0.5) * 0.08,
        y: f.y - 0.05,
        dx: (Math.random() - 0.5) * 0.03,
        dy: -0.03 - Math.random() * 0.04,
        char: FOUNTAIN_CHARS[Math.floor(Math.random() * FOUNTAIN_CHARS.length)]!,
        life: 6 + Math.floor(Math.random() * 8),
        district: f.district,
      });
    }
  }
}

function emitExplosion(w: World, x: number, y: number, district: DistrictId, size: number) {
  for (let i = 0; i < size; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.02 + Math.random() * 0.05;
    w.particles.push({
      x: x + (Math.random() - 0.5) * 0.1,
      y: y + (Math.random() - 0.5) * 0.1,
      dx: Math.cos(angle) * speed,
      dy: Math.sin(angle) * speed,
      char: EXPLOSION_CHARS[Math.floor(Math.random() * EXPLOSION_CHARS.length)]!,
      life: 3 + Math.floor(Math.random() * 8),
      district,
    });
  }
}

function emitSparks(w: World, x: number, y: number, district: DistrictId, count: number) {
  for (let i = 0; i < count; i++) {
    w.particles.push({
      x, y,
      dx: (Math.random() - 0.5) * 0.06,
      dy: -0.02 - Math.random() * 0.03,
      char: SPARK_CHARS[Math.floor(Math.random() * SPARK_CHARS.length)]!,
      life: 3 + Math.floor(Math.random() * 5),
      district,
    });
  }
}

function tickWorld(w: World) {
  if (w.paused) return;
  w.tick++;

  // Day/night
  w.dayPhase = (w.dayPhase + 0.001 * w.speed) % 1.0;

  // Fountain particles every tick
  if (w.tick % 2 === 0) emitFountain(w);

  // Factory sparks
  if (w.tick % 5 === 0) {
    for (const b of w.buildings.filter(b => b.type === "factory" && b.powered)) {
      emitSparks(w, b.x, b.y - 0.05, b.district, 2);
    }
  }

  // Reactor hum particles
  if (w.tick % 8 === 0) {
    for (const b of w.buildings.filter(b => b.type === "reactor" && b.powered)) {
      w.particles.push({
        x: b.x + (Math.random() - 0.5) * 0.15,
        y: b.y + (Math.random() - 0.5) * 0.1,
        dx: (Math.random() - 0.5) * 0.01,
        dy: -0.01,
        char: "☢",
        life: 4 + Math.floor(Math.random() * 3),
        district: b.district,
      });
    }
  }

  // Drill sparks
  if (w.tick % 4 === 0) {
    for (const b of w.buildings.filter(b => b.type === "drill" && b.powered)) {
      emitSparks(w, b.x, b.y + 0.05, b.district, 1);
      if (Math.random() < 0.3) {
        w.particles.push({
          x: b.x, y: b.y + 0.08,
          dx: (Math.random() - 0.5) * 0.02, dy: 0.01,
          char: "◇", life: 5, district: b.district,
        });
      }
    }
  }

  // Update particles
  for (const p of w.particles) {
    p.x += p.dx;
    p.y += p.dy;
    p.dy += 0.003; // gravity
    p.life--;
  }
  w.particles = w.particles.filter(p => p.life > 0);

  // Resource generation
  if (w.tick % 10 === 0) {
    const farms = w.buildings.filter(b => b.type === "farm" && b.powered).length;
    const drills = w.buildings.filter(b => b.type === "drill" && b.powered).length;
    const reactors = w.buildings.filter(b => b.type === "reactor" && b.powered).length;
    const labs = w.buildings.filter(b => b.type === "lab" && b.powered).length;
    const workers = w.ants.filter(a => a.caste === "worker").length;

    w.resources.food += farms * 2 + Math.floor(workers * 0.5);
    w.resources.crystals += drills * 2;
    w.resources.energy += reactors * 3 - Math.floor(w.buildings.length * 0.3);
    w.resources.science += labs * 2 + w.ants.filter(a => a.caste === "scientist").length;

    // Consumption
    w.resources.food = Math.max(0, w.resources.food - Math.floor(w.ants.length * 0.3));
    w.resources.energy = Math.max(0, w.resources.energy);
  }

  // Ant movement and behavior
  for (const ant of w.ants) {
    ant.age++;
    const spec = CASTE_GLYPHS[ant.caste];

    // Brownian movement
    ant.dx += (Math.random() - 0.5) * 0.015;
    ant.dy += (Math.random() - 0.5) * 0.015;
    ant.dx = clamp(ant.dx, -0.04, 0.04);
    ant.dy = clamp(ant.dy, -0.04, 0.04);
    ant.x += ant.dx * w.speed;
    ant.y += ant.dy * w.speed;

    // Bounce
    if (ant.x < 0.05 || ant.x > 0.95) ant.dx *= -0.8;
    if (ant.y < 0.05 || ant.y > 0.95) ant.dy *= -0.8;
    ant.x = clamp(ant.x, 0.03, 0.97);
    ant.y = clamp(ant.y, 0.03, 0.97);

    // Energy drain
    ant.energy -= 0.05 * w.speed;
    if (ant.energy < 20) ant.mood = "sleepy";
    if (ant.energy < 5) ant.task = "napping";
    if (w.resources.food > 0 && ant.energy < 50 && w.tick % 15 === 0) {
      ant.energy = Math.min(100, ant.energy + 20);
      w.resources.food--;
    }

    // Task changes
    if (w.tick % 30 === 0 && Math.random() < 0.2) {
      ant.task = TASKS[Math.floor(Math.random() * TASKS.length)]!;
      ant.mood = MOODS[Math.floor(Math.random() * MOODS.length)]!;
    }

    // District migration
    if (Math.random() < 0.002 * w.speed) {
      const districts: DistrictId[] = ["industrial", "residential", "plaza", "mines"];
      const old = ant.district;
      ant.district = districts[Math.floor(Math.random() * 4)]!;
      if (ant.district !== old) {
        ant.x = 0.3 + Math.random() * 0.4;
        ant.y = 0.3 + Math.random() * 0.4;
      }
    }
  }

  // ── DRAMATIC EVENTS ─────────────────────────────────────────────────

  // Reactor overload!
  if (w.tick % 60 === 0 && Math.random() < 0.08 * w.dangerLevel) {
    const reactors = w.buildings.filter(b => b.type === "reactor" && b.powered);
    if (reactors.length > 0) {
      const r = reactors[Math.floor(Math.random() * reactors.length)]!;
      emitExplosion(w, r.x, r.y, r.district, 25);
      r.hp -= 10;
      w.dangerLevel = Math.max(0, w.dangerLevel - 0.3);
      evt(w, "REACTOR OVERLOAD! Explosion in the Industrial Zone!", "chaos");
      evt(w, "Engineers scramble to contain the damage!", "warn");
      // Knock nearby ants back
      for (const ant of w.ants.filter(a => a.district === r.district)) {
        if (Math.abs(ant.x - r.x) < 0.2 && Math.abs(ant.y - r.y) < 0.2) {
          ant.dx += (ant.x - r.x) * 0.3;
          ant.dy += (ant.y - r.y) * 0.3;
          ant.mood = "nervous";
          ant.task = "running away";
        }
      }
    }
  }

  // Gas leak in mines
  if (w.tick % 80 === 0 && Math.random() < 0.06) {
    const drills = w.buildings.filter(b => b.type === "drill");
    if (drills.length > 0) {
      const d = drills[Math.floor(Math.random() * drills.length)]!;
      emitExplosion(w, d.x, d.y, d.district, 15);
      evt(w, "Gas pocket breach in the Crystal Mines!", "chaos");
      evt(w, "Miners evacuate! Crystals scatter!", "warn");
      w.resources.crystals += 5; // silver lining
    }
  }

  // Catapult test fire
  if (w.tick % 100 === 0) {
    const catapults = w.buildings.filter(b => b.type === "catapult" && b.powered);
    for (const cat of catapults) {
      for (let i = 0; i < 8; i++) {
        w.particles.push({
          x: cat.x, y: cat.y - 0.05,
          dx: 0.04 + Math.random() * 0.06,
          dy: -0.06 - Math.random() * 0.04,
          char: "●",
          life: 10 + Math.floor(Math.random() * 5),
          district: cat.district,
        });
      }
      evt(w, "Catapult test fire! THWACK!", "warn");
    }
  }

  // Social events
  if (w.tick % 25 === 0 && Math.random() < 0.3) {
    const antCount = w.ants.length;
    if (antCount >= 2) {
      const a = w.ants[Math.floor(Math.random() * antCount)]!;
      const b = w.ants[Math.floor(Math.random() * antCount)]!;
      if (a.id !== b.id && a.district === b.district) {
        const verbs = [
          "shares a crumb with", "bumps antennae with", "argues about politics with",
          "challenges to a duel", "does a tiny dance for", "trades crystals with",
          "tells a joke to", "arm-wrestles", "forms an alliance with",
          "writes a poem about", "builds a tiny sandcastle with",
          "starts a book club with", "invents a handshake with",
        ];
        const verb = verbs[Math.floor(Math.random() * verbs.length)]!;
        evt(w, `${CASTE_NAMES[a.caste]} #${a.id} ${verb} ${CASTE_NAMES[b.caste]} #${b.id}`);
      }
    }
  }

  // Engineer builds
  if (w.tick % 50 === 0 && w.resources.crystals >= 10 && w.resources.energy >= 5) {
    const engineers = w.ants.filter(a => a.caste === "engineer");
    if (engineers.length > 0 && w.buildings.length < 20 && Math.random() < 0.4) {
      const buildable: BuildingType[] = [
        "farm", "factory", "silo", "barracks", "tavern", "library",
        ...(w.techLevel >= 2 ? ["reactor", "lab", "refinery"] as BuildingType[] : []),
        ...(w.techLevel >= 3 ? ["beacon", "shrine", "catapult"] as BuildingType[] : []),
      ];
      const type = buildable[Math.floor(Math.random() * buildable.length)]!;
      const district = BUILDING_DISTRICT[type];
      const x = 0.15 + Math.random() * 0.7;
      const y = 0.15 + Math.random() * 0.7;
      placeBuilding(w, type, district, x, y);
      w.resources.crystals -= 10;
      w.resources.energy -= 5;
      emitSparks(w, x, y, district, 8);
      evt(w, `Engineers built a new ${type}! (${DISTRICTS[district].label})`);
    }
  }

  // Tech level up
  if (w.resources.science >= 50 * w.techLevel && w.techLevel < 5) {
    w.techLevel++;
    w.resources.science = 0;
    evt(w, `TECH LEVEL ${w.techLevel}! New buildings unlocked!`, "warn");
    // Celebration fireworks
    for (const d of ["plaza", "residential"] as DistrictId[]) {
      emitExplosion(w, 0.5, 0.3, d, 20);
    }
  }

  // Population growth
  if (w.tick % 120 === 0 && w.resources.food >= 20 && w.ants.length < 40) {
    const castes: AntCaste[] = ["worker", "worker", "worker", "soldier", "engineer", "scientist"];
    const caste = castes[Math.floor(Math.random() * castes.length)]!;
    spawnAnt(w, caste);
    w.resources.food -= 10;
    evt(w, `A new ${CASTE_NAMES[caste]} hatches in the nursery!`);
  }

  // Danger ramp
  w.dangerLevel = clamp(
    w.dangerLevel + 0.005 * w.buildings.filter(b => b.type === "reactor").length * w.speed,
    0, 1
  );

  // Happiness
  const hasFountain = w.buildings.some(b => b.type === "fountain" && b.powered);
  const hasTavern = w.buildings.some(b => b.type === "tavern");
  w.happiness = clamp(
    50
    + (hasFountain ? 15 : 0)
    + (hasTavern ? 10 : 0)
    + Math.min(20, w.resources.food * 0.5)
    - w.dangerLevel * 30
    - (w.resources.food <= 0 ? 20 : 0)
    + (w.decree === "festival" ? 15 : 0),
    0, 100
  );

  // ── Queen decrees ───────────────────────────────────────────────────
  if (w.decreeTicks > 0) {
    w.decreeTicks -= w.speed;
    if (w.decreeTicks <= 0) {
      evt(w, `The ${DECREE_NAMES[w.decree]} ends. Normal operations resume.`);
      w.decree = "none";
      w.decreeTicks = 0;
    }
  }

  // Decree effects on resources
  if (w.decree === "rush" && w.tick % 10 === 0) {
    w.resources.food += 3;
    w.resources.crystals += 2;
    w.resources.energy += 1;
  }
  if (w.decree === "science_push" && w.tick % 10 === 0) {
    w.resources.science += 4;
  }
  if (w.decree === "festival" && w.tick % 15 === 0) {
    // Festival: random social events + fireworks
    const biomes: DistrictId[] = ["plaza", "residential"];
    const d = biomes[Math.floor(Math.random() * biomes.length)]!;
    emitSparks(w, 0.3 + Math.random() * 0.4, 0.2 + Math.random() * 0.3, d, 5);
    for (const ant of w.ants) { ant.mood = "ecstatic"; }
  }
  if (w.decree === "lockdown") {
    for (const ant of w.ants) {
      ant.dx *= 0.85;
      ant.dy *= 0.85;
      ant.task = "sheltering";
    }
  }

  // Rare queen decree (every ~200 ticks, 15% chance)
  if (w.decree === "none" && w.tick % 200 === 0 && Math.random() < 0.15) {
    const queens = w.ants.filter(a => a.caste === "queen");
    if (queens.length > 0) {
      const decrees: Exclude<DecreeType, "none">[] = ["festival", "lockdown", "rush", "science_push"];
      const pick = decrees[Math.floor(Math.random() * decrees.length)]!;
      w.decree = pick;
      w.decreeTicks = 15 + Math.floor(Math.random() * 10); // 15-25 effective ticks (scaled by speed)
      w.decreeHistory.push(DECREE_NAMES[pick]);
      if (w.decreeHistory.length > 3) w.decreeHistory.shift();
      evt(w, DECREE_ANNOUNCE[pick], "chaos");
      if (pick === "festival") {
        // Celebratory fireworks
        emitExplosion(w, 0.5, 0.3, "plaza", 20);
        emitExplosion(w, 0.4, 0.4, "residential", 15);
      }
    }
  }

  // Cap events
  if (w.events.length > 80) w.events = w.events.slice(-50);
}

// ═══════════════════════════════════════════════════════════════════════════
// RENDERER
// ═══════════════════════════════════════════════════════════════════════════

function renderDistrict(districtId: DistrictId, w: number, h: number, world: World): string {
  const district = DISTRICTS[districtId];
  const grid: string[][] = [];

  // Background fill
  for (let y = 0; y < h; y++) {
    const row: string[] = [];
    for (let x = 0; x < w; x++) {
      const seed = (x * 7 + y * 13 + world.tick) | 0;
      row.push(district.bg[Math.abs(seed) % district.bg.length]!);
    }
    grid.push(row);
  }

  // Render buildings
  for (const b of world.buildings.filter(b => b.district === districtId)) {
    const art = BUILDING_ART[b.type];
    if (!art) continue;
    const bx = Math.floor(b.x * (w - 6));
    const by = Math.floor(b.y * (h - 4));
    for (let row = 0; row < art.length; row++) {
      const line = art[row]!;
      for (let col = 0; col < line.length; col++) {
        const gx = bx + col;
        const gy = by + row;
        if (gx >= 0 && gx < w && gy >= 0 && gy < h && line[col] !== " ") {
          grid[gy]![gx] = line[col]!;
        }
      }
    }
  }

  // Render particles
  for (const p of world.particles.filter(p => p.district === districtId)) {
    const px = Math.floor(p.x * (w - 1));
    const py = Math.floor(p.y * (h - 1));
    if (px >= 0 && px < w && py >= 0 && py < h) {
      grid[py]![px] = p.char;
    }
  }

  // Render ants (2-char glyphs)
  for (const ant of world.ants.filter(a => a.district === districtId)) {
    const ax = Math.floor(ant.x * (w - 3));
    const ay = Math.floor(ant.y * (h - 1));
    const glyph = CASTE_GLYPHS[ant.caste];
    if (ax >= 0 && ay >= 0 && ay < h) {
      for (let c = 0; c < glyph.length; c++) {
        if (ax + c < w) grid[ay]![ax + c] = glyph[c]!;
      }
    }
  }

  return grid.map(row => row.join("")).join("\n");
}

function renderResources(world: World, w: number): string {
  const r = world.resources;
  // Census by caste
  const census = (["worker", "soldier", "engineer", "queen", "scientist"] as AntCaste[])
    .map(c => {
      const n = world.ants.filter(a => a.caste === c).length;
      return n > 0 ? `${CASTE_GLYPH_SHORT[c]}${n}` : null;
    })
    .filter(Boolean)
    .join(" ");

  const items = [
    `♣${r.food}`,
    `◇${r.crystals}`,
    `⚡${r.energy}`,
    `◊${r.science}`,
    `☺${world.happiness.toFixed(0)}%`,
    `⚙T${world.techLevel}`,
  ];
  const left = " " + items.join("  ");
  const right = `pop:${world.ants.length} [${census}] `;
  const gap = Math.max(1, w - left.length - right.length);
  return (left + " ".repeat(gap) + right).slice(0, w);
}

function renderStatus(world: World, w: number): string {
  const dayNames = ["midnight", "dawn", "morning", "noon", "afternoon", "dusk", "evening", "night"];
  const dayIcons = ["*", "~", ".", "o", ".", "~", "*", "*"];
  const dayIdx = Math.floor(world.dayPhase * 8) % 8;
  const day = dayNames[dayIdx];
  const dayIcon = dayIcons[dayIdx];
  const danger = world.dangerLevel > 0.5 ? " !! DANGER" : world.dangerLevel > 0.3 ? " ! caution" : "";
  const speedStr = `${world.speed}x`;
  const pauseStr = world.paused ? " || PAUSED" : "";
  const decree = world.decree !== "none" ? ` << ${DECREE_NAMES[world.decree]} >>` : "";
  const left = ` ${dayIcon} ${day}${danger}${decree}${pauseStr} ${speedStr}`;
  const right = " [p]ause [+/-]spd [1-5]spawn [e]xplode [b]uild ";
  const gap = Math.max(1, w - left.length - right.length);
  return (left + " ".repeat(gap) + right).slice(0, w);
}

// ═══════════════════════════════════════════════════════════════════════════
// MODULE SETUP
// ═══════════════════════════════════════════════════════════════════════════

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: "Antopolis",
    description: "A micro-city for ants with ant technology",
    menu: [{ category: "applications", order: 90, label: "Antopolis" }],
    palette: { order: 290, label: "Antopolis" },
    action: () => openAntopolis(host),
  });
}

function openAntopolis(host: MicroappHost) {
  const geo = host.geometry;
  const winW = Math.min(geo.width - 4, 180);
  const winH = Math.min(geo.height - 4, 54);
  const win = host.createWindow({ title: "🐜 ANTOPOLIS", width: winW, height: winH });
  const timers = new Set<ReturnType<typeof setInterval>>();
  const world = createWorld();
  const t = host.theme();

  // ── UI elements ─────────────────────────────────────────────────────

  const districtBoxes: Record<DistrictId, blessed.Widgets.BoxElement> = {} as any;
  const districtIds: DistrictId[] = ["industrial", "residential", "plaza", "mines"];

  for (const id of districtIds) {
    districtBoxes[id] = blessed.box({
      parent: win.body,
      top: 0, left: 0, width: 0, height: 0,
      border: "line",
      label: ` ${DISTRICTS[id].label} `,
      style: { ...t.body, border: { fg: DISTRICTS[id].borderFg } },
    });
  }

  // Figlet header
  const figletBox = blessed.box({
    parent: win.body, top: 0, left: 0, width: 0, height: 0,
    tags: false,
    style: t.header,
  });

  const subtitleBox = blessed.box({
    parent: win.body, top: 0, left: 0, width: 0, height: 1,
    tags: false,
    style: { ...t.body, fg: t.muted.fg },
  });

  const resourceBox = blessed.box({
    parent: win.body, top: 0, left: 0, width: 0, height: 1,
    tags: false,
    style: { ...t.body, fg: t.accent.fg },
  });

  // Status bar with theme colours
  const statusBox = blessed.box({
    parent: win.body, top: 0, left: 0, width: 0, height: 1,
    tags: false,
    style: t.header,
  });

  const logBox = blessed.box({
    parent: win.body, top: 0, left: 0, width: 0, height: 0,
    scrollable: true, alwaysScroll: true, mouse: true,
    tags: false,
    label: " Colony Log ",
    border: "line",
    style: { ...t.body, border: { fg: t.muted.fg } },
  });

  // ── Layout ──────────────────────────────────────────────────────────

  // Render figlet once to measure height
  const figletText = renderFiglet("ANTOPOLIS", "small");
  const figletH = figletText.split("\n").length;

  const biomeGrid = createGrid(win.body, {
    rows: 2, columns: 2,
    templateRows: ["1fr", "1fr"],
    templateColumns: ["1fr", "1fr"],
    gap: 0,
  });
  biomeGrid.set({ key: "industrial",  row: 0, column: 0, part: createNodePart(districtBoxes.industrial) });
  biomeGrid.set({ key: "residential", row: 0, column: 1, part: createNodePart(districtBoxes.residential) });
  biomeGrid.set({ key: "plaza",       row: 1, column: 0, part: createNodePart(districtBoxes.plaza) });
  biomeGrid.set({ key: "mines",       row: 1, column: 1, part: createNodePart(districtBoxes.mines) });

  const root = createStack(win.body, [
    { key: "figlet",    basis: figletH, part: createNodePart(figletBox) },
    { key: "subtitle",  basis: 1,       part: createNodePart(subtitleBox) },
    { key: "resources", basis: 1,       part: createNodePart(resourceBox) },
    { key: "districts", basis: "4fr",   part: biomeGrid },
    { key: "status",    basis: 1,       part: createNodePart(statusBox) },
    { key: "log",       basis: "1fr",   part: createNodePart(logBox) },
  ]);

  // ── Render ──────────────────────────────────────────────────────────

  function render() {
    const w = Math.max(1, Number(win.body.width) || 0);
    const h = Math.max(1, Number(win.body.height) || 0);

    root.layout({ top: 0, left: 0, width: w, height: h });

    // Figlet header
    const pauseTag = world.paused ? "  || PAUSED" : "";
    figletBox.setContent(figletText + pauseTag);

    // Subtitle
    const bldgCount = world.buildings.length;
    const districtSummary = districtIds.map(id => {
      const n = world.ants.filter(a => a.district === id).length;
      return `${DISTRICTS[id].label.split(" ")[0]}:${n}`;
    }).join("  ");
    subtitleBox.setContent(` a micro-city for ants with ant technology  --  ${bldgCount} buildings  --  ${districtSummary}`);

    // Resources
    resourceBox.setContent(renderResources(world, w));

    // Status
    statusBox.setContent(renderStatus(world, w));

    // Districts
    for (const id of districtIds) {
      const box = districtBoxes[id];
      const bw = Math.max(1, (Number(box.width) || 10) - 2);
      const bh = Math.max(1, (Number(box.height) || 5) - 2);
      box.setContent(renderDistrict(id, bw, bh, world));
      const count = world.ants.filter(a => a.district === id).length;
      const buildings = world.buildings.filter(b => b.district === id).length;
      const sub = DISTRICTS[id].subtitle;
      (box as any).setLabel(` ${DISTRICTS[id].label} — ${sub} [${count} ant${count !== 1 ? "s" : ""}, ${buildings} bldg] `);
    }

    // Log with severity prefixes
    const logH = Math.max(2, Number(logBox.height) || 4);
    const logLines = world.events.slice(-logH).map(e => SEVERITY_PREFIX[e.severity] + e.text);
    logBox.setContent(logLines.join("\n"));
    logBox.setScrollPerc(100);

    host.screen.render();
  }

  // ── Simulation tick ─────────────────────────────────────────────────

  createTimer(() => {
    tickWorld(world);
    render();
  }, 120, timers);

  // ── Keyboard ────────────────────────────────────────────────────────

  const SPAWN_KEYS: Record<string, AntCaste> = {
    "1": "worker", "2": "soldier", "3": "engineer", "4": "queen", "5": "scientist",
  };

  win.body.on("keypress", (_ch: string, key: { name: string; full: string }) => {
    if (!key) return;

    if (key.full === "p") {
      world.paused = !world.paused;
      evt(world, world.paused ? "Time freezes over Antopolis..." : "Time resumes!");
      render();
    } else if (key.full === "+" || key.full === "=") {
      world.speed = Math.min(8, world.speed * 2);
      evt(world, `Speed: ${world.speed}x`);
    } else if (key.full === "-" || key.full === "_") {
      world.speed = Math.max(1, world.speed / 2);
      evt(world, `Speed: ${world.speed}x`);
    } else if (key.full === "e") {
      // Manual explosion for fun!
      const districts: DistrictId[] = ["industrial", "residential", "plaza", "mines"];
      const d = districts[Math.floor(Math.random() * 4)]!;
      emitExplosion(world, 0.3 + Math.random() * 0.4, 0.3 + Math.random() * 0.4, d, 30);
      evt(world, `BOOM! Mysterious explosion in ${DISTRICTS[d].label}!`, "chaos");
      render();
    } else if (key.full === "b") {
      // Manual build
      if (world.resources.crystals >= 5) {
        const types: BuildingType[] = ["fountain", "tavern", "library", "shrine", "catapult", "beacon"];
        const type = types[Math.floor(Math.random() * types.length)]!;
        const district = BUILDING_DISTRICT[type];
        placeBuilding(world, type, district, 0.15 + Math.random() * 0.7, 0.15 + Math.random() * 0.7);
        world.resources.crystals -= 5;
        evt(world, `Built a ${type} in ${DISTRICTS[district].label}!`);
        emitSparks(world, 0.5, 0.5, district, 10);
      } else {
        evt(world, "Not enough crystals to build!", "warn");
      }
      render();
    } else if (SPAWN_KEYS[key.full]) {
      const caste = SPAWN_KEYS[key.full]!;
      spawnAnt(world, caste);
      evt(world, `Summoned a ${CASTE_NAMES[caste]}!`);
      render();
    }
  });

  win.body.key(["p", "+", "=", "-", "_", "e", "b", "1", "2", "3", "4", "5"], () => {});

  // ── Lifecycle ───────────────────────────────────────────────────────

  render();
  win.onResize(render);

  win.describeState(() => ({
    summary: `Antopolis — pop:${world.ants.length} bldg:${world.buildings.length} tech:${world.techLevel} happy:${world.happiness.toFixed(0)}%${world.decree !== "none" ? ` [${DECREE_NAMES[world.decree]}]` : ""}${world.paused ? " PAUSED" : ""}`,
    population: world.ants.length,
    buildings: world.buildings.length,
    techLevel: world.techLevel,
    happiness: world.happiness,
    resources: { ...world.resources },
    dangerLevel: world.dangerLevel,
    decree: world.decree !== "none" ? DECREE_NAMES[world.decree] : null,
    recentDecrees: world.decreeHistory,
  }));

  win.captureText(() => [
    `ANTOPOLIS — pop:${world.ants.length} tech:${world.techLevel}`,
    `Resources: food=${world.resources.food} crystals=${world.resources.crystals} energy=${world.resources.energy}`,
    "", ...world.events.slice(-15).map(e => SEVERITY_PREFIX[e.severity] + e.text),
  ].join("\n"));

  win.onRestyle(() => {
    const th = host.theme();
    figletBox.style = th.header;
    subtitleBox.style = { ...th.body, fg: th.muted.fg };
    resourceBox.style = { ...th.body, fg: th.accent.fg };
    statusBox.style = th.header;
    logBox.style = { ...th.body, border: { fg: th.muted.fg } };
    for (const id of districtIds) {
      districtBoxes[id].style = { ...th.body, border: { fg: DISTRICTS[id].borderFg } };
    }
    host.screen.render();
  });

  win.onCleanup(() => {
    clearTimers(timers);
    root.destroy(); // root owns biomeGrid via LayoutPart — single destroy
  });

  win.focus();
}
