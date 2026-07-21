# Page: /admin

## Purpose
Staff space, organized into **five tabs** (Tableau de bord · Patients · Demandes · Tester · Équipe) so it stays usable on mobile as it grows. Five jobs:
1. **Search patients & attach a CyberLab identity** — the **Patients** tab. A multi-field search (email, name/prénom, phone, date of birth, `requester_id`) finds the patient; picking a result shows their account creation date + date of birth and prefills the attach form, which merges `requester_id` + `type` onto their account (browser equivalent of `functions/scripts/seed-requester.js`). Replaces the old exact-email-only lookup.
2. **Fulfill patient access requests** — the **Demandes** tab lists patients who tapped "Demander l'accès" on `/resultats`; staff verifies identity (face-to-face) and attaches `requester_id` + `type` to activate access.
3. **Manage the team** (roles) — the **Équipe** tab (managers only): owners add/remove admins; owners and admins add/remove staff (stagiaires).
4. **Test a requester_id** (onboarding probe) — the **Tester** tab lets staff run a live CyberLab call for an arbitrary `requester_id` + `type` and preview what the patient would see (dossier list + analyses), BEFORE asking the patient to log in on their own device. Each dossier has a **"Voir le PDF"** that fetches that single PDF exactly like the patient's "Voir" — so staff also catch a failing/empty PDF (the on-demand PDF is where onboarding actually breaks). An empty PDF from the lab shows "Le serveur n'a pas renvoyé de PDF pour ce dossier." Patient names are scrubbed server-side. Independent of the email lookup (the patient may not have an account yet).

