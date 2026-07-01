# Page: /admin

## Purpose
Staff space with two jobs:
1. **Encode a patient's CyberLab identity** (`requester_id` + `type`) by email — the browser equivalent of `functions/scripts/seed-requester.js`.
2. **Manage the team** (roles) — owners add/remove admins; owners and admins add/remove staff (stagiaires).

It does NOT create patient accounts (patients sign up themselves) and never shows medical results.

## Directory & File
- **Path:** `src/app/[lang]/admin/page.tsx`
- **Type:** Client Component (`"use client"`)

## Role model (single `role` field on `users/{uid}`)
Hierarchy, higher does everything lower can:
- **`owner`** (level 3): manage admins + everything below. (Bootstrapped: hassanelallali@gmail.com, azizelallali@gmail.com.)
- **`admin`** (level 2): add/remove **staff** + encode. Cannot touch admins/owners.
- **`staff`** (level 1, "stagiaire"): encode `requester_id`/`type` only.

`levelOf(role)` = `{owner:3, admin:2, staff:1}`. Page sections: encode (level ≥ 1), team management (level ≥ 2), the "add admin" form + admin-removal (level = 3).

## Access control (defense in depth)
1. **Page gate:** requires `user`; unauthenticated → redirect to `/[lang]/login`. If `level < 1` → "Accès refusé" card.
2. **Server gate:** every callable re-computes the caller's level from `users/{uid}.role` (never trusts the client) via `requireLevel(request, min)`. Hiding UI is not the boundary — the functions are.

## Context & Key Components
- `useAuth()` → `user`, `userProfile` (needs `role`), `loading`; derives `isStaff`/`isManager`/`isOwner`.
- Encode state: `email`, `lookup`, `requesterId`, `type`, `busy`, `error`, `saved`.
- Team state: `team` (Member[]), `teamBusy`, `teamError`, `teamMsg`, `newStaffEmail`, `newAdminEmail`.
- `callFn<T>(name, data)`: `getClientFunctions()` (region `europe-southwest1`) → `httpsCallable`.
- Encode: `handleSearch` → `adminLookupPatient`; `handleSave` → `adminSetRequester`.
- Team: `loadTeam` → `adminListStaff` (on mount if `isManager`); `addStaff`/`addAdmin`/`removeMember` via `adminSetStaff`/`adminSetAdmin`.
- i18n under `admin.*` in `public/locales/{fr,ar}/common.json`.

## Backend (Cloud Functions — `functions/src/admin/adminPatients.ts`)
All region `europe-southwest1`, all guarded by `requireLevel`:
- `adminLookupPatient(email)` (≥staff) → patient profile/identity, or `{ found:false }`.
- `adminSetRequester(email, requester_id, type)` (≥staff) → merges `{requester_id, type}` onto `users/{uid}` (Admin SDK, bypasses rules). Validates `type ∈ {patient,medecin,correspondant}`.
- `adminSetStaff(email, grant)` (≥admin) → set `role: 'staff'` / remove. Refuses if target is admin/owner.
- `adminSetAdmin(email, grant)` (owner only) → set `role: 'admin'` / remove. Refuses if target is owner.
- `adminListStaff()` (≥admin) → `{ members: [{uid,email,fullName,role}], callerLevel }`, sorted owner→admin→staff.

## Bootstrapping owners
An owner must exist before the UI can manage roles. First owners set out-of-band with `functions/scripts/make-admin.js <email> owner` (Admin SDK, needs `GOOGLE_APPLICATION_CREDENTIALS`). `role` lives on `users/{uid}` and survives profile edits because all `users/{uid}` writes use `{ merge: true }`.

## Notes for AI
- **Not in public nav** — reachable only by URL (`/[lang]/admin`), gated as above.
- Role changes take effect in a client only after the profile re-loads (full refresh / re-login), since `AuthContext` caches `userProfile` for the session.
- Never write `users/{uid}` without `{ merge: true }` (holds `role`/`requester_id`/`type`/consent).
- Firestore rules keep `users/{userId}` client access to own-doc only; cross-user writes happen ONLY through these Admin-SDK callables. Do not loosen `firestore.rules`.
- Out of scope (future): account creation from admin, patient search by name/phone, audit log of role/identity changes.
