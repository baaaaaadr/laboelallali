# Page: /profile

## Purpose
This page handles the route `/profile`. It manages the user's patient profile, handles profile completion requirements, allows users to view and update their personal details, **and shows their lab patient code as big digits + a Code 128 barcode to be scanned at the front desk** (see §5).

## Directory & File
- **Path:** `src/app/[lang]/profile/page.tsx`
- **Type:** Client Component (`"use client"`)

## Context & Key Components

### 1. State Management
- `fullName` (string): Captures the patient's full name.
- `dateOfBirth` (string): Captures the patient's date of birth (`YYYY-MM-DD`).
- `phone` (string): Captures the patient's mandatory phone number.
- `isEditing` (boolean): Controls toggle between static view and edit mode.
- `isSubmitting` (boolean): UI loading indicator during Firestore writes.
- `error` (string | null): Captures and displays database or validation errors.

### 2. Authentication Integration (`useAuth`)
Uses the `useAuth()` custom context hook to access:
- `user`: The current active Firebase Auth user.
- `userProfile`: The Firestore document mapping (`UserProfile`).
- `loading`: Loading state of the active authentication check.
- `logout`: Function to end the active session.
- `refreshProfile`: Reloads the profile document from Firestore.

### 3. Display Logic
- **Profile Completion Mode:** Rendered if `!userProfile || !userProfile.phone`. The user must submit a valid Full Name, Date of Birth, and Phone number before they can view their profile or proceed to download PDF devis.
- **Normal View Mode:** Displays static cards with the user's Full Name, Email, Phone number, and Date of Birth.
- **Date Formatting:** In the static view, dates of birth are formatted as `JJ/MM/AAAA` (e.g. `18/05/1990`) using a local `formatDateDisplay` helper.
- **Edit Mode:** Active when `isEditing` is true. Replaces static text with editable inputs. The primary `email` address remains read-only for security and authentication consistency.

### 4. Reusable Styles & Assets
- Styled using standard semantic CSS classes defined in `DESIGN.md` (e.g., `.card`, `.button-bordeaux`, `bg-[var(--background-default)]`).
- Lucide Icons used: `User`, `Calendar`, `Mail`, `LogOut`, `CheckCircle`, `Phone`.

### 5. Patient code card (`PatientCodeCard`)
Rendered between the profile header and the details card, as a direct child of the `space-y-8` wrapper. **The page passes only `lang`** — the card reads `userProfile` itself and renders its own "not activated yet" state, so the page needs no guard.

**Why it exists:** `requester_id` was stored on every profile but displayed nowhere. At the counter, patients spell their name while staff searches. A counter scanner emulates a keyboard: scanning the barcode types the number straight into Qalam's patient search — **no integration with Qalam is involved**. The lab must own a **2D imager**; a 1D laser cannot read a phone screen at all (it measures reflected light, a screen emits its own).

**Files:**
- `src/components/features/profile/PatientCodeCard.tsx` — the card. State: `selectedId` (local, never persisted), `copied` (2 s feedback, mirrors `/resultats`), `scanOpen`.
- `src/components/features/profile/ScanFullscreen.tsx` — full-screen white surface for the actual scan.
- `src/components/common/Barcode.tsx` — maps geometry onto `<rect>`s. Also exports `barcodeFits()`.
- `src/components/common/IdentitySelector.tsx` — shared with `/resultats`.
- `src/lib/barcode/code128.ts` — pure encoder. Verified by `node scripts/test-barcode.js` (50 checks: reverse-decoding, check character, geometry, and a permanent comparison against `marketing/scripts/generer-code-barres.js`, the implementation the lab actually scanned).
- `src/lib/results/identities.ts` — turns a profile into the ordered list of dossiers this account may consult (`resolveIdentities`), and reads the doctor access (`readPractitioner`) — never mixed.
- `src/hooks/useScreenWakeLock.ts` — keeps the screen awake while the overlay is open.

**Multi-person:** when the account carries relatives' dossiers (`linkedRequesters`), the selector switches *which* code is shown. It is usually the adult child who comes to the desk for a parent, so they need to present the parent's code, not their own.

**Doctor-only accounts (23/09/2026):** the card **renders nothing** when the account has no patient dossier at all AND holds a doctor access (`!selected && readPractitioner(userProfile)`). The doctor code is never a patient identity (so never on the barcode), and the « pending » sentence (« Votre code apparaîtra ici dès que le laboratoire aura activé votre accès ») would read as if his doctor access were not active. The card comes back by itself the day the lab attaches a patient dossier to the account.

