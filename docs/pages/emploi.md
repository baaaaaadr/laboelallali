# Page: /emploi — « Emploi & Stage »

## Purpose
Public page where anyone applies to the lab — school observation internship, pre-hiring internship, application to a position, or spontaneous application — **without an account** (owner's decision, 08/10/2026: an account loses candidates and would mix them with the patients in the access requests and the dashboard). Devis **line 27** (page + form, 1,5 j); the lab reads and decides in the admin **« Candidatures »** tab, devis **line 40** (see `docs/pages/admin.md`). Aziz's goal, written in the devis: gather everything needed to decide **without calling the candidate back**.

Indexable on purpose (a candidate searching « stage laboratoire Agadir » should land here): no `robots` tag, in the sitemap automatically.

## Directory & File
- **Route:** `src/app/[lang]/emploi/page.tsx` — Client Component, `use(params)`; header (Briefcase icon, `emploi.title`, `emploi.intro`) + `<ApplicationForm lang>`.
- **Layout:** `src/app/[lang]/emploi/layout.tsx` — Server Component, only `generateMetadata` (title/description read from `public/locales/{lang}/common.json` → `emploi.meta_title` / `meta_description`; a client page cannot export metadata).
- **Form:** `src/components/features/emploi/ApplicationForm.tsx` (state, validation, submit, success panel).
- **Presentational pieces:** `src/components/features/emploi/formParts.tsx` — `Section` (numbered card), `Label`, `FieldError`, `TextField`, `Chips` (radio or checkbox chips), `FilePicker`, `inputClass`.
- **Rules (shared with the server):** `src/lib/emploi/applicationFields.ts` re-exports `functions/src/hr/applicationRules.ts` (pure, no Firebase) + `FIELD_ORDER` and the admin DTO type `ApplicationRecord`.
- **Files:** `src/lib/emploi/prepareFile.ts` — `prepareFile(file)`, `FILE_ACCEPT`, `formatSize`.
- **Server:** `functions/src/hr/submitApplication.ts` (`submitApplication`, europe-southwest1, no auth), e-mails in `functions/src/hr/applicationEmails.ts`.

## Context & Key Components

### 1. The five blocks (one screen, `Section` cards, numbered)
1. **Votre demande** — four `ChoiceCard`s (from `src/components/features/journey/SectionShell.tsx`): `observation`, `preembauche`, `emploi`, `spontanee`. The choice drives what follows:
   - observation: **Vous êtes** (`schoolLevel`: collège/lycée, université/école, formation professionnelle) — required; **position optional** (label becomes « Service qui vous intéresse »); **duration** required + optional dates (`startDate` / `endDate`);
   - preembauche: position required, duration required, optional dates;
   - emploi / spontanee: position required, **availability** (`immediate` | `date` → `availableFrom` required).
   - position `autre` → `positionOther` required.
2. **Vous** — `lastName`, `firstName`, `dateOfBirth` (age shown live under it, `emploi.age_value`), `phone` (dir ltr), `email` (optional — only used for the acknowledgement), `city`, `district` (optional).
3. **Votre parcours** — `diplomaLevel` (chips, required), `diplomaTitle`, `diplomaYear` (4 digits), `school`, `experience` (chips, required), `lastEmployer`.
4. **Ce qui compte aussi** — `license` (Oui/Non, required), `vehicle` (aucun / moto-scooter / voiture, required — home sampling), `languages` (multi-chips: arabe, amazighe, français, anglais, espagnol; at least one, or `languagesOther`), `source` (optional: how they heard of the lab).
5. **Vos documents** — `FilePicker` for `cv` and `letter`; consent checkbox (links to `/{lang}/confidentialite#candidatures`, new tab); submit button; the « À compléter ou corriger : … » list; the send error.

No national ID (CIN) anywhere — sensitive and useless before hiring (devis wording).

### 2. State (all in `ApplicationForm`)
`values: Values` (strings; `license` is `'' | 'yes' | 'no'`, `languages: string[]`), `consent`, `files: Record<'cv'|'letter', PreparedFile|null>`, `fileBusy`, `fileErrors` (local file refusals), `serverErrors` (field → code from the server), `showErrors` (set on the first submit click), `sending`, `sendError`, `done` (`{ref, firstName, email}` → success panel), `hp` (trap field), `prefilled`, refs `startedAt` (mount time) and `touched` (fields typed by the person).

### 3. Validation — the SERVER's rules, imported
`formPayload` converts the values to what the server reads (`license` boolean, `diplomaYear` number, `consent`). `errors` = `parseApplication(formPayload)` (the very function `submitApplication` runs) + `filesError(kind, …)` + local file errors + server errors. Field messages map the codes (`required`, `invalid`, `too_long`, `age`, `dates`, `too_big`, `format`, `read`) to `emploi.err_*` / `emploi.file_err_*`.
- **The submit button is never locked** (« a visible clickable element always does something »): a click on an incomplete form shows every error at once, scrolls to the first (`data-field` attributes, `FIELD_ORDER`), and lists them under the button with their labels (`FIELD_LABEL`).
- Errors appear only after the first submit attempt, except file and server errors (immediate).

### 4. Files (`prepareFile`)
- Accepted: PDF, Word (.doc/.docx), JPEG/PNG (HEIC converted when the browser can read it). 5 MB max each.
- **Every image is redrawn in the browser** (≤ 2000 px, JPEG 0.85, white background): a phone photo of a paper CV (3–10 MB) drops under 1 MB, and its metadata (GPS position) is gone. The file is renamed `*.jpg`.
- `cv` required, except for an **observation** internship where the CV **or** the school's letter is enough (`cvRequired` / `filesError`).
- The file row sits on its own line inside the picker: sharing it with the buttons squeezed the name to 0 px at 390 px (measured, fixed 08/10/2026).
- The server re-checks the REAL format from the first bytes (`sniffFile`): a renamed program is refused whatever its name.

### 5. Anti-spam (invisible to a person, judged by the server)
- `hp`: an off-screen `website` input (`aria-hidden`, `tabIndex -1`, `autocomplete off`) — robots fill it.
- `elapsedMs`: time since mount; under 8 s (`MIN_FILL_MS`) the server answers « ok » and stores nothing.
- Per 24 h (server, hashed keys in `applicationThrottle`): 10 per network address (shared mobile addresses), 2 per phone, 1 acknowledgement e-mail per address.

### 6. Pre-fill (signed-in visitor)
Phone, e-mail and date of birth from `useAuth()` (`userProfile`, `user.email`), never over a field already typed (`touched`), with the note `emploi.prefilled`. **Names are not guessed** from `fullName` (order unknown). The account is recorded server-side as `uid` (shown as « Compte dans l'app » to the admin) — it is never required.

### 7. Success
`VerdictPanel` (success): « Merci {{name}}. Votre référence : {{ref}}… », then either « Un accusé de réception part à {{email}} » or « Notez votre référence ». Link back home.

### 8. Entry points
Footer « Liens rapides » (`emploi.nav`), mobile drawer (after Contact — the desktop bar is full: an 8th link overflows at 1024 px), contact page card « Rejoindre l'équipe » (`#emploi`), the link the admin copies from the « Candidatures » tab (to post on Facebook/WhatsApp). `GoogleSignInPrompt` `HIDDEN_ROUTES` contains `emploi` (no account is needed — an invitation to sign in would say otherwise, over the submit button).

## Data Fetching & Mutations
- One callable: `submitApplication({ lang, hp, elapsedMs, form, files: { cv?: {name, data}, letter?: {name, data} } })` via `httpsCallable(…, { timeout: 120000 })`. Returns `{ ok, ref }`. Errors: `invalid-argument` with `details.fields` (field → code) → shown on the fields; `resource-exhausted` → « appelez le laboratoire »; anything else → « vos réponses sont conservées ».
- Server (`functions/src/hr/submitApplication.ts`): trap/speed check → `parseApplication` → files decoded + `sniffFile` + 5 MB → rate-limit transaction → Storage `candidatures/{id}/{cv|letter}.{ext}` → Firestore `applications/{id}` (`status: 'a_etudier'`, `note: ''`, `uid`, `lang`, `ref`, `createdAt`, `expiresAt` = +183 days) → staff alert (`ALERT_EMAILS`, link `/fr/admin?tab=candidatures`) + acknowledgement (page language) — e-mails best-effort, 12 s cap. Both collections and the Storage folder are server-only (default deny).
- Erasure: `cleanupExpiredApplications` (daily 03:30 Africa/Casablanca, europe-west1) deletes expired applications and their files, and anti-spam counters older than 2 days.

## Notes for AI
- **One source of truth for the rules**: edit `functions/src/hr/applicationRules.ts` only; the page imports it. Then `npm --prefix functions run build` — `npm run test:emploi` (section A) fails if `functions/lib` (what deploys) differs from the source.
- Adding a value to a list (a position, a language…) = the list in `applicationRules.ts` + `emploi.<prefix>_<value>` in fr AND ar (`npm run test:emploi` section B) + the French label in `applicationEmails.ts` (staff e-mail).
- Never ask for a CIN; never attach a CV to an e-mail (they open in the admin tab); never log a candidate's data (ids and types only).
- Chip colours are inline (global button rules beat Tailwind colours); selected text uses `--background-default` so it stays readable on the dark-mode pink.
- Benches: `npm run test:emploi` (pure, 32 checks), `npm run test:emploi:ui` (browser, F1–F7 form + C1–C4 admin tab), `node functions/scripts/test-applications.js` (server rules and e-mails, 75 checks).
