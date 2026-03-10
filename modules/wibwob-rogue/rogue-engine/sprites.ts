/** Sprite definitions — extracted from game.js, no DOM dependency */

import type { Sprite, SpriteFrame, SpriteCell } from "./types.js";

export function createSprite(rawFrames: (string | string[])[], options: {
  solidRowsFromBottom?: number;
  emotionalStates?: Record<string, string[]>;
} = {}): Sprite {
  const framesInput: string[][] =
    Array.isArray(rawFrames[0]) && typeof rawFrames[0] !== "string"
      ? (rawFrames as string[][])
      : [rawFrames as string[]];

  const processedFrames: SpriteFrame[] = [];
  let maxWidth = 0;
  let maxHeight = 0;

  for (const rows of framesInput) {
    const normalized = rows.slice();
    const width = normalized.reduce((max, row) => Math.max(max, [...row].length), 0);
    const height = normalized.length;
    maxWidth = Math.max(maxWidth, width);
    maxHeight = Math.max(maxHeight, height);
    const center = Math.floor((width - 1) / 2);
    const bottom = height - 1;
    const cells: SpriteCell[] = [];
    const solidCells: { ox: number; oy: number }[] = [];

    const solidRowsFromBottom = options.solidRowsFromBottom ?? null;

    normalized.forEach((row, rowIndex) => {
      const chars = [...row];
      for (let col = 0; col < chars.length; col++) {
        const char = chars[col];
        if (char === " ") continue;
        const ox = col - center;
        const oy = rowIndex - bottom;
        cells.push({ char, ox, oy });
        const isSolid = solidRowsFromBottom === null || rowIndex >= height - solidRowsFromBottom;
        if (isSolid) {
          solidCells.push({ ox, oy });
        }
      }
    });

    processedFrames.push({ rows: normalized, width, height, center, bottom, cells, solidCells });
  }

  return {
    frames: processedFrames,
    width: maxWidth,
    height: maxHeight,
    emotionalStates: options.emotionalStates ?? null,
    solidRowsFromBottom: options.solidRowsFromBottom ?? null,
  };
}

// Player sprites
export const PLAYER_SPRITE_RIGHT = createSprite([
  ["◕‿◕‿◕༽"],
  ["◡‿◕‿◕༽"],
  ["◕‿◡‿◕༽"],
  ["◕‿◕‿◡༽"],
]);
export const PLAYER_SPRITE_LEFT = createSprite([
  ["༼◕‿◕‿◕"],
  ["༼◡‿◕‿◕"],
  ["༼◕‿◡‿◕"],
  ["༼◕‿◕‿◡"],
]);
export const PLAYER_SQUEEZE_SPRITE = createSprite([["◕"]]);

// Scramble
export const SCRAMBLE_SPRITE = createSprite([
  ["/ᐠ｡ꞈ｡ᐟ\\"],
  ["/ᐠ｡-｡ᐟ\\"],
  ["/ᐠ｡ꞈ｡ᐟ\\"],
], {
  emotionalStates: {
    normal: ["/ᐠ｡ꞈ｡ᐟ\\"],
    surprised: ["/ᐠ｡◕｡ᐟ\\"],
    extra_happy: ["/ᐠ｡^｡ᐟ\\"],
    playful_joy: ["/ᐠ｡◠｡ᐟ\\"],
    relaxed: ["/ᐠ｡-｡ᐟ\\"],
    curious: ["/ᐠ｡o｡ᐟ\\"],
    blissful: ["/ᐠ｡◡｡ᐟ\\"],
    focused: ["/ᐠ｡•｡ᐟ\\"],
    friendly: ["/ᐠ｡◜｡ᐟ\\"],
    asleep: ["/ᐠ｡_｡ᐟ\\"],
    prowling: ["/ᐠ｡ꞈ｡ᐟ\\"],
    battlemode: ["/ᐠ｡#｡ᐟ\\"],
    zooming: ["/ᐠ｡!｡ᐟ\\"],
  },
});

// Titan / ridge sentinel
export const TITAN_SPRITE = createSprite([
  [
    "   ╭─╮   ",
    "  ╭╯ ╰╮  ",
    " ╭╯ ◕◕╰╮ ",
    "╭╯ ~~~~╰╮",
  ],
  [
    "   ╭─╮   ",
    "  ╭╯ ╰╮  ",
    " ╭╯ ◡◡╰╮ ",
    "╭╯ ~~~~╰╮",
  ],
  [
    "   ╭─╮   ",
    "  ╭╯ ╰╮  ",
    " ╭╯ ◕◕╰╮ ",
    "╭╯ ~~~~╰╮",
  ],
], { solidRowsFromBottom: 2 });

