/**
 * TidePoolEngine — pure simulation state machine, no UI.
 *
 * Owns: grid, species placement, tick logic, era detection, populations.
 * Does NOT own: rendering, UI widgets, blessed nodes.
 *
 * Designed as a reusable engine — could drive any tide pool visualisation.
 */

import {
  SPECIES_IDS,
  SPECIES,
  INTERACTIONS,
  shannonIndex,
  MAX_SHANNON,
  type SpeciesId,
} from "./species.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CellState = SpeciesId | null;

export type TideLevel = "low" | "mid" | "high";

export type Era = "genesis" | "bloom" | "equilibrium" | "collapse" | "recovery";

export interface TidePoolEvent {
  generation: number;
  type: "extinction" | "bloom" | "collapse" | "recovery";
  species?: SpeciesId;
  detail: string;
}

// ---------------------------------------------------------------------------
// Seeded PRNG (xorshift32)
// ---------------------------------------------------------------------------

function xorshift32(state: number): number {
  let x = state;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return x >>> 0;
}

class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed === 0 ? 1 : seed >>> 0;
  }

  /** Returns float in [0, 1) */
  next(): number {
    this.state = xorshift32(this.state);
    return this.state / 0x100000000;
  }

  /** Returns integer in [0, max) */
  int(max: number): number {
    return Math.floor(this.next() * max);
  }
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

export class TidePoolEngine {
  private grid: CellState[];
  private _width: number;
  private _height: number;
  private _generation = 0;
  private _seed: number;
  private rng: Rng;
  private _tide: TideLevel = "mid";
  private _tideTimer = 0;
  private _tideCycleTicks = 80; // ticks per full tide cycle
  private _era: Era = "genesis";
  private _events: TidePoolEvent[] = [];
  private _extinct: Set<SpeciesId> = new Set();
  private _populations: Record<SpeciesId, number>;
  private _prevPopulations: Record<SpeciesId, number>;
  private _shannonHistory: number[] = [];
  private _running = false;

  constructor(width: number, height: number, seed?: number) {
    this._width = width;
    this._height = height;
    this._seed = seed ?? (Date.now() & 0xffffffff);
    this.rng = new Rng(this._seed);
    this.grid = new Array(width * height).fill(null);
    this._populations = this.emptyPops();
    this._prevPopulations = this.emptyPops();
    this.seedInitial();
  }

  // -- Accessors --

  get width(): number { return this._width; }
  get height(): number { return this._height; }
  get generation(): number { return this._generation; }
  get seed(): number { return this._seed; }
  get tide(): TideLevel { return this._tide; }
  get era(): Era { return this._era; }
  get events(): readonly TidePoolEvent[] { return this._events; }
  get extinct(): ReadonlySet<SpeciesId> { return this._extinct; }
  get running(): boolean { return this._running; }

  /** Tide phase: 0→1 continuous, drives the sinusoidal tide curve */
  get tidePhase(): number { return this._tideTimer / this._tideCycleTicks; }

  /** Tide sine value: -1..+1 (negative=low, positive=high) */
  get tideSine(): number { return Math.sin(this.tidePhase * 2 * Math.PI); }
  get populations(): Readonly<Record<SpeciesId, number>> { return this._populations; }

  get totalPopulation(): number {
    return SPECIES_IDS.reduce((s, id) => s + this._populations[id], 0);
  }

  get shannonDiversity(): number {
    return shannonIndex(this._populations);
  }

  get dominant(): SpeciesId | null {
    let best: SpeciesId | null = null;
    let max = 0;
    for (const id of SPECIES_IDS) {
      if (this._populations[id] > max) {
        max = this._populations[id];
        best = id;
      }
    }
    return best;
  }

  cellAt(x: number, y: number): CellState {
    if (x < 0 || x >= this._width || y < 0 || y >= this._height) return null;
    return this.grid[y * this._width + x];
  }

  // -- Control --

  start(): void { this._running = true; }
  stop(): void { this._running = false; }
  toggle(): void { this._running = !this._running; }

  // -- Grid resize --

  resize(newWidth: number, newHeight: number): void {
    if (newWidth === this._width && newHeight === this._height) return;
    const newGrid: CellState[] = new Array(newWidth * newHeight).fill(null);
    const copyW = Math.min(this._width, newWidth);
    const copyH = Math.min(this._height, newHeight);
    for (let y = 0; y < copyH; y++) {
      for (let x = 0; x < copyW; x++) {
        newGrid[y * newWidth + x] = this.grid[y * this._width + x];
      }
    }
    this._width = newWidth;
    this._height = newHeight;
    this.grid = newGrid;
    this.recount();
  }

