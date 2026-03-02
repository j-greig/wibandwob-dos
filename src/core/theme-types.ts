/**
 * Semantic theme tokens for the app.
 *
 * Every colour used in the app should map to one of these roles.
 * No window or service should use raw blessed colour strings as the source of truth.
 */

export type AppearanceMode = "system" | "light" | "dark";

/** A blessed-compatible style pair. */
export interface StylePair {
  fg: string;
  bg: string;
}

/** Full semantic token set for one theme variant. */
export interface ThemeTokens {
  // Desktop shell
  desktop: StylePair;
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

  // Content areas
  body: StylePair;
  bodyAlt: StylePair;
  header: StylePair;
  footer: StylePair;

  // Interactive
  selected: StylePair;
  input: StylePair;
  scrollbar: { fg: string; bg: string; track: string };

  // Semantic
  accent: StylePair;
  warning: StylePair;
  error: StylePair;
  success: StylePair;
  muted: StylePair;
}

/** A named theme variant. */
export interface ThemeVariant {
  name: string;
  tokens: ThemeTokens;
}
