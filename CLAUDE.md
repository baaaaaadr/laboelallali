# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Laboelallali is a Next.js 16 App Router PWA for a medical lab (Laboratoire El Allali), French-primary with Arabic/RTL, deployed on Firebase (framework-aware Hosting + a separate classic Cloud Functions codebase in `functions/`).

## Communication avec le propriétaire (IMPORTANT — lire en premier)

Le propriétaire de ce projet **n'est pas développeur**. Adapte-toi à lui :

- **Parle en français**, clairement et en résumé. Va à l'essentiel, évite le jargon ; quand un terme technique est indispensable, explique-le en une phrase simple.
- **Minimise les manipulations manuelles.** Ne lui demande de faire à la main que le **strict nécessaire** — c.-à-d. uniquement ce que Claude ne peut pas faire lui-même (ex. : saisir un secret, valider un paiement, cliquer dans une interface externe). Regroupe ces demandes et donne des étapes numérotées, précises.
- **Fais tout ce que tu peux toi-même.** Le budget de tokens Claude est large : privilégie l'automatisation complète (écrire/modifier les fichiers, lancer les commandes, corriger, tester, documenter) plutôt que de déléguer des étapes au propriétaire. En cas de doute, agis puis résume ce que tu as fait — ne renvoie pas le travail à l'utilisateur.

## Source-of-Truth Documents (read these; they are authoritative)

- **`SPEC.md`** — product scope. In-scope: i18n (fr/ar RTL), GLABO home sampling, appointment booking, analysis catalog + cost estimate, installable PWA, contact/map, dark mode, **and the CyberLab results viewer bridge** (a newer backend addition, live in `functions/`). Historically-out-of-scope items in `SPEC.md` (patient results, payment gateways, backend CMS) predate the CyberLab bridge — when a task conflicts with `SPEC.md`, warn and confirm before acting.
- **`DESIGN.md`** — brand/design system (Bordeaux primary, Fuchsia accent, semantic classes, dark mode never pure black). Caveat below: it references `globals.css` and Tailwind utilities that no longer exist.
- **`AGENTS.md`** — engineering conventions and git/deploy workflow.
- `.cursorrules` / `.windsurfrules` — older mirrors; where they disagree with `AGENTS.md`/this file, the newer files win.

## Mandatory Conventions (do not skip)

1. **`/docs/pages/[page].md` documentation protocol** (most-emphasized rule):
   - At the start of a session, read every `.md` in `docs/pages/` before the first task (`analyses`, `contact`, `glabo`, `home`, `login`, `medecins`, `profile`, `rendez-vous`). These are the AI-optimized source of truth per page.
   - **Read-before-edit:** before editing any `src/app/[lang]/<page>/`, read the matching `docs/pages/<page>.md`.
   - **Update-after-change:** if you changed a page's structure/components/state/props/business logic, update its `docs/pages/<page>.md` BEFORE declaring the task done. "An undocumented change is an incomplete change." Docs must be self-sufficient (purpose, components + file paths, state vars, key handlers/derived state, data fetch/mutation, non-obvious gotchas) — no "see the code" stubs. (`PLANNING.md` and `WORKFLOW.md` are empty; ignore them.)
2. **No hardcoded user-facing strings.** All UI text goes through i18next: `useTranslation(ns)` / `t()`. Add every key to BOTH `public/locales/fr/<ns>.json` AND `public/locales/ar/<ns>.json`. Key convention: `component.section.key`.
3. **Prefer semantic CSS classes** (`.button-bordeaux`, `.button-fuchsia`, `.btn-*`, `.card`) over ad-hoc Tailwind for buttons/cards/inputs. Colors come from CSS variables only — never raw hex, never vanilla Tailwind color utilities. See the design-system caveats below (the real files are in `src/styles/`, not `globals.css`).
4. Default to Server Components; add `"use client"` only for interactivity/hooks/DOM. Functional components only. Never commit secrets — use `.env.local` / `.env.example` placeholders.

