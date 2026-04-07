import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "no-irregular-whitespace": "off",
    },
  },
  {
    ignores: [
      "dist/",
      "node_modules/",
      "src/routeTree.gen.ts",
      "output/",
      "data/",
      ".agent/",
      ".antigravity/",
      ".claude/",
    ],
  }
);
