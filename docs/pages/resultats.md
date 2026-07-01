# Page: /resultats

## Purpose
Authenticated patient results viewer. It fetches the patient's lab results on demand from the lab's CyberLab server (via the `fetchResults` Cloud Function) and lets the patient view or download each result PDF. The app is a **viewer only**: results live in component memory for the duration of the visit and are never persisted (no Firestore, no localStorage, no disk). See `docs/integrations/cyberlab-results-api.md`.

## Directory & File
- **Path:** `src/app/[lang]/resultats/page.tsx`
- **Type:** Client Component (`"use client"`)

## Context & Key Components

### 1. State Management
- `status` (`'loading' | 'error' | 'empty' | 'ready' | 'need_access'`): drives which block renders. `need_access` = patient has no `requester_id` yet → self-service access-request card.
- `results` (`CyberlabResult[]`): the fetched dossiers, held in memory only. Never written anywhere.
- `errorMsg` (string | null): user-facing (generic) error text.
- `viewer` (`{ url: string; dossierId: string } | null`): the currently open PDF viewer; `url` is an in-memory `blob:` URL.
- `accessStatus` (`'checking' | 'none' | 'pending' | 'rejected'`) + `requesting` (bool): drive the access-request card in the `need_access` state.

### 2. Authentication Integration (`useAuth`)
- `user`, `loading` (aliased to `authLoading`). Unauthenticated visitors are redirected to `/${lang}/login` (same pattern as `/profile`). While `authLoading || !user`, a bordeaux spinner renders.

### 3. Data type (mirrors the lab API — `functions/src/cyberlab/client.ts`)
`CyberlabResult`: `dossier_id`, `patient_nom`, `patient_prenom`, `date_dossier` (ISO), `etat`, `analyses_summary`, `pdf_base64`. For `type: "patient"`, `patient_nom` / `patient_prenom` come back **empty** (data minimisation), so the UI intentionally does not show them.

### 4. Key handlers / derived logic
- `loadResults` (useCallback): `getClientFunctions()` → `httpsCallable('fetchResults')` → sets `results` + `status`. Runs automatically once `!authLoading && user`, and on the "Actualiser"/"Réessayer" buttons.
- Error mapping: callable `not-found` → `empty` state (not an error); `failed-precondition` → **`need_access`** state (no `requester_id` yet), which calls `loadAccessStatus`; anything else → generic message.
- **Self-service access** (`need_access`): `loadAccessStatus` (`myAccessRequest` callable) checks if a request is already pending; `handleRequestAccess` (`requestResultsAccess` callable) creates one. The card shows a "Demander l'accès" button or a "pending" badge. Staff activates it from `/admin` (attaches `requester_id`) → results then load normally.
- `base64ToPdfBlob`: decodes `pdf_base64` → in-memory `application/pdf` Blob.
- `openViewer` / `closeViewer`: manage the modal; a single `useEffect` keyed on `viewer?.url` revokes the `blob:` URL whenever it changes or the component unmounts (no PDF lingers).
- `downloadPdf`: creates a blob URL, clicks a temporary `<a download>` (user-initiated save), revokes after 15s.
- `formatDate`: `date_dossier` → localized (`ar-MA` / `fr-FR`) long date; falls back to the raw string if unparseable.

### 5. Reusable Styles & Assets
- Semantic classes: `.card`, `.button-bordeaux`, `.button-outline`, CSS vars (`--color-bordeaux-primary`, `--background-default`, `--text-*`, `--border-default`, `--status-error`).
- Lucide icons: `FileText`, `Download`, `Eye`, `X`, `RefreshCw`, `Inbox`, `AlertCircle`, `ShieldCheck`.
- i18n: `useTranslation('common')`, keys under `resultats.*` in `public/locales/{fr,ar}/common.json` (incl. plural `resultats.count`).

## Data Fetching & Mutations
- **Read:** `fetchResults` callable in region `europe-southwest1` (wired via `getClientFunctions` in `src/config/firebase.ts`). The callable reads `requester_id` + `type` from `users/{uid}` server-side (never from the client) and proxies the signed request to the lab. Response carries `Cache-Control: no-store`.
- **Writes:** none. This page never writes to Firestore/Storage.

## Notes for AI
- **Never persist results.** Do not add caching, localStorage, Firestore writes, or file writes for results/PDFs. Keep them in memory and revoke blob URLs on close.
- **Access is granted, not seeded.** A patient without `requester_id` gets the `need_access` card and requests access (`requestResultsAccess`); staff activates it from `/admin` (`docs/pages/admin.md`). Local shortcut still exists: `functions/scripts/seed-requester.js <email> [requester_id] [type]`.
- **Dev wiring:** callable → local emulator when `NEXT_PUBLIC_USE_FUNCTIONS_EMULATOR=true` (root `.env.local`; forced `false` for prod builds via `.env.production.local`). Emulator needs `NODE_OPTIONS=--use-system-ca` + `GOOGLE_APPLICATION_CREDENTIALS`. **In prod, gen2 callables MUST have `allUsers` Cloud Run invoker** or the browser gets a CORS/403 (set via the Cloud Run IAM API — firebase deploy did not always apply it).
- **Linked from the nav** (Header + BottomNav → "Résultats").
- **Perf caveat:** the lab server returns all PDFs inline (~8 s for 3 dossiers). For many dossiers this is slow / risks timeout + payload limits — planned fix is a two-step list-then-PDF-on-demand flow needing a server-side change.
