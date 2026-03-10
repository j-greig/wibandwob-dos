/**
 * Headless roguelike engine.
 * No DOM, no blessed — pure state machine.
 * initState(seed) → step(command) → getFrame(viewW, viewH)
 */

import { FOV } from "rot-js";
import { RNG } from "rot-js";
import type { GameState, GameCommand, FrameCell, Entity, Tile } from "./types.js";
import {
  HEIGHT, WIDTH, VIEWPORT_WIDTH, BASE_LIGHT_RADIUS, SQUEEZE_LIGHT_FACTOR,
  MAX_LOG_LINES, MAIN_PATH_Y, ROOMS, REGION_BOUNDS,
} from "./constants.js";
import {
  PLAYER_SPRITE_RIGHT, PLAYER_SPRITE_LEFT, PLAYER_SQUEEZE_SPRITE,
  spriteWorldCells, spriteSolidCells,
} from "./sprites.js";
import { generateWorld, tileKey } from "./worldgen.js";

// ─── state initialisation ────────────────────────────────

export function initState(seed: number): GameState {
  const world = generateWorld(seed);

  const player = {
    id: "player",
    x: world.playerStart.x,
    y: world.playerStart.y,
    sprite: PLAYER_SPRITE_RIGHT,
    normalSprite: PLAYER_SPRITE_RIGHT,
    color: "#f5f5f5",
    visible: true,
    facingLeft: false,
    squeezing: false,
  };

  const state: GameState = {
    tiles: world.tiles,
    player,
    monsters: world.monsters,
    structures: world.structures,
    discovered: new Set(),
    visible: new Set(),
    camera: { offsetX: 0, offsetY: 0, currentRoom: "castle", prevRoom: "castle" },
    log: [],
    turn: 0,
    seed,
    mode: "overworld",
  };

  // Initial FOV + camera
  computeFov(state);
  updateCamera(state);
  addLog(state, "Wibwob awakens in the castle.");

  return state;
}

// ─── FOV ─────────────────────────────────────────────────

function computeFov(state: GameState) {
  const lightRadius = state.player.squeezing
    ? Math.max(1, Math.floor(BASE_LIGHT_RADIUS / SQUEEZE_LIGHT_FACTOR))
    : BASE_LIGHT_RADIUS;

  state.visible.clear();
  const fov = new FOV.PreciseShadowcasting((x, y) => {
    const tile = state.tiles.get(tileKey(x, y));
    return tile ? Boolean(tile.transparent) : false;
  });
  fov.compute(state.player.x, state.player.y, lightRadius, (x, y) => {
    const key = tileKey(x, y);
    state.visible.add(key);
    state.discovered.add(key);
  });
}

// ─── camera ──────────────────────────────────────────────

function getCurrentRoom(playerX: number): string {
  if (playerX < ROOMS.forest.minX) return "castle";
  if (playerX < ROOMS.mountain.minX) return "forest";
  return "mountain";
}

/** Set viewport height for camera Y tracking. Updated by the renderer. */
export let viewportHeight = 36;
export function setViewportHeight(h: number) { viewportHeight = h; }

function updateCamera(state: GameState) {
  const room = getCurrentRoom(state.player.x);
  state.camera.prevRoom = state.camera.currentRoom;
  state.camera.currentRoom = room;

  const bounds = ROOMS[room];
  const halfViewport = Math.floor(VIEWPORT_WIDTH / 2);
  const minOffset = bounds.minX;
  const maxOffset = Math.max(bounds.maxX - VIEWPORT_WIDTH + 1, bounds.minX);
  const desired = state.player.x - halfViewport;
  state.camera.offsetX = Math.min(Math.max(desired, minOffset), Math.min(maxOffset, WIDTH - VIEWPORT_WIDTH));

  // Vertical camera — centre on player
  const halfViewH = Math.floor(viewportHeight / 2);
  const desiredY = state.player.y - halfViewH;
  state.camera.offsetY = Math.min(Math.max(desiredY, 0), Math.max(0, HEIGHT - viewportHeight));

  if (state.camera.prevRoom !== state.camera.currentRoom) {
    const names: Record<string, string> = { castle: "the castle", forest: "the forest", mountain: "the mountains" };
    addLog(state, `You enter ${names[room] ?? room}.`);
  }
}

