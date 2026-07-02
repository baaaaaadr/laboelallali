# Page: /resultats

## Purpose
Authenticated patient results viewer. It fetches the patient's lab results from the lab's CyberLab server (via the `fetchResults` Cloud Function) and lets the patient view or download each result PDF. The app is a **viewer only**: results live in memory for the duration of the session and are never persisted (no Firestore, no localStorage, no disk). See `docs/integrations/cyberlab-results-api.md`.

**Results are prefetched at login** (background), not on page open — see `src/contexts/ResultsContext.tsx` (§1.1). This page mostly *consumes* that context.

## Directory & File
- **Path:** `src/app/[lang]/resultats/page.tsx`
- **Type:** Client Component (`"use client"`)

## Context & Key Components

### 1. State Management
- `results` + `status` come from **`useResults()`** (the `ResultsContext`), NOT local state (§1.1). `status` (`'idle' | 'loading' | 'ready' | 'empty' | 'error' | 'need_access'`) drives which block renders; `idle` renders the same loader as `loading`. `need_access` = patient has no `requester_id` yet → self-service access-request card.
- `errorMsg` (string | null): local — used ONLY by the access-request flow now (the results-error block shows a generic translated string directly).
- `viewer` (`{ url: string; dossierId: string } | null`): the currently open PDF viewer; `url` is an in-memory `blob:` URL.
- `accessStatus` (`'checking' | 'none' | 'pending' | 'rejected'`) + `requesting` (bool): drive the access-request card in the `need_access` state.
- **PDF viewer state:** `pdfPages` / `pdfPage` (page nav), `zoom` (1 = fit-to-width; opens at **1.6** = 160%), `containerWidth` (measured, for width-based rendering). See §4b.

