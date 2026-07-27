# Page: /login

## Purpose
This page manages patient access, signup, and authentication. It handles email/password login, email registration with inline profile collection, password reset, and Google social login. New users are never redirected away to `/profile` to complete their information; missing profile details are collected inline on this page.

Google auth uses `signInWithPopup` as the primary flow on desktop, mobile browser, and installed PWA contexts. `signInWithRedirect` is used as a fallback only when the browser blocks the popup (`auth/popup-blocked`). Both flows are first-party and reliable because `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` is set to the app's own domain (`laboelallali.com`, served by Firebase Hosting), so there is no cross-domain auth relay and no third-party-cookie failure.

## Directory & File
- **Path:** `src/app/[lang]/login/page.tsx`
- **Type:** Client Component (`"use client"`) using React hooks.

## Three-Step Auth & Onboarding Flow

### Step 1 - Auth (`step === 'auth'`)
Shown to all unauthenticated visitors. Switches between login mode and signup mode via `isSignUp`.

**Login mode (`isSignUp = false`):** email + password only.

**Signup mode (`isSignUp = true`):** 5 fields + a mandatory consent checkbox in a single form:
1. Nom complet (`fullName`)
2. Email
3. Mot de passe
4. Date de naissance (`dateOfBirth`)
5. Telephone (`phone`)
6. **Consent checkbox (CNDP / loi 09-08)** — `consentAccepted`, links to `/[lang]/confidentialite` (opens in a new tab). Signup is blocked (inline `consent_error`) until it is checked. The same checkbox is also shown in the Step 2 profile-completion form for Google users.

On email signup submit: consent guard -> `createUserWithEmailAndPassword` -> `persistProfile` (`setDoc` merge) -> `refreshProfile` -> `router.push(getRedirectTarget(lang))` (post-auth target; see **Redirect Logic**).

On email login submit: `signInWithEmailAndPassword`. The auth context loads the Firestore profile; completed profiles are redirected to the post-auth target (`getRedirectTarget`, default `/${lang}/profile`), incomplete profiles stay on `/login` and show step 2.

Google submit:
- Creates `new GoogleAuthProvider()`.
- Tries `signInWithPopup(auth, provider)` first.
- If the browser blocks the popup (`auth/popup-blocked`), falls back to `signInWithRedirect`.
- Any other popup error (e.g. the user closed the popup) is mapped to a readable message and displayed inline.

### Step 1.5 - Password Reset (`step === 'forgot_password'`)
Shown when the user clicks the "Mot de passe oublie ?" link in the login form.
- Prompts for the user's `email`.
- On submit: `sendPasswordResetEmail` -> `resetSent = true` -> confirmation message.
- Provides a "Retour a la connexion" button to return to the standard login screen.

### Step 2 - Profile completion (`step === 'profile'`)
Shown inline on the same page when a user is authenticated but has no Firestore profile with `phone`.

Triggered by the effect watching `user`, `userProfile`, and `loading`, unless `isSigningUp.current` is true.

When this appears:
- Google signup: user completes popup or redirect -> `onAuthStateChanged` fires -> no Firestore doc or no `phone` -> `setStep('profile')`.
- Edge case: returning user whose Firestore doc is missing or lacks `phone`.

Pre-fill:
- If the Google user has a `displayName`, it is pre-filled into `fullName`.
- The pre-fill never overwrites user input because it only runs when `fullName` is empty.

On submit: `setDoc` to `users/{uid}` -> `refreshProfile` -> `router.push(getRedirectTarget(lang))` (post-auth target; see **Redirect Logic**).

## State Management

| State | Type | Purpose |
|---|---|---|
| `step` | `'auth' \| 'profile' \| 'forgot_password'` | Controls which screen is shown |
| `isSignUp` | `boolean` | Toggles login vs signup in step 1 |
| `email`, `password` | `string` | Auth credentials |
| `fullName`, `dateOfBirth`, `phone` | `string` | Profile fields used in signup form and profile-completion step |
| `isSubmitting` | `boolean` | Disables submit buttons and shows loading state during async ops |
| `error` | `string \| null` | Inline error display |
| `resetSent` | `boolean` | Indicates if password reset email was sent successfully |
| `isSigningUp` (ref) | `boolean` | Guards against a race where `onAuthStateChanged` fires before the Firestore profile is saved during email signup |

## Key Helpers and Effects

- `getFirebaseErrorCode(err)`: Extracts a Firebase Auth `code` from an unknown error object.
- `getErrorMessage(err)`: Extracts a generic readable message from unknown errors.
- `getAuthErrorMessage(err, fallbackKey, fallbackMessage)`: `useCallback` that maps common Firebase Auth codes to localized i18n keys (`auth_error_*`) before falling back to the generic error message.
- `persistProfile(uid, userEmail)`: Writes the profile document to `users/{uid}` with **`{ merge: true }`** — it never wipes fields set elsewhere (`requester_id`/`type`/`role` from the admin space). Also records CNDP consent (`consentAccepted: true`, `consentAcceptedAt`).
- Google redirect resolution effect: on mount, calls `getRedirectResult(auth)` so redirect fallback responses are consumed and redirect errors are displayed inline.

## Redirect Logic

```
loading                       -> show spinner
user + profile.phone          -> show spinner; effect redirects to post-auth target
step === 'profile'            -> show profile completion form
step === 'forgot_password'    -> show password reset request form
default                       -> show auth form
```

