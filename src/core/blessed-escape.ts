/**
 * blessed-escape.ts — Canonical blessed tag escaping.
 *
 * Blessed uses {bold}, {red-fg}, etc as formatting tags. Raw `{` in user
 * content MUST be escaped or blessed crashes with `_attr(...).slice` errors.
 *
 * Single owner for this concern — imported everywhere content is rendered.
 * @primitive
 */

/**
 * Escape `{` so blessed doesn't interpret user text as formatting tags.
 * Use for all user-supplied content passed to setContent/setItems.
 */
export function escapeBlessedTags(s: string): string {
  return s.replace(/\{/g, "\\{");
}