### 1.1 Results prefetch — `src/contexts/ResultsContext.tsx`
- `ResultsProvider` is mounted in `src/app/[lang]/layout.tsx` **inside `AuthProvider`** (it needs `useAuth`). Exposes `{ results, status, ensureLoaded, refresh }` via `useResults()`.
- **Background prefetch:** an effect fires `load()` as soon as `user && userProfile?.requester_id && status === 'idle'` — i.e. the slow (~10 s) fetch starts at **login**, so the page is usually already `ready` when opened (Aziz's idea). Only patients who already have access (`requester_id`) prefetch, to avoid pointless failing calls.
- `loadedForUidRef` (set only on `ready`/`empty`) de-dupes reloads while still retrying after `error`/`need_access`; `loadingRef` guards concurrent calls; a `prevUidRef` effect resets everything on login/logout/**account switch**.
- Same error mapping as before: `not-found` → `empty`, `failed-precondition` → `need_access`, else `error`.
- **Still in-memory only** (React state) — never localStorage/IndexedDB/SW. Cleared on logout. This does **not** reduce total load (everything is still fetched at once); it only moves it earlier.

### 2. Authentication Integration (`useAuth`)
- `user`, `loading` (aliased to `authLoading`). Unauthenticated visitors are redirected to `/${lang}/login` (same pattern as `/profile`). While `authLoading || !user`, a bordeaux spinner renders.

### 3. Data type — `src/types/cyberlab.ts` (mirrors the lab API — `functions/src/cyberlab/client.ts`)
`CyberlabResult`: `dossier_id`, `patient_nom`, `patient_prenom`, `date_dossier` (ISO), `etat`, `analyses_summary`, `pdf_base64`. For `type: "patient"`, `patient_nom` / `patient_prenom` come back **empty** (data minimisation), so the UI intentionally does not show them. (Shared by the page AND `ResultsContext`.)

### 4. Key handlers / derived logic
- Fetching lives in `ResultsContext` now (§1.1). The page calls `ensureLoaded()` once `!authLoading && user` (idempotent), and `refresh()` from the "Actualiser"/"Réessayer" buttons and after `already_granted`.
- A `useEffect` calls `loadAccessStatus` whenever `status === 'need_access'` (the context sets the status; the page owns the access UI).
- **Self-service access** (`need_access`): `loadAccessStatus` (`myAccessRequest` callable) checks if a request is already pending; `handleRequestAccess` (`requestResultsAccess` callable) creates one. The card shows a "Demander l'accès" button or a "pending" badge. Staff activates it from `/admin` (attaches `requester_id`) → `refresh()` then loads results.
- `base64ToPdfBlob`: decodes `pdf_base64` → in-memory `application/pdf` Blob.
- `openViewer` / `closeViewer`: manage the modal; a single `useEffect` keyed on `viewer?.url` revokes the `blob:` URL whenever it changes or the component unmounts (no PDF lingers).
- `downloadPdf`: creates a blob URL, clicks a temporary `<a download>` (user-initiated save), revokes after 15s.
- `formatDate`: `date_dossier` → localized (`ar-MA` / `fr-FR`) long date; falls back to the raw string if unparseable.

### 4b. PDF viewer (full-screen modal, `react-pdf`/pdf.js on a `<canvas>`)
- Rendered via **`react-pdf`** (lazy `Document`/`Page`, pdf.js worker from an unpkg CDN URL) — a `<canvas>`, NOT an `<iframe>`, because Android can't inline-render PDFs in an iframe (it only offered an "Open" button).
- **Full-screen** panel (`fixed inset-0`, close ✕ in the header). Toolbar is forced **`dir="ltr"`** so the page-nav arrows ("◀ prev / next ▶") and zoom ("−/+") never look reversed under the Arabic RTL layout.
- **Fit-to-width via the `width` prop** (`(containerWidth-16)*zoom`), NOT `scale`. `zoom = 1` fits the viewer width; opens at **1.6** pinned to the top-left (`pendingScrollRef` applied in `onRenderSuccess`) so the readable left column is visible first.
- **Pinch-zoom / one-finger pan** (`pdfScrollRef` viewport, `pdfWrapRef` page box): non-passive native `touch*` listeners + `touch-action: none` on the surface **and its descendants** (the canvas). During a pinch we scale `pdfWrapRef` with a live CSS `transform` (GPU, anchored at the pinch midpoint) and DO NOT re-render — react-pdf hides the canvas + cancels the render task on every prop change, which made zoom crawl ~1% then stall. On release we commit the real `zoom` (one width-based re-render) and compensate scroll so the focus point stays put.

### 5. Reusable Styles & Assets
- Semantic classes: `.card`, `.button-bordeaux`, `.button-outline`, CSS vars (`--color-bordeaux-primary`, `--background-default`, `--text-*`, `--border-default`, `--status-error`).
- Lucide icons: `FileText`, `Download`, `Eye`, `X`, `RefreshCw`, `Inbox`, `AlertCircle`, `ShieldCheck`.
- i18n: `useTranslation('common')`, keys under `resultats.*` in `public/locales/{fr,ar}/common.json` (incl. plural `resultats.count`).

## Data Fetching & Mutations
- **Read:** `fetchResults` callable in region `europe-southwest1` (wired via `getClientFunctions` in `src/config/firebase.ts`), invoked from `ResultsContext` (background at login + on demand). The callable reads `requester_id` + `type` from `users/{uid}` server-side (never from the client) and proxies the signed request to the lab. Response carries `Cache-Control: no-store`.
- **Writes:** none. This page never writes to Firestore/Storage.

## Notes for AI
- **Never persist results.** Do not add caching, localStorage, Firestore writes, or file writes for results/PDFs. Keep them in memory and revoke blob URLs on close.
- **Access is granted, not seeded.** A patient without `requester_id` gets the `need_access` card and requests access (`requestResultsAccess`); staff activates it from `/admin` (`docs/pages/admin.md`). Local shortcut still exists: `functions/scripts/seed-requester.js <email> [requester_id] [type]`.
- **Dev wiring:** callable → local emulator when `NEXT_PUBLIC_USE_FUNCTIONS_EMULATOR=true` (root `.env.local`; forced `false` for prod builds via `.env.production.local`). Emulator needs `NODE_OPTIONS=--use-system-ca` + `GOOGLE_APPLICATION_CREDENTIALS`. **In prod, gen2 callables MUST have `allUsers` Cloud Run invoker** or the browser gets a CORS/403 (set via the Cloud Run IAM API — firebase deploy did not always apply it).
- **Linked from the nav** (Header + BottomNav → "Résultats").
- **Perf caveat:** the lab server returns all PDFs inline (~8–10 s for 3 dossiers). The login-time **prefetch** (`ResultsContext`) hides this latency but does NOT reduce it. The real fix is still a two-step list-then-PDF-on-demand flow needing a server-side change (Si Brahim: `include_pdf=latest|list|all` + `dossier_id`). Until then, keep the prefetch in-memory only.
- **Prefetch is opt-in by access:** only patients with `requester_id` prefetch. If you change the gate, do NOT prefetch for users without access (avoids failing calls at every login).
