/**
 * Semantic theme tokens for the app.
 *
 * Every colour used in the app should map to one of these roles.
 * No window or service should use raw blessed colour strings as the source of truth.
 */

export type AppearanceMode = "system" | "light" | "dark";

/** A blessed-compatible style pair. */
/** @primitive */
export interface StylePair {
  fg: string;
  bg: string;
}

/** Full semantic token set for one theme variant. */
/** @primitive */
export interface ThemeTokens {
  // Desktop shell
  desktop: StylePair;
  /** Character used to tile the desktop background. Space = flat colour. */
  desktopFillChar: string;
  /** Multi-line tiling pattern for desktop. Overrides desktopFillChar if set. */
  desktopPattern?: string[];
  menuBar: StylePair;
  statusLine: StylePair;

  // Window chrome
  windowFrame: StylePair;
  windowBorderFocused: StylePair;
  windowBorderUnfocused: StylePair;
  titleBarFocused: StylePair;
  titleBarUnfocused: StylePair;
  closeButton: StylePair;
  resizeGrip: StylePair;
  windowShadow: { fg: string; bg: string; char: string };

  // Content areas
  body: StylePair;
  bodyAlt: StylePair;
  /** Background for the Wib&Wob Agent window — distinct from plain body */
  agentBg: StylePair;
  header: StylePair;
  footer: StylePair;

  // Interactive
  selected: StylePair;
  input: StylePair;
  scrollbar: { fg: string; bg: string; track: string };

  // Semantic
  accent: StylePair;
  /** Warm highlight — used for user labels, call-to-action text. Distinct from error. */
  highlight: StylePair;
  warning: StylePair;
  error: StylePair;
  success: StylePair;
  muted: StylePair;
}

/** A named theme variant. */
/** @primitive */
export interface ThemeVariant {
  name: string;
  tokens: ThemeTokens;
}
