# Page: /resultats

## Purpose
Authenticated patient results viewer. It fetches the patient's lab results from the lab's CyberLab server (via the `fetchResults` Cloud Function) and lets the patient view or download each result PDF. The app is a **viewer only**: results live in memory for the duration of the session and are never persisted (no Firestore, no localStorage, no disk). See `docs/integrations/cyberlab-results-api.md`.

**Two-phase progressive loading** (see `src/contexts/ResultsContext.tsx` §1.1): the **list** is fetched first with `include_pdf: "none"` (~0.2 s, no PDFs) so every dossier renders immediately; then the **most recent** dossier's PDF auto-loads via `dossier_id`, and every other PDF is fetched **on demand** when the patient taps "Voir"/"Télécharger". This is prefetched at login (background), not on page open. This page mostly *consumes* the context and adds the per-card loading animations.

## Directory & File
- **Path:** `src/app/[lang]/resultats/page.tsx`
- **Type:** Client Component (`"use client"`)

## Context & Key Components

### 1. State Management
- `results` + `status` + **per-dossier PDF state** come from **`useResults()`** (the `ResultsContext`), NOT local state (§1.1). `status` (`'idle' | 'loading' | 'ready' | 'empty' | 'error' | 'need_access'`) is the **list** status and drives which block renders; `idle` renders the same loader as `loading`. `need_access` = patient has no `requester_id` yet → self-service access-request card.
- **Per-dossier PDF:** `pdfState(dossierId)` → `PdfState` (`'idle' | 'loading' | 'ready' | 'error'`, `base64?`); `loadPdf(dossierId)` fetches one PDF on demand; `newestDossierId` = the auto-loaded most-recent dossier (badged "Dernier résultat").
- `errorMsg` (string | null): local — used ONLY by the access-request flow now (the results-error block shows a generic translated string directly).
- `viewer` (`{ url: string; dossierId: string } | null`): the currently open PDF viewer; `url` is an in-memory `blob:` URL.
- `accessStatus` (`'checking' | 'none' | 'pending' | 'rejected'`) + `requesting` (bool): drive the access-request card in the `need_access` state.
- **PDF viewer state:** `pdfPages` / `pdfPage` (page nav), `zoom` (1 = fit-to-width; opens at **1.6** = 160%), `containerWidth` (measured, for width-based rendering). See §4b.
- **Year sections state:** `yearOverrides` (`Record<string, boolean>`) — remembers ONLY the sections the user explicitly toggled; every untouched section follows the default rule (most-recent year open). See §4d.

