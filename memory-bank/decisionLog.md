# Decision Log: Laboratoire El Allali PWA

This log records key architectural, technical, and design decisions made during the development of the PWA.

---

**YYYY-MM-DD:** (Replace with today's date)

*   **Decision ID:** DL-001
*   **Decision:** Adopt Next.js with App Router as the primary frontend framework.
*   **Rationale:** For performance benefits (SSR/SSG), improved developer experience, robust routing, and strong community support. Aligns with modern React development.
*   **Alternatives Considered:** Create React App (CRA) - lacks SSR/SSG out-of-the-box.
*   **Impact:** Project structure, data fetching patterns, and routing will follow Next.js App Router conventions.

---

**YYYY-MM-DD:**

*   **Decision ID:** DL-002
*   **Decision:** Utilize Firebase as the comprehensive backend-as-a-service (BaaS) platform (Auth, Firestore, Storage, Functions, Hosting).
*   **Rationale:** Rapid development, generous free tier, integrated services, scalability, and good Next.js compatibility. Minimizes custom backend infrastructure management.
*   **Alternatives Considered:** Custom backend (e.g., Node.js/Express) - higher development overhead for initial phases. Other BaaS (Supabase) - Firebase has stronger local familiarity/tooling for this project.
*   **Impact:** Data modeling will be NoSQL (Firestore). Backend logic primarily in Cloud Functions. Authentication tightly coupled with Firebase Auth.

---

**YYYY-MM-DD:**

*   **Decision ID:** DL-003
*   **Decision:** Implement styling using Tailwind CSS with a custom theme defined in `src/styles/theme.ts`.
*   **Rationale:** Utility-first approach for rapid UI development, high customizability, and consistency. `theme.ts` allows JavaScript access to design tokens and a centralized theme definition.
*   **Alternatives Considered:** CSS Modules, Styled-Components. Tailwind chosen for speed and direct utility application.
*   **Impact:** Styling will primarily use Tailwind classes. `theme.ts` will be the source of truth for all design tokens. Custom components in `globals.css` or `theme.components` if needed.

---

**YYYY-MM-DD:**

*   **Decision ID:** DL-004
*   **Decision:** Use `next-i18next` for internationalization (French 'fr' and Arabic 'ar').
*   **Rationale:** Well-suited for Next.js, supports App Router, and handles language detection and routing.
*   **Impact:** All user-facing strings must be managed in `public/locales/` and accessed via `useTranslation` hook. RTL support for Arabic is critical.

---

**YYYY-MM-DD:**

*   **Decision ID:** DL-005
*   **Decision:** Employ `react-datepicker` for date selection in forms.
*   **Rationale:** Provides a consistent, accessible, and feature-rich date picker UI, reducing custom development effort. Supports localization.
*   **Impact:** Appointment and GLABO forms will use this component. Styling might need customization to fit the theme.

---

**YYYY-MM-DD:**

*   **Decision ID:** DL-006
*   **Decision:** For initial contact/appointment/GLABO forms, use `mailto:` links or pre-formatted WhatsApp `wa.me/` links for submission to the lab. Full backend processing via Cloud Functions to handle Firestore writes will be phased in.
*   **Rationale:** Allows rapid deployment of core contact functionalities while backend processing (e.g., direct Firestore writes from Cloud Functions triggered by forms) is being fully developed and tested. Reduces initial complexity for form submission.
*   **Alternatives Considered:** Building full API endpoints and direct Firestore write logic from client immediately.
*   **Impact:** Initial user experience for form submission will redirect to email/WhatsApp clients. Backend Cloud Functions will later handle these submissions more directly from the app (e.g., via HTTPS callable functions or Firestore writes from client triggering functions).

---

**2025-05-21:**

*   **Decision ID:** DL-007
*   **Decision:** Consolidate multiple PWA install button implementations into a single, comprehensive `PWAInstallButton.tsx` component.
*   **Rationale:** Multiple implementations created inconsistent user experiences and made maintenance more difficult. The consolidated component incorporates the best features from all versions, uses theme variables for styling, and provides multiple presentation variants (button, banner, footer).
*   **Alternatives Considered:** Keeping separate components for different use cases, but this would have led to code duplication and potential inconsistencies.
*   **Impact:** Simplified codebase, consistent styling using theme variables, and reduced maintenance overhead. All PWA installation UI needs can now be handled through this single component with appropriate props.

---
*(Add new decisions below this line as they are made)*