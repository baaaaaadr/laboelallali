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

**2025-05-22:**

*   **Decision ID:** DL-008
*   **Decision:** Adopt Tailwind CSS v4 with specific configuration for Next.js 15+ compatibility.
*   **Rationale:** To leverage the latest Tailwind features while ensuring stable theming and build processes. The configuration addresses known issues with Tailwind v4 in Next.js 15+ environments, particularly on Windows.
*   **Key Configuration Details:**
      - Use `postcss.config.js` (CommonJS) instead of `.mjs` to avoid module scope issues
      - Configure PostCSS to use `@tailwindcss/postcss` plugin instead of direct `tailwindcss` reference
      - Define custom colors through CSS classes in `globals.css` as a workaround for v4 theme extension limitations
      - Use `@import "tailwindcss";` in CSS files for better v4 compatibility
      - Clear Next.js cache (`rm -rf .next`) when making configuration changes
*   **Impact:** Ensures consistent styling across the application while working around Tailwind v4's custom theming limitations. May require using CSS classes or inline styles for brand colors until v4 theme extension matures.
*   **Alternatives Considered:** 
      - Downgrading to Tailwind v3 for more stable theming
      - Using CSS Modules or other CSS-in-JS solutions

---

**2025-05-22:**

*   **Decision ID:** DL-009
*   **Decision:** Establish standardized button styling patterns for Tailwind CSS v4 compatibility
*   **Rationale:** After extensive debugging, we identified consistent issues with button styling in Tailwind v4, particularly with background colors and complex class applications. This decision documents the working patterns and best practices.
*   **Key Findings & Patterns:**
      1. **Arbitrary Background Colors:** Avoid using arbitrary values (e.g., `bg-[#FF4081]`) directly on `<button>` elements as they may not render consistently.
      2. **Global CSS Classes:** Use simple, dedicated global CSS classes in `globals.css` for button backgrounds and text colors (e.g., `.button-style-fuchsia { background-color: #FF4081; }`).
      3. **Complex Classes:** Avoid applying complex global classes with multiple properties (especially those using `@apply`) directly to raw `<button>` elements.
      4. **Component Usage:** When using button components, apply simple global classes for core styles and use Tailwind utilities for layout and spacing.
      5. **Hover States:** Define hover states within the global CSS class rather than using Tailwind's hover variants for background colors.
*   **Implementation Strategy:**
      - Define simple, single-purpose global classes for button variants
      - Use Tailwind utilities for layout and spacing
      - Avoid `@apply` for complex button styles
      - Test all button variants across different components and states
*   **Impact:** Ensures consistent button styling across the application while working around Tailwind v4's limitations with button elements. This approach provides reliable theming and maintainability.
*   **Alternatives Considered:**
      - Using inline styles (less maintainable)
      - Creating wrapper components for all buttons (increased complexity)
      - Downgrading to Tailwind v3 (would lose v4 features)

---

**2025-05-22:**

*   **Decision ID:** DL-010
*   **Decision:** Adopt Simple Global Classes for Button Backgrounds in Tailwind v4
*   **Rationale:** After extensive testing, we've identified that complex global classes (even those using plain CSS) and arbitrary values fail to properly apply background colors to `<button>` elements in our Tailwind v4 + Next.js 15 setup. Only simple, single-property global CSS classes reliably work for button backgrounds.
*   **Key Findings:**
      1. Complex global classes (like `.btn-primary`) fail to apply background colors to buttons, even when defined with plain CSS
      2. Arbitrary values (e.g., `bg-[#FF4081]`) also fail on button elements
      3. Simple global classes (e.g., `.bg-bordeaux-custom { background-color: #800020 }`) work reliably
      4. This behavior is consistent across both raw buttons and buttons inside components
*   **Implementation Strategy:**
      - Use simple, single-purpose global CSS classes for button backgrounds and text colors
      - Define these classes in `globals.css` with minimal properties (only `background-color` and `color`)
      - Apply all other styling (padding, borders, hover states, etc.) using Tailwind utility classes directly on elements
      - Avoid using `@apply` for button styles
      - Example:
        ```css
        /* In globals.css */
        .btn-bg-bordeaux { background-color: #800020; color: white; }
        .btn-bg-fuchsia { background-color: #FF4081; color: white; }
        
        /* In component */
        <button className="btn-bg-bordeaux px-4 py-2 rounded hover:opacity-90">
          Button Text
        </button>
        ```
*   **Impact:** This approach ensures reliable button styling while working around Tailwind v4's limitations. It maintains maintainability by keeping color definitions in one place while allowing for flexible composition of other styles.
*   **Alternatives Considered:**
      - Continuing to use complex global classes (proven unreliable)
      - Using inline styles (less maintainable, harder to theme)
      - Downgrading to Tailwind v3 (would lose v4 features)
      - Using CSS Modules or other CSS-in-JS solutions (adds complexity)

---

**2025-05-27:**

*   **Decision ID:** DL-011
*   **Decision:** Refined Dark Mode Color Palette for Improved Brand Identity and Readability
*   **Rationale:** The initial dark mode implementation used harsh, monochromatic colors that didn't align well with the brand identity. The new palette introduces subtle bordeaux undertones to maintain brand consistency while ensuring excellent readability and visual hierarchy.
*   **Key Changes:**
      1. **Background Hierarchy:** Replaced pure black backgrounds with warm, bordeaux-tinted darks:
         - Default: `#1A0F12` (dark with bordeaux hint)
         - Secondary: `#241418` (elevated surfaces)
         - Tertiary: `#2E1A1F` (hover states, most elevated)
      2. **Brand Colors:** Refined bordeaux and fuchsia for better dark mode contrast:
         - Bordeaux: `#D64669` (brighter, more vibrant)
         - Fuchsia: `#FF79A8` (softer, more readable)
      3. **Text Colors:** Warm whites and muted roses for better readability:
         - Primary: `#F5F5F5` (warm white)
         - Secondary: `#C8B5BA` (muted rose)
      4. **Footer Gradient:** Elegant gradient with bordeaux-fuchsia tones instead of harsh blacks
      5. **Component Refinements:** Updated shadows, hover states, and interactive elements for consistency
*   **Impact:** 
      - Improved visual hierarchy and readability in dark mode
      - Maintained brand identity across light/dark themes
      - Enhanced user experience with softer, more comfortable dark theme
      - Better accessibility with improved contrast ratios
*   **Alternatives Considered:**
      - Pure gray dark mode (would lose brand identity)
      - Keeping original harsh black backgrounds (poor user experience)
      - Using default Material Design dark palette (too generic)

---
*(Add new decisions below this line as they are made)*