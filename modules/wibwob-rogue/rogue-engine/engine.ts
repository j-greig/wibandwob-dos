/**
 * Headless roguelike engine.
 * No DOM, no blessed — pure state machine.
 * initState(seed) → step(command) → getFrame(viewW, viewH)
 */

import { FOV } from "rot-js";
import { RNG } from "rot-js";
import type { GameState, GameCommand, FrameCell, Entity, Tile, StarCell, BeamCell } from "./types.js";
import {
  HEIGHT, WIDTH, VIEWPORT_WIDTH, BASE_LIGHT_RADIUS, SQUEEZE_LIGHT_FACTOR,
  MAX_LOG_LINES, MAIN_PATH_Y, ROOMS, REGION_BOUNDS,
} from "./constants.js";
import {
  PLAYER_SPRITE_RIGHT, PLAYER_SPRITE_LEFT, PLAYER_SQUEEZE_SPRITE,
  spriteWorldCells, spriteSolidCells,
} from "./sprites.js";
import { generateWorld, tileKey } from "./worldgen.js";

const STAR_GLYPHS = ["·", "✦", "✧", "✶", "✹", "*", "˙"] as const;

function generateStars(seed: number): StarCell[] {
  const stars: StarCell[] = [];
  const skyRows = 3;
  const starDensity = 0.08;
  let r = seed;
  function rand() {
    r = (r * 1664525 + 1013904223) & 0xffffffff;
    return (r >>> 0) / 0xffffffff;
  }
  for (let y = 0; y < skyRows; y++) {
    for (let x = 0; x < WIDTH; x++) {
      if (rand() < starDensity) {
        stars.push({
          x,
          y,
          phase: Math.floor(rand() * STAR_GLYPHS.length),
          speed: 1 + Math.floor(rand() * 3),
        });
      }
    }
  }
  return stars;
}

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
    piloting: false,
    pilotedMech: null,
    cannonCooldown: 0,
    lastMoveDir: { dx: 1, dy: 0 },
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
    animTick: 0,
    stars: generateStars(seed),
    nearbyMech: null,
    hints: [],
    beamCells: [],
  };

  // Initial FOV + camera
  computeFov(state);
  updateCamera(state);
  refreshNearby(state);
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

function refreshHints(state: GameState): void {
  const hints: string[] = ["hjkl move"];
  if (state.player.piloting) {
    hints.push("e eject");
    hints.push("f fire");
  } else {
    hints.push("w squeeze");
    if (state.nearbyMech) hints.push("e board mech");
  }
  state.hints = hints;
}

