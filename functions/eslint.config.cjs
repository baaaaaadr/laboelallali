// Flat ESLint configuration for Cloud Functions within Firebase (CommonJS)

const { FlatCompat } = require("@eslint/eslintrc");
const js = require("@eslint/js"); // ESLint built-in recommended rules (flat config form)

// Translate classic (eslintrc-style) shareable configs to flat config
const compat = new FlatCompat({
  baseDirectory: __dirname,
});

module.exports = [
  // 1) ESLint's own recommended rule set
  js.configs.recommended,

  // 2) Legacy configs converted via FlatCompat
  ...compat.extends(
    "plugin:import/errors",
    "plugin:import/warnings",
    "plugin:import/typescript",
    "google",
    "plugin:@typescript-eslint/recommended"
  ),

  // 3) Project overrides for Functions source
  {
    files: ["src/**/*.ts", "src/**/*.js"],
    languageOptions: {
      parser: require("@typescript-eslint/parser"),
      parserOptions: {
        project: ["./tsconfig.json", "./tsconfig.dev.json"],
        sourceType: "module",
      },
      ecmaVersion: 2020,
    },
    plugins: {
      "@typescript-eslint": require("@typescript-eslint/eslint-plugin"),
      import: require("eslint-plugin-import"),
    },
    rules: {
      // --- Relax stylistic rules to prevent deployment failures ---
      quotes: ["error", "double", { avoidEscape: true }],
      indent: "off",
      "max-len": "off",
      "object-curly-spacing": "off",
      "comma-dangle": "off",
      "no-multi-spaces": "off",
      "import/no-unresolved": "off",
    },
  },

  // 4) Ignore generated / compiled output and config files
  {
    ignores: ["lib/**/*", "generated/**/*", ".eslintrc.js", "eslint.config.cjs"],
  },
];
