# Page: /login

## Purpose
This page manages patient access, signup, and authentication. It handles email/password login, email registration with inline profile collection, password reset, and Google social login. New users are never redirected away to `/profile` to complete their information; missing profile details are collected inline on this page.

Google auth uses `signInWithPopup` as the primary flow on desktop, mobile browser, and installed PWA contexts. `signInWithRedirect` is used as a fallback only when the browser blocks the popup (`auth/popup-blocked`). `.env.local` sets `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="laboelallali.com"` with the stated intent of keeping both flows first-party. **⚠ MEASURED septembre 2026: that is NOT what production does.** Capturing the popup on `https://www.laboelallali.com/fr/login` shows it opening `https://labo-el-allali-pwa.firebaseapp.com/__/auth/handler` — the Firebase auto-init defaults injected by the web-frameworks deploy win over the env value — while the same capture on the dev server correctly uses `laboelallali.com`. So in production the auth relay IS cross-domain. Consequence is narrow but real: `signInWithPopup` still works (the popup is first-party to `firebaseapp.com` and posts back to its opener), but the `signInWithRedirect` fallback depends on third-party storage and is the flow that Safari/ITP and third-party-cookie phase-out break. Since redirect only triggers when the browser blocks popups, the exposure is an iOS Safari user with popups blocked. **Do not repeat the old claim without re-capturing the popup URL.**

## Directory & File
- **Path:** `src/app/[lang]/login/page.tsx`
- **Type:** Client Component (`"use client"`) using React hooks.

## Three-Step Auth & Onboarding Flow

### Step 1 - Auth (`step === 'auth'`)
Shown to all unauthenticated visitors. Switches between login mode and signup mode via `isSignUp`.

**Visual order, reworked in août 2026 (demandes n° 19 and 21) — Google comes FIRST:**
1. Header (logo tile, `sign_in`/`create_account`, subtitle).
2. **Help texts** — `login_help.intro` ("Retrouvez toutes vos analyses en vous connectant ici avec votre compte Google.") and `login_help.no_google`, an external link to `accounts.google.com/signup?hl={fr|ar}` so Google greets the patient in their own language.
3. **The error block** — moved OUT of the `<form>`. `handleGoogleLogin` also calls `setError`, and with Google above the form a Google error would otherwise render far below the button that produced it.
4. **The Google button**, full width. Promoted **by hierarchy, not by colour**: Google's branding rules require the white/black/blue button with the official G mark, so it gets `border-2`, `text-base font-semibold` and a real label (`continue_with_google`) instead of the bare word "Google" it used to show.
5. **Separator `or_use_email`** — a NEW key. `or_continue_with` ("Ou continuer avec") introduced Google; it makes no sense now that it introduces the email form. The old key is left in place, unused, rather than having its meaning silently changed.
6. The email/password `<form>`.
7. The login↔signup toggle.

The third element the lab asked for in demande n° 21 — "un agent du laboratoire vous assiste" — is **deliberately absent**: it needs a call-back workflow (request storage, staff notification, an admin tab), which is a separately quoted line, not a sentence.

**Login mode (`isSignUp = false`):** email + password only.

**Signup mode (`isSignUp = true`):** 5 fields + a mandatory consent checkbox in a single form:
1. Nom complet (`fullName`)
2. Email
3. Mot de passe
4. Date de naissance (`dateOfBirth`)
5. Telephone (`phone`)
6. **Consent checkbox (CNDP / loi 09-08)** — `consentAccepted`, links to `/[lang]/confidentialite` (opens in a new tab). Signup is blocked (inline `consent_error`) until it is checked. The same checkbox is also shown in the Step 2 profile-completion form for Google users.

On email signup submit: consent guard -> `createUserWithEmailAndPassword` -> `persistProfile` (`setDoc` merge) -> `refreshProfile` -> **`autoRequestResultsAccess()`** (best-effort; see **Auto results-access request**) -> `router.push(getRedirectTarget(lang))` (post-auth target; see **Redirect Logic**).

On email login submit: `signInWithEmailAndPassword`. The auth context loads the Firestore profile; completed profiles are redirected to the post-auth target (`getRedirectTarget`, default `/${lang}/profile`), incomplete profiles stay on `/login` and show step 2.

### Google One Tap — one-click sign-in (septembre 2026)

Dr Aziz asked for "autodetection des comptes google loggués et login en un clic".
That is the *same mechanism* as the wrong-account bug fixed two days earlier, so the
resolution is: **make the identity visible before anything happens, and never sign in
without a tap.**

