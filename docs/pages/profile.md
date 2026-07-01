# Page: /profile

## Purpose
This page handles the route `/profile`. It manages the user's patient profile, handles profile completion requirements, and allows users to view and update their personal details.

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

## Data Fetching & Mutations
- **Read:** Integrated with `useAuth` which loads user profile documents from the `users` Firestore collection on auth state changes.
- **Write:** Updates are written via `setDoc(doc(db, 'users', user.uid), {...}, { merge: true })` to Firestore. **`merge: true` is required** so a profile edit never wipes fields set elsewhere on the same doc (`requester_id`/`type`/`role` from the admin space, `consentAccepted*`, `createdAt`). Submitting also calls `refreshProfile()` to sync the context state.

## Notes for AI
- **Always write with `{ merge: true }`:** the `users/{uid}` doc also holds `requester_id`/`type`/`role` (admin space) and consent flags. A non-merge `setDoc` wipes them and breaks the results/admin flow.
- **Mandatory Phone Field:** The `phone` field is strictly required to successfully create or update a profile. Legacy profiles without a phone number will be redirected to complete it.
- **Auth Email Constraints:** Do not attempt to add editing capabilities for the `email` field inside this profile component, as email updates must be done with Firebase Auth credentials reauthentication.
