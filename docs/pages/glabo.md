# Page: /glabo

## Purpose
This page hosts the booking form for **at-home blood tests and collections (Prélèvement à Domicile)**. It allows patients to fill out their details, select dates/times, upload doctor prescriptions, and submit their at-home appointment request either securely to the Firestore database or formatted directly to the laboratory via WhatsApp.

## Directory & File
- **Path:** `src/app/[lang]/glabo/page.tsx`
- **Type:** Client Component (`"use client"`) with dynamic parameters unwrapping via `useState` and `useEffect`.

## Context & Key Components

### 1. State Management & Form Handling
- Tracks user text inputs: `nom` (Full Name), `telephone` (Phone Number), `email` (Optional), `adresse` (Home address), `lieuPrelevement` (Domicile vs. Travail), `instructionsAcces` (Building access codes), and `commentaires` (Optional description).
- `now` (Date | null): `useNow()` (`src/hooks/useNow.ts`) — the browser clock, `null` until mount, then re-ticking every minute and on `visibilitychange`/`focus`/`pageshow`. **Never compute the current time during a render the server also performs**: these pages are prerendered at build time, so anything derived from `new Date()` in the render body gets baked into the static HTML (this is exactly what froze the home page's open/closed badge on "Ouvert"). The same hook backs `useLabStatus`.
- `selectedDate` (Date | null): `react-datepicker` value. Starts `null` (server + first client render agree, the field shows its placeholder) and is seeded in a `useNow` effect with `nextBookableDate(now)` — today if it still has a slot ahead, otherwise the next open day. The effect uses the functional form `current ?? …` so it never overwrites a choice the patient has already made.
- `selectedTime` (string): filled from `generateTimeSlots(selectedDate, now)` (`src/utils/timeSlots.ts`), whose hours come from the SAME `src/constants/labHours.ts` as the home page's open/closed badge — Lun-Ven 07:30→18:15, Sam 07:30→12:45, dimanche aucun créneau (last slot is always 15 min before closing). Passing `now` drops the slots of TODAY that have already passed: at 16h03 the form no longer offers 07:30.
- `filterDate={(date) => hasBookableSlots(date, now)}` greys out any day with nothing left to book — dimanche always, and today once its last slot has passed. react-datepicker applies the same predicate to a date TYPED in the field (`isDayDisabled` inside its `setSelected`), so a closed day cannot be entered by keyboard either.
- `handleDateChange` wraps `setSelectedDate`: it CLEARS `selectedTime` when the newly picked date no longer offers it (e.g. 17:00 chosen on a Tuesday, then the date is moved to a Saturday). Without it the `<select>` renders blank while still holding the stale value, and the lab receives a request for an hour it is closed. Wire any new date input through this handler, never through `setSelectedDate` directly.
- `prescriptionFiles` (File[]) & `filePreviews` (string[]): Tracks selected prescription files for upload.

### 2. MultiFileUploader Component
- Embedded component handling drag-and-drop or file selector uploads.
- Validates file extensions and limits size.
- Previews images/docs as raw blob URLs.

### 3. Submission Workflows

#### A. Secure Database & Email Booking (`handleSubmit`)
1. Performs validation on required fields and asserts correct Moroccan/international phone formats via `validatePhone`.
2. Triggers sequential progress overlay `SubmitProgressModal` tracking state changes (`uploading_image` -> `saving_database` -> `sending_email` -> `success`).
3. Uploads files to Firebase Storage in directory `ordonnances/` and maps resulting download URLs.
4. Adds appointment record of type `"home_service_appointment"` with status `"new_home_service_request"` into Firestore collection `appointmentRequests`.
5. Sends notification email to the lab admins via `/api/send-appointment` and displays completion state before resetting all form inputs.

#### B. Direct WhatsApp Redirection (`handleWhatsapp`)
1. Validates details.
2. Uploads any selected prescription files in the background to Firebase Storage to generate URLs.
3. Adds appointment tracking document of status `"whatsapp_home_service_request"` into Firestore.
4. Generates a fully formatted multilingual WhatsApp text message including a bulleted layout of appointment specifications and prescription URLs.
5. Performs standard device checks. On mobile, triggers an immediate redirection. On desktop, initiates a synchronous blank window popup beforehand (`window.open`) to avoid standard browser pop-up blocking actions during async calls.

## Styles & Visual Structure
- **Left Column:** A professional information card highlighting at-home services benefits ("Why Choose Us"): safety/sterilization, time-saving convenience, and flexibility. Includes a quick action card for urgent landline calls.
- **Right Column:** Fully styled multi-step interactive booking form utilizing premium design standards.

## Notes for AI
- **WhatsApp Blockers:** Do not run async operations (like Firestore writes or Storage uploads) *before* calling `window.open` on desktop systems, otherwise browsers will block the redirection as an unwanted popup. Ensure `window.open` is called first synchronously inside the user's click boundary.
- **Time Slots:** `generateTimeSlots(date, now)` returns 15-minute increments derived from `LAB_WEEKLY_HOURS` (`src/constants/labHours.ts`) — the single source of truth shared with the home page badge — minus the slots of the current day that have already passed. It stays a pure function of `(date, now)`; keep it that way (no `new Date()` inside) so it can be reasoned about and unit-tested, and so the caller controls the SSR-safe `null`. Weekday/`getHours` reads are in the VISITOR's timezone, deliberately: they pick a day in a calendar grid rendered in that timezone. Only "is the lab open right now" resolves the lab's own timezone, inside `labHours.ts`.
- **Never redefine opening hours locally.** `labHours.ts` is the only machine-readable schedule; the patient-facing text lives only in the `opening_hours_text` / `monday_to_friday` / `saturday_hours` i18n keys (fr + ar). The old French-only `LAB_HOURS` constant has been removed.
