import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // Les bancs d'essai de `scripts/` sont des scripts Node en CommonJS,
    // lancés à la main (`npm run test:journey`, `test:pwa`, …). Ils ne font pas
    // partie du bundle Next, et `require()` y est la forme correcte — la règle
    // `no-require-imports` de la configuration TypeScript les signalait tous,
    // un bruit permanent qui finit par masquer les vraies erreurs.
    files: ["scripts/**/*.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
];

export default eslintConfig;