- `src/lib/auth/googleOneTap.ts` — loads the GSI script on demand, shows the One Tap
  card, exchanges the ID token via `signInWithCredential`. **`googleSignIn.ts` is not
  touched**: two paths, two guarantees — the card names the person, the explicit button
  keeps the full chooser.
- **`auto_select: false` is load-bearing and must never be flipped.** It is the one
  setting that re-creates the wrong-account bug, and worse: with zero interaction there
  is not even a flash of a popup for the patient to notice.
- `use_fedcm_for_prompt: true` is required (Chrome removed the legacy iframe path). The
  consequence is that `isNotDisplayed()` / `isSkippedMoment()` no longer report anything,
  so **a page cannot know whether the card appeared**. Only `isDismissedMoment()` survives
  — and a dismissal whose reason is `credential_returned` is a SUCCESS, not a refusal.
- **`GoogleSignInPrompt` arbitrates both solicitations**, so one component decides:
  One Tap first; its own card only if One Tap cannot run (no client id, script blocked,
  or six silent seconds — usually no Google session, or Chrome's post-dismissal
  cooldown). Falling back **closes the One Tap card first** (`google.accounts.id.cancel()`):
  two solicitations at once is the one thing that component has always refused.
  Closing the One Tap card counts as an answer → 30-day snooze, nothing else shown.
- **Google draws its OWN button inside the fallback card** (`renderGoogleButton`). This is the answer to "can the signed-in account appear directly in the widget?": with an active Google session and consent already granted, Google renders a **personalized** button — "Continuer en tant que <Nom>" with the avatar — and a click signs the patient in **with no popup at all**, the ID token arriving straight in the callback. With no session it degrades to the plain "Continuer avec Google", which opens the chooser. It shows ONE account (the browser's active session), never a list — a Google constraint, not ours. Our hand-made button is removed from the render as soon as Google's succeeds, and stays as the fallback when it does not. `initialize()` may only run once per page, so both One Tap and the button go through a single `ensureGsi()` and the credential is routed to whoever asked last.
### Why the button stayed generic — the answer, researched 04/09/2026

Reported repeatedly: the button says "Continuer avec Google", never "Continuer en tant que <Nom>",
and clicking it opens the `accounts.google.com` chooser. **Two causes composed**, and fixing either
one alone changes nothing on screen.

1. **`use_fedcm_for_button: true` was missing** (it defaults to `false`), so the button ran in legacy
   non-FedCM mode. It is an `IdConfiguration` option — `renderButton()` silently ignores it.
   Chrome desktop M125+ / Android M128+.
2. **No account had ever completed a Sign In With Google flow on the `laboelallali.com` origin.**
   The personalized button is only shown to a **returning** user: active Google session **plus** a
   prior SIWG flow on *this* origin, in *this* browser. A Firebase `signInWithPopup` does **not**
   qualify — it hands off to `labo-el-allali-pwa.firebaseapp.com/__/auth/handler`, a different
   origin, and it is not a FedCM flow. Since every patient signed in through the hand-made button,
   that record was never created, so the button could never personalize — whatever was configured.
   **Hence the second half of the fix: Google's own button is now the primary Google CTA on `/login`.**

**`use_fedcm_for_prompt` was REMOVED, not kept.** Google's reference now marks it
*"Deprecated: this attribute will be ignored if used"* — One Tap goes through FedCM unconditionally.
The comment that justified it ("without this the card never appears") was simply false.

**⛔ Never set `button_auto_select`.** It is the button-flow twin of `auto_select`: it signs a
returning visitor in while bypassing the account chooser — the exact wrong-account incident that
`googleOneTap.ts` exists to prevent. "Zero clicks, no dialog" is therefore **not** a deliverable here.

**Free side effect worth knowing:** under FedCM the dialog is drawn by Chrome and names
`laboelallali.com`, not the OAuth app. The ugly "Accéder à l'application
labo-el-allali-pwa.firebaseapp.com" line disappears on that path — **without** brand verification.
(Renaming the app in Google Auth Platform → Branding changes nothing until the brand is *verified*:
Google only shows the app name for verified apps, otherwise just the domain.)

**Testing it takes TWO visits, and the first one "failing" is the expected result.** Visit 1 shows the
generic button and the chooser — that flow is what CREATES the record. Personalization starts on
visit 2. Before testing: `chrome://settings/content/federatedIdentityApi` must not list the domain as
blocked, and the site's permissions may need resetting (Chrome mutes One Tap for weeks after ~3
dismissals). Add `?connexion=1` or the 30-day snooze will hide everything and look like a bad deploy.