// ─── logging ─────────────────────────────────────────────

function addLog(state: GameState, text: string) {
  state.log.push(text);
  if (state.log.length > MAX_LOG_LINES) state.log.shift();
}

// ─── collision ───────────────────────────────────────────

function detectMonsterCollision(state: GameState, targetX: number, targetY: number): Entity | null {
  const playerCells = spriteWorldCells(state.player.sprite, targetX, targetY);
  const playerOccupied = new Set(playerCells.map(c => tileKey(c.x, c.y)));

  for (const monster of state.monsters) {
    const cells = spriteWorldCells(monster.sprite, monster.x, monster.y);
    for (const cell of cells) {
      if (playerOccupied.has(tileKey(cell.x, cell.y))) return monster;
    }
  }
  for (const structure of state.structures) {
    if (!structure.solid) continue;
    const cells = spriteWorldCells(structure.sprite, structure.x, structure.y);
    for (const cell of cells) {
      if (playerOccupied.has(tileKey(cell.x, cell.y))) return structure;
    }
  }
  return null;
}

function canPlayerOccupy(state: GameState, targetX: number, targetY: number): boolean {
  const cells = spriteWorldCells(state.player.sprite, targetX, targetY);
  for (const cell of cells) {
    if (cell.x < 0 || cell.x >= WIDTH || cell.y < 0 || cell.y >= HEIGHT) return false;
    const tile = state.tiles.get(tileKey(cell.x, cell.y));
    if (!tile || !tile.walkable) return false;
  }
  return true;
}

// ─── AI step ─────────────────────────────────────────────

function stepMonsters(state: GameState) {
  for (const monster of state.monsters) {
    if (monster.static) continue;
    const behavior = monster.behavior;
    if (!behavior) continue;

    // Simple AI: wander within patrol bounds
    if (monster.stayChance && RNG.getUniform() < monster.stayChance) continue;

    const dx = RNG.getUniformInt(-1, 1);
    const dy = RNG.getUniformInt(-1, 1);
    if (dx === 0 && dy === 0) continue;

    const newX = monster.x + dx;
    const newY = monster.y + dy;

    // Bounds check
    if (monster.patrolBounds) {
      const b = monster.patrolBounds;
      if (newX < (b.minX ?? 0) || newX > (b.maxX ?? WIDTH - 1)) continue;
      if (newY < (b.minY ?? 0) || newY > (b.maxY ?? HEIGHT - 1)) continue;
    }

    // Walkability check
    const cells = spriteWorldCells(monster.sprite, newX, newY);
    let canMove = true;
    for (const cell of cells) {
      if (cell.x < 0 || cell.x >= WIDTH || cell.y < 0 || cell.y >= HEIGHT) { canMove = false; break; }
      const tile = state.tiles.get(tileKey(cell.x, cell.y));
      if (!tile || !tile.walkable) { canMove = false; break; }
      if (monster.allowedRegions && !monster.allowedRegions.has(tile.region)) { canMove = false; break; }
    }
    if (!canMove) continue;

    monster.x = newX;
    monster.y = newY;
  }
}

// ─── step ────────────────────────────────────────────────

