/**
 * eslint.config.js — SDK boundary enforcement for microapps.
 *
 * Microapps import from microapp-sdk.js only. No blessed, no src/core/*,
 * no src/services/* directly. Existing violations get eslint-disable
 * comments — new ones are blocked by the pre-commit hook.
 *
 * Run: bun run lint
 * Scope: microapps/
 */
import tsParser from "typescript-eslint";

export default [
  {
    files: ["microapps/**/*.ts"],
    languageOptions: {
      parser: tsParser.parser,
    },
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["blessed", "blessed-contrib"],
              message:
                "Use SDK primitives from microapp-sdk.js. Direct blessed imports are a COAT violation.",
            },
            {
              group: ["../../src/core/*", "../../src/core/**"],
              message:
                "Import from ../../src/services/microapp-sdk.js instead.",
            },
            {
              group: [
                "../../src/services/*",
                "../../src/services/**",
                "!../../src/services/microapp-sdk.js",
                "!../../src/services/microapp-sdk",
              ],
              message:
                "Import from ../../src/services/microapp-sdk.js instead.",
            },
          ],
        },
      ],
    },
  },
];
