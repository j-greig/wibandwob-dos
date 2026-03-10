/** Core types for the headless roguelike engine */

export interface Tile {
  x: number;
  y: number;
  glyph: string;
  fg?: string;
  bg?: string;
  walkable: boolean;
  transparent: boolean;
  region: string;
  label: string;
  portal?: string;
}

export interface SpriteCell {
  char: string;
  ox: number;
  oy: number;
}

export interface SpriteFrame {
  rows: string[];
  width: number;
  height: number;
  center: number;
  bottom: number;
  cells: SpriteCell[];
  solidCells: { ox: number; oy: number }[];
}

export interface Sprite {
  frames: SpriteFrame[];
  width: number;
  height: number;
  emotionalStates?: Record<string, string[]> | null;
  solidRowsFromBottom?: number | null;
}

export interface Entity {
  id: string;
  x: number;
  y: number;
  sprite: Sprite;
  color: string;
  visible: boolean;
  behavior?: string;
  allowedRegions?: Set<string>;
  patrolBounds?: Bounds;
  stayChance?: number;
  material?: string;
  solid?: boolean;
  static?: boolean;
  facingLeft?: boolean;
  squeezing?: boolean;
  mood?: string;
  emotionalState?: string;
  piloting?: boolean;
  [key: string]: any;
}

export interface Bounds {
  minX: number;
  maxX: number;
  minY?: number;
  maxY?: number;
}

export interface Camera {
  offsetX: number;
  offsetY: number;
  currentRoom: string;
  prevRoom: string;
}

export interface Player extends Entity {
  facingLeft: boolean;
  squeezing: boolean;
  squeezeAnimating?: boolean;
  normalSprite: Sprite;
  piloting: boolean;
  pilotedMech?: Entity | null;
  cannonCooldown: number;
  lastMoveDir: { dx: number; dy: number };
  previousForm?: any;
}

export interface Interactable {
  id: string;
  x: number;
  y: number;
  glyph: string;
  fg?: string;
  radius: number;
  prompt: string;
  petPrompt?: string;
  onInteract: (state: GameState) => void;
  onPet?: (state: GameState) => void;
  exhausted?: boolean;
  istate?: Record<string, any>;
}

export interface StarCell {
  x: number;
  y: number;
  phase: number;
  speed: number;
}

export interface BeamCell {
  x: number;
  y: number;
  ch: string;
  ttl: number;   // animation ticks remaining
  fg: string;    // staged beam color
}

export interface GameState {
  tiles: Map<string, Tile>;
  player: Player;
  monsters: Entity[];
  structures: Entity[];
  discovered: Set<string>;
  visible: Set<string>;
  camera: Camera;
  log: string[];
  turn: number;
  seed: number;
  mode: "overworld" | "castleInterior";
  animTick: number;
  stars: StarCell[];
  interactables: Interactable[];
  nearbyInteractable: Interactable | null;
  nearbyPetTarget: Interactable | null;
  overworldSnapshot: any | null;
  magick: number;
  maxMagick: number;
  sigils: Set<string>;
  groundItems: { id: string; type: string; x: number; y: number }[];
  inventory: { type: string; quantity: number }[];
  pressurePlateProgress: string[];
  instrumentsPlayed: Set<string>;
  libraryBooksRead: number;
  mirrorVaultOpened: boolean;
  nearbyMech?: Entity | null;
  hints: string[];
  beamCells: BeamCell[];  // transient cannon beam overlay
}

export interface FrameCell {
  x: number;
  y: number;
  ch: string;
  fg: string;
  bg: string;
}

export type GameCommand =
  | "move-north"
  | "move-south"
  | "move-east"
  | "move-west"
  | "move-nw"
  | "move-ne"
  | "move-sw"
  | "move-se"
  | "squeeze-toggle"
  | "interact"
  | "board-mech"
  | "eject-mech"
  | "fire-cannon"
  | "pet"
  | "noop";
