# Page: /glabo

## Purpose
This page hosts the booking form for **at-home blood tests and collections (Prélèvement à Domicile)**. It allows patients to fill out their details, select dates/times, upload doctor prescriptions, and submit their at-home appointment request either securely to the Firestore database or formatted directly to the laboratory via WhatsApp.

## Directory & File
- **Path:** `src/app/[lang]/glabo/page.tsx`
- **Type:** Client Component (`"use client"`) with dynamic parameters unwrapping via `useState` and `useEffect`.

## Context & Key Components

### 1. State Management & Form Handling
- Tracks user text inputs: `nom` (Full Name), `telephone` (Phone Number), `email` (Optional), `adresse` (Home address), `lieuPrelevement` (Domicile vs. Travail), `instructionsAcces` (Building access codes), and `commentaires` (Optional description).
- `selectedDate` (Date): Selected calendar date utilizing the `react-datepicker` library.
- `selectedTime` (string): Time slot selection generated dynamically based on active days by `generateTimeSlots(selectedDate)`.
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
- **Time Slots:** `generateTimeSlots` filters out past hours if booking is attempted on the current day, or returns standard working hour increments.
