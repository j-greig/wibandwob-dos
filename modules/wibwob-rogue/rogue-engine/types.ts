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
  normalSprite: Sprite;
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
  mode: string;
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
  | "squeeze-toggle"
  | "interact"
  | "noop";
