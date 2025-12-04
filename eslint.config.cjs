const eslintJs = require("@eslint/js");
const globals = require("globals");
const tsParser = require("@typescript-eslint/parser");
const tsPlugin = require("@typescript-eslint/eslint-plugin");
const eslintComments = require("eslint-plugin-eslint-comments");
const sonarjs = require("eslint-plugin-sonarjs");

const tsTypeCheckedRules = tsPlugin.configs["recommended-type-checked"].rules;
const tsStylisticRules = tsPlugin.configs["stylistic-type-checked"].rules;

module.exports = [
  {
    ignores: ["dist", "node_modules"]
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: __dirname,
        sourceType: "module",
        ecmaVersion: "latest"
      },
      globals: { ...globals.node }
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      "eslint-comments": eslintComments,
      sonarjs
    },
    rules: {
      ...eslintJs.configs.recommended.rules,
      ...tsTypeCheckedRules,
      ...tsStylisticRules,
      ...eslintComments.configs.recommended.rules,
      ...sonarjs.configs.recommended.rules,
      "@typescript-eslint/ban-ts-comment": [
        "error",
        { "ts-expect-error": true, "ts-ignore": true, "ts-nocheck": true, "ts-check": false }
      ],
      "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports" }],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "complexity": ["warn", 15],
      "eslint-comments/no-use": "error",
      "max-lines": ["warn", { max: 800, skipBlankLines: false, skipComments: false }],
      "max-lines-per-function": ["warn", { max: 80, skipBlankLines: false, skipComments: false }],
      "sonarjs/cognitive-complexity": ["error", 30]
    }
  }
];
