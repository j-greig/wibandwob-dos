/**
 * unicode-patch.ts — Monkey-patch blessed's unicode width detection.
 *
 * blessed's built-in charWidth() has incomplete double-width tables,
 * missing emoji, trigrams, ZWJ sequences, etc. (chjj/blessed#422).
 *
 * We patch THREE things that must stay in sync:
 *   1. unicode.charWidth()  — used by screen.draw() to eat next cell
 *   2. unicode.strWidth()   — used by Element.strWidth() for alignment
 *   3. unicode.chars.all    — regex used by parseContent() to insert \x03
 *                             spacer cells after wide characters
 *
 * If charWidth and chars.all disagree, parseContent inserts spacers for
 * chars that draw doesn't eat (or vice versa), causing layout corruption.
 *
 * Strategy: use string-width v8.2.0 (already installed) for accurate
 * width measurement, and build a comprehensive regex for chars.all by
 * extending blessed's existing ranges with the ones it misses.
 *
 * MUST be called before blessed.screen() is created.
 */

import stringWidth from "string-width";

// ── charWidth patch ─────────────────────────────────────────────

const widthCache = new Map<number, number>();

/**
 * Get the tab width from blessed's screen config (same as original).
 */
function getTabWidth(unicode: any): number {
  try {
    if (!unicode.blessed) unicode.blessed = require("blessed");
    return unicode.blessed?.screen?.global?.tabc?.length ?? 8;
  } catch {
    return 8;
  }
}

function makePatchedCharWidth(unicode: any) {
  return function patchedCharWidth(str: string | number, i?: number): number {
    const point =
      typeof str !== "number" ? codePointAt(str, i || 0) : str;

    // nul
    if (point === 0) return 0;

    // tab — preserve blessed's original behaviour
    if (point === 0x09) return getTabWidth(unicode);

    // ASCII fast path
    if (point >= 0x20 && point < 0x7f) return 1;

    // Control characters
    if (point < 0x20 || (point >= 0x7f && point < 0xa0)) return 0;

    // Cache lookup
    const cached = widthCache.get(point);
    if (cached !== undefined) return cached;

    // Measure via string-width
    const ch = String.fromCodePoint(point);
    const w = stringWidth(ch);
    widthCache.set(point, w);
    return w;
  };
}

function makePatchedStrWidth(_unicode: any) {
  return function patchedStrWidth(str: string): number {
    // string-width handles ANSI stripping, ZWJ, skin tones, flags, etc.
    return stringWidth(str);
  };
}

function codePointAt(str: string, position: number): number {
  const code = str.charCodeAt(position);
  if (code >= 0xd800 && code <= 0xdbff) {
    const next = str.charCodeAt(position + 1);
    if (next >= 0xdc00 && next <= 0xdfff) {
      return (code - 0xd800) * 0x400 + (next - 0xdc00) + 0x10000;
    }
  }
  return code;
}

// ── chars.all regex patch ───────────────────────────────────────
//
// blessed's chars.wide regex covers CJK/Hangul/fullwidth forms but
// misses many ranges that terminals render as double-width.
// We add the missing BMP ranges. SMP emoji (U+1F000+) are surrogate
// pairs and blessed handles those through chars.swide already — we
// extend that too.

function buildPatchedRegexes() {
  // BMP wide chars — blessed's original PLUS missing ranges
  const bmpWide =
    "\\u1100-\\u115f" + // Hangul Jamo init consonants
    "\\u2329\\u232a" + // angle brackets
    "\\u2600-\\u27bf" + // Misc symbols, Dingbats (includes ☰ trigrams U+2630-2637)
    "\\u2b50-\\u2b55" + // misc symbols
    "\\u2e80-\\u303e\\u3040-\\ua4cf" + // CJK ... Yi
    "\\uac00-\\ud7a3" + // Hangul Syllables
    "\\uf900-\\ufaff" + // CJK Compat Ideographs
    "\\ufe10-\\ufe19" + // Vertical forms
    "\\ufe30-\\ufe6f" + // CJK Compat Forms
    "\\uff00-\\uff60" + // Fullwidth Forms
    "\\uffe0-\\uffe6"; // Fullwidth signs

  // SMP wide chars — blessed's original PLUS emoji ranges
  // Emoji are in SMP and appear as surrogate pairs in JS strings.
  // U+1F000-1FFFF → \uD83C\uDC00 - \uD83F\uDFFF (covers Mahjong, Playing Cards,
  //   Misc Symbols & Pictographs, Emoticons, Transport, Supplemental Symbols)
  // U+20000-2FFFD → \uD840-\uD87F \uDC00-\uDFFF (CJK Unified Ext B+)
  // U+30000-3FFFD → \uD880-\uD8BF \uDC00-\uDFFF (CJK Unified Ext G+)
  const smpWide =
    // Emoji: U+1F000-1FFFF
    "[\\ud83c-\\ud83f][\\udc00-\\udfff]" +
    "|" +
    // Misc Symbols Ext-A, Symbols for Legacy Computing: U+1FA00-1FBFF
    // (already covered by above range)
    // CJK Ext B+: U+20000-2FFFD
    "[\\ud840-\\ud87f][\\udc00-\\udffd]" +
    "|" +
    // CJK Ext G+: U+30000-3FFFD
    "[\\ud880-\\ud8bf][\\udc00-\\udffd]";

  const charsWide = new RegExp("([" + bmpWide + "])", "g");
  const charsSwide = new RegExp("(" + smpWide + ")", "g");
  const charsAll = new RegExp(
    "(" + charsSwide.source.slice(1, -1) + "|" + charsWide.source.slice(1, -1) + ")",
    "g",
  );

  return { charsWide, charsSwide, charsAll };
}

// ── apply ───────────────────────────────────────────────────────

export function patchBlessedUnicode(): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const unicode = require("blessed/lib/unicode");

    // 1. Patch width functions
    unicode.charWidth = makePatchedCharWidth(unicode);
    unicode.strWidth = makePatchedStrWidth(unicode);

    // 2. Patch regexes so parseContent inserts spacers for the same
    //    chars that charWidth now reports as width=2
    const { charsWide, charsSwide, charsAll } = buildPatchedRegexes();
    unicode.chars.wide = charsWide;
    unicode.chars.swide = charsSwide;
    unicode.chars.all = charsAll;
  } catch {
    // If blessed isn't loadable, skip silently
  }
}
