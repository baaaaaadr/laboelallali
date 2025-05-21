# Product Context: Laboratoire El Allali PWA

## 1. Project Overview & Vision

**Product Name:** Laboratoire El Allali PWA (Progressive Web App)

**Core Purpose:** To modernize and enhance the patient experience for Laboratoire El Allali, a medical analysis laboratory in Agadir, Morocco. The PWA will serve as a primary digital interface for patients and, to a lesser extent, referring doctors.

**Vision:** To provide a seamless, intuitive, and reliable bilingual (French/Arabic) platform that empowers patients to manage their interactions with the laboratory, from information gathering and appointment booking to accessing their medical results, thereby improving accessibility, efficiency, and patient satisfaction.

**Target Users:**
*   **Primary:** Patients of Laboratoire El Allali (existing and new).
    *   Demographics: Agadir residents and surrounding areas, diverse age groups, varying levels of digital literacy.
    *   Needs: Easy access to lab info, simple appointment booking (lab/home), quick access to test results, clear understanding of test preparations and pricing.
*   **Secondary:**
    *   Referring Doctors: Access to patient results (with consent), lab service information.
    *   Laboratory Staff: Streamlined reception of appointment requests and prescription submissions.

## 2. Core Features (Patient-Facing Focus)

*   **Information Hub:**
    *   Lab contact details, opening hours, location (interactive map).
    *   Bilingual content (FR/AR).
    *   FAQ and medical glossary.
*   **Service Catalog & Pricing:**
    *   Browsable list of available medical analyses.
    *   Information on test preparation, delays, and pricing.
    *   Ability for users to select multiple tests to estimate total cost.
*   **Appointment Booking:**
    *   **At Laboratory:** Patients can select a date/time for an in-lab appointment.
    *   **Home Service (GLABO):** Patients can request a home visit for sample collection, providing address (with optional geolocation) and preferred time slots.
*   **Prescription Submission:**
    *   Patients can upload a photo or document of their medical prescription.
    *   This initiates contact with the lab for test identification and quoting.
*   **Results Access (Future/Phased):**
    *   Secure login for patients to view their analysis results (PDFs).
    *   Download and sharing capabilities.
    *   Initially may link to existing CyberLab system or use lab-provided credentials for a Firebase-managed system.
*   **PWA Capabilities:**
    *   Installable on user devices for app-like experience.
    *   Offline access to cached information (e.g., lab contact details, potentially viewed results).
    *   Push notifications (for appointment reminders, new results - Phase 2+).

## 3. Key Technologies & Architecture Principles

*   **Frontend:** Next.js (App Router), React, TypeScript, Tailwind CSS.
*   **Backend & Infrastructure:** Firebase (Auth, Firestore, Storage, Cloud Functions, Hosting).
*   **i18n:** `next-i18next` for FR/AR localization.
*   **Design:** Adherence to `Charte_Graphique.txt` (Bordeaux/Fuchsia theme) and `src/styles/theme.ts`.
*   **User Experience:** Focus on simplicity, accessibility (WCAG AA), and mobile-first responsive design.

## 4. High-Level User Flows to Consider

1.  **New Patient Inquiry:** Finds lab -> Checks services/prices -> Books appointment or submits prescription.
2.  **Existing Patient - Needs Analysis:** Books appointment (with/without prescription) -> Attends appointment -> Awaits results.
3.  **Existing Patient - Checks Results:** Logs in -> Views/downloads results.
4.  **Patient Needing Home Service:** Requests GLABO -> Provides details -> Awaits confirmation.

This document provides a snapshot of the project's intent and scope. Refer to `.windsurfrules` for specific technical implementation guidelines.