**Post-auth target — `getRedirectTarget(lang)` (return-URL pattern):** all three success exits
(returning login, email signup, Google profile completion) redirect through this single helper.
It returns `?redirect=<path>` from the URL when present, else `/${lang}/profile` (unchanged default).
`?redirect` is honored ONLY for same-origin relative paths (`/fr/resultats`); protocol-relative
(`//host`) or backslash values fall back to `/profile` — open-redirect guard. This is what lets
`/resultats` bounce an unauthenticated patient to `/login?redirect=/fr/resultats` and land them
back on their results after sign-in, instead of stranding them on `/profile` (Dr Aziz's UX report:
patients reached the profile page and didn't know how to get to the results they came for). Same
reader idea as `readSignupRef`'s `?ref` — both parse `window.location.search`, independently.

Effects:
- Redirects to `getRedirectTarget(lang)` when `user && userProfile?.phone`.
- Sets `step = 'profile'` when `user && !userProfile?.phone && !isSigningUp.current`.
- Pre-fills `fullName` from `user.displayName` when entering step 2.
- Resolves Google redirect results through `getRedirectResult(auth)` for the redirect fallback flow.

## Firebase Auth Methods
- **Email login:** `signInWithEmailAndPassword`
- **Email signup:** `createUserWithEmailAndPassword` + immediate `setDoc` to `users/{uid}`
- **Google primary flow:** `signInWithPopup(auth, new GoogleAuthProvider())`
- **Google fallback:** `signInWithRedirect(auth, provider)` + `getRedirectResult(auth)`, used when the browser blocks the popup
- **Password reset:** `sendPasswordResetEmail`

## Firebase Client Auth Initialization
`getClientAuth()` in `src/config/firebase.ts` initializes Firebase Auth lazily in the browser with:
- `initializeAuth(app, { persistence, popupRedirectResolver })`
- Persistence fallbacks in order: `indexedDBLocalPersistence`, `browserLocalPersistence`, `browserSessionPersistence`, `inMemoryPersistence`
- `browserPopupRedirectResolver` for popup/redirect providers
- Fallback to `getAuth(app)` if Auth was already initialized elsewhere

## Firestore Profile Document (`users/{uid}`)
Written with `{ merge: true }` (both here and on the profile page), so it is never fully overwritten. Fields written by the auth/profile flow:

```ts
{ uid, fullName, dateOfBirth, phone, email, createdAt: ISO string,
  consentAccepted: true, consentAcceptedAt: ISO string }
```

Other fields on the same doc, written by the **admin space** (`/[lang]/admin` → `adminSetRequester` Cloud Function): `requester_id`, `type` (`patient` | `medecin` | `correspondant`), and `role` (`'admin'` for staff). These MUST survive profile edits — hence `merge: true` everywhere.

## Translations
Auth errors use `public/locales/[lang]/common.json` keys:
- `auth_error_unauthorized_domain`
- `auth_error_network`
- `auth_error_popup_blocked`
- `auth_error_google_cancelled`
- `auth_error_invalid_email`
- `auth_error_invalid_credentials`
- `auth_error_email_in_use`
- `auth_error_weak_password`
- `auth_error_too_many_requests`

## Notes for AI
- **Never use `setDoc` without `{ merge: true }` on `users/{uid}`:** the doc also holds admin-set fields (`requester_id`/`type`/`role`) and consent flags. A non-merge write wipes them and breaks the results/admin flow.
- **Consent is mandatory at registration:** `consentAccepted` gates both email signup and the Google profile-completion step. Do not remove the checkbox or its guards (CNDP / loi 09-08 requirement).
- **No redirect to /profile for completion:** All profile data is collected on the login page itself. Do not add a redirect-to-profile-for-completion pattern.
- **Post-auth redirect goes through `getRedirectTarget(lang)`:** do NOT hardcode `router.push(/${lang}/profile)` at the login / email-signup / profile-completion exits — all three must call the helper so a `?redirect=<internal path>` return-URL is honored (e.g. `/resultats` → login → back to `/resultats`). Keep the open-redirect guard (same-origin relative paths only, reject `//` and `/\`).
- **isSigningUp ref:** This ref is critical. Without it, the `useEffect` that sets `step = 'profile'` would fire between `createUserWithEmailAndPassword` and `setDoc`, causing the profile form to flash before saving completes.
- **Google pre-fill:** `user.displayName` is only available for Google users. The pre-fill effect only runs when `step === 'profile'` and `fullName` is empty.
- **Returning user without profile:** If a user somehow has auth but no Firestore doc, the profile step appears after login; same inline flow, no redirect needed.
- **Authorized domains:** Firebase Auth requires every production host used by patients (`laboelallali.com`, `www.laboelallali.com` if used, Firebase/Vercel hosts if still reachable) to be present in Firebase Console -> Authentication -> Settings -> Authorized domains. Missing domains produce `auth/unauthorized-domain`, now mapped to a readable inline message.
- **authDomain = app domain:** `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` is `laboelallali.com` (served by Firebase Hosting at `/__/auth/handler`, confirmed via `/__/firebase/init.json`). This keeps Google auth first-party, so both popup and redirect work without the third-party-cookie failure that previously returned from account selection with no signed-in user. If the app is ever served from a domain that does NOT serve `/__/auth/handler`, revert authDomain to `labo-el-allali-pwa.firebaseapp.com` and use popup only.
