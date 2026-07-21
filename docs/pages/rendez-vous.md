# Page: /rendez-vous

## Purpose
This page manages **In-Laboratory Appointment Booking (Rendez-vous Laboratoire)**. Patients can request a time slot to visit the physical laboratory, select calendar dates, choose desired times, upload prescriptions, and dispatch requests either to the Firestore database or directly via WhatsApp.

## Directory & File
- **Path:** `src/app/[lang]/rendez-vous/page.tsx`
- **Type:** Client Component (`"use client"`) using dynamic parameters resolution.

## Context & Key Components

### 1. State Management & Advanced Pre-Uploading
- Renders standard inputs: Full Name, Phone, Email (Optional), Date, Hour, Comments, and Prescription files.
- **Date & hour are bound to the lab's real opening hours** (identical wiring to `/glabo`): `selectedDate` is seeded with `nextOpenDate(new Date())` and the `DatePicker` carries `filterDate={(date) => isOpenDay(date.getDay())}`, so dimanche (closed) cannot be picked; `generateTimeSlots(selectedDate)` derives the slots from `src/constants/labHours.ts` — Lun-Ven 07:30→18:15, Sam 07:30→12:45, dimanche vide. `handleDateChange` clears `selectedTime` when the new date no longer offers it (17:00 picked on a Tuesday then moved to a Saturday), so the lab never receives a request for a closed hour — always route date changes through it. Opening hours live in ONE file (`labHours.ts`); keep `LAB_HOURS` in `src/constants/contact.ts` and the `opening_hours_text` i18n key in sync with it. Known gap: past hours of the current day are still offered.
- **Pre-uploading Logic:** When files are selected in `MultiFileUploader`, the page initiates background uploads *immediately* rather than waiting for form submission.
  - A `useEffect` hooks into `prescriptionFiles`.
  - It tracks active upload promises using `uploadPromiseRef` and stores statuses ('uploading', 'done', 'error') in `fileUploadStates`.
  - If a patient clicks "Submit" while a file is uploading, the form submission is blocked.
  - Once completed, the final Firestore write reuses the generated Storage download URLs instantly, eliminating final loading times.

### 2. MultiFileUploader Component
- Reusable React component managing selected local files, previews, and background progress states.

### 3. Dual Booking Actions

#### A. Secure Database & Email Booking (`handleSubmit`)
1. Validates fields, asserts correct phone numbers, and checks background pre-uploads.
2. Displays standard sequential status tracker `SubmitProgressModal` (`uploading_image` -> `saving_database` -> `sending_email` -> `success`).
3. Saves record of type `"lab_appointment"` and status `"new_appointment_request"` in collection `appointmentRequests`.
4. Triggers admin email notifications via `/api/send-appointment` and resets all fields.

#### B. WhatsApp Redirection (`handleWhatsapp`)
1. Checks validation.
2. Awaits background pre-upload URLs.
3. Saves a record of status `"whatsapp_appointment_request"` in Firestore for reporting.
4. Builds a detailed multilingual WhatsApp message layout listing appointment specifications and prescription URLs.
5. On desktop, initiates a synchronous blank window popup (`window.open`) first to prevent browser popup blockers from intercepting the WhatsApp redirect.

## Notes for AI
- **Differences from at-home service (/glabo):** `/rendez-vous` handles bookings for physical visits, whereas `/glabo` handles home service requests. `/rendez-vous` also features the **Pre-uploading** performance optimization, which makes final form submissions significantly faster.
- **Popup blockers:** Make sure `window.open` is called first synchronously inside the user's click boundary.
