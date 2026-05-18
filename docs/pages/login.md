# Page: /login

## Purpose
This page manages patient access, signup, and authentication. It handles email/password logins, email registration, and social login with Google.

## Directory & File
- **Path:** `src/app/[lang]/login/page.tsx`
- **Type:** Client Component (`"use client"`) using React hooks.

## Context & Key Components

### 1. State Management
- `isSignUp` (boolean): Toggles between the Login and Registration screens.
- `email` (string) & `password` (string): Captures credentials.
- `error` (string | null): Tracks and displays descriptive error notices.
- `isSubmitting` (boolean): Controls disabled states and visual spinner feedback during Firebase Auth operations.

### 2. Authentication Integration (`useAuth`)
- Queries `useAuth()` to check if a user is already signed in (`user`) or if the initial auth validation is in progress (`loading`).
- **Loading / Logged In Guard:** If `loading || user` is active, displays a global full-screen medical spinner (`MedicalLoader` style) to prevent page access.
- **Auto-Redirect:** An active `useEffect` automatically checks if `user` is non-null. When logged in, it redirects the client to their personal profile page at `/${lang}/profile`.

### 3. Firebase Auth Methods
All operations use the `getClientAuth()` helper loaded from `@/config/firebase` to ensure correct client-side client configuration:
- **Email & Password Login:** Calls `signInWithEmailAndPassword(auth, email, password)`.
- **Account Registration:** Calls `createUserWithEmailAndPassword(auth, email, password)`.
- **Google Social Login:** Initiates a Google popup flow via `signInWithPopup(auth, new GoogleAuthProvider())`.

## UI Design & Aesthetics
- Single clean form card styled with premium dark mode compatibility (`bg-[var(--background-card)]`, `.button-bordeaux`, `var(--text-primary)`).
- Lucide icons: `Mail`, `Lock`, `LogIn`, `UserPlus`.
- Standard Google brand assets and SVGs.

## Notes for AI
- **Profile Enforcements:** Registration does not prompt for phone numbers or dates of birth immediately. The validation is enforced on `/profile` after redirect. If the user completes registration, they will be blocked from downloading devis until they complete their profile details on `/profile`.
- **Auth Errors:** Displayed errors are mapped from standard Firebase Auth error codes (e.g. `auth/user-not-found`, `auth/wrong-password`) to readable notices.