**Who will still see the generic button, permanently:** a fresh Chrome profile, private browsing,
anyone who cleared site data, Safari and Firefox (no FedCM button mode), Chrome older than M125, and
**anyone with several Google sessions active** — Google degrades it deliberately. This is a
statistical improvement, not a universal change of screen. The hand-made button stays as the fallback.

**Still unverified empirically:** Google's own docs say the personalized button "has no impact on the
UX flows after the button is clicked" and that the displayed account "is not automatically selected".
Whether a short Chrome confirmation dialog appears after the click could not be settled from the
documentation — it needs a human on a real browser.

- **⚠ What CANNOT be done, asked twice and worth writing down once.** A website cannot read, list or display the visitor's Google accounts. There is no API for it — it is a deliberate privacy boundary, not a missing feature. Only Google's own surfaces may show them: the One Tap card (drawn by Chrome, anchored where Chrome decides — top-right on desktop — never inside our markup) or the account chooser popup. The personalized button (`renderButton`) shows **one** account at most, and Google degrades it to the plain "Continuer avec Google" when **several sessions are active**, which is the common case. So "list my accounts inside the little corner widget" is not achievable, and no amount of configuration changes that.
- **⚠ Do not `cancel()` One Tap on the fallback timeout.** An earlier version closed the card when falling back to ours, to guarantee a single solicitation. FedCM negotiates with Google over the network and is slower when several accounts are signed in, so the timeout was closing the card at the very moment it appeared — indistinguishable, from the field, from "One Tap never works". The window is 12s and the card is left alone; on desktop Chrome anchors it top-right and ours sits bottom-right, so they do not collide.
- **⚠ The 30-day snooze now silences One Tap too**, since both are the same solicitation arbitrated in one place. Consequence discovered in the field: someone who had closed the OLD card saw **absolutely nothing** — no card, no One Tap — and the console showed no `gsi/client` request at all, which reads like a broken deploy. It is not. The dismissal key is therefore **versioned** (`googleSignInPromptDismissedAt_v2`); bumping the suffix re-asks once, because the offer changed materially. Bump it only for a change of that size — it is not a way to re-ask someone who said no. **Debug recipe: if a tester reports "nothing appears", check `localStorage` for that key before suspecting anything else.** **`?connexion=1` on any page forgets the snooze and re-opens the prompt on the spot** — deliberately not dev-only, because the owner tests on a real phone where clearing a localStorage key by hand is not an option. Harmless: the worst it can do is offer a sign-in to someone who asked for it in the URL.
- Invariant preserved: after `signInWithCredential`, it still hands over to
  `/login?redirect=<current path>`. Profile completion and `autoRequestResultsAccess()`
  live only there; One Tap must never become a second place that creates accounts.
- **⚠⚠ THE FIREBASE DEPLOY DOES NOT APPLY `.env.local` TO THE CLIENT BUNDLE.** Discovered the hard way: One Tap worked in dev and did *nothing* in production — no card, and no request to `gsi/client` at all — because `NEXT_PUBLIC_GOOGLE_CLIENT_ID` was empty in the built JS, so `isOneTapConfigured()` returned false and the script was never even fetched. Independent proof it is not a fluke: `.env.local` sets `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=laboelallali.com`, yet production has always relayed through `labo-el-allali-pwa.firebaseapp.com` — firebase-tools injects its own web config and our file is ignored. **Any `NEXT_PUBLIC_*` value that lives only in `.env.local` will be `undefined` in production.** Ship such values as a literal fallback in the code (fine here — the client id is public), and verify by grepping the deployed chunk: `curl <chunk>.js | grep <the value>`.
- **`NEXT_PUBLIC_GOOGLE_CLIENT_ID`** — the Web client Firebase auto-created. **Not a
  secret**: it already travels in every OAuth URL the browser sends, and it is useless
  from an unauthorized origin. Declared in `.env.local`, `.env.example` (real value, so a
  fresh clone works) and the `env:` block of `next.config.js`, which enumerates public vars.