## Commands

There is **no root `test` script** and no automated test suite/CI (see Testing). The deploy scripts are plain `npm run build && firebase deploy ...` (no shell-specific prefix), so they run the same under cmd.exe, PowerShell, or bash. **History/gotcha:** they used to prepend `set NODE_OPTIONS=--use-system-ca && ...` (for firebase-tools TLS behind an SSL-inspecting proxy). That flag is **forbidden in `NODE_OPTIONS` for Turbopack workers** on Node ≥ 24, so `next build` crashed with `ERR_WORKER_INVALID_EXEC_ARGV`. It was removed (Firebase deploys fine without it here). If a machine behind a MITM proxy ever needs a custom CA, use `NODE_EXTRA_CA_CERTS=<path-to-ca.pem>` (worker-safe), never `--use-system-ca`.

Root (`package.json`):
- `npm run dev` — `next dev`. PWA is disabled in dev unless `NEXT_PUBLIC_ENABLE_PWA_DEV=true`.
- `npm run build` — `next build`. `prebuild` (`node scripts/copy-sw.js`) and `postbuild` (`next-sitemap`) run automatically. Note: `next.config.js` sets `typescript.ignoreBuildErrors: true`, so `next build` does NOT fail on TS errors (worked around i18next type recursion). Run `npx tsc --noEmit` manually if you need type checking.
- `npm run lint` — `next lint` (flat `eslint.config.mjs`, extends `next/core-web-vitals` + `next/typescript`).
- `npm run deploy` — build + `firebase deploy` (hosting + functions + firestore rules/indexes + storage). Prefer the narrower variants.
- `npm run deploy:hosting` — build + `firebase deploy --only hosting` (preferred; avoids functions build failures). **This also (re)deploys the framework SSR Cloud Function `ssrlaboelallalipwa` (europe-west1)** — `firebase deploy` rebuilds the Next app itself via web-frameworks, so the `npm run build` prefix mainly exists to run `prebuild` (copy-sw) + `postbuild` (sitemap). **`next.config.js` sets `output: 'standalone'`** so that SSR function ships a traced ~13 MB bundle (was ~580 MB — full `node_modules` + the 842 MB `.next/dev` Turbopack cache — which made Cloud Build exceed the 25-min deploy timeout: `Task index 0 failed: timed out after 1500000ms`). Do NOT remove `output: 'standalone'`.
- `npm run deploy:functions` — `firebase deploy --only functions` (no local build; Firebase builds functions via their own `tsc`).
- `npm run generate:css-vars` — regenerates `src/styles/system/variables.css` from theme tokens (auto-generated file, do not edit by hand).
- `npm run docs:concat` — `node scripts/concat-docs.js`: concatenates `SPEC.md` + `DESIGN.md` + `AGENTS.md` + `docs/pages/*.md` into `docs/FULL_CONTEXT.md` for pasting into external AIs.
- `npm run git` — `git add . && git commit -m "update" && git push` (quick push, fixed message).
- `npm run context` — runs `generate_context.ps1` (PowerShell).

Functions (`cd functions`; Node 20, CommonJS, `main: lib/index.js`):
- `npm run build` — `tsc` → `lib/`. `npm run build:watch` — `tsc --watch`.
- `npm run lint` — `eslint .`. `npm run serve` — build + `firebase emulators:start --only functions`. `npm run logs` — `firebase functions:log`.

CyberLab test battery (from `functions/`, Node built-ins only, no test runner — run manually; requires `npm run build` first so `lib/` exists):
- Mock server: `node scripts/mock-cyberlab-server.js` (listens on `http://127.0.0.1:3001`).
- Full battery vs mock: `node scripts/test-battery.js http://127.0.0.1:3001 mock`.
- Battery vs real server: `node scripts/test-battery.js https://real.example.com real`.
- Regenerate report only (no requests): `node scripts/test-battery.js --report` (writes `docs/integrations/test-results.md`).
- End-to-end core against prod Firestore (real `fetchResultsForUser`, no callable/auth): `node scripts/call-fetch-results.js <uid>` (needs `.secret.local`, `.env`, and Firestore creds via `GOOGLE_APPLICATION_CREDENTIALS` or `gcloud auth application-default login`; default project `labo-el-allali-pwa`).

