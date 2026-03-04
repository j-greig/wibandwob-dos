/**
 * Scene Layout — resolve layout tokens against live desktop geometry.
 *
 * Layout tokens are named positions like "hero-left", "lyric-bar", "backdrop".
 * This service resolves them to absolute cell coordinates given a desktop size.
 *
 * The agent chat window is always excluded from layout calculations.
 */

import type { SceneLayout, ExplicitLayout, ProportionalLayout, LayoutToken } from "./timeline-types.js";

export interface DesktopBounds {
  width: number;
  height: number;
  /** Usable area offset (e.g. menu bar = 1 row top, status bar = 1 row bottom). */
  topInset?: number;
  bottomInset?: number;
}

export interface ResolvedRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Default insets: 1 row menu bar top, 1 row status bar bottom. */
const DEFAULT_TOP_INSET = 1;
const DEFAULT_BOTTOM_INSET = 1;

function usable(bounds: DesktopBounds): { x0: number; y0: number; w: number; h: number } {
  const y0 = bounds.topInset ?? DEFAULT_TOP_INSET;
  const yEnd = bounds.height - (bounds.bottomInset ?? DEFAULT_BOTTOM_INSET);
  return { x0: 0, y0, w: bounds.width, h: yEnd - y0 };
}

function isExplicit(layout: SceneLayout): layout is ExplicitLayout {
  return typeof layout === "object" && "x" in layout && "w" in layout;
}

function isProportional(layout: SceneLayout): layout is ProportionalLayout {
  return typeof layout === "object" && "xPct" in layout;
}

/**
 * Named layout token definitions.
 * Each returns a rect relative to usable desktop area.
 */
const TOKEN_RESOLVERS: Record<string, (u: ReturnType<typeof usable>) => ResolvedRect> = {
  "backdrop":         (u) => ({ x: u.x0, y: u.y0, w: u.w, h: u.h }),
  "fullscreen":       (u) => ({ x: u.x0, y: u.y0, w: u.w, h: u.h }),

  "hero-left":        (u) => ({ x: u.x0, y: u.y0, w: Math.round(u.w * 0.65), h: u.h }),
  "hero-right":       (u) => {
    const w = Math.round(u.w * 0.65);
    return { x: u.x0 + u.w - w, y: u.y0, w, h: u.h };
  },
  "hero-center":      (u) => {
    const w = Math.round(u.w * 0.70);
    const h = Math.round(u.h * 0.80);
    return { x: u.x0 + Math.round((u.w - w) / 2), y: u.y0 + Math.round((u.h - h) / 2), w, h };
  },

  "top-banner":       (u) => ({ x: u.x0, y: u.y0, w: u.w, h: Math.round(u.h * 0.15) }),
  "bottom-banner":    (u) => {
    const h = Math.round(u.h * 0.15);
    return { x: u.x0, y: u.y0 + u.h - h, w: u.w, h };
  },
  "lyric-bar":        (u) => {
    const h = 12;
    return { x: u.x0, y: u.y0 + u.h - h, w: u.w, h };
  },

  "top-right-corner": (u) => {
    const w = Math.round(u.w * 0.30);
    const h = Math.round(u.h * 0.20);
    return { x: u.x0 + u.w - w, y: u.y0, w, h };
  },
  "top-left-corner":  (u) => ({
    x: u.x0, y: u.y0, w: Math.round(u.w * 0.30), h: Math.round(u.h * 0.20),
  }),

  "sidebar-right":    (u) => {
    const w = Math.round(u.w * 0.30);
    return { x: u.x0 + u.w - w, y: u.y0, w, h: u.h };
  },
  "sidebar-left":     (u) => ({ x: u.x0, y: u.y0, w: Math.round(u.w * 0.30), h: u.h }),

  "center-card":      (u) => {
    const w = Math.round(u.w * 0.40);
    const h = Math.round(u.h * 0.50);
    return { x: u.x0 + Math.round((u.w - w) / 2), y: u.y0 + Math.round((u.h - h) / 2), w, h };
  },
  "strip-bottom":     (u) => {
    const h = Math.round(u.h * 0.30);
    return { x: u.x0, y: u.y0 + u.h - h, w: u.w, h };
  },
};

/**
 * Resolve a SceneLayout to absolute cell coordinates.
 */
export function resolveLayout(layout: SceneLayout, bounds: DesktopBounds): ResolvedRect {
  if (isExplicit(layout)) {
    return { x: layout.x, y: layout.y, w: layout.w, h: layout.h };
  }

  if (isProportional(layout)) {
    const u = usable(bounds);
    return {
      x: u.x0 + Math.round(u.w * layout.xPct),
      y: u.y0 + Math.round(u.h * layout.yPct),
      w: Math.round(u.w * layout.wPct),
      h: Math.round(u.h * layout.hPct),
    };
  }

  // Named token
  const resolver = TOKEN_RESOLVERS[layout];
  if (!resolver) {
    throw new Error(`Unknown layout token: "${layout}"`);
  }
  return resolver(usable(bounds));
}

/**
 * List all known layout tokens.
 */
export function listLayoutTokens(): string[] {
  return Object.keys(TOKEN_RESOLVERS);
}
