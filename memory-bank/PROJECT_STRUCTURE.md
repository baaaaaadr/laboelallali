# Project Structure: Laboratoire El Allali PWA

Last Updated: 2025-05-30

> **Note:** This document is automatically generated. Please run `node scripts/update-structure.js` after making structural changes.

This document outlines the file and directory structure of the PWA.
AI Assistant: Please refer to this for file locations and organizational patterns.
When creating new files, follow these patterns or suggest updates to this document.

## `/` (Root Directory)
- `.env.example`, `.env.local`: Environment variable configurations.
- `.eslintrc.json`, `eslint.config.mjs`: ESLint configuration files.
- `.firebaserc`: Firebase project aliases.
- `.gitignore`: Specifies intentionally untracked files that Git should ignore.
- `.windsurfrules`: **AI behavior and project conventions (Key Reference!)**.
- `firebase.json`: Firebase hosting and services configuration.
- `firestore.indexes.json`: Firestore index definitions.
- `firestore.rules`: Firestore security rules.
- `storage.rules`: Firebase Storage security rules.
- `i18n.ts`: Core i18next internationalization settings.
- `next-env.d.ts`: TypeScript type definitions for Next.js.
- `next-sitemap.config.js`: Configuration for `next-sitemap` generation.
- `next.config.js`: Next.js project configuration (PWA, webpack, etc.).
- `package-lock.json`, `package.json`: Project dependencies, scripts, and versions.
- `PLANNING.md`: Project planning document.
- `postcss.config.js`: PostCSS configuration.
- `README.md`: Project overview and setup instructions.
- `tailwind.config.js`: Tailwind CSS configuration with theme extensions.
- `TASK.md`: Project task tracking.
- `tsconfig.json`: TypeScript compiler configuration.
- `WORKFLOW.md`: Development workflow guidelines.
- `generate_context.ps1`: Script for generating context files.
- `clear-cache.ps1`: Script to clear Next.js cache and node_modules.
- *Test files (to be cleaned up):*
  - `simple-map-test.js`
  - `test-map-fixed.js`
  - `test-map.js`
  - `test-server.js`
- *Documentation:*
  - `docs/CSS_ARCHITECTURE_GUIDE.md`
  - `docs/CSS_REFACTORING_PROMPT.md`
  - `docs/STYLE_GUIDE.md` (if exists)

---
## `memory-bank/`
*Directory for AI persistent context files.*
- `AI_ASSISTANT_PROTOCOL.md`: **Primary guide for AI interaction and session start.**
- `productContext.md`: High-level project overview, vision, target users, core features.
- `decisionLog.md`: Log of key architectural and technical decisions.
- `PROJECT_STRUCTURE.md`: (This file) Detailed file structure outline.

---
## `public/`
*Static assets served directly.*
- `manifest.json`: PWA manifest file.
- `robots.txt`: Instructions for web crawlers.
- `sitemap.xml`, `sitemap-0.xml`: Sitemap files for SEO.
- `sw.js`: Service worker script (potentially managed by `next-pwa`).
- `workbox-e43f5367.js`: Workbox library file for the service worker.
- `404.html`: Custom 404 page (if using static export or specific fallback).
- *Various .svg files (file.svg, globe.svg, next.svg, vercel.svg, window.svg) - General SVG assets.*
- **`contexts/`**: React context providers.
    - `ThemeContext.tsx`: Manages theme state (light/dark mode) and provides theme utilities.
      - Handles theme persistence in localStorage
      - Provides `useTheme` hook for theme management
      - Used by `ThemeSwitcher` component
    - *(Other context files as needed)*
- **`images/`**: Application images.
    - `hero-banner.jpg`: Main hero image for the homepage.
    - **`icons/`**: PWA and application icons.
        - `apple-touch-icon.png`
        - `icon-192x192-maskable.png`, `icon-192x192.png`
        - `icon-512x512-maskable.png`, `icon-512x512.png`
        - `ios-share-icon.png`: Icon for iOS "Add to Home Screen" prompt.
    - **`leaflet/`**: Default marker icons for Leaflet maps.
        - `marker-icon-2x.png`, `marker-icon.png`, `marker-shadow.png`
    - **`screenshots/`**: Example screenshots of the application.
        - `desktop-catalog.png`, `mobile-home.png`
- **`locales/`**: i18n translation JSON files.
    - `.gitkeep`: Placeholder to keep the directory in Git if empty.
    - **`ar/`**: Arabic translations.
        - `appointment.json`, `catalog.json`, `common.json`, `glabo.json`
    - **`fr/`**: French translations.
        - `appointment.json`, `catalog.json`, `common.json`, `glabo.json`

---
## `src/`
*Main application source code.*
- `custom.d.ts`: Custom TypeScript type definitions.
- `env-check.js`: Script for checking environment variables (utility).
- `i18n.server.ts`: i18next server-side setup and initialization.
- `middleware.ts`: Next.js middleware (primarily for i18n routing).
- **`app/`**: Next.js App Router pages, layouts, and global styles.
    - `favicon.ico`: Application favicon.
    - `globals.css`: Global stylesheets, Tailwind base/components/utilities, custom global classes.
      - **Button Styling (Tailwind v4 Compatibility):**
        - Use simple global CSS classes for button backgrounds (e.g., `.button-style-bordeaux`)
        - Define hover states in CSS, not with Tailwind variants
        - Avoid `@apply` for complex button styles
        - Use Tailwind utilities for layout and spacing only
        - **Mobile Menu Button Classes:** `.menu-whatsapp-button`, `.menu-pwa-button`, `.menu-language-button` with proper hover and focus states
        - See Decision Log DL-009 for detailed patterns and rationale
    - `layout.tsx`: Root layout for the entire application.
    - `metadata.ts`: Default metadata for the application.
    - **`(lang)/`**: Dynamic segment for language-specific routes (e.g., `/fr/...`, `/ar/...`).
        - `layout.tsx`: Root layout for the language segment (applies to all pages within this language).
        - `page.tsx`: Homepage component for the specific language.
        - `HomeClient.tsx`: Client component used within the homepage.
        - `metadata.ts`: Metadata specific to the language segment or homepage.
        - **Test directories (development only):**
          - `test-styles/`: Styling tests and experiments
          - `header-test/`: Header component testing
          - `image-test/`: Image optimization and testing
        - **`analyses/`**: Analysis catalog feature.
            - `page.tsx`: Page component for displaying the analysis catalog.
        - **`contact/`**: Contact feature.
            - `page.tsx`: Page component for the contact page.
        - **`glabo/`**: Home service (GLABO) request feature.
            - `page.tsx`: Page component for GLABO requests.
        - **`rendez-vous/`**: Appointment booking feature.
            - `page.tsx`: Page component for booking appointments.
