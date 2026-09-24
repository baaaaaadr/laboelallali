# Page: /mes-patients

## Purpose
The **prescribing doctor's space** (23/09/2026, quote line 62 « Accès médecin — Mes patients »). A doctor who has an account in the app sees, separately from his own results and his relatives' (which stay on `/resultats`, untouched):
1. the list of **his patients** — the people whose lab reports **he prescribed**, and only those — with a search;
2. for one patient, **his reports**, newest first: the most recent PDF is loaded on opening, older ones on demand; view / download / share, exactly like a patient does.

**The rule « only the reports he prescribed » is enforced by the lab server**, not by the app: a dossier prescribed by another doctor answers 404, even for the same patient (verified on the real server on 23/09/2026 with a real prescriber code). The app only ever asks with the doctor's code.

## Directory & File
- **Route:** `src/app/[lang]/mes-patients/page.tsx` (Client Component) + `layout.tsx` (Server Component, `robots: noindex` — a client page cannot export `metadata`).
- **Workspace:** `src/components/features/practitioner/` — `PractitionerWorkspace.tsx` (orchestration, states, search, phone back button), `PatientList.tsx`, `PatientDetail.tsx`, `PractitionerDossierCard.tsx`, `usePractitionerPdfActions.ts`, `PractitionerAccessCard.tsx` (entry point: `variant="card"` on `/profile`, `variant="banner"` on `/resultats`; renders nothing without a doctor access).
- **Pure logic:** `src/lib/practitioner/patients.ts` (grouping, search, display, cap), `src/lib/results/format.ts` (dates, lab status), `src/lib/results/dossiers.ts` (`newestOf`, shared with `ResultsContext`), `src/lib/results/identities.ts` (`readPractitioner`).
- **Server:** `functions/src/cyberlab/identities.ts` (`practitionerIdentity`), `functions/src/cyberlab/fetchResults.ts`, `functions/src/admin/adminPractitioner.ts` (activation, admin level — see `docs/pages/admin.md`).

## Who sees what — the page's gate (`page.tsx`)
| Situation | Screen |
|---|---|
| not signed in | redirect to `/{lang}/login?redirect=/{lang}/mes-patients` |
| no doctor access (`readPractitioner(userProfile) === null`) | « Espace réservé aux médecins partenaires » + **« Vérifier à nouveau »** (`refreshProfile()`: the profile is read ONCE per session, so an access the lab just gave would not show otherwise) + the lab's phone and WhatsApp |
| doctor code equal to one of the account's PATIENT ids | « Accès médecin à corriger » — **no call at all** (the server resolves the patient side first; the doctor would see his own results labelled « Mes patients »). The admin refuses this on write; this is the belt to that brace |
| otherwise | `<PractitionerWorkspace key={uid + ':' + code} practitioner={…} />` |

## Context & Key Components

### 1. The doctor access (`users/{uid}.practitioner`)
`{ requester_id: "MOUSTZOU", type: "medecin" | "correspondant", label: "Dr …", linkedAt, linkedBy, lastUsedAt? }`, written ONLY by `adminSetPractitioner` (admin level), **locked in `firestore.rules`** (both lists). Read through `readPractitioner()` — same validity test as the server (`practitionerIdentity`).

**⚠ Invariant: the doctor access is NEVER one of the patient identities.** `resolveIdentities()` / `primaryIdentity()` ignore it, so it is never the home page's « VOTRE dernier bilan », never a tab of the family selector, never on the barcode, never prefetched at login. Server side, `resolveIdentity()` returns it only on an explicit, exact selector, and the patient side wins a collision. Tested by `functions/scripts/test-identities.js` (sections 9–15), `scripts/test-practitioner.js` (D) and `scripts/test-practitioner-ui.js` (M7).

