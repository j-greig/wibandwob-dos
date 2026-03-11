/**
 * unicode-patch.ts — Monkey-patch blessed's unicode width detection.
 *
 * blessed's built-in charWidth() has incomplete double-width detection:
 * it misses emoji, trigrams, ZWJ sequences, skin tones, flags, keycaps,
 * and variation selectors. This module replaces it with string-width
 * (v8.2.0) which handles all Unicode correctly.
 *
 * MUST be called before blessed.screen() is created, or at minimum
 * before any rendering occurs.
 *
 * See: chjj/blessed#422 (open since 2019, unresolved)
 *      chjj/blessed#4   (original double-width issue)
 */

import stringWidth from "string-width";

// Cache: codepoint → visual width (0, 1, or 2)
// string-width is fast but we call charWidth thousands of times per render
const widthCache = new Map<number, number>();

// For multi-codepoint sequences (emoji ZWJ, flags, skin tones),
// we need to measure the full grapheme cluster, not individual codepoints.
// But blessed's render path calls charWidth per-codepoint.
// Strategy: cache known codepoint ranges as width=2, and let blessed's
// "eat next cell" logic handle the rest.

function patchedCharWidth(str: string | number, i?: number): number {
  const point = typeof str !== "number"
    ? codePointAt(str, i || 0)
    : str;

  // Fast path: ASCII
  if (point >= 0x20 && point < 0x7f) return 1;

  // nul
  if (point === 0) return 0;

  // Control characters
  if (point < 0x20 || (point >= 0x7f && point < 0xa0)) return 0;

  // Check cache
  const cached = widthCache.get(point);
  if (cached !== undefined) return cached;

  // Use string-width to measure the single character
  const ch = String.fromCodePoint(point);
  const w = stringWidth(ch);
  widthCache.set(point, w);
  return w;
}

function patchedStrWidth(str: string): number {
  // string-width handles everything: ZWJ, skin tones, flags, keycaps
  return stringWidth(str);
}

// Borrowed from blessed's own codePointAt
function codePointAt(str: string, position: number): number {
  const code = str.charCodeAt(position);
  // High surrogate
  if (code >= 0xd800 && code <= 0xdbff) {
    const next = str.charCodeAt(position + 1);
    if (next >= 0xdc00 && next <= 0xdfff) {
      return (code - 0xd800) * 0x400 + (next - 0xdc00) + 0x10000;
    }
  }
  return code;
}

/**
 * Apply the patch. Call once at startup before screen creation.
 * Also enables fullUnicode on the screen options by default.
 */
export function patchBlessedUnicode(): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const unicode = require("blessed/lib/unicode");
    unicode.charWidth = patchedCharWidth;
    unicode.strWidth = patchedStrWidth;

    // Pre-warm cache with common ranges
    // Emoji presentation (most common emoji)
    for (let cp = 0x1f300; cp <= 0x1f9ff; cp++) {
      patchedCharWidth(cp);
    }
    // CJK common
    for (let cp = 0x4e00; cp <= 0x4e50; cp++) {
      patchedCharWidth(cp);
    }
  } catch {
    // If blessed isn't loadable, skip silently
  }
}
