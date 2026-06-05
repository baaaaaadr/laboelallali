# Page: /login

## Purpose
This page manages patient access, signup, and authentication. It handles email/password logins, email registration with inline profile collection, and social login with Google. New users are never redirected to `/profile` to complete their information — everything is collected on this page.

## Directory & File
- **Path:** `src/app/[lang]/login/page.tsx`
- **Type:** Client Component (`"use client"`) using React hooks.

## Three-Step Auth & Onboarding Flow

### Step 1 — Auth (`step === 'auth'`)
Shown to all unauthenticated visitors. Switches between login mode and signup mode via `isSignUp`.

**Login mode (isSignUp = false):** email + password only.

**Signup mode (isSignUp = true):** 5 fields in a single form:
1. Nom complet (`fullName`)
2. Email
3. Mot de passe
4. Date de naissance (`dateOfBirth`)
5. Téléphone (`phone`)

On submit: `createUserWithEmailAndPassword` → `setDoc` (saves profile to Firestore) → `refreshProfile` → `router.push(/${lang}/profile)`.

### Step 1.5 — Password Reset (`step === 'forgot_password'`)
Shown when the user clicks the "Mot de passe oublié ?" link in the login form. 
* Prompts for the user's `email`.
* On submit: Calls `sendPasswordResetEmail` → Sets `resetSent = true` which displays a confirmation message.
* Provides a "Retour à la connexion" button to return to the standard login screen.

### Step 2 — Profile completion (`step === 'profile'`)
Shown inline on the same page (no redirect) when a user is authenticated but has no Firestore profile with `phone`. Triggered by a `useEffect` that watches `user` and `userProfile`.

**When this appears:**
- Google signup: user completes Google popup → `onAuthStateChanged` fires → no Firestore doc found → `setStep('profile')`.
- Edge case: returning user whose Firestore doc is missing or lacks `phone`.

**Pre-fill:** If the Google user has a `displayName`, it is pre-filled into the `fullName` field.

On submit: `setDoc` (saves to Firestore) → `refreshProfile` → `router.push(/${lang}/profile)`.

## State Management

| State | Type | Purpose |
|---|---|---|
| `step` | `'auth' \| 'profile' \| 'forgot_password'` | Controls which screen is shown |
| `isSignUp` | `boolean` | Toggles login vs signup in step 1 |
| `email`, `password` | `string` | Auth credentials |
| `fullName`, `dateOfBirth`, `phone` | `string` | Profile fields (used in both signup form and step 2) |
| `isSubmitting` | `boolean` | Disables button and shows `...` during async ops |
| `error` | `string \| null` | Inline error display |
| `resetSent` | `boolean` | Indicates if password reset email was sent successfully |
| `isSigningUp` (ref) | `boolean` | Guards against a race where `onAuthStateChanged` fires before the Firestore doc is saved during email signup — prevents `step` from being set to `'profile'` prematurely |

## Redirect Logic

```
loading               → show spinner
user + profile.phone  → show spinner (useEffect redirects to /profile)
step === 'profile'    → show profile completion form
step === 'forgot_password' → show password reset request form
default               → show auth form (step 1)
```

`useEffect` #1: redirects to `/${lang}/profile` when `user && userProfile?.phone`.
`useEffect` #2: sets `step = 'profile'` when `user && !userProfile?.phone && !isSigningUp.current`.
`useEffect` #3: pre-fills `fullName` from `user.displayName` when entering step 2 (Google users).

## Firebase Auth Methods
- **Email login:** `signInWithEmailAndPassword`
- **Email signup:** `createUserWithEmailAndPassword` + immediate `setDoc` to `users/{uid}`
- **Google:** `signInWithPopup(auth, new GoogleAuthProvider())`
- **Password reset:** `sendPasswordResetEmail`

## Firestore Profile Document (`users/{uid}`)
Saved with these fields:
```ts
{ uid, fullName, dateOfBirth, phone, email, createdAt: ISO string }
```

## Notes for AI
- **No redirect to /profile for completion:** All profile data is collected on the login page itself. Do not add a redirect-to-profile-for-completion pattern.
- **isSigningUp ref:** This ref is critical. Without it, the `useEffect` that sets `step = 'profile'` would fire between `createUserWithEmailAndPassword` and `setDoc`, causing the profile form to flash before saving completes.
- **Google pre-fill:** `user.displayName` is only available for Google users. The pre-fill `useEffect` only runs when `step === 'profile'` and `fullName` is empty, so it never overwrites user input.
- **Returning user without profile:** If a user somehow has auth but no Firestore doc (e.g. doc was deleted), the profile step appears after login — same inline flow, no redirect needed.