export function step(state: GameState, command: GameCommand): void {
  if (command === "noop") return;

  let dx = 0, dy = 0;
  switch (command) {
    case "move-north": dy = -1; break;
    case "move-south": dy = 1; break;
    case "move-east": dx = 1; break;
    case "move-west": dx = -1; break;
    case "squeeze-toggle":
      state.player.squeezing = !state.player.squeezing;
      state.player.sprite = state.player.squeezing ? PLAYER_SQUEEZE_SPRITE : state.player.normalSprite;
      addLog(state, state.player.squeezing ? "Wibwob squeezes into a tiny form ◕" : "Wibwob expands back to normal size.");
      computeFov(state);
      return;
    case "interact":
      addLog(state, "Nothing to interact with here.");
      return;
  }

  if (dx === 0 && dy === 0) return;

  const targetX = state.player.x + dx;
  const targetY = state.player.y + dy;

  // Collision with entities
  const collision = detectMonsterCollision(state, targetX, targetY);
  if (collision) {
    if (collision.behavior === "screamer") {
      // Slay screamer
      state.monsters = state.monsters.filter(m => m !== collision);
      addLog(state, `Wibwob squishes through a screamer!`);
    } else {
      const name = collision.id.replace(/-/g, " ");
      addLog(state, `Wibwob bumps into ${name}.`);
      return;
    }
  }

  // Walkability
  if (!canPlayerOccupy(state, targetX, targetY)) {
    const tile = state.tiles.get(tileKey(targetX, targetY));
    addLog(state, tile ? `The way is blocked (${tile.label}).` : "The way is blocked.");
    return;
  }

  // Update facing
  if (dx < 0) {
    state.player.facingLeft = true;
    if (!state.player.squeezing) {
      state.player.normalSprite = PLAYER_SPRITE_LEFT;
      state.player.sprite = PLAYER_SPRITE_LEFT;
    }
  } else if (dx > 0) {
    state.player.facingLeft = false;
    if (!state.player.squeezing) {
      state.player.normalSprite = PLAYER_SPRITE_RIGHT;
      state.player.sprite = PLAYER_SPRITE_RIGHT;
    }
  }

  state.player.x = targetX;
  state.player.y = targetY;
  state.turn++;

  // Step monsters
  stepMonsters(state);

  // Update FOV and camera
  computeFov(state);
  updateCamera(state);

  // Location label
  const tile = state.tiles.get(tileKey(state.player.x, state.player.y));
  if (tile && tile.label) {
    // Only log location on region change
    const currentLabel = tile.label;
    if (state.log.length === 0 || !state.log[state.log.length - 1]?.includes(currentLabel)) {
      // Don't spam the log
    }
  }
}

// ─── frame output ────────────────────────────────────────

export function getFrame(state: GameState, viewW: number, viewH: number): FrameCell[] {
  const cells: FrameCell[] = [];
  const camX = state.camera.offsetX;
  const camY = state.camera.offsetY;

  // Terrain layer
  for (let sy = 0; sy < viewH; sy++) {
    for (let sx = 0; sx < viewW; sx++) {
      const worldX = camX + sx;
      const worldY = camY + sy;
      const key = tileKey(worldX, worldY);
      const tile = state.tiles.get(key);

      if (!tile || !state.discovered.has(key)) {
        cells.push({ x: sx, y: sy, ch: " ", fg: "#000000", bg: "#000000" });
        continue;
      }

      const isVisible = state.visible.has(key);
      const fg = isVisible ? (tile.fg || "#f5f5f5") : "#393939";
      const bg = isVisible ? (tile.bg || "#000000") : "#000000";
      const ch = tile.glyph;
      cells.push({ x: sx, y: sy, ch, fg, bg });
    }
  }

  // Entity layers — structures, monsters, player
  const paintEntity = (entity: Entity) => {
    const spriteCells = spriteWorldCells(entity.sprite, entity.x, entity.y);
    const color = entity.color || "#f5f5f5";
    for (const cell of spriteCells) {
      const sx = cell.x - camX;
      const sy = cell.y - camY;
      if (sx < 0 || sx >= viewW || sy < 0 || sy >= viewH) continue;
      const key = tileKey(cell.x, cell.y);
      if (!state.discovered.has(key) || !state.visible.has(key)) continue;
      // Overwrite the cell in the output
      const idx = sy * viewW + sx;
      if (idx >= 0 && idx < cells.length) {
        cells[idx] = { x: sx, y: sy, ch: cell.char, fg: color, bg: "#000000" };
      }
    }
  };

  for (const structure of state.structures) paintEntity(structure);
  for (const monster of state.monsters) paintEntity(monster);
  paintEntity(state.player);

  return cells;
}

/** Get semantic state for describeState / API */
export function describeEngine(state: GameState) {
  const tile = state.tiles.get(tileKey(state.player.x, state.player.y));
  return {
    biome: state.camera.currentRoom,
    playerPos: { x: state.player.x, y: state.player.y },
    turn: state.turn,
    seed: state.seed,
    lastMessage: state.log[state.log.length - 1] ?? "",
    label: tile?.label ?? "",
    squeezing: state.player.squeezing,
    monstersVisible: state.monsters.filter(m =>
      spriteWorldCells(m.sprite, m.x, m.y).some(c => state.visible.has(tileKey(c.x, c.y)))
    ).map(m => ({ id: m.id, x: m.x, y: m.y, behavior: m.behavior })),
  };
}
