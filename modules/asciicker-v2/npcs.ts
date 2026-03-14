// ─── NPCs: other cats, foxes, seagulls ──────────────────────
import { hash2d, rgb6, grey } from "./types.js";
import { type City, Tile, getCell, isWalkable } from "./city.js";

export interface NPC {
  x: number; y: number;
  homeX: number; homeY: number;
  dx: number; dy: number;
  ch: string; fg: number;
  name: string;
  kind: "cat" | "fox" | "seagull";
  patrolRadius: number;
}

const NPC_DEFS = [
  { kind: "cat" as const, ch: "ᓚ", fg: rgb6(5, 3, 0), name: "Ginger Tom" },
  { kind: "cat" as const, ch: "ᓚ", fg: grey(4), name: "Shadow" },
  { kind: "cat" as const, ch: "ᓚ", fg: grey(22), name: "Snowball" },
  { kind: "fox" as const, ch: "▸", fg: rgb6(5, 2, 0), name: "Fox" },
  { kind: "seagull" as const, ch: "◇", fg: grey(20), name: "Seagull" },
];

export function placeNPCs(city: City, seed: number): NPC[] {
  const npcs: NPC[] = [];
  for (let i = 0; i < 10; i++) {
    const sx = Math.floor(hash2d(i * 97, seed * 3, 77) * (city.w - 10)) + 5;
    const sy = Math.floor(hash2d(seed * 5, i * 61, 88) * (city.h - 10)) + 5;
    const cell = getCell(city, sx, sy);
    if (!isWalkable(cell.tile)) continue;
    const def = NPC_DEFS[i % NPC_DEFS.length];
    npcs.push({
      x: sx, y: sy, homeX: sx, homeY: sy,
      dx: (hash2d(i, seed, 33) - 0.5) * 0.2,
      dy: (hash2d(seed, i, 44) - 0.5) * 0.2,
      ...def,
      patrolRadius: 4 + Math.floor(hash2d(i * 7, seed, 55) * 5),
    });
  }
  return npcs;
}

export function updateNPCs(npcs: NPC[], city: City, tick: number): void {
  for (const npc of npcs) {
    const nx = npc.x + npc.dx, ny = npc.y + npc.dy;
    const cell = getCell(city, Math.floor(nx), Math.floor(ny));
    if (isWalkable(cell.tile)) {
      npc.x = nx; npc.y = ny;
    }
    // Bounce off patrol radius
    const dist = Math.sqrt((npc.x - npc.homeX) ** 2 + (npc.y - npc.homeY) ** 2);
    if (dist > npc.patrolRadius) {
      npc.dx = (npc.homeX - npc.x) * 0.05;
      npc.dy = (npc.homeY - npc.y) * 0.05;
    }
    // Random direction change
    if (hash2d(tick + npc.homeX, npc.homeY, 99) < 0.03) {
      npc.dx = (hash2d(tick, npc.homeX, 11) - 0.5) * 0.2;
      npc.dy = (hash2d(npc.homeY, tick, 22) - 0.5) * 0.2;
    }
    npc.x = Math.max(1, Math.min(city.w - 2, npc.x));
    npc.y = Math.max(1, Math.min(city.h - 2, npc.y));
  }
}

export function nearestNPC(
  npcs: NPC[], px: number, py: number, range: number,
): NPC | null {
  let best: NPC | null = null, bestD = range;
  for (const n of npcs) {
    const d = Math.sqrt((n.x - px) ** 2 + (n.y - py) ** 2);
    if (d < bestD) { bestD = d; best = n; }
  }
  return best;
}

const CAT_LINES = [
  "Mrrp.", "Prrt?", "*slow blink*", "*headbutt*", "*ignores you*",
  "*stretches*", "Mew.", "*purrs*",
];
const FOX_LINES = ["*stares*", "*trots away*", "*rummages in bin*"];
const GULL_LINES = ["SQUAWK!", "*eyes your chips*", "*aggressive hover*"];

export function npcDialogue(npc: NPC, tick: number): string {
  const lines = npc.kind === "fox" ? FOX_LINES
    : npc.kind === "seagull" ? GULL_LINES : CAT_LINES;
  const i = Math.floor(hash2d(tick, npc.homeX, npc.homeY) * lines.length);
  return `${npc.name}: ${lines[i]}`;
}
