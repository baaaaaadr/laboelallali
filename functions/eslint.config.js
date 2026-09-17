/**
 * ESLint flat config for the Cloud Functions codebase.
 *
 * Replaces `eslint.config.cjs`, which was dead: it pulled `google`,
 * `plugin:import/*` and `plugin:@typescript-eslint/*` through `FlatCompat`, and
 * none of those packages are installed any more — so `npm run lint` failed with
 * "couldn't find the config 'google'" instead of linting anything. This config
 * depends only on `typescript-eslint`, which IS a devDependency.
 *
 * **Style rules stay off, on purpose.** The old config disabled `quotes`,
 * `indent`, `max-len` and friends with the comment "relax stylistic rules to
 * prevent deployment failures". That call is preserved here: turning them back on
 * flags ~20 pre-existing lines in files nobody is touching, which is how a lint
 * becomes something people stop running. What is kept is the part that catches
 * real defects — undefined variables, unused bindings, unsafe TypeScript.
 *
 *   npm run lint            # from functions/
 */
const js = require("@eslint/js");
const tseslint = require("typescript-eslint");

/** Node 20 runtime globals. `crypto` is deliberately absent: the scripts all
 *  `require("crypto")` explicitly, and declaring it here makes that a redeclare. */
const NODE_GLOBALS = {
  process: "readonly",
  console: "readonly",
  Buffer: "readonly",
  setTimeout: "readonly",
  clearTimeout: "readonly",
  setInterval: "readonly",
  clearInterval: "readonly",
  performance: "readonly",
  fetch: "readonly",
  AbortController: "readonly",
  AbortSignal: "readonly",
  URL: "readonly",
  URLSearchParams: "readonly",
  TextEncoder: "readonly",
  TextDecoder: "readonly",
  __dirname: "readonly",
  __filename: "readonly",
  module: "writable",
  exports: "writable",
  require: "readonly",
};

module.exports = tseslint.config(
  {
    // Build output, generated files, and this config itself.
    ignores: ["lib/**", "generated/**", "node_modules/**", "eslint.config.js"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: NODE_GLOBALS,
    },
    rules: {
      // Formatting is not this lint's job — see the header.
      quotes: "off",
      indent: "off",
      "max-len": "off",
      "object-curly-spacing": "off",
      "comma-dangle": "off",
      // An empty catch is a deliberate, documented pattern in this codebase:
      // best-effort side effects (usage stamps, alert emails, outage telemetry)
      // must never break a patient's results. Each one carries a comment saying so.
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
  {
    // The hand-run benches and diagnostic scripts are plain CommonJS programs.
    files: ["scripts/**/*.js"],
    languageOptions: { sourceType: "commonjs", globals: NODE_GLOBALS },
    rules: { "@typescript-eslint/no-require-imports": "off" },
  }
);