- **❌ CORRECTION (04/09/2026, from a real console log). An earlier note here claimed the three
  origins were already authorized and that no Cloud Console change was needed. That was WRONG, and
  the test behind it was insufficient: `initialize()` + `prompt()` do NOT validate the JavaScript
  origin, so they pass on an unauthorized one. `renderButton()` does — it loads an iframe from
  `accounts.google.com/gsi/button`, which returned **403** with
  `[GSI_LOGGER]: The given origin is not allowed for the given client ID`, and
  `accounts.google.com/gsi/status` returned 403 too. Interestingly **One Tap still worked** (FedCM
  does not go through that check), which is why the failure looked so selective.
  **To validate an origin, always exercise `renderButton`, never just `initialize`.** If One Tap ever stops appearing everywhere at once, re-check that
  list first: an unauthorized origin fails **silently**, with no error and no card.
- QA gotchas: Chrome puts One Tap in a cooldown after 3 dismissals ("I don't see it" is
  not a bug); and a browser with no Google session logs "Provider's accounts list is
  empty" + a FedCM `NetworkError` — both are expected there, and are exactly the case the
  fallback exists for.
- ⚠ **Not covered by an automated driver**: the signed-in path. A headless browser has no
  Google session, so the card itself cannot be exercised. Verified by driver: script loads,
  fallback timing, silent routes, 30-day snooze. **The one-tap-and-you-are-in path needs a
  human on a real browser signed into Google.**