// Castle facade
export const CASTLE_SPRITE = createSprite([
  [
    "      |WWW   ",
    "      |      ",
    "  _  _|_  __ ",
    " |;|_|;|_|;||",
    "  \\ .    .// ",
    "   \\ .  ://  ",
    "    |  :||   ",
    "    |. :||   ",
    "    |: :||   ",
    "    |, :||   ",
    "    |   ||   ",
    "    |. :||   ",
    "    |:  ||   ",
    "    | ☖ |/   ",
  ],
], { solidRowsFromBottom: 7 });

// Wobbler
export const WOBBLER_SPRITE = createSprite([
  [
    " ╭╮╭╮╭╮ ",
    "╭╯╰╯╰╯╰╮",
    "│ ▓ ▓  │",
    "│  ═   │",
    "│      │",
    "│╭╮╭╮╭╮│",
    "╰╯╰╯╰╯╰╯",
  ],
  [
    " ╭╮╭╮╭╮ ",
    "╭╯╰╯╰╯╰╮",
    "│ ░ ░  │",
    "│  ═   │",
    "│      │",
    "│╭╮╭╮╭╮│",
    "╰╯╰╯╰╯╰╯",
  ],
]);

// Screamer
export const SCREAMER_SPRITE = createSprite([
  ["╱◕◕╲"],
  ["╱◉◉╲"],
]);

// Mech
export const MECH_SPRITE = createSprite([
  [
    "    ╭──┬──┬──╮    ",
    "    │◕ │◡ │ ◕│    ",
    "    ╰──┴╮╭┴──╯    ",
    "      ╭─╯╰─╮      ",
    "  ┌───┤    ├───┐  ",
    "  │   ╰────╯   │  ",
    "  │            │  ",
    " ╱│╲          ╱│╲ ",
  ],
  [
    "    ╭──┬──┬──╮    ",
    "    │◡ │– │ ◡│    ",
    "    ╰──┴╮╭┴──╯    ",
    "      ╭─╯╰─╮      ",
    "  ┌───┤    ├───┐  ",
    "  │   ╰────╯   │  ",
    "  │            │  ",
    " ╱│╲          ╱│╲ ",
  ],
], { solidRowsFromBottom: 3 });

// Skinny mech
export const SKINNY_MECH_SPRITE = createSprite([
  [
    "     ┌──┐      ",
    " ┌───│◕◕│───┐ ",
    " │   └──┘   │ ",
    " │          │ ",
    " │          │ ",
    " │          │ ",
    " │          │ ",
    " │          │ ",
    " │          │ ",
    "╱│╲        ╱│╲",
  ],
  [
    "     ┌──┐      ",
    " ┌───│◡◡│───┐ ",
    " │   └──┘   │ ",
    " │          │ ",
    " │          │ ",
    " │          │ ",
    " │          │ ",
    " │          │ ",
    " │          │ ",
    "╱│╲        ╱│╲",
  ],
], { solidRowsFromBottom: 3 });

// Tree
export const TREE_SPRITE = createSprite([
  [
    "   *   ",
    "  /|\\  ",
    " /◕|◕\\ ",
    "///|\\\\\\",
    " /|||\\ ",
    "//|||\\\\",
    " /|||\\ ",
    "//|||\\\\",
    "  |||  ",
    "  |||  ",
    "  |||  ",
    "  |||   ",
  ],
]);

// Mysterious cube
export const MYSTERIOUS_CUBE_SPRITE = createSprite([["▣"]]);

// Glumface sprites
export const GLUMFACE_SPRITES: Record<string, Sprite> = {
  small: createSprite([["·̥"]]),
  medium: createSprite([["◦̥"]]),
  elder: createSprite([["◌̥"]]),
};

/** Sprite helper: get world cells for a sprite at a given anchor */
export function spriteWorldCells(sprite: Sprite, anchorX: number, anchorY: number, frameIndex = 0) {
  const frames = sprite.frames || [];
  if (!frames.length) return [];
  const frame = frames[frameIndex % frames.length];
  return frame.cells.map((cell) => ({
    x: anchorX + cell.ox,
    y: anchorY + cell.oy,
    char: cell.char,
  }));
}

/** Sprite helper: get solid cells for collision detection */
export function spriteSolidCells(sprite: Sprite, anchorX: number, anchorY: number, frameIndex = 0) {
  const frames = sprite.frames || [];
  if (!frames.length) return [];
  const frame = frames[frameIndex % frames.length];
  const solidCells = frame.solidCells || frame.cells;
  return solidCells.map((cell) => ({
    x: anchorX + cell.ox,
    y: anchorY + cell.oy,
  }));
}