### 6. « Espace médecin » card (`PractitionerAccessCard`, 23/09/2026)
Mounted right after `PatientCodeCard`, unconditionally: `<PractitionerAccessCard lang={lang} />` (`src/components/features/practitioner/PractitionerAccessCard.tsx`, `data-testid="mp-access-card"`). It renders only for an account holding a doctor access (`readPractitioner(userProfile)`) — title « Espace médecin », one sentence, a full-width-on-phone `.button-bordeaux` « Ouvrir « Mes patients » » → `/{lang}/mes-patients` (keys `mes_patients.access_card_*`). For a doctor-only account the code card above is absent, so this card sits directly under the identity. See `docs/pages/mes-patients.md`.
- **The button is under the icon row, not beside it:** `.button-bordeaux` is declared UNLAYERED in `src/styles/index.css` (padding 0.875 rem 1.75 rem, `white-space: nowrap`, 48 px min height), so no Tailwind utility can shrink it; beside the icon it had ~196 px at 320 px for a label that needs ~240.
- **The title is a `<p>`, not an `<h2>`:** `base/reset.css` sizes and colours `h2` unlayered (2xl, brand colour).
- Tested by `scripts/test-practitioner-ui.js` M13 (doctor-only: card, no code card, zero call; doctor-patient: both; patient: no card).

## Notes for AI — the patient code card
- **Never put the barcode on a `.card`.** `.card` is `#FFF0F5` (pink) in light mode and is **redeclared in `src/styles/index.css` (~line 1084) after `cards.css` is imported**, so the later rule wins. The white quiet zone comes from the `.barcode-surface` class, which also kills the **global 1 s `background-color` transition** this project sets on `*` — without that, flipping the theme mid-scan fades the surface through grey for a second, and grey decodes as nothing.
- **`!important` + a duplicated `.dark` selector, not an inline style.** An `!important` stylesheet declaration beats a plain inline style. Same recipe as `.hero-panel__cta`.
- **`dir="ltr"` belongs on the wrapper, not the `<svg>`** — `dir` is not a valid React SVG prop (TS2322). The digits must stay Latin and unreordered: this number is read aloud and typed into the lab software.
- **Never render an empty barcode.** `encodeValues('')` throws on purpose; an empty symbol still encodes to Start + check + Stop and scans as nothing, which looks like a broken reader. The card shows `profile.code.pending` instead.
- **No browser API can change screen brightness.** The only two real levers are the full-screen white surface and the wake lock. `requestFullscreen()` is unavailable on iOS Safari outside video and pointless in an installed PWA — do not gate anything on it.
- **The wake lock must be re-acquired on `visibilitychange`.** The browser releases the sentinel whenever the tab is hidden and never restores it; without the re-acquisition the lock works on the first scan attempt only.
- **`ScanFullscreen` must use `createPortal`.** The home hero carries `backdrop-filter: blur(16px)`, which makes it the containing block of `position: fixed` descendants — a non-portalled overlay gets clipped to a small box. Same trap documented in `PdfViewerModal`.
- i18n lives under `profile.code.*` and `identity.*` in `common` (fr **and** ar).

## Data Fetching & Mutations
- **Read:** Integrated with `useAuth` which loads user profile documents from the `users` Firestore collection on auth state changes.
- **Write:** Updates are written via `setDoc(doc(db, 'users', user.uid), {...}, { merge: true })` to Firestore. **`merge: true` is required** so a profile edit never wipes fields set elsewhere on the same doc (`requester_id`/`type`/`role` from the admin space, `consentAccepted*`, `createdAt`). Submitting also calls `refreshProfile()` to sync the context state.

## Notes for AI
- **Always write with `{ merge: true }`:** the `users/{uid}` doc also holds `requester_id`/`type`/`role` (admin space), `linkedRequesters`/`linkedRequesterIds` (attached relatives) and consent flags. A non-merge `setDoc` wipes them and breaks the results/admin flow. Since those fields are locked in `firestore.rules`, a non-merge write is now **rejected outright** rather than silently destructive — the rules compare values, and dropping a locked field counts as changing it.
- **Mandatory Phone Field:** The `phone` field is strictly required to successfully create or update a profile. Legacy profiles without a phone number will be redirected to complete it.
- **Save failures are translated, not echoed.** `handleProfileSubmit` catches `unknown` and shows `profile.save_error`. It used to render `err.message` straight from Firebase — English, technical ("Missing or insufficient permissions"), in front of a French- or Arabic-speaking patient. The raw error still goes to the console.
- **Auth Email Constraints:** Do not attempt to add editing capabilities for the `email` field inside this profile component, as email updates must be done with Firebase Auth credentials reauthentication.