  // -- Seeding --

  reset(seed?: number): void {
    this._seed = seed ?? (Date.now() & 0xffffffff);
    this.rng = new Rng(this._seed);
    this.grid.fill(null);
    this._generation = 0;
    this._tideTimer = 0;
    this._tide = "mid";
    this._era = "genesis";
    this._events = [];
    this._extinct = new Set();
    this._populations = this.emptyPops();
    this._prevPopulations = this.emptyPops();
    this._shannonHistory = [];
    this.seedInitial();
  }

  private seedInitial(): void {
    const area = this._width * this._height;

    // Seed algae: 2–4 random clusters
    const algaeClusters = 2 + this.rng.int(3);
    for (let c = 0; c < algaeClusters; c++) {
      const cx = 2 + this.rng.int(Math.max(1, this._width - 4));
      const cy = 2 + this.rng.int(Math.max(1, this._height - 4));
      const radius = 1 + this.rng.int(2);
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (this.rng.next() < 0.5) {
            this.setCell(cx + dx, cy + dy, "algae");
          }
        }
      }
    }

    // Seed lichen: 1–2 small patches
    const lichenClusters = 1 + this.rng.int(2);
    for (let c = 0; c < lichenClusters; c++) {
      const cx = 2 + this.rng.int(Math.max(1, this._width - 4));
      const cy = 2 + this.rng.int(Math.max(1, this._height - 4));
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (this.rng.next() < 0.4) {
            this.setCell(cx + dx, cy + dy, "lichen");
          }
        }
      }
    }

    // Seed coral: 1 small cluster
    {
      const cx = 2 + this.rng.int(Math.max(1, this._width - 4));
      const cy = 2 + this.rng.int(Math.max(1, this._height - 4));
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (this.rng.next() < 0.35) {
            this.setCell(cx + dx, cy + dy, "coral");
          }
        }
      }
    }

    // Seed anemone: 1 tiny cluster (2–3 cells)
    {
      const cx = 2 + this.rng.int(Math.max(1, this._width - 4));
      const cy = 2 + this.rng.int(Math.max(1, this._height - 4));
      this.setCell(cx, cy, "anemone");
      this.setCell(cx + 1, cy, "anemone");
      if (this.rng.next() < 0.5) this.setCell(cx, cy + 1, "anemone");
    }

    // Seed barnacles on edges
    const barnacleCount = Math.max(3, Math.floor(area * 0.015));
    for (let i = 0; i < barnacleCount; i++) {
      const pos = this.randomEdgeCell();
      if (pos) this.setCell(pos[0], pos[1], "barnacle");
    }

    this.recount();
  }

  seedSpecies(species: SpeciesId, x: number, y: number, radius = 2): void {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (this.rng.next() < 0.5) {
          this.setCell(x + dx, y + dy, species);
        }
      }
    }
    this.recount();
  }

  // -- Core tick --

  tick(): void {
    if (!this._running) return;

    this._generation++;
    this.advanceTide();

    // Copy grid for simultaneous update
    const next = [...this.grid];

    for (let y = 0; y < this._height; y++) {
      for (let x = 0; x < this._width; x++) {
        const idx = y * this._width + x;
        const current = this.grid[idx];

        if (current === null) {
          // Empty cell: try colonisation
          next[idx] = this.tryColonise(x, y);
        } else {
          // Occupied: check survival
          if (this.shouldDie(x, y, current)) {
            next[idx] = null;
          }
        }
      }
    }

    this.grid = next;
    this._prevPopulations = { ...this._populations };
    this.recount();
    this.updateEra();
  }

  // -- Colonisation --

  private tryColonise(x: number, y: number): CellState {
    const neighbours = this.getNeighbourCounts(x, y);
    const isEdge = x === 0 || x === this._width - 1 || y === 0 || y === this._height - 1;
    const area = this._width * this._height;

    let bestSpecies: SpeciesId | null = null;
    let bestScore = 0;

    for (const id of SPECIES_IDS) {
      if (this._extinct.has(id)) continue;
      const def = SPECIES[id];

      // Edge-only check
      if (def.edgeOnly && !isEdge) continue;

      // Need at least one neighbour of same species to spread (except algae which can spontaneously appear rarely)
      const sameNeighbours = neighbours[id] || 0;
      if (sameNeighbours === 0 && id !== "algae") continue;
      if (sameNeighbours === 0 && id === "algae" && this.rng.next() > 0.002) continue;

      // Growth rate modified by tide
      let rate = def.growthRate;
      rate *= this.tideModifier(def.tidePref);

      // Density-dependent: slow down near carrying capacity
      const density = this._populations[id] / area;
      if (density > def.carryingCapacity * 0.7) {
        rate *= Math.max(0.1, 1 - (density / def.carryingCapacity));
      }

      // More same-species neighbours = faster spread
      rate *= (1 + sameNeighbours * 0.3);

      // Interactions: check if other species neighbours help or hinder
      for (const otherId of SPECIES_IDS) {
        if (otherId === id) continue;
        const otherCount = neighbours[otherId] || 0;
        if (otherCount === 0) continue;
        const interaction = INTERACTIONS[otherId][id];
        // Positive interaction helps growth, negative hinders
        rate *= (1 - interaction * otherCount * 0.5);
      }

      const score = this.rng.next() * rate;
      if (score > bestScore) {
        bestScore = score;
        bestSpecies = id;
      }
    }

    // Threshold: need meaningful score to colonise
    if (bestScore > 0.01) return bestSpecies;
    return null;
  }

  // -- Mortality --

  private shouldDie(x: number, y: number, species: SpeciesId): boolean {
    const def = SPECIES[species];
    const neighbours = this.getNeighbourCounts(x, y);
    const sameNeighbours = neighbours[species] || 0;
    const area = this._width * this._height;

    let mortality = 0;

    // Isolation mortality
    if (sameNeighbours < def.minNeighbours) {
      mortality += def.isolationMortality;
    }

    // Density-dependent mortality (overcrowding)
    const density = this._populations[species] / area;
    if (density > def.carryingCapacity) {
      mortality += 0.05 * (density / def.carryingCapacity);
    }

    // Tide stress
    if (def.tidePref !== "any") {
      const tideMod = this.tideModifier(def.tidePref);
      if (tideMod < 0.7) {
        mortality += 0.02 * (1 - tideMod);
      }
    }

    // Predation / competition from neighbours
    for (const otherId of SPECIES_IDS) {
      if (otherId === species) continue;
      const otherCount = neighbours[otherId] || 0;
      if (otherCount === 0) continue;
      const interaction = INTERACTIONS[otherId][species];
      if (interaction > 0) {
        mortality += interaction * otherCount;
      }
    }

    // Base background mortality
    mortality += 0.005;

    return this.rng.next() < mortality;
  }

  // -- Tide --

  private advanceTide(): void {
    this._tideTimer = (this._tideTimer + 1) % this._tideCycleTicks;
    const phase = this._tideTimer / this._tideCycleTicks;

    // Sinusoidal tide: 0→low, 0.25→mid(rising), 0.5→high, 0.75→mid(falling)
    const tideValue = Math.sin(phase * 2 * Math.PI);
    if (tideValue < -0.33) this._tide = "low";
    else if (tideValue > 0.33) this._tide = "high";
    else this._tide = "mid";
  }

  private tideModifier(pref: "low" | "high" | "any"): number {
    if (pref === "any") return 1;
    if (pref === "low") {
      return this._tide === "low" ? 1.3 : this._tide === "mid" ? 1.0 : 0.6;
    }
    // high
    return this._tide === "high" ? 1.3 : this._tide === "mid" ? 1.0 : 0.6;
  }

  cycleTide(): void {
    const levels: TideLevel[] = ["low", "mid", "high"];
    const idx = levels.indexOf(this._tide);
    this._tide = levels[(idx + 1) % 3];
  }

  // -- Era detection --

  private updateEra(): void {
    const h = this.shannonDiversity;
    this._shannonHistory.push(h);
    if (this._shannonHistory.length > 50) {
      this._shannonHistory.shift();
    }

    const total = this.totalPopulation;
    const area = this._width * this._height;
    const fillRate = total / area;

    // Check for extinctions
    for (const id of SPECIES_IDS) {
      if (!this._extinct.has(id) && this._populations[id] === 0 && this._prevPopulations[id] > 0) {
        this._extinct.add(id);
        this._events.push({
          generation: this._generation,
          type: "extinction",
          species: id,
          detail: `${SPECIES[id].label} went extinct`,
        });
      }
    }

    // Detect era from recent Shannon trend
    const prevEra = this._era;

    if (this._generation < 50) {
      this._era = "genesis";
    } else if (fillRate < 0.05) {
      this._era = "genesis";
    } else {
      const recentH = this._shannonHistory.slice(-20);
      const avgH = recentH.reduce((s, v) => s + v, 0) / recentH.length;
      const trend = recentH.length >= 10
        ? recentH[recentH.length - 1] - recentH[recentH.length - 10]
        : 0;

      if (trend < -0.15 && avgH < MAX_SHANNON * 0.6) {
        this._era = "collapse";
      } else if (avgH > MAX_SHANNON * 0.7 && Math.abs(trend) < 0.08) {
        this._era = "equilibrium";
      } else if (trend > 0.05 && avgH < MAX_SHANNON * 0.7) {
        this._era = prevEra === "collapse" || prevEra === "recovery" ? "recovery" : "bloom";
      } else if (avgH < MAX_SHANNON * 0.5 && prevEra === "collapse") {
        this._era = "recovery";
      } else {
        // Keep previous era if nothing definitive
        this._era = prevEra;
      }
    }

    // Log era transitions
    if (this._era !== prevEra && this._generation > 10) {
      if (this._era === "collapse") {
        this._events.push({
          generation: this._generation,
          type: "collapse",
          detail: `Ecosystem entering collapse (H': ${h.toFixed(2)})`,
        });
      } else if (this._era === "bloom") {
        this._events.push({
          generation: this._generation,
          type: "bloom",
          detail: `Population bloom detected`,
        });
      } else if (this._era === "recovery") {
        this._events.push({
          generation: this._generation,
          type: "recovery",
          detail: `Recovery phase beginning`,
        });
      }
    }

    // Cap events list
    if (this._events.length > 20) {
      this._events = this._events.slice(-20);
    }
  }

  // -- Neighbour counting --

  private getNeighbourCounts(x: number, y: number): Record<SpeciesId, number> {
    const counts: Record<string, number> = {};
    for (const id of SPECIES_IDS) counts[id] = 0;

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= this._width || ny < 0 || ny >= this._height) continue;
        const cell = this.grid[ny * this._width + nx];
        if (cell !== null) counts[cell]++;
      }
    }

    return counts as Record<SpeciesId, number>;
  }

  // -- Helpers --

  private setCell(x: number, y: number, species: SpeciesId): void {
    if (x < 0 || x >= this._width || y < 0 || y >= this._height) return;
    this.grid[y * this._width + x] = species;
  }

  private recount(): void {
    const pops: Record<string, number> = {};
    for (const id of SPECIES_IDS) pops[id] = 0;
    for (const cell of this.grid) {
      if (cell !== null) pops[cell]++;
    }
    this._populations = pops as Record<SpeciesId, number>;
  }

  private randomEdgeCell(): [number, number] | null {
    const side = this.rng.int(4);
    switch (side) {
      case 0: return [this.rng.int(this._width), 0]; // top
      case 1: return [this.rng.int(this._width), this._height - 1]; // bottom
      case 2: return [0, this.rng.int(this._height)]; // left
      case 3: return [this._width - 1, this.rng.int(this._height)]; // right
      default: return null;
    }
  }

  private emptyPops(): Record<SpeciesId, number> {
    const p: Record<string, number> = {};
    for (const id of SPECIES_IDS) p[id] = 0;
    return p as Record<SpeciesId, number>;
  }

  // -- Serialisation --

  serialize(): Record<string, unknown> {
    return {
      width: this._width,
      height: this._height,
      seed: this._seed,
      generation: this._generation,
      tide: this._tide,
      tideTimer: this._tideTimer,
      era: this._era,
      extinct: [...this._extinct],
      events: this._events.slice(-10),
      running: this._running,
      grid: this.grid.map(c => c === null ? 0 : SPECIES_IDS.indexOf(c) + 1),
    };
  }

  hydrate(data: Record<string, unknown>): void {
    if (typeof data.seed === "number") this._seed = data.seed;
    if (typeof data.generation === "number") this._generation = data.generation;
    if (typeof data.tideTimer === "number") this._tideTimer = data.tideTimer;
    if (typeof data.tide === "string") this._tide = data.tide as TideLevel;
    if (typeof data.era === "string") this._era = data.era as Era;
    if (typeof data.running === "boolean") this._running = data.running;
    if (Array.isArray(data.extinct)) {
      this._extinct = new Set(data.extinct as SpeciesId[]);
    }
    if (Array.isArray(data.events)) {
      this._events = data.events as TidePoolEvent[];
    }
    if (Array.isArray(data.grid)) {
      const gridData = data.grid as number[];
      const w = typeof data.width === "number" ? data.width : this._width;
      const h = typeof data.height === "number" ? data.height : this._height;
      this._width = w;
      this._height = h;
      this.grid = new Array(w * h).fill(null);
      for (let i = 0; i < Math.min(gridData.length, this.grid.length); i++) {
        const v = gridData[i];
        this.grid[i] = v === 0 ? null : (SPECIES_IDS[v - 1] ?? null);
      }
    }
    this.rng = new Rng(this._seed);
    // Advance RNG to approximate correct state
    for (let i = 0; i < this._generation; i++) this.rng.next();
    this.recount();
  }
}