### 2. Data — one call for the list, one per PDF
- `useResultsFor(practitioner.requester_id)` — the shared results context (`src/contexts/ResultsContext.tsx`): bucket `${uid}::${code}`, PDFs `${code}::${dossierId}`, memory only, reset on logout / account switch. **Never `useResultsFor(null)`** — that is the account's PRIMARY identity (the doctor's own results).
- **List:** `fetchResults({ include_pdf: "none", requester_id: CODE })`. The server FORCES `none` for a practitioner whatever the client sends (a 50-dossier roster with PDFs would blow the 20 s transport timeout and raise a false outage alert). Measured: 0.25 s.
- **No PDF is auto-loaded after the list** for a practitioner identity (`autoPdfIds` in `ResultsContext` = patient-side identities only): the newest dossier of a roster is some patient the doctor did not ask to open.
- **Opening a patient** loads the PDF of **that patient's** most recent report, once (`PatientDetail`); older PDFs on « Voir » / « Télécharger ». One PDF ≈ 2.5 s, ~260 KB.
- **Telemetry** (server): `usageDaily.practitionerConsultations` + `practitioner.lastUsedAt` (6 h throttle, conditional write) — never the patient counters, never the relance list.

### 3. Grouping and search (`src/lib/practitioner/patients.ts`)
The lab returns **no patient identifier** (`patient_id` is ignored by the server) — only `patient_nom` / `patient_prenom`. `patientKey()` = accents off, capitals, punctuation → space, spaces collapsed; **nameless dossiers are never merged** (one line each, keyed on the dossier number). `groupByPatient()` sorts patients by most recent report, ties by name (stable between refreshes). `matchesQuery()`: every typed word must appear in the name (accent/case/order-insensitive) or START a dossier number. `displayName()`: « EL ALLALI Hassan ».

**⚠ Known limit, stated on screen (`mes_patients.homonym_note`):** two different patients with exactly the same family name and first name appear as one line; each report keeps its date and dossier number. A stable patient id from the lab (asked to Si Brahim) would remove it. The server's twin `patientKey` (admin « Vérifier » counts, `functions/src/admin/adminPractitioner.ts`) must stay identical, **nameless rule included** (it takes the dossier number as a third argument; until 23/09/2026 it merged every nameless dossier into one patient, so « Vérifier » undercounted) — checked by `scripts/test-practitioner.js` (E) and `functions/scripts/test-practitioner-admin.js`.

**The 50 cap.** The lab server returns at most 50 dossiers, **newest first, and truncation keeps the most recent** (verified 23/09/2026 with `max_results: 1` on four identities). At 50, `mes_patients.capped` says only the 50 most recent are shown.

