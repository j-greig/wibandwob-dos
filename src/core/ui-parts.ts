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
/** @deprecated Use createStatusBar from composition-helpers (SDK @public) */
export { createLayoutStatusBar as createStatusBar } from "../ui/chrome.js";
/** @deprecated Use createButtonBar from composition-helpers (SDK @public) */
export { createLayoutButtonBar as createButtonBar } from "../ui/chrome.js";
/** @deprecated Use createHeaderBar from composition-helpers (SDK @public) */
export { createLayoutHeaderBar as createHeaderBar } from "../ui/chrome.js";
/** @deprecated Use createRule from composition-helpers (SDK @public) */
export { createLayoutRule as createRule } from "../ui/chrome.js";
/** @deprecated Use createInputLine from composition-helpers (SDK @public) */
export { createLayoutInputLine as createInputLine } from "../ui/chrome.js";
/** @deprecated Use createTabs from composition-helpers (SDK @public) */
export { createLayoutTabs as createTabs } from "../ui/containers.js";
// TabDef kept as original name in containers.ts — no alias needed