function refreshNearby(state: GameState): void {
  state.nearbyMech = state.monsters.find(m => {
    const d = Math.abs(state.player.x - m.x) + Math.abs(state.player.y - m.y);
    return d <= 1 && (m.behavior === "mech-warden" || m.behavior === "skinny-mech" || m.id?.startsWith("mech"));
  }) ?? null;
  refreshHints(state);
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
    const cells = spriteSolidCells(structure.sprite, structure.x, structure.y);
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

function boardMech(state: GameState, mech: Entity): void {
  const dist = Math.abs(state.player.x - mech.x) + Math.abs(state.player.y - mech.y);
  if (dist > 1) {
    addLog(state, "The mech is just out of reach.");
    return;
  }
  if (state.player.piloting) {
    addLog(state, "Already piloting a mech.");
    return;
  }

  state.player.previousForm = {
    sprite: state.player.sprite,
    normalSprite: state.player.normalSprite,
    color: state.player.color,
    facingLeft: state.player.facingLeft,
    squeezing: state.player.squeezing,
  };

  state.monsters = state.monsters.filter(m => m !== mech);
  state.player.x = mech.x;
  state.player.y = mech.y;
  state.player.piloting = true;
  state.player.pilotedMech = mech;
  state.player.squeezing = false;

  const pilotedSprite = mech.pilotedSprite ?? mech.sprite;
  state.player.sprite = pilotedSprite;
  state.player.normalSprite = pilotedSprite;
  state.player.color = mech.color || "#d8f3ff";
  state.player.cannonCooldown = 0;

  addLog(state, "Wibwob slides into the mech's chassis.");
  computeFov(state);
  refreshNearby(state);
}

function ejectMech(state: GameState): void {
  if (!state.player.piloting || !state.player.pilotedMech) {
    addLog(state, "Not piloting anything.");
    return;
  }

  const mech = state.player.pilotedMech;
  mech.x = state.player.x;
  mech.y = state.player.y;
  state.monsters.push(mech);

  const prev = state.player.previousForm;
  if (prev) {
    state.player.sprite = prev.sprite;
    state.player.normalSprite = prev.normalSprite;
    state.player.color = prev.color;
    state.player.facingLeft = prev.facingLeft;
    state.player.squeezing = prev.squeezing;
  }

  state.player.piloting = false;
  state.player.pilotedMech = null;

  const exitY = state.player.y + 1;
  const exitKey = `${state.player.x},${exitY}`;
  if (state.tiles.get(exitKey)?.walkable) {
    state.player.y = exitY;
  }

  addLog(state, "Wibwob drops out of the mech chassis.");
  computeFov(state);
  refreshNearby(state);
}

function fireCannon(state: GameState): void {
  if (!state.player.piloting) {
    addLog(state, "Wibwob needs a mech chassis to fire.");
    return;
  }

  const now = Date.now();
  if (state.player.cannonCooldown > now) {
    addLog(state, "Cannon recharging...");
    return;
  }

  state.player.cannonCooldown = now + 800;
  const dir = state.player.lastMoveDir || { dx: state.player.facingLeft ? -1 : 1, dy: 0 };
  let stepX = Math.sign(dir.dx || (state.player.facingLeft ? -1 : 1));
  let stepY = Math.sign(dir.dy || 0);
  if (stepX === 0 && stepY === 0) stepX = state.player.facingLeft ? -1 : 1;

  const beamGlyph = (stepX === 0 && stepY !== 0) ? "┃"
    : (stepY === 0 && stepX !== 0) ? "━"
    : (stepX > 0 && stepY < 0) || (stepX < 0 && stepY > 0) ? "╱" : "╲";

  let bx = state.player.x + stepX;
  let by = state.player.y + stepY;
  let hit = false;
  const newBeam: BeamCell[] = [];

  for (let i = 0; i < 20; i++) {
    const tile = state.tiles.get(`${bx},${by}`);
    if (!tile?.transparent) break;
    newBeam.push({ x: bx, y: by, ch: beamGlyph, ttl: 3 });
    const monster = state.monsters.find(m => m.x === bx && m.y === by);
    if (monster) {
      state.monsters = state.monsters.filter(m => m !== monster);
      addLog(state, `Mech cannon vaporises ${monster.id.replace(/-/g, " ")}!`);
      hit = true;
      break;
    }
    bx += stepX;
    by += stepY;
  }

  // Replace beam overlay — new beam gets TTL 3 anim ticks (~2.4s)
  state.beamCells = newBeam;

  if (!hit) addLog(state, `Mech cannon fires — nothing hit.`);
  state.turn++;
  computeFov(state);
  refreshNearby(state);
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
      refreshHints(state);
      return;
    case "interact": {
      const mech = state.nearbyMech;
      if (mech && !state.player.piloting) {
        boardMech(state, mech);
      } else if (state.player.piloting) {
        ejectMech(state);
      } else {
        addLog(state, "Nothing to interact with here.");
      }
      refreshHints(state);
      return;
    }
    case "board-mech": {
      const mech = state.nearbyMech;
      if (mech && !state.player.piloting) {
        boardMech(state, mech);
      } else {
        addLog(state, "Nothing to interact with here.");
      }
      refreshHints(state);
      return;
    }
    case "eject-mech":
      ejectMech(state);
      refreshHints(state);
      return;
    case "fire-cannon":
      fireCannon(state);
      refreshHints(state);
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
    if (!state.player.squeezing && !state.player.piloting) {
      state.player.normalSprite = PLAYER_SPRITE_LEFT;
      state.player.sprite = PLAYER_SPRITE_LEFT;
    }
  } else if (dx > 0) {
    state.player.facingLeft = false;
    if (!state.player.squeezing && !state.player.piloting) {
      state.player.normalSprite = PLAYER_SPRITE_RIGHT;
      state.player.sprite = PLAYER_SPRITE_RIGHT;
    }
  }

  state.player.x = targetX;
  state.player.y = targetY;
  state.player.lastMoveDir = { dx, dy };
  state.turn++;

  // Step monsters
  stepMonsters(state);

  // Update FOV and camera
  computeFov(state);
  refreshNearby(state);
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

export function tickAnim(state: GameState): void {
  state.animTick++;
  for (const star of state.stars) {
    if (state.animTick % star.speed === 0) {
      star.phase = (star.phase + 1) % STAR_GLYPHS.length;
    }
  }
  // Decay beam overlay
  if (state.beamCells.length > 0) {
    state.beamCells = state.beamCells
      .map(b => ({ ...b, ttl: b.ttl - 1 }))
      .filter(b => b.ttl > 0);
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

  // Star layer — sky rows only
  const brightness = ["#505050", "#707070", "#909090", "#b0b0b0", "#d0d0d0", "#f0f0f0", "#ffffff"];
  for (const star of state.stars) {
    const sx = star.x - camX;
    const sy = star.y - camY;
    if (sx < 0 || sx >= viewW || sy < 0 || sy >= viewH) continue;
    const idx = sy * viewW + sx;
    if (idx < 0 || idx >= cells.length) continue;
    const cell = cells[idx];
    if (cell.ch === " ") {
      cells[idx] = {
        x: sx,
        y: sy,
        ch: STAR_GLYPHS[star.phase % STAR_GLYPHS.length],
        fg: brightness[star.phase % brightness.length],
        bg: "#000000",
      };
    }
  }

  // Entity layers — structures, monsters, player
  const paintEntity = (entity: Entity) => {
    const frameCount = entity.sprite.frames.length;
    let frameIndex = 0;
    if (frameCount > 1) {
      frameIndex = Math.floor(state.animTick / 2) % frameCount;
    }
    const spriteCells = spriteWorldCells(entity.sprite, entity.x, entity.y, frameIndex);
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

  // Beam overlay — cyan, drawn on top of everything visible
  for (const beam of state.beamCells) {
    const sx = beam.x - camX;
    const sy = beam.y - camY;
    if (sx < 0 || sx >= viewW || sy < 0 || sy >= viewH) continue;
    const idx = sy * viewW + sx;
    if (idx >= 0 && idx < cells.length) {
      cells[idx] = { x: sx, y: sy, ch: beam.ch, fg: "#00ffff", bg: "#000000" };
    }
  }

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
    piloting: state.player.piloting,
    monstersVisible: state.monsters.filter(m =>
      spriteWorldCells(m.sprite, m.x, m.y).some(c => state.visible.has(tileKey(c.x, c.y)))
    ).map(m => ({ id: m.id, x: m.x, y: m.y, behavior: m.behavior })),
  };
}
