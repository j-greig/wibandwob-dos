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
