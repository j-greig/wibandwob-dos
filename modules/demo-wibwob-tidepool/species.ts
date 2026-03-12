/**
 * Tide Pool Species — definitions, interaction matrix, glyph mappings.
 *
 * Pure data module. No UI, no blessed, no host deps.
 */

// ---------------------------------------------------------------------------
// Species identifiers
// ---------------------------------------------------------------------------

export type SpeciesId = "algae" | "lichen" | "coral" | "anemone" | "barnacle";

export const SPECIES_IDS: SpeciesId[] = [
  "algae",
  "lichen",
  "coral",
  "anemone",
  "barnacle",
];

// ---------------------------------------------------------------------------
// Species definitions
// ---------------------------------------------------------------------------

export interface SpeciesDef {
  id: SpeciesId;
  label: string;
  /** Glyphs: [sparse, dense] — sparse for young/thin, dense for mature */
  glyphs: [string, string];
  /** Base growth probability per tick (0–1) */
  growthRate: number;
  /** Probability of dying per tick when isolated (no same-species neighbours) */
  isolationMortality: number;
  /** Minimum same-species neighbours to avoid isolation death */
  minNeighbours: number;
  /** Maximum population density (fraction of grid) before self-limiting */
  carryingCapacity: number;
  /** If true, can only spawn on edge cells */
  edgeOnly: boolean;
  /** Tide sensitivity: "low" = thrives at low tide, "high" = thrives at high tide, "any" = indifferent */
  tidePref: "low" | "high" | "any";
}

export const SPECIES: Record<SpeciesId, SpeciesDef> = {
  algae: {
    id: "algae",
    label: "Algae",
    glyphs: ["◦", "●"],
    growthRate: 0.12,
    isolationMortality: 0.05,
    minNeighbours: 0,
    carryingCapacity: 0.45,
    edgeOnly: false,
    tidePref: "any",
  },
  lichen: {
    id: "lichen",
    label: "Lichen",
    glyphs: ["※", "※"],
    growthRate: 0.04,
    isolationMortality: 0.01,
    minNeighbours: 1,
    carryingCapacity: 0.55,
    edgeOnly: false,
    tidePref: "low",
  },
  coral: {
    id: "coral",
    label: "Coral",
    glyphs: ["✧", "✧"],  // unicode, not emoji — coral is structural
    growthRate: 0.06,
    isolationMortality: 0.03,
    minNeighbours: 2,
    carryingCapacity: 0.30,
    edgeOnly: false,
    tidePref: "high",
  },
  anemone: {
    id: "anemone",
    label: "Anemone",
    glyphs: ["♦", "♦"],
    growthRate: 0.03,
    isolationMortality: 0.04,
    minNeighbours: 1,
    carryingCapacity: 0.20,
    edgeOnly: false,
    tidePref: "high",
  },
  barnacle: {
    id: "barnacle",
    label: "Barnacle",
    glyphs: ["✶", "✶"],
    growthRate: 0.025,
    isolationMortality: 0.005,
    minNeighbours: 0,
    carryingCapacity: 0.15,
    edgeOnly: true,
    tidePref: "low",
  },
};

// ---------------------------------------------------------------------------
// Interaction matrix
// ---------------------------------------------------------------------------

/**
 * Interaction effect of `actor` species on `target` species.
 *
 *  positive = actor helps target (symbiosis)
 *  negative = actor hurts target (competition/predation)
 *  zero     = no interaction
 *
 * Values are modifiers to the target's mortality when actor is a neighbour.
 * e.g. anemone→algae = 0.15 means each anemone neighbour adds 15% mortality
 * to adjacent algae cells (predation).
 */
export const INTERACTIONS: Record<SpeciesId, Record<SpeciesId, number>> = {
  //                algae   lichen  coral   anemone  barnacle
  algae:    { algae:  0,    lichen: -0.01, coral:  -0.02, anemone:  0,    barnacle:  0    },
  lichen:   { algae:  0.03, lichen:  0,    coral:   0,    anemone:  0,    barnacle:  0    },
  coral:    { algae:  0.02, lichen:  0,    coral:   0,    anemone: -0.02, barnacle:  0    },
  anemone:  { algae:  0.15, lichen:  0,    coral:   0.01, anemone:  0,    barnacle:  0    },
  barnacle: { algae:  0,    lichen:  0,    coral:   0,    anemone:  0,    barnacle:  0    },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Shannon diversity index H' = -Σ(pᵢ · ln(pᵢ)) */
export function shannonIndex(populations: Record<SpeciesId, number>): number {
  const total = SPECIES_IDS.reduce((sum, id) => sum + populations[id], 0);
  if (total === 0) return 0;

  let h = 0;
  for (const id of SPECIES_IDS) {
    const p = populations[id] / total;
    if (p > 0) h -= p * Math.log(p);
  }
  return h;
}

/** Maximum possible Shannon index for N species */
export const MAX_SHANNON = Math.log(SPECIES_IDS.length); // ln(5) ≈ 1.609