### 1.1 Results prefetch + progressive PDF loading — `src/contexts/ResultsContext.tsx`
- `ResultsProvider` is mounted in `src/app/[lang]/layout.tsx` **inside `AuthProvider`** (it needs `useAuth`). Exposes `{ results, status, pdfState, loadPdf, newestDossierId, ensureLoaded, refresh }` via `useResults()`.
- **Phase 1 — list (`load`):** calls `fetchResults({ include_pdf: 'none' })` → list metadata only (fast, ~0.2 s, `pdf_base64` empty). Sets `results` + `status` (`ready`/`empty`). Same error mapping: `not-found` → `empty`, `failed-precondition` → `need_access`, else `error`.
- **Phase 2 — newest PDF (auto):** right after the list, `load` picks the most recent dossier (`newestOf` = max `date_dossier`) and fires `loadPdf(newest)` in the background.
- **On-demand PDFs (`loadPdf`):** calls `fetchResults({ dossier_id })`, extracts the matching result's `pdf_base64` (matched by id, defensively), stores it in `pdfById[id]`. Idempotent + de-duped via `pdfByIdRef` (sync mirror) + `pdfPromisesRef` (shared in-flight promise); returns the final `PdfState` so the page can await then open the viewer. `ready` results short-circuit (no refetch).
- **Empirical choice (2 calls vs 1):** measured on the real server — `"latest"` in one call ≈ 2.3 s to show anything; `"none"` list ≈ 0.2 s + newest PDF ≈ +2.3 s. Two calls win big on perceived speed (list ~2 s sooner; newest PDF only ~0.2 s later). See `functions/scripts/time-approaches.js`.
- **Background prefetch:** an effect fires `load()` as soon as `user && userProfile?.requester_id && status === 'idle'` — at app open on ANY screen (Firebase restores the session), so list + newest PDF are usually ready before /resultats opens. Only patients with `requester_id` prefetch.
- **Cold-start auto-retry:** on a generic/network error, the *background* load retries up to 2× (4 s, 8 s), guarded by `currentUidRef`. `loadedForUidRef` (set on `ready`/`empty`) de-dupes reloads; `loadingRef` guards concurrent calls; the account-switch effect (keyed on `user?.uid`) resets everything (incl. `resetPdfs`) on login/logout/**account switch**.
- **In-memory only** (React state + refs) — PDF base64 never touches localStorage/IndexedDB/SW. Cleared on logout.

### 2. Authentication Integration (`useAuth`)
- `user`, `loading` (aliased to `authLoading`). Unauthenticated visitors are redirected to `/${lang}/login` (same pattern as `/profile`). While `authLoading || !user`, a bordeaux spinner renders.

### 3. Data type — `src/types/cyberlab.ts` (mirrors the lab API — `functions/src/cyberlab/client.ts`)
`CyberlabResult`: `dossier_id`, `patient_nom`, `patient_prenom`, `date_dossier` (ISO), `etat`, `analyses_summary`, `pdf_base64`. For `type: "patient"`, `patient_nom` / `patient_prenom` come back **empty** (data minimisation), so the UI intentionally does not show them. (Shared by the page AND `ResultsContext`.) `analyses_summary` is a comma-separated list of the lab's terse internal codes (e.g. `"NFS, GLY, HBA1C, U, CR"`), passed through verbatim — see §4c.

### 4d. Checkup reminder — `src/components/features/results/CheckupReminder.tsx`
- Rendered between the page header and the status blocks with `variant="results"` (compact). Same component is on the home page with `variant="home"` — full behavior documented in `docs/pages/home.md` §2.2. (The privacy-reassurance note sits at the very BOTTOM of the page, below all results — owner request.)
- Self-gated: `null` unless linked patient (`userProfile.requester_id`) + `status === 'ready'` + newest bilan **≥ 6 full months** old. Bilan date = `date_dossier` of `newestDossierId` (NOT `lastUpdated`). Pure helper `monthsSince()` exported for testing.
- i18n keys `resultats.checkup_*` in both `common.json` files (fr `_one/_other` plurals, ar 6-form CLDR). CTAs → `/{lang}/rendez-vous` (primary) and `/{lang}/analyses?tab=bilans`.

### 4c. "Détails des analyses" (code → name) — `src/components/features/results/AnalysesDetails.tsx`
- Per result card, `analyses_summary` is rendered as a **collapsed** "Détails des analyses (N)" toggle. On first expand it **lazy-loads** the analyses catalog (Firestore `analyses`, ~324 docs) via `src/lib/analyses/catalog.ts` and lists each code resolved to its patient-facing name; unknown codes are shown **as-is**.
- **Code matching gotcha:** catalog ids carry a category prefix (`"H  NFS"`, `"C  GLY"`) but the lab summary sends the **bare** code (`"NFS"`, `"GLY"`). `buildCodeMap` indexes both the full normalized id (`HNFS`) and the prefix-stripped bare code (`NFS`); a bare code shared by ≥2 analyses is **ambiguous → dropped** (show the raw code rather than risk a wrong medical name). No fuzzy/tag matching for the same reason (so e.g. `HBA1C` vs catalog `HBA1` stays a code).
- The catalog loader (`loadAnalysesCatalog`) caches at module scope + de-dupes in-flight; it's a SEPARATE cache from the analyses page's (acceptable — small, public data).

### 4. Key handlers / derived logic
- Fetching lives in `ResultsContext` now (§1.1). The page calls `ensureLoaded()` once `!authLoading && user` (idempotent), and `refresh()` from the "Actualiser"/"Réessayer" buttons and after `already_granted`.
- A `useEffect` calls `loadAccessStatus` whenever `status === 'need_access'` (the context sets the status; the page owns the access UI).
- **Self-service access** (`need_access`): `loadAccessStatus` (`myAccessRequest` callable) checks if a request is already pending; `handleRequestAccess` (`requestResultsAccess` callable) creates one. The card shows a "Demander l'accès" button or a "pending" badge. Staff activates it from `/admin` (attaches `requester_id`) → `refresh()` then loads results.
- `base64ToPdfBlob`: decodes `pdf_base64` → in-memory `application/pdf` Blob.
- `handleView(r)` / `handleDownload(r)`: **on-demand** — if the dossier's PDF isn't loaded yet, `await loadPdf(r.dossier_id)` first (the card shows a spinner + loading bar), then open the viewer / save. `openViewerWithBase64(dossierId, base64)` builds the blob URL and opens the modal; `closeViewer` closes it. A single `useEffect` keyed on `viewer?.url` revokes the `blob:` URL on change/unmount (no PDF lingers).
- **Per-card UI states** (from `pdfState(r.dossier_id)`): `loading` → indeterminate progress bar + "Chargement du PDF…", buttons disabled with a `Loader2` spinner; `error` → "Échec du chargement" + the second button becomes "Réessayer" (`loadPdf` again); the newest dossier shows a "Dernier résultat" star badge. Cards fade in with a small staggered `resFadeUp` animation.
- `formatDate`: `date_dossier` → localized (`ar-MA` / `fr-FR`) long date; falls back to the raw string if unparseable.

### 4d. Collapsible year sections (the "ready" list)
- The dossiers list is **grouped by year** (from `date_dossier`), rendered as collapsible `<section>`s, most-recent year first. The `grouped` `useMemo` (keyed on `results`) builds `{ years: number[] (desc), byYear: Map<number, CyberlabResult[]>, noDate: CyberlabResult[] }`; **within each year the newest dossier is first** (sorted desc by `date_dossier`).
- **Only years that actually have results get a section** (empty years never render). Results whose `date_dossier` is missing/unparseable go into a **dateless section** labelled `resultats.year_unknown` so **none are ever dropped**; it renders last and is never the default-open one.
- **Default open = the most recent year** (`defaultOpenKey = String(grouped.years[0])`, or `'no-date'` if that's all there is); all other sections start collapsed. The newest dossier (star "Dernier résultat" badge + its auto-loaded PDF) therefore always sits in the section that's open by default.
- **Open/closed logic:** `isSectionOpen(key) = key in yearOverrides ? yearOverrides[key] : key === defaultOpenKey`; `toggleSection` flips the effective value into `yearOverrides`. So a `refresh()` that introduces a newer year re-opens *that* (untouched) year automatically, while any section the user manually opened/closed keeps its choice (override keyed by year string — stale keys for years that vanish are harmless).
- **Collapsed sections don't render their cards** (the card list is behind `isSectionOpen`), so cards fade in (`resFadeUp`, staggered by within-section index) when a year is expanded. PDF prefetch is unaffected — it lives in `ResultsContext`, independent of what's rendered, so the newest PDF still auto-loads even if its section were collapsed.
- Section keys are **strings**: the year (`"2026"`) or the literal `"no-date"`. `formatYear` localizes the header digits (`Intl.NumberFormat` `ar-MA`/`fr-FR`, `useGrouping:false`) so they match the Arabic-Indic/Latin digits of the card dates. Card + section header markup is factored into `renderResultCard(r, index)` / `renderSectionHeader(key, label, count)` (chevron rotates: down=open, `-rotate-90` LTR / `rotate-90` RTL when collapsed).

### 4b. PDF viewer (full-screen modal, `react-pdf`/pdf.js on a `<canvas>`)
- Rendered via **`react-pdf`** (lazy `Document`/`Page`, pdf.js worker from an unpkg CDN URL) — a `<canvas>`, NOT an `<iframe>`, because Android can't inline-render PDFs in an iframe (it only offered an "Open" button).
- **Full-screen** panel (`fixed inset-0`, close ✕ in the header). Toolbar is forced **`dir="ltr"`** so the page-nav arrows ("◀ prev / next ▶") and zoom ("−/+") never look reversed under the Arabic RTL layout.
- **Fit-to-width via the `width` prop** (`(containerWidth-16)*zoom`), NOT `scale`. `zoom = 1` fits the viewer width; opens at **1.6** pinned to the top-left (`pendingScrollRef` applied in `onRenderSuccess`) so the readable left column is visible first.
- **Pinch-zoom / one-finger pan** (`pdfScrollRef` viewport, `pdfWrapRef` page box): non-passive native `touch*` listeners + `touch-action: none` on the surface **and its descendants** (the canvas). During a pinch we scale `pdfWrapRef` with a live CSS `transform` (GPU, anchored at the pinch midpoint) and DO NOT re-render — react-pdf hides the canvas + cancels the render task on every prop change, which made zoom crawl ~1% then stall. On release we commit the real `zoom` (one width-based re-render) and compensate scroll so the focus point stays put.

### 5. Reusable Styles & Assets
- Semantic classes: `.card`, `.button-bordeaux`, `.button-outline`, CSS vars (`--color-bordeaux-primary`, `--background-default`, `--text-*`, `--border-default`, `--status-error`).
- Lucide icons: `FileText`, `Download`, `Eye`, `X`, `RefreshCw`, `Inbox`, `AlertCircle`, `ShieldCheck`, `Loader2`, `Star`, `RotateCw`, `ChevronDown` (year section toggle).
- New i18n keys: `resultats.latest_badge`, `resultats.pdf_loading`, `resultats.pdf_loading_short`, `resultats.pdf_load_error`, `resultats.year_unknown` (dateless section label) — all fr + ar. Year section headers also reuse `resultats.count` for the per-year result count.
- i18n: `useTranslation('common')`, keys under `resultats.*` in `public/locales/{fr,ar}/common.json` (incl. plural `resultats.count`).

## Data Fetching & Mutations
- **Read:** `fetchResults` callable in region `europe-southwest1` (wired via `getClientFunctions` in `src/config/firebase.ts`), invoked from `ResultsContext`. The callable reads `requester_id` + `type` from `users/{uid}` server-side (never from the client) and proxies the signed request to the lab. It now **accepts two optional, validated client params** — `include_pdf` (`"latest" | "none" | "all"`) and `dossier_id` — to drive the two-phase flow (list via `none`, then each PDF via `dossier_id`). Identity still comes only from Firestore. Response carries `Cache-Control: no-store`.
- **Writes:** none. This page never writes to Firestore/Storage.

## Notes for AI
- **Never persist results.** Do not add caching, localStorage, Firestore writes, or file writes for results/PDFs. Keep them in memory and revoke blob URLs on close.
- **Access is granted, not seeded.** A patient without `requester_id` gets the `need_access` card and requests access (`requestResultsAccess`); staff activates it from `/admin` (`docs/pages/admin.md`). Local shortcut still exists: `functions/scripts/seed-requester.js <email> [requester_id] [type]`.
- **Dev wiring:** callable → local emulator when `NEXT_PUBLIC_USE_FUNCTIONS_EMULATOR=true` (root `.env.local`; forced `false` for prod builds via `.env.production.local`). Emulator needs `NODE_OPTIONS=--use-system-ca` + `GOOGLE_APPLICATION_CREDENTIALS`. **In prod, gen2 callables MUST have `allUsers` Cloud Run invoker** or the browser gets a CORS/403 (set via the Cloud Run IAM API — firebase deploy did not always apply it).
- **Flagship entry points:** Résultats is promoted as the star feature — it sits in the **2nd nav slot** (right after Accueil) in the desktop header, mobile hamburger, and `BottomNav`, each with a fuchsia marker; and the home page opens with a full **fuchsia `ServicesHub` banner** → `/resultats` (see `docs/pages/home.md` §2.1). i18n for the banner: `resultats.home_highlight_*` + `services_hub.*`.
- **Perf — DONE (two-phase):** the list-then-PDF-on-demand flow is implemented (server params `include_pdf` + `dossier_id` verified against the real server — see `docs/integrations/cyberlab-results-api.md` §9.1 and `test-results.md` group E). The list shows in ~0.2 s; the newest PDF auto-loads; others load on tap. Do NOT revert to fetching all PDFs inline. Keep everything in-memory only.
- **Backward-compat note:** omitting `include_pdf`/`dossier_id` still returns all PDFs (`"all"`), so old callers keep working. `loadPdf` matches the returned result **by `dossier_id`** (not `results[0]`) to stay correct even if a server/build returns the full list.
- **Prefetch is opt-in by access:** only patients with `requester_id` prefetch. If you change the gate, do NOT prefetch for users without access (avoids failing calls at every login).