5. **Track adoption** — the **Tableau de bord** tab (default): how many patient accounts exist, how many have their results access activated, how many are pending, and — the point of it — **who actually uses their account vs who is dormant**, with a one-tap WhatsApp relance for dormant patients. Sold to Dr Aziz as "Version 2" (base + suivi d'utilisation), the level that crosses into a small CNDP commitment.

It does NOT create patient accounts (patients sign up themselves). It never persists medical results — the test preview is fetched on the fly, held in React state only, and the response carries `Cache-Control: no-store`. The **only** usage datum stored anywhere is `users/{uid}.lastResultsAt` (a date, see below).

## Directory & File
- **Path:** `src/app/[lang]/admin/page.tsx`
- **Type:** Client Component (`"use client"`)

## Layout — four tabs
`activeTab` (`dashboard|patients|requests|test|team`, default `dashboard`) selects one section; only that section renders. The tab bar uses the shared `TabsNavigation` (`src/components/features/catalog/TabsNavigation.tsx`, `TabItem {id,label,icon,count?}`, RTL-aware, horizontal-scroll on overflow) in a plain in-flow wrapper (`border-b`) — **not sticky** (deliberate): it scrolls away with the page so it consumes zero fixed screen space; to change tab, scroll back to the top. The `team` tab is only added to `tabs` when `isManager`; the `requests` tab shows a live count badge.

## Role model (single `role` field on `users/{uid}`)
Hierarchy, higher does everything lower can:
- **`owner`** (level 3): manage admins + everything below. (Bootstrapped: hassanelallali@gmail.com, azizelallali@gmail.com.)
- **`admin`** (level 2): add/remove **staff** + encode. Cannot touch admins/owners.
- **`staff`** (level 1, "stagiaire"): encode `requester_id`/`type` + test a `requester_id`.

`levelOf(role)` = `{owner:3, admin:2, staff:1}`. Page sections: encode + test-a-requester_id (level ≥ 1), team management (level ≥ 2), the "add admin" form + admin-removal (level = 3).

The role gate (`LEVEL`/`levelOf`/`requireLevel`) + `REGION` live in a shared leaf module `functions/src/admin/roles.ts`, imported by both `adminPatients.ts` and the CyberLab staff callable `adminTestResults.ts` (single source of truth).

## Access control (defense in depth)
1. **Page gate:** requires `user`; unauthenticated → redirect to `/[lang]/login`. If `level < 1` → "Accès refusé" card.
2. **Server gate:** every callable re-computes the caller's level from `users/{uid}.role` (never trusts the client) via `requireLevel(request, min)`. Hiding UI is not the boundary — the functions are.

## Context & Key Components
- `useAuth()` → `user`, `userProfile` (needs `role`), `loading`; derives `isStaff`/`isManager`/`isOwner`.
- Tab state: `activeTab` (`dashboard|patients|requests|test|team`, default `dashboard`).
- Dashboard state: `dash` (`DashboardStats | null`) + `dashError`, filled once by `loadDash` → `adminDashboardStats` on mount when `isStaff`. Local helpers: `fmtWhen` (epoch ms → short date), `daysSince`, and `waLink(phone, name)` which builds a `wa.me` deep link (Moroccan `0…` → `212…`) prefilled with `admin.dash_relance_msg`. `USAGE_SINCE` (module constant) drives the "suivi depuis" caption.
- Patients-tab state: `query`, `results` (`SearchResult[]`), `truncated`, `searched`, `selected`, `requesterId`, `type`, `busy`, `error`, `saved`. `SearchResult` = `{uid,email,hasProfile,fullName,phone?,requester_id?,type?,role?,createdAt?,dateOfBirth?}`; `createdAt`/`dateOfBirth` shown when present via the local `fmtDate` helper.
- Team state: `team` (Member[]), `teamBusy`, `teamError`, `teamMsg`, `newStaffEmail`, `newAdminEmail`.
- Test state: `testId`, `testType`, `testBusy`, `testStatus` (`idle|ok|empty|error`), `testError`, `testResp` (`CyberlabResponse`), `pdfProbe` (per-dossier `loading|ok|empty|error`). `viewTestPdf(dossierId)` fetches one PDF and opens a blob in a new tab (revoked after 60s).
- `callFn<T>(name, data)`: `getClientFunctions()` (region `europe-southwest1`) → `httpsCallable`.
- Patients: `handleSearch` → `adminSearchPatients` (returns a ranked list; single hit auto-selects); `selectPatient(r)` prefills the attach form; `handleSave` → `adminSetRequester` with `selected.email` (attach stays keyed on email; save button disabled when `selected.email` is null).
- Team: `loadTeam` → `adminListStaff` (on mount if `isManager`); `addStaff`/`addAdmin`/`removeMember` via `adminSetStaff`/`adminSetAdmin`.
- Test: `runTest(id, type)` → `adminTestResults`; `ok` when results non-empty, `empty` on `functions/not-found` or zero results. Preview reuses `ResultsIndicators` + `AnalysesDetails` (`src/components/features/results/`), plus local `fmtDate`/`etatLabel` helpers. **Above the count, an identity row shows `patient_name`** with a discreet source tag (`admin.test_name_src_lab` / `test_name_src_account`), or `admin.test_name_unknown` when no name could be resolved — so staff can confirm the id belongs to the right person before onboarding. Typed via the local `AdminTestResponse = CyberlabResponse & { patient_name?, name_source? }`.
- i18n under `admin.*` in `public/locales/{fr,ar}/common.json`.

## Backend (Cloud Functions — `functions/src/admin/adminPatients.ts`)
All region `europe-southwest1`, all guarded by `requireLevel`:
- `adminLookupPatient(email)` (≥staff) → patient profile/identity, or `{ found:false }`. Kept for compat; the UI now uses `adminSearchPatients`.
- `adminSearchPatients(query)` (≥staff) → `{ results: SearchResult[], truncated }`. Scans `users` (`.limit(SCAN_LIMIT=5000)`, Admin SDK bypasses rules) and matches the normalized query (lowercase + strip diacritics) as a substring of `fullName`/`email`, equality/inclusion on `requester_id`, phone digits (query ≥ 4 digits), or `dateOfBirth`. Exact email/`requester_id` ranked first; capped at `MAX_RESULTS=25` (`truncated` flags overflow). Email fallback via `getUserByEmail` for a profile-less account. Returns `createdAt`/`dateOfBirth` for display. In-memory match (Firestore has no substring search) — see scale caveat in Notes. Never logs PII.
- `adminSetRequester(email, requester_id, type)` (≥staff) → merges `{requester_id, type}` onto `users/{uid}` (Admin SDK, bypasses rules). Validates `type ∈ {patient,medecin,correspondant}`.
- `adminSetStaff(email, grant)` (≥admin) → set `role: 'staff'` / remove. Refuses if target is admin/owner.
- `adminSetAdmin(email, grant)` (owner only) → set `role: 'admin'` / remove. Refuses if target is owner.
- `adminListStaff()` (≥admin) → `{ members: [{uid,email,fullName,role}], callerLevel }`, sorted owner→admin→staff.
- `adminDashboardStats()` (≥staff) → the whole Tableau de bord in one call. Same bounded scan as `adminSearchPatients` (`SCAN_LIMIT`), **excluding team members** (any `role`) from the patient counts so the adoption denominator stays meaningful. Returns `totals` (accounts / withAccess / withoutAccess / pendingRequests / byType), `usage` (active in the last 30 d, dormant, `rate` = active ÷ withAccess as a %, `windowDays`), `latestCreated` (10, sorted on the ISO `createdAt` string), `latestActive` (10, sorted on `lastResultsAt`), `dormantList` (25 — access activated but never consulted or inactive > 30 d, never-used first, **includes `phone`** so staff can relance), and `truncated`. Timestamps come back as epoch ms.

Access requests (`resultAccessRequests/{uid}`, only touched via callables):
- `adminListAccessRequests()` (≥staff) → pending requests (`{uid, fullName, email, phone, createdAt}`).
- `adminFulfillAccessRequest(uid, requester_id, type)` (≥staff) → merges identity onto `users/{uid}` + marks the request `fulfilled` (records `fulfilledBy`/`fulfilledAt`).
- `adminRejectAccessRequest(uid)` (≥staff) → marks the request `rejected`.
- Patient-side (not admin-gated): `requestResultsAccess()` creates a `pending` request; `myAccessRequest()` returns its status (used by `/resultats`).

CyberLab onboarding probe (`functions/src/cyberlab/adminTestResults.ts`, secrets `CYBERLAB_API_KEY`/`CYBERLAB_HMAC_SECRET`, URL param `CYBERLAB_API_URL`):
- `adminTestResults(requester_id, type, dossier_id?)` (≥staff) → calls `callCyberlab` (from `cyberlab/client.ts`) with the **client-supplied** id. Two phases like the patient bridge: no `dossier_id` → list only (`max_results:50`, `include_pdf:'none'`); with `dossier_id` → that single dossier's PDF on demand. **Scrubs** `patient_nom`/`patient_prenom` **only for `medecin`/`correspondant`** ids (a practitioner id would otherwise ship their whole nominative patient roster); a `patient` id keeps its name since that is the one person staff are confirming.
- **Identity shown to staff** (`patient_name` + `name_source` added to the response): the lab returns **empty names for `type:'patient'`** (data minimisation — verified on the real server, `docs/integrations/test-results.md` case A1), so the name normally comes from the **linked app account** — a best-effort `users` lookup `where('requester_id','==',id).limit(1)` returning `fullName` (never fails the test). `name_source` (`'lab'` \| `'account'`) is surfaced in the UI so staff are never led to believe the laboratory confirmed the identity. If Brahim ever returns names for patient ids, they take precedence automatically. Errors → generic French `HttpsError` (not_found→"not-found" = "aucun résultat", rate_limited→resource-exhausted, network→unavailable, else internal); logs `{kind,status}` only, never the body. Sets `Cache-Control: no-store`. Unlike `fetchResults` (identity from the profile), identity here comes from the client — hence the ≥staff gate.

**`requester_id` normalization (gotcha, fixed 2026-07-21):** Qalam displays large ids with a thousands separator, and a real patient profile was saved as `"67 305"` → the lab server answers `404 requester_not_found` and the patient sees **nothing** in `/resultats` (no error hinting at the cause). `normalizeRequesterId()` (exported from `functions/src/cyberlab/client.ts`, strips **all** whitespace incl. NBSP) is now applied on **write** (`adminSetRequester`, `adminFulfillAccessRequest`), on **test** (`adminTestResults`) and on **read** (`fetchResultsForUser`, so profiles saved before the fix are rescued at runtime without a data migration). Do not replace it with a plain `.trim()` — the problem is the *internal* space.

**Deploy note:** gen2 callables need `allUsers` as Cloud Run invoker (auth is enforced in-function). `firebase deploy` did not always apply it → the browser gets a CORS/403; grant it via the Cloud Run IAM API (see `functions/scripts` / conversation).

## Bootstrapping owners
An owner must exist before the UI can manage roles. First owners set out-of-band with `functions/scripts/make-admin.js <email> owner` (Admin SDK, needs `GOOGLE_APPLICATION_CREDENTIALS`). `role` lives on `users/{uid}` and survives profile edits because all `users/{uid}` writes use `{ merge: true }`.

## Notes for AI
- **Not in public nav** — reachable only by URL (`/[lang]/admin`), gated as above.
- Role changes take effect in a client only after the profile re-loads (full refresh / re-login), since `AuthContext` caches `userProfile` for the session.
- Never write `users/{uid}` without `{ merge: true }` (holds `role`/`requester_id`/`type`/consent).
- Firestore rules keep `users/{userId}` client access to own-doc only, AND now **hard-block** clients from setting/changing the privileged fields `role`/`requester_id`/`type`/`lastResultsAt` (create rejects any of them; update rejects changing any — `diff().affectedKeys()`). These are written ONLY server-side (Admin SDK bypasses rules): the callables above, plus `fetchResults` for the usage stamp. This closes self-promotion to staff/owner, self-pointing `requester_id` at another patient's id, and forging one's own activity date. Do not loosen this — the role model, `adminTestResults` access, and the dashboard's integrity all depend on it.
- **Where `lastResultsAt` comes from:** `fetchResults` (`functions/src/cyberlab/fetchResults.ts`) stamps it on the **list** fetch only — the one that runs when the patient opens the app — throttled to once per **6 h** (checked against the profile snapshot it already loaded, so no extra read) and wrapped in try/catch so usage tracking can never break a patient's results. It is a DATE only: never a result, never which dossier. Declared to patients in `confidentialite.usage_*`.
- **Ramp-up caveat:** nothing was measured before the feature shipped, so every pre-existing account reads as "jamais consulté" until its owner next opens the app. The dashboard shows a `admin.dash_since` caption (module constant `USAGE_SINCE`) so the first weeks aren't misread — update that constant if the go-live date changes.
- **Adding a tool** = add a `TabItem` to `tabs` + wrap a section in `{activeTab === 'x' && …}`; `TabsNavigation` handles overflow, no layout change.
- Patient search by name/phone/DOB/`requester_id` is now implemented (`adminSearchPatients`, Patients tab). The per-search scan reads up to `SCAN_LIMIT` docs — fine for this lab; past a few thousand patients, migrate to a normalized-field prefix index or a search service (`truncated:true` is the early signal).
- Out of scope (future / Étape 2): traceability dashboard (accounts proposed/validated/dormant, filter by period + CIN — **CIN is not collected yet**), a "last results view" usage timestamp for the used/dormant indicator, account creation from admin, audit log of role/identity changes. Any usage tracking must store only an access timestamp, never medical content.