Google submit (all of it lives in `src/lib/auth/googleSignIn.ts`, shared with `GoogleSignInPrompt`):
- Creates `new GoogleAuthProvider()`.
- **`provider.setCustomParameters({ prompt: 'select_account' })` — do not remove.** Without it Firebase sends NO `prompt` parameter to `accounts.google.com/o/oauth2/auth` (verifiable by capturing the popup's request), and Google is then allowed to reuse the browser's existing session once consent has been granted: the account chooser flashes open, closes on its own, and the patient is signed in as an account they never selected. Reported from the field in septembre 2026. On a phone shared within a family — the normal case for this lab — that silently opens the wrong person's account, on an app that displays medical results. `select_account` forces the chooser on every sign-in, for the redirect fallback too.
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

On submit: `setDoc` to `users/{uid}` -> `refreshProfile` -> **`autoRequestResultsAccess()`** (best-effort; see **Auto results-access request**) -> `router.push(getRedirectTarget(lang))` (post-auth target; see **Redirect Logic**).

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

## Auto results-access request (staff onboarding)

On **every completed signup** — email signup (`handleEmailAuth`, `isSignUp`) AND Google profile completion (`handleProfileSubmit`) — the page calls **`autoRequestResultsAccess()`** right after `refreshProfile()`, before the redirect. It invokes the shared `requestResultsAccess` callable once with `{ source: 'signup' }`, creating `resultAccessRequests/{uid}` = `pending` — the exact same document the "Demander l'accès à mes résultats" button on `/resultats` creates (that one passes `{ source: 'results_page' }`).

**Since août 2026 this also sends an email to the lab staff** (demande n° 18) — see `docs/pages/admin.md`. `source` is what tells whoever calls the patient back whether they asked for access themselves or were enrolled automatically at signup. It is client input, so the callable matches it against a server-side whitelist.

**Why (Dr Aziz):** the pending-requests queue doubles as the front desk's **onboarding / outreach list**. Every new registrant lands there automatically so a staff member can phone them and offer/explain the online-results service — the patient never has to find or press the button. This is deliberately fired for ALL new accounts, not only results-seekers.

**Guarantees / safety:**
- **Best-effort:** wrapped in try/catch + a 2.5 s `Promise.race` cap, so it never blocks or fails signup; a slow call still finishes in the background (soft client-side navigation keeps the request alive).
- **Idempotent:** the callable de-dupes per uid and returns `already_granted` when `requester_id` is already set — safe to call once per signup, and harmless next to the manual button (a later click just sees the existing pending request; `/resultats` then shows "Demande en attente").
- **Creation paths only:** NOT fired on plain login of an existing user — only the two signup exits. A team member who signs up generates one stray pending request; the dashboard already scopes request stats to non-team accounts, and staff can reject it.
- Requires a completed profile (`fullName` + `phone`), which both signup forms enforce, so the callable's `failed-precondition` guard never trips on this path.

## Firebase Auth Methods
- **Email login:** `signInWithEmailAndPassword`
- **Email signup:** `createUserWithEmailAndPassword` + immediate `setDoc` to `users/{uid}`
- **Google:** both flows live in **`src/lib/auth/googleSignIn.ts` → `signInWithGoogle()`**, extracted in août 2026 when `GoogleSignInPrompt` became a second caller. Popup first (`signInWithPopup`), full-page `signInWithRedirect` only on `auth/popup-blocked`. **That fallback exists in exactly one place — do not re-inline it.** The popup path works on most browsers, so a divergent copy of the blocked-popup branch would go unnoticed for months. Error *messages* stay with the callers (this page has `getAuthErrorMessage` + inline state; the banner just closes).
  - Note the contract: `signInWithGoogle()` resolving does **not** mean the user is signed in — on the redirect path the page navigates away and the result is consumed by `getRedirectResult(auth)` on mount here.
- **Password reset:** `sendPasswordResetEmail`

## Global sign-in prompt (`GoogleSignInPrompt`)
`src/components/features/auth/GoogleSignInPrompt.tsx`, added for demande n° 19 ("proposer de se connecter par gmail dès ouverture de l'app"). Modelled on `IOSInstallBanner`: a dismissible strip, never a modal, rendering `null` until it has something to say.
- **Mounted in `src/app/[lang]/layout.tsx`, NOT in `PWAComponents`.** That component `return null`s when `display-mode: standalone` — i.e. exactly inside the installed app, where the invitation matters most.
- Gating, all of which must hold: `!loading && user === null`; the current section is not in `HIDDEN_ROUTES` (`login`, `rendez-vous`, `glabo`, `profile`, `admin`, `resultats`, `confidentialite` — never interrupt a booking funnel, and `/resultats` already has its own auth CTA, two competing ones cancel out); no dismissal within 30 days; and on iOS, `iosInstallBannerDismissed` must already be set (one solicitation at a time).
- **Dismissal is a timestamp, not a boolean** (`googleSignInPromptDismissedAt` + 30-day snooze). A permanent `'true'` would kill the CTA on that device forever, including for someone who simply was not ready that day.
- **3-second delay before appearing.** On the first paint it read as a pop-up and covered the page before the visitor had seen any of it.
- Positioned `fixed`, `z-[900]` (below the PWA banner's `z-[999]`), offset by `var(--mobile-bottom-nav-offset)` so it never covers `BottomNav`.
- **THE INVARIANT — every Google account creation goes through `/login`.** A first Google sign-in produces an authenticated user with no Firestore profile and no phone number. Profile completion (Step 2) and `autoRequestResultsAccess()` exist **only on this page**. So after a successful `signInWithGoogle()` the banner does `router.push('/{lang}/login')` and hands over: the existing effect either shows Step 2 or forwards a complete profile to `getRedirectTarget(lang)`. Without that push, the banner would mint accounts that are authenticated, phone-less, and never enter the lab's onboarding queue — the exact opposite of its purpose.

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
- **Auto results-access request on signup:** both signup exits call `autoRequestResultsAccess()` before the redirect — it fires the shared `requestResultsAccess` callable so every new account auto-lands on the staff onboarding queue (Dr Aziz — see **Auto results-access request**). Keep it best-effort (never block signup) and do NOT also fire it on plain login. It reuses the existing callable, so no `functions` deploy is needed to change this behavior.
- **isSigningUp ref:** This ref is critical. Without it, the `useEffect` that sets `step = 'profile'` would fire between `createUserWithEmailAndPassword` and `setDoc`, causing the profile form to flash before saving completes.
- **Google pre-fill:** `user.displayName` is only available for Google users. The pre-fill effect only runs when `step === 'profile'` and `fullName` is empty.
- **Returning user without profile:** If a user somehow has auth but no Firestore doc, the profile step appears after login; same inline flow, no redirect needed.
- **Authorized domains:** Firebase Auth requires every production host used by patients (`laboelallali.com`, `www.laboelallali.com` if used, Firebase/Vercel hosts if still reachable) to be present in Firebase Console -> Authentication -> Settings -> Authorized domains. Missing domains produce `auth/unauthorized-domain`, now mapped to a readable inline message.
- **authDomain = app domain:** `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` is `laboelallali.com` (served by Firebase Hosting at `/__/auth/handler`, confirmed via `/__/firebase/init.json`). This keeps Google auth first-party, so both popup and redirect work without the third-party-cookie failure that previously returned from account selection with no signed-in user. If the app is ever served from a domain that does NOT serve `/__/auth/handler`, revert authDomain to `labo-el-allali-pwa.firebaseapp.com` and use popup only.
