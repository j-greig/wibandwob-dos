/**
 * Strip ANSI escape sequences and blessed rendering artefacts from text.
 *
 * Two levels:
 *   stripAnsi()         — remove all ANSI/VT escape sequences
 *   stripBlessedChrome() — also replace Unicode box-drawing and block chars
 *                          with ASCII equivalents or spaces
 */

// Comprehensive ANSI escape pattern:
//   CSI (ESC[) sequences  — colours, cursor, erase, scroll, etc.
//   OSC (ESC]) sequences  — title, hyperlinks, etc. (terminated by BEL or ST)
//   ESC followed by single char (RIS, DECSC, etc.)
//   ESC followed by ( or ) and a char (charset select)
const ANSI_RE = /\x1b(?:\[[0-9;?]*[ -/]*[A-Za-z@`]|\][^\x07\x1b]*(?:\x07|\x1b\\)?|[()][A-B012]|[A-Za-z=<>78])/g;

// Stray control chars that might leak through (except \n \t)
const CONTROL_RE = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g;

/**
 * Strip all ANSI/VT escape sequences. Returns plain text with \n preserved.
 */
export function stripAnsi(text: string): string {
  return text.replace(ANSI_RE, "").replace(CONTROL_RE, "");
}

// ── Unicode block / box-drawing replacement ──────────────────────────────────

// Box-drawing chars (U+2500–U+257F) → ASCII equivalents
const BOX_MAP: Record<string, string> = {
  // horizontals
  "\u2500": "-", "\u2501": "-", "\u2502": "|", "\u2503": "|",
  "\u2504": "-", "\u2505": "-", "\u2506": "|", "\u2507": "|",
  "\u2508": "-", "\u2509": "-", "\u250A": "|", "\u250B": "|",
  // corners
  "\u250C": "+", "\u250D": "+", "\u250E": "+", "\u250F": "+",
  "\u2510": "+", "\u2511": "+", "\u2512": "+", "\u2513": "+",
  "\u2514": "+", "\u2515": "+", "\u2516": "+", "\u2517": "+",
  "\u2518": "+", "\u2519": "+", "\u251A": "+", "\u251B": "+",
  // tees
  "\u251C": "+", "\u251D": "+", "\u251E": "+", "\u251F": "+",
  "\u2520": "+", "\u2521": "+", "\u2522": "+", "\u2523": "+",
  "\u2524": "+", "\u2525": "+", "\u2526": "+", "\u2527": "+",
  "\u2528": "+", "\u2529": "+", "\u252A": "+", "\u252B": "+",
  // crosses
  "\u252C": "+", "\u252D": "+", "\u252E": "+", "\u252F": "+",
  "\u2530": "+", "\u2531": "+", "\u2532": "+", "\u2533": "+",
  "\u2534": "+", "\u2535": "+", "\u2536": "+", "\u2537": "+",
  "\u2538": "+", "\u2539": "+", "\u253A": "+", "\u253B": "+",
  "\u253C": "+", "\u253D": "+", "\u253E": "+", "\u253F": "+",
  "\u2540": "+", "\u2541": "+", "\u2542": "+", "\u2543": "+",
  "\u2544": "+", "\u2545": "+", "\u2546": "+", "\u2547": "+",
  "\u2548": "+", "\u2549": "+", "\u254A": "+", "\u254B": "+",
  // double lines
  "\u2550": "=", "\u2551": "|", "\u2552": "+", "\u2553": "+",
  "\u2554": "+", "\u2555": "+", "\u2556": "+", "\u2557": "+",
  "\u2558": "+", "\u2559": "+", "\u255A": "+", "\u255B": "+",
  "\u255C": "+", "\u255D": "+", "\u255E": "+", "\u255F": "+",
  "\u2560": "+", "\u2561": "+", "\u2562": "+", "\u2563": "+",
  "\u2564": "+", "\u2565": "+", "\u2566": "+", "\u2567": "+",
  "\u2568": "+", "\u2569": "+", "\u256A": "+", "\u256B": "+",
  "\u256C": "+",
  // arcs and diagonals (U+256D–U+2572)
  "\u256D": "+", "\u256E": "+", "\u256F": "+", "\u2570": "+",
  "\u2571": "/", "\u2572": "\\",
};

// Block elements (U+2580–U+259F) — shading / half-blocks → space
// These are purely visual fill in blessed and carry no semantic content.
const BLOCK_RE = /[\u2580-\u259F]/g;

// Braille patterns (U+2800–U+28FF) — sometimes used for dot-matrix rendering
const BRAILLE_RE = /[\u2800-\u28FF]/g;

// Private Use Area chars that blessed sometimes emits
const PUA_RE = /[\uE000-\uF8FF]/g;

// Build a single regex for all box-drawing chars
const BOX_CHARS = Object.keys(BOX_MAP).join("");
const BOX_RE = new RegExp(`[${BOX_CHARS}]`, "g");

/**
 * Strip ANSI escapes AND replace blessed chrome characters with ASCII.
 * Best-effort readable output for full-screen captures.
 */
export function stripBlessedChrome(text: string): string {
  let result = stripAnsi(text);
  // Replace box-drawing with ASCII
  result = result.replace(BOX_RE, (ch) => BOX_MAP[ch] ?? "+");
  // Replace block elements, braille, PUA with space
  result = result.replace(BLOCK_RE, " ");
  result = result.replace(BRAILLE_RE, " ");
  result = result.replace(PUA_RE, " ");
  return result;
}