- **`components/`**: Reusable React components.
    - `BaseStyles.tsx`: Component to include base global styles or font links.
    - `EnvironmentScript.tsx`, `EnvProvider.tsx`: Components related to environment variable handling/providing.
    - `RTLAdditionalStyles.tsx`, `RTLStylesProvider.tsx`: Components/Providers for handling RTL-specific styling.
    - `SimpleMap.tsx`: A basic map component (likely Leaflet).
    - *`PWAInstallButton.tsx.new` - Draft/backup file (to be reviewed for cleanup)*
    - **`common/`**: General-purpose, reusable UI components.
        - **`buttons/Button.tsx`**: Generic button component.
        - **`cards/Card.tsx`**: Generic card component.
        - `ThemeSwitcher.tsx`: Toggle button for switching between light and dark themes.
    - **`features/`**: Components specific to application features.
        - **`catalog/`**: Components for the analysis catalog.
            - `AnalysisCard.tsx`: Displays a single analysis item.
            - `TotalCalculator.tsx`: Calculates total price for selected analyses.
        - **`home/HeroBanner.tsx`**: Hero banner for the homepage.
        - **`pwa/`**: Components related to PWA functionality.
            - `IOSInstallBanner.tsx`: Banner for iOS "Add to Home Screen" instructions.
            - `PWABanner.tsx`: General PWA install prompt banner.
            - `PWAComponents.tsx`: Potentially a wrapper or collection of PWA UI elements.
            - `PWAInstallButton.tsx`: The official PWA install button with multiple variants (button, banner, footer).
            - `ServiceWorkerRegistration.tsx`: Logic for registering the service worker.
    - **`layout/`**: Layout structure components.
        - `Footer.tsx`: Application footer.
        - `Header.tsx`: Application header/navigation bar.
        - `MainLayout.tsx`: Main content area wrapper/layout.
        - `BottomNav.tsx`: Mobile-only bottom navigation bar with 4 main navigation items (Home, Analyses, RDV, Contact).
    - **`providers/TranslationsProvider.tsx`**: React Context provider for i18next translations.
- **`config/`**: Configuration files for the application.
    - `firebase.ts`: Firebase SDK initialization and configuration.
- **`constants/`**: Application-wide constant values.
    - `contact.ts`: Contact information constants (phone numbers, email, address).
- **`hooks/`**: Custom React hooks.
    - `useInstallPrompt.ts`: Hook for managing PWA installation prompt logic.
    - `useLabStatus.ts`: Hook for calculating lab opening/closing status with real-time countdown functionality.
- **`lib/`**: Utility libraries or external scripts.
    - `sw.js`: (Duplicate of `public/sw.js`? Check which one is active or if this is a source file copied to public).
- **`styles/`**: Styling-related files.
    - `leaflet.css`: Base CSS for Leaflet maps.
    - `theme.ts`: **Centralized design tokens (colors, typography, spacing, component styles) - Key Reference!**
- **`types/`**: TypeScript type definitions and interfaces.
    - `next-i18next.d.ts`: Type definitions for `next-i18next`.
    - *(Should also contain custom types like `Analysis.ts`, `User.ts` etc. as project grows)*

---
## `functions/`
*Firebase Cloud Functions backend logic.*
- `package.json`, `package-lock.json`: Dependencies for Cloud Functions.
- `tsconfig.json`: TypeScript configuration for Functions.
- `.eslintrc.js`, `eslint.config.cjs`: ESLint configuration for Functions.
- `.gitignore`: Git ignore for Functions directory.
- **`src/`**: Source code for Cloud Functions.
    - `index.ts`: Main entry point for deploying Cloud Functions (e.g., HTTPS triggers, Firestore triggers).
    - *(May contain subdirectories for utilities or grouped functions as it grows)*
- **`node_modules/`**: (Exists, content not detailed) - Dependencies for Cloud Functions.

---
## Other Top-Level Directories
- `.firebase/`: Firebase CLI local cache and configuration.
- `.next/`: Next.js build output and cache.
- `.vscode/`: VS Code editor specific settings.
- `docs/`: Project documentation and guidelines.
- `node_modules/`: Project dependencies (automatically generated).
- `scripts/`: Development utility scripts.
  - `generate_context.ps1`: Generates context files for AI assistance.
  - `update-structure.js`: Updates this structure document.

## Cleanup Recommendations
1. Remove backup files:
   - `src/app/[lang]/page.new.tsx`
   - Any `*.new.*` files
2. Review and potentially remove test files:
   - `simple-map-test.js`
   - `test-map-fixed.js`
   - `test-map.js`
   - `test-server.js`
3. Organize test directories under `__tests__/` if keeping them.

---
*(This structure is a snapshot and will evolve. AI: Please suggest updates when files are added/moved/deleted.)*