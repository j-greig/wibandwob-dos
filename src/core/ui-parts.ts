/**
 * ui-parts.ts — Backward-compatible barrel re-export.
 *
 * All UI components now live in src/ui/.
 * This file exists so existing `import { ... } from "./ui-parts.js"` paths
 * continue to work. New code should import from src/ui/ or microapp-sdk.
 *
 * @deprecated Import from "../ui/index.js" or "../../src/services/microapp-sdk.js" instead.
 */
export * from "../ui/index.js";

// Backward-compat aliases — old names still work, new code uses createLayout* or SDK Handle API
export { createLayoutStatusBar as createStatusBar } from "../ui/chrome.js";
export { createLayoutButtonBar as createButtonBar } from "../ui/chrome.js";
