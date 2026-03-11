/**
 * eslint.config.js — minimal flat config.
 *
 * Single purpose: enforce SDK import boundary for module authors.
 * Modules must import from microapp-sdk.js, not from src/core/* or
 * src/services/* directly.
 *
 * Run: bun run lint
 * Scope: modules/** only. Does not lint src/ or other directories.
 */
import tsParser from "typescript-eslint";

export default [
  {
    files: ["modules/**/index.ts"],
    languageOptions: {
      parser: tsParser.parser,
    },
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["../../src/core/*", "../../src/core/**"],
              message:
                "Import from ../../src/services/microapp-sdk.js instead. See docs/module-authoring.md.",
            },
            {
              group: [
                "../../src/services/*",
                "../../src/services/**",
                "!../../src/services/microapp-sdk.js",
                "!../../src/services/microapp-sdk",
              ],
              message:
                "Import from ../../src/services/microapp-sdk.js instead. See docs/module-authoring.md.",
            },
          ],
        },
      ],
    },
  },
];