**Testing:** no `test` script anywhere. `playwright` is a devDependency but is used only for ad-hoc manual browser drivers at repo root (`test-map.js`, `test-map-fixed.js`, `simple-map-test.js`, run via `node <file>` against `localhost:3003`), not a test runner. There are no `*.test.*`/`*.spec.*` files. "Running a single test" means invoking one of these scripts or the CyberLab battery directly.

**Windows shell:** propose PowerShell-native cmdlets (`Remove-Item -Recurse -Force`, `New-Item -ItemType Directory -Force`, `Get-ChildItem`), not Unix equivalents — but remember the npm deploy scripts themselves run under cmd.exe.

## Architecture

### App Router + `[lang]` i18n
- **Two-tier layout nesting.** `src/app/layout.tsx` is the langless root (`<html suppressHydrationWarning>`, PWA/RTL `<head>` helpers, splash). All localized routes live under `src/app/[lang]/`, whose `layout.tsx` renders a nested `<div lang dir>` (NOT a second `<html>`/`<body>`) and mounts all chrome + providers. Routes are flat under `[lang]/`: home `page.tsx`, `analyses`, `rendez-vous`, `profile`, `contact`, `glabo`, `login`, `medecins`.
- `generateStaticParams()` pre-generates `fr` and `ar`. Despite `i18n.ts` comments, `output: 'export'` is NOT set — a real `src/middleware.ts` and `/api/send-appointment` route ship, so this is a server/hybrid build deployed on Firebase.
- **Next 16 / React 19 `params` is a Promise**, handled inconsistently: server pages `await params`; `profile/page.tsx` uses `use(params)`; `analyses`/`rendez-vous` resolve it in client effects behind a `MedicalLoader` gate. Match the surrounding page's pattern.
- **i18n config source of truth: `i18n.ts`** — `supportedLngs=['fr','ar']`, `fallbackLng='ar'`, `defaultNS='common'`, cookie `laboelallali-i18next-lng`. Runtime uses `i18next` + `react-i18next` + `i18next-resources-to-backend` (NOT `next-i18next` at runtime — it's only referenced by `src/types/next-i18next.d.ts` for typing).
- **Translations load TWICE via two mechanisms.** Server: `[lang]/layout.tsx` `initServerI18next()` builds a fresh per-request instance from static `import()` of `public/locales/${lang}/${ns}.json` (bundled) and passes `resources` into the client provider. Client: `src/components/providers/TranslationsProvider.tsx` builds ANOTHER instance and `fetch`es missing namespaces from `/locales/...` at runtime. **Neither uses a singleton — the client instance is created once per component mount (wrapped in `useRef`), and `initServerI18next` builds one per request; do not switch to the default `i18next` export.** A new namespace must be added to BOTH the `initServerI18next` array AND the `<TranslationsProvider namespaces={...}>` prop (both hardcode `['common','appointment','glabo','catalog']`); miss one and it silently falls back. Namespace files: `public/locales/{fr,ar}/{common,appointment,catalog,glabo}.json`.
- **Middleware** (`src/middleware.ts`): passes through locale-prefixed paths; otherwise detects language from the cookie only (Accept-Language detection is commented out — default is always `ar`), 302-redirects to `/{lng}{path}`, sets the cookie, and rewrites `*/manifest.json` → `/manifest.json`. Its `matcher` excludes `api|_next/*|images|assets|favicon.ico|sw.js|locales|manifest.json` and any path with a file extension — new top-level asset dirs would otherwise get locale-redirected. Known inconsistencies: `TranslationsProvider` hardcodes `fallbackLng:'fr'` (vs `'ar'` elsewhere); the Header language switcher only `router.push`es and never updates the cookie, so a stale cookie can win on a later prefix-less visit.
- **RTL** is derived from the URL segment only: `dir = lang==='ar' ? 'rtl':'ltr'` on the `[lang]` wrapper. Global RTL CSS is injected by two overlapping client components in the root `<head>` (`src/components/RTLStylesProvider.tsx` styled-jsx, `src/components/RTLAdditionalStyles.tsx` dangerouslySetInnerHTML), both keyed off `[dir="rtl"]`. Page logic also toggles RTL ad-hoc via `isArabic = lang==='ar'`. `suppressHydrationWarning` is intentional at `<html>`/`<body>`/`[lang]` wrapper — preserve it.

### Design system
- **Token flow:** `src/styles/theme.ts` (TS token definitions) and `scripts/generateCSSVariables.js` (run by `npm run generate:css-vars`) together produce `src/styles/system/variables.css` (runtime CSS vars, light + `html.dark`) → consumed by component CSS classes / Tailwind arbitrary values (`bg-[var(--background-default)]`). **Caveat: the generator does NOT import `theme.ts`; it holds its own hardcoded copy of the token values (comment: "Hardcoded theme values (extracted from theme.ts)"). Editing `theme.ts` alone does not change generated output — keep the generator's hardcoded copy in sync with `theme.ts` and re-run the script.** Brand: `--color-bordeaux-primary #800020` / `--brand-primary`; `--color-fuchsia-accent #FF4081` / `--brand-accent`. Dark mode (`darkMode:'class'`, Tailwind v4 `@custom-variant dark`) remaps semantic tokens and overrides brand (bordeaux → pink `#FF79A8`, base bg `#1A0F12`, never pure black).
- **Entry point is `src/styles/index.css`** (imported by both layouts). Import order: fonts/leaflet → `@import "tailwindcss"` → `system/variables.css` → `base/{reset,typography}.css` → `components/{cards,navigation,buttons}.css` → `utilities/*` → `base.css`. Tailwind v4 is PostCSS-only (`@tailwindcss/postcss`); `tailwind.config.js` `theme.extend` is empty.
- **Why dedicated CSS classes for interactive elements:** Tailwind v4 form normalization breaks utilities on buttons/inputs, so use the semantic classes in `src/styles/components/buttons.css` / `cards.css`. Layout/spacing/responsive still use Tailwind utilities. See `docs/CSS_ARCHITECTURE_GUIDE.md`.
- **Design-system caveats (docs are stale here):**
  - `src/app/globals.css` is ORPHANED — nothing imports it (layouts import `src/styles/index.css`). `DESIGN.md`/`AGENTS.md`/`.cursorrules` still point at `globals.css`; when editing real styles, edit `src/styles/*` instead. (`tailwind:build` also still points at the orphaned file.)
  - Tailwind utilities `bg-bordeaux`/`text-bordeaux`/`font-heading`/`font-primary`/`shadow-fuchsia` referenced in `DESIGN.md` and in `src/components/ui/Button.tsx` DO NOT EXIST (no `@theme` block). Only `.bg-bordeaux-custom` and `.shadow-bordeaux` (in `base.css`) exist. Prefer the defined `.button-bordeaux`/`.button-fuchsia`/`.btn-*` classes.
  - `src/components/common/buttons/Button.tsx` and `src/components/common/cards/Card.tsx` are empty (0-line) stubs; `src/components/ui/Button.tsx` is a real 139-line component — but it is imported nowhere either, so all three are effectively unused.
  - `src/components/BaseStyles.tsx` (styled-jsx) injects a second legacy token set (`--primary-bordeaux`, `--accent-fuchsia`) with the same hex — `system/variables.css` is canonical.
  - `base/reset.css` forces `h1,h2 { color: var(--brand-primary) }` and header/hero/footer rules use heavy `!important`; overriding needs higher specificity, not utilities.
- Component taxonomy under `src/components/`: `common/` (reusable primitives), `ui/` (widgets/modals), `features/` (domain, grouped — `catalog/` incl. `cart/`, `home/`, `medecins/`, `pwa/`, `search/`), `layout/` (Header/Footer/BottomNav/MainLayout), `providers/`.

### Client services, Firebase init, contexts
- **`src/config/firebase.ts` is the single init point** (config from `NEXT_PUBLIC_FIREBASE_*`). Firestore `db` is initialized eagerly/synchronously and exported directly; Auth/Storage/Analytics are lazy, browser-only, async via dynamic `import()`. If config is invalid (`isConfigValid` checks apiKey/projectId/appId), `app`/`db` are `null` — **null-check `db`** (AuthContext does; `src/services/medecinsService.ts` does NOT). `storage` is a mutable `let` filled by a floating promise, so direct `storage` imports can race and be null on first use.
- **Only two contexts, wired in `src/app/[lang]/layout.tsx`:** `ThemeProvider` → `TranslationsProvider` → `AuthProvider` (+ `ToastProvider`). `AuthContext` wraps `onAuthStateChanged`, loads `users/{uid}` UserProfile. `ThemeContext` persists `localStorage['theme']`. There is **no global cart context**.
- **Cart** (`src/lib/cart/`) is pure functions; state is local `useState<CartItem[]>` in `src/app/[lang]/analyses/page.tsx`, persisted to localStorage behind an `isFirstLoad` race guard. Pricing source of truth is `cartView.ts` `computeCartView(items, map, samplingFee=20)`: first non-excluded occurrence of a code owns it; later duplicates priced 0; total adds the 20 MAD sampling fee once. `cartItem.ts` `normalizeCode` is the single code-normalization source. `usePreparationRules.ts` computes fasting/turnaround/sample-type constraints.
- **Firestore usage** is read-heavy client-side: `medecinsService.ts` fetches the whole `medecins` collection and filters/derives facets client-side. Storage writes (prescriptions → `ordonnances/${Date.now()}-${name}`) happen inline in `rendez-vous/page.tsx` and `glabo/page.tsx`, not in a service.
- **PDF/QR:** `src/lib/pdf/generateDevisPdf.ts` (dynamic `jspdf`+`qrcode`, hand-drawn A4 quote) re-implements duplicate detection independently from `computeCartView` — **keep the two in sync**. `useCartPdfHandler.ts` gates download behind auth (redirect to `/login`) and pulls patient name/phone from `userProfile`. A separate `react-pdf` system in `src/components/ui/MultiFileUploader.tsx` sets its pdf.js worker to an unpkg CDN URL.
- **Appointment email API** `src/app/api/send-appointment/route.ts` (Node, nodemailer): builds a French HTML email, hardcodes three CC Gmail addresses, and if `SMTP_USER`/`SMTP_PASS` are unset returns a simulated success. It interpolates patient fields/URLs into HTML without escaping — treat as injection-prone; escape any new interpolated user input.
- Known inconsistency: three different lab-hours definitions exist (`src/utils/timeSlots.ts`, `src/hooks/useLabStatus.ts`, `contact.ts`); two overlapping PWA-install hooks (`usePWAInstall.ts`, `useInstallPrompt.ts`).

### Firebase Functions + CyberLab HMAC results bridge
Separate codebase in `functions/` (region `europe-southwest1`; note `firebase.json` `frameworksBackend.region` is `europe-west1` — a real region mismatch). Exports in `functions/src/index.ts`:
- `nextServer` (`onRequest`) — SSR Next handler (alongside the frameworks backend).
- `cleanupExpiredPrescriptions` (`onSchedule` daily 02:00 Europe/Paris) — deletes prescription files past 30-day `expiresAt`. (Defined but not currently deployed.)
- `fetchResults` (`onCall`) — the CyberLab bridge (from `functions/src/cyberlab/fetchResults.ts`).
- The admin/results-access callables from `functions/src/admin/adminPatients.ts` (`adminSetRequester`, `requestResultsAccess`, …).
- **Email note:** appointment notifications are sent by the Next.js API route (`src/app/api/send-appointment/route.ts`, nodemailer + Gmail SMTP), NOT by a Cloud Function. The old SendGrid `sendAppointmentRequestEmail` trigger was unused (never deployed) and has been **removed**.

**CyberLab bridge is viewer-only for RESULTS:** results are fetched on demand and returned verbatim to the client — never written to Firestore, never logged, `Cache-Control: no-store`. The one thing it does persist is a usage stamp on the caller's own profile (`users/{uid}.lastResultsAt`, list fetch only, throttled 6 h, best-effort) — a date, never a result — which powers the admin dashboard's "suivi d'utilisation" and is declared in the privacy policy. Flow: reject unauthenticated; take `uid` from auth; read `users/{uid}` and take `requester_id` + `type ∈ {patient,medecin,correspondant}` **exclusively from the profile (never from client input — anti-spoof)**; call `callCyberlab`. The callable also accepts two **validated, optional** client params — `include_pdf` (`latest|none|all`) and `dossier_id` — to drive the two-phase progressive loading (list first, PDFs on demand). Every failure maps to a generic French `HttpsError`; only `kind`/`status` is logged, never the response body (may contain medical data).

**Transport/HMAC** (`functions/src/cyberlab/client.ts`, Firebase-free/unit-testable): `POST {apiUrl}/api/v1/results`, 20s timeout. Body is `JSON.stringify({type, requester_id, max_results})` serialized ONCE and both signed and sent. Headers: `Authorization: Bearer <apiKey>`, `X-Timestamp` (integer Unix seconds), `X-Nonce` (UUID v4), `X-Signature = HMAC-SHA256(hmacSecret, "{timestamp}.{nonce}.{body}")` lowercase hex. **Critical pitfall (`docs/integrations/hmac-signature-notes.md`): the server must verify over the RAW body — re-serializing with `JSON.stringify(req.body)` changes key order/whitespace/escaping and yields 401.** Config: `CYBERLAB_API_URL` via `defineString` (non-secret, in gitignored `functions/.env`, local default `http://127.0.0.1:3001`); `CYBERLAB_API_KEY` + `CYBERLAB_HMAC_SECRET` via `defineSecret` (prod: `firebase functions:secrets:set ...`; local/scripts: gitignored `functions/.secret.local`, which also accepts short aliases `API_KEY`/`HMAC_SECRET`). Reference docs: `docs/integrations/{cyberlab-results-api.md,hmac-signature-notes.md,test-results.md}`.

### PWA / service-worker pipeline
- `next-pwa` v5 wraps `next.config.js` (`dest:'public'`, `register`, `skipWaiting`, disabled in dev unless `NEXT_PUBLIC_ENABLE_PWA_DEV=true`).
- **The intended registered worker is the hand-written `src/lib/sw.js`** (`CACHE_NAME='laboelallali-v3'`, offline fallback `/offline.html`; network-first for navigations, cache-first for static, explicitly skips `/_next/` chunks to avoid hydration mismatches). `scripts/copy-sw.js` copies it to `public/sw.js` in the `prebuild` hook. Note: next-pwa's Workbox output also targets `public/sw.js`, so the two can collide — the custom `src/lib/sw.js` is authoritative.
- `next.config.js` `headers()` serves `/sw.js` with `no-cache, no-store, must-revalidate` + `Service-Worker-Allowed: /`, plus global security headers. Manifest: `public/manifest.json` (standalone, `theme_color #800020`).
- Deploy targets: framework-aware Hosting (SSR via Firebase web-frameworks, no static export), the `functions/` codebase, `firestore.rules` + `firestore.indexes.json` (4 composite indexes), `storage.rules`. Project `labo-el-allali-pwa` (`.firebaserc`). `next-sitemap.config.js` `siteUrl` defaults to a stale Vercel URL unless `NEXT_PUBLIC_SITE_URL` is set.
