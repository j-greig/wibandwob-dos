/**
 * Timeline Types — declarative music video scheduling for WibWob-DOS.
 *
 * A timeline file describes a sequence of visual cues synced to an audio track.
 * An agent writes the file; the timeline service parses and executes it.
 *
 * Design principles:
 *   - Cues reference stable ROLES, not runtime window IDs
 *   - Scene windows use layout tokens resolved against live desktop geometry
 *   - Commands use canonical registry IDs (theme.set, primer.open, figlet.open)
 *   - Timing can be absolute (seconds) or musical (beat/bar/section)
 *   - The format is agent-writable and human-readable
 */

// ---------------------------------------------------------------------------
// Beat map — optional audio analysis output that cues can reference
// ---------------------------------------------------------------------------

export interface BeatMapEntry {
  beat: number;
  t: number; // seconds from track start
}

export interface SectionEntry {
  name: string;
  startBeat: number;
  endBeat: number;
  startT: number;
  endT: number;
}

export interface BeatMap {
  bpm: number;
  key?: string;
  duration: number; // seconds
  beats: BeatMapEntry[];
  sections: SectionEntry[];
}

// ---------------------------------------------------------------------------
// Layout tokens — resolved against desktop geometry at runtime
// ---------------------------------------------------------------------------

/**
 * Layout can be:
 *   - a named token: "hero-left", "lyric-bar", "top-right-corner", "fullscreen"
 *   - explicit geometry: { x, y, w, h } in absolute cells
 *   - proportional geometry: { x%, y%, w%, h% } as 0-1 fractions of desktop
 */
export type LayoutToken =
  | "hero-left"        // 65% width, full height
  | "hero-right"       // 65% width, right-aligned, full height
  | "hero-center"      // 70% width, centered, 80% height
  | "backdrop"         // full desktop
  | "top-banner"       // full width, top 15%
  | "bottom-banner"    // full width, bottom 15%
  | "lyric-bar"        // full width, bottom 12 rows
  | "top-right-corner" // 30% width, top 20%
  | "top-left-corner"  // 30% width, top 20%
  | "sidebar-right"    // 30% width, full height, right
  | "sidebar-left"     // 30% width, full height, left
  | "center-card"      // 40% width, 50% height, centered
  | "strip-bottom"     // full width, bottom 30%
  | string;            // custom token or future additions

export interface ExplicitLayout {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ProportionalLayout {
  /** 0-1 fractions of desktop width/height */
  xPct: number;
  yPct: number;
  wPct: number;
  hPct: number;
}

export type SceneLayout = LayoutToken | ExplicitLayout | ProportionalLayout;

// ---------------------------------------------------------------------------
// Scene windows — what should be on screen
// ---------------------------------------------------------------------------

export interface SceneWindow {
  /** Stable role name. Used to match/reuse existing windows across cues. */
  role: string;

  /** What to open. Maps to command registry. */
  open:
    | { type: "primer"; file: string }
    | { type: "figlet"; text: string; font?: string }
    | { type: "art" }
    | { type: "pattern" }
    | { type: "contour" }
    | { type: "contour-triptych" }
    | { type: "companion" }
    | { type: "command"; id: string; args?: Record<string, unknown> };

  /** Where to place it. */
  layout: SceneLayout;

  /** Z-order hint. Lower = further back. Default: order in array. */
  zOrder?: number;
}

/** A scene is a complete desired desktop state (minus the agent window). */
export interface SceneDefinition {
  name: string;
  theme?: string;
  windows: SceneWindow[];
}

// ---------------------------------------------------------------------------
// Cues — what happens at a point in time
// ---------------------------------------------------------------------------

/**
 * Timing reference. Exactly one of t, beat, bar, or section should be set.
 *   t:       absolute seconds from track start
 *   beat:    beat number (requires beat map)
 *   bar:     bar number (requires beat map + time signature)
 *   section: named section from beat map (fires at section start)
 */
export interface CueTiming {
  t?: number;
  beat?: number;
  bar?: number;
  section?: string;
}

/**
 * A cue is one thing that happens at one point in time.
 *
 * Three cue styles:
 *   scene:   switch to a named scene (full desktop transition)
 *   patch:   partial update — add/remove/move specific roles
 *   command: fire a single registry command
 */
export type Cue =
  | { at: CueTiming; scene: string }
  | { at: CueTiming; patch: CuePatch }
  | { at: CueTiming; command: { id: string; args?: Record<string, unknown> } };

export interface CuePatch {
  /** Windows to add or reposition. */
  set?: SceneWindow[];
  /** Roles to close. */
  close?: string[];
  /** Theme change. */
  theme?: string;
}

// ---------------------------------------------------------------------------
// Timeline file — the top-level artifact an agent writes
// ---------------------------------------------------------------------------

export interface TimelineFile {
  /** Format version for forward compat. */
  version: 1;

  /** Human-readable title. */
  title: string;

  /** Audio file path (absolute or relative to timeline file). */
  track: string;

  /** Track duration in seconds. Runner uses this for end-of-show. */
  duration: number;

  /** Optional beat map. Inline or path to a JSON file. */
  beatMap?: BeatMap | string;

  /** Primer palette — curated list of visual assets for this show. */
  palette?: PrimerPaletteEntry[];

  /** Named scene definitions. Referenced by cues. */
  scenes: Record<string, SceneDefinition>;

  /** Ordered cue list. Must be monotonically ordered by resolved time. */
  cues: Cue[];

  /** Options. */
  options?: TimelineOptions;
}

export interface PrimerPaletteEntry {
  /** Short name used in scene window references. */
  name: string;
  /** Absolute file path. */
  file: string;
  /** Why this primer is in the palette. Agent's creative note. */
  note?: string;
}

export interface TimelineOptions {
  /** Window roles to never close (e.g. the agent chat window). Default: ["agent"]. */
  protect?: string[];
  /** Whether to record with asciinema. Default: false. */
  record?: boolean;
  /** Output path for asciinema recording. */
  recordPath?: string;
  /** Whether to show lyric subtitles. Default: false. */
  subtitles?: boolean;
}

// ---------------------------------------------------------------------------
// Resolved types — internal, used by the runner after parsing
// ---------------------------------------------------------------------------

/** A cue with its timing resolved to absolute seconds. */
export interface ResolvedCue {
  /** Absolute time in seconds from track start. */
  t: number;
  /** Original cue data. */
  cue: Cue;
}

/** The fully parsed and validated timeline, ready to run. */
export interface ResolvedTimeline {
  file: TimelineFile;
  beatMap?: BeatMap;
  cues: ResolvedCue[];
  durationMs: number;
}
