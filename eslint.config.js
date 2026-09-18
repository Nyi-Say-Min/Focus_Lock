import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(
  {
    ignores: [
      "node_modules/**",
      "out/**",
      "dist/**",
      "coverage/**",
      "**/*.config.*.mjs",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: [
      "*.js",
      "*.ts",
      "scripts/**/*.mjs",
      "src/main/**/*.ts",
      "src/preload/**/*.ts",
    ],
    languageOptions: { globals: globals.node },
  },
  {
    files: ["src/renderer/**/*.{ts,tsx}", "tests/**/*.test.tsx"],
    languageOptions: { globals: globals.browser },
  },
);
