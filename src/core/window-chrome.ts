import type { WindowKind } from "./types.js";

/** @primitive */
export type ChromeMode = "standard" | "toolbar" | "frameless";

/** @primitive */
export interface ContentSize {
  width: number;
  height: number;
}

/** @primitive */
export interface WindowSize {
  width: number;
  height: number;
}

const CHROME_BY_KIND: Partial<Record<WindowKind, ChromeMode>> = {
  figlet: "toolbar"
};

const CHROME_PADDING: Record<ChromeMode, WindowSize> = {
  standard: { width: 2, height: 2 },
  toolbar: { width: 4, height: 5 },
  frameless: { width: 0, height: 0 }
};

/** @primitive */
export function getChromeModeForWindow(kind: WindowKind): ChromeMode {
  return CHROME_BY_KIND[kind] ?? "standard";
}

/** @primitive */
export function contentToWindowSize(content: ContentSize, chromeMode: ChromeMode): WindowSize {
  const chrome = CHROME_PADDING[chromeMode];
  return {
    width: Math.max(1, content.width + chrome.width),
    height: Math.max(1, content.height + chrome.height)
  };
}
