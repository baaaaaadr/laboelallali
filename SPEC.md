# Functional Blueprint (SPEC.md)

## 1. Product Vision
Labo El Allali PWA is a digital portal for a medical analysis laboratory in Agadir, Morocco. Its primary goal is to provide a comprehensive, mobile-first experience allowing patients to easily access laboratory services, book appointments, request home sampling, and view the catalog of tests.

## 2. Core Features (In-Scope)
*   **i18n Support:** French (primary) and Arabic (secondary) localization.
*   **Home Sampling (GLABO):** Users can request blood withdrawals at their home or workplace. Includes a form with geolocation capabilities.
*   **Appointment Booking:** A form to book visits to the physical laboratory.
*   **Analysis Catalog:** Patients can select required analyses, calculate an estimated total cost, and send choices to the lab via WhatsApp.
*   **Progressive Web App (PWA):** Must be installable on mobile devices (iOS/Android) and desktop, providing a native-app-like experience.
*   **Contact & Map Integrations:** Direct links to call, WhatsApp, and Google Maps for directions.
*   **Dark/Light Mode:** First-class support for system and user-defined themes.

## 3. Out of Scope
*   Access to live patient results (No patient portal/login system is implemented locally).
*   Live payment gateways (Payments are handled on-site or via WhatsApp negotiation).
*   Complex backend CMS (Information is largely static or updated via code, though basic Firebase services may route form emails).

## 4. User Roles
*   **Patient / Visitor (Anonymous):** The main user browsing the app, selecting analyses, and sending requests via WhatsApp or email.

## 5. Success Criteria
*   The application must load extremely fast (Next.js server-side static generation).
*   The UI must perfectly adapt to both LTR (French) and RTL (Arabic) alignments.
*   Forms must fail gracefully and validate required fields before delegating to external channels (WhatsApp/Email).
