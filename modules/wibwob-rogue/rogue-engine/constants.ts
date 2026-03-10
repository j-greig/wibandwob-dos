/** World constants — extracted from game.js */

export const HEIGHT = 72;
export const CASTLE_WIDTH = 96;
export const FOREST_WIDTH = 96;
export const MOUNTAIN_WIDTH = 96;
export const WIDTH = CASTLE_WIDTH + FOREST_WIDTH + MOUNTAIN_WIDTH;
export const MIN_PASSAGE_WIDTH = 12;
export const MAIN_PATH_Y = Math.floor(HEIGHT / 2);
export const MAX_LOG_LINES = 8;
export const BASE_LIGHT_RADIUS = 15;
export const SQUEEZE_LIGHT_FACTOR = 3;
export const VIEWPORT_WIDTH = 96;

export const REGION_BOUNDS = {
  castle: { minX: 0, maxX: CASTLE_WIDTH - 1 },
  forest: { minX: CASTLE_WIDTH, maxX: CASTLE_WIDTH + FOREST_WIDTH - 1 },
  mountain: { minX: CASTLE_WIDTH + FOREST_WIDTH, maxX: WIDTH - 1 },
} as const;

export const ROOMS: Record<string, { minX: number; maxX: number }> = {
  castle: REGION_BOUNDS.castle,
  forest: REGION_BOUNDS.forest,
  mountain: REGION_BOUNDS.mountain,
};

export const COLORS = {
  foreground: "#f5f5f5",
  background: "#000000",
  unseenForeground: "#393939",
};
