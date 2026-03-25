/**
 * Typed argument extraction helpers for command args / payload objects.
 *
 * Eliminates repetitive `typeof args?.x === "string" ? args.x : undefined`
 * guards scattered across app-controller, control-api, and snapshot-registry.
 *
 * §6 Say Things Once — single implementation of safe arg extraction.
 * §9 Guard Clauses — early returns baked into the helper.
 * §29 Narrow First — runtime narrowing, no `as` casts.
 */

type ArgType = "string" | "number" | "boolean";

type ArgTypeMap = {
  string: string;
  number: number;
  boolean: boolean;
};

/**
 * Extract a typed value from a loose args/payload record.
 * Returns `undefined` when the key is missing or has the wrong runtime type.
 *
 * @example
 *   const filePath = typedArg(args, "filePath", "string");
 *   const x = typedArg(args, "x", "number");
 *   const enabled = typedArg(args, "enabled", "boolean");
 */
export function typedArg<T extends ArgType>(
  args: Record<string, unknown> | undefined | null,
  key: string,
  type: T,
): ArgTypeMap[T] | undefined {
  if (!args) return undefined;
  const v = args[key];
  // eslint-disable-next-line valid-typeof
  return typeof v === type ? (v as ArgTypeMap[T]) : undefined;
}

/**
 * Extract a string arg and trim it. Returns `undefined` if absent, wrong type, or blank after trimming.
 *
 * @example
 *   const name = trimmedArg(args, "name"); // string | undefined (always trimmed, never "")
 */
export function trimmedArg(
  args: Record<string, unknown> | undefined | null,
  key: string,
): string | undefined {
  const v = typedArg(args, key, "string");
  if (!v) return undefined;
  const trimmed = v.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Extract a string arg and validate it against an allowed set.
 * Returns `undefined` if the value is not in the allowed set.
 *
 * @example
 *   const mode = enumArg(args, "mode", ["auto", "live", "fake-live"] as const);
 *   // type: "auto" | "live" | "fake-live" | undefined
 */
export function enumArg<const A extends readonly string[]>(
  args: Record<string, unknown> | undefined | null,
  key: string,
  allowed: A,
): A[number] | undefined {
  const v = typedArg(args, key, "string");
  if (!v) return undefined;
  return (allowed as readonly string[]).includes(v) ? (v as A[number]) : undefined;
}

/**
 * Extract a number arg and clamp it to [min, max].
 *
 * @example
 *   const turns = clampedArg(args, "turns", 1, 20) ?? 6;
 */
export function clampedArg(
  args: Record<string, unknown> | undefined | null,
  key: string,
  min: number,
  max: number,
): number | undefined {
  const v = typedArg(args, key, "number");
  if (v === undefined) return undefined;
  return Math.max(min, Math.min(max, v));
}
