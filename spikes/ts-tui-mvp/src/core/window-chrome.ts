import type { WindowKind } from "./types.js";

export type ChromeMode = "standard" | "toolbar" | "frameless";

export interface ContentSize {
  width: number;
  height: number;
}

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

export function getChromeModeForWindow(kind: WindowKind): ChromeMode {
  return CHROME_BY_KIND[kind] ?? "standard";
}

export function contentToWindowSize(content: ContentSize, chromeMode: ChromeMode): WindowSize {
  const chrome = CHROME_PADDING[chromeMode];
  return {
    width: Math.max(1, content.width + chrome.width),
    height: Math.max(1, content.height + chrome.height)
  };
}
