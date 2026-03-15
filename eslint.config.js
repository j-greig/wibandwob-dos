/**
 * eslint.config.js — minimal flat config.
 *
 * Single purpose: enforce SDK import boundary for microapp authors.
 * Modules must import from microapp-sdk.js, not from src/core/* or
 * src/services/* directly.
 *
 * Run: bun run lint
 * Scope: microapps/** only. Does not lint src/ or other directories.
 */
import tsParser from "typescript-eslint";

export default [
  {
    files: ["microapps/**/index.ts"],
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
                "Import from ../../src/services/microapp-sdk.js instead. See docs/microapp-authoring.md.",
            },
            {
              group: [
                "../../src/services/*",
                "../../src/services/**",
                "!../../src/services/microapp-sdk.js",
                "!../../src/services/microapp-sdk",
              ],
              message:
                "Import from ../../src/services/microapp-sdk.js instead. See docs/microapp-authoring.md.",
            },
          ],
        },
      ],
    },
  },
];