### 4. States (`PractitionerWorkspace`)
`idle`/`loading` → loader · `need_access` or `permission-denied` → « accès retiré ou modifié » + contacts · `unknown_id` (lab 404: no dossier sent yet since the doctor's activation in Qalam) → « pas encore actif côté laboratoire » + contacts · `error` → rate-limited / confirmed outage (`useOutageStatus`, + `OutageOptIn`) / generic, with « Réessayer » · `empty` → « Aucun bilan pour le moment » · `ready` → search + summary (« N patients · M bilans », plural forms fr + ar) + list/detail.

### 5. Layout and the phone back button
- Large screens (`lg`): list (22 rem) and detail side by side. Phones: the detail **replaces** the list (`hidden lg:block` both ways).
- **Phone back button:** opening a patient on a phone (`matchMedia('(min-width: 1024px)')` false) pushes ONE history entry `{ mpDetail: 1 }`, same URL; `popstate` closes the detail and restores the list's scroll; the in-page « ← Mes patients » calls `history.back()`. Next.js patches `pushState` and keeps its own router state in the entry, so this is not a navigation. **Nothing identifying goes into the history state, the URL, the page title or a file name** (`resultat-<dossier>.pdf`).

### 6. PDF actions (`usePractitionerPdfActions`)
Same mechanics as `/resultats` (base64 stays in the context, the viewer keeps only the dossier id and closes by itself on an account switch). Differences: **neutral share texts** (`mes_patients.share_*`, never « Mon résultat »), viewer title « NOM Prénom — dossier N » (on screen only). `PdfViewerModal` got optional `title` / `shareTitle` / `shareText` / `fileName` props for this.

### 7. Entry points (all gated on `readPractitioner(userProfile)`)
- **Header (`src/components/layout/Header.tsx`):**
  - **desktop bar — « Mes patients » REPLACES « Médecins »** (right after Résultats), because an 8th link does not fit: measured 23/09/2026 on the production build, logged-in account, it overflows by 38 px at 1024 px in French and leaves 12 px at 1280; replacing leaves 46 / 113 px. Full numbers in `docs/pages/resultats.md` §Notes (nav width). **Staff accounts keep their bar** (8 links, already 6 px over at 1024).
  - **mobile drawer — « Mes patients » is ADDED** right after Résultats, for every doctor account including staff (icon `Users`; « Médecins » keeps the stethoscope and stays).
  - `BottomNav` is unchanged.
- **`/profile`:** `PractitionerAccessCard` (variant `card`) after the barcode card — `docs/pages/profile.md` §6.
- **`/resultats`:** `PractitionerAccessCard variant="banner"`, one line under the header — `docs/pages/resultats.md` §1.055.
- **Doctor-only accounts** (no patient dossier, own or relative's): the home hero panel **collapses** instead of showing « Activer mon accès », and remembers it (hint `none`) so the next visit does not flash it while Firebase loads — `docs/pages/home.md` §2.0-bis. The barcode card **renders nothing** — `docs/pages/profile.md` §5. A doctor who is also a patient keeps both, about his own dossier.
- Tested by `scripts/test-practitioner-ui.js` M11 (menu), M12 (home), M13 (profile + banner).

### 8. Styles, i18n
Semantic classes (`card`, `button-bordeaux`), colours from CSS variables only; keyframe `mpBar` (PDF progress). i18n block **`mes_patients.*`** in `public/locales/{fr,ar}/common.json` (+ `confidentialite.practitioner_*`); Arabic plurals in six forms (`patients_count_*`, `bilans_count_*`). Reused: `resultats.view/download/share/retry/pdf_loading/pdf_load_error/etat_final/refresh/error_title/year_unknown`.

## Data Fetching & Mutations
- **Read:** `fetchResults` callable (see §2). Nothing is written by this page, except the server-side usage stamp.
- **No Firestore rule change for reading** — the profile is read by `AuthContext` like any profile.

## Notes for AI
- **Tests:** `npm run test:practitioner` (pure: grouping, search, client twin, server parity, rules lock, fr/ar key completeness, the privacy page's doctor card — 54 checks) and `npm run test:practitioner:ui` (Chromium: M1 journey + phone back button, M2 search, M3 missing PDF, M4 five blocked states, M5 no access + re-check, M6 collision, M7 doctor-patient never calls with his code at startup, M8 account switch, M9 Arabic, M10 the admin card's lock, M11 menu, M12 home panel, M13 profile card + /resultats banner, M14 the admin Patients tab shows one card per person — 145 checks). Server: `node functions/scripts/test-identities.js`, `node functions/scripts/test-practitioner-admin.js`.
- **Never put a patient name in a URL, `document.title`, `history.state`, a log line or a file name.**
- **Never call `useResultsFor(null)` from this page**, and never add the practitioner to `resolveIdentities`.
- **The lab side** (activating a prescriber in Qalam, re-saving old dossiers, the send queue, ~5 min delay): `docs/integrations/cyberlab-results-api.md` §« Accès praticien » and the lab procedure `docs/procedures/activation-medecin.md`.
- Out of scope (v1): patient-initiated sharing with a non-prescribing doctor, a « new since last visit » marker, search inside analyses, more than 50 reports (needs the lab server: pagination or a date filter).
