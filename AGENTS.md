# Technical Execution Rules (AGENTS.md)

## 1. Tech Stack
*   **Framework:** Next.js 16+ (using App Router).
*   **Language:** TypeScript (strict mode preferred).
*   **Styling:** Tailwind CSS v4 in conjunction with plain CSS variables (see `globals.css`).
*   **Core Libraries:** 
    *   `react`, `react-dom` (React 19)
    *   `react-hook-form`, `@hookform/resolvers`, `yup` for form validation
    *   `react-i18next`, `i18next` for translations
    *   `react-leaflet`, `leaflet` for mapping
    *   `lucide-react`, `react-icons` for iconography
*   **Deployment & Backend:** Firebase (Hosting, Functions).

## 2. Directory Structure Conventions
*   `/src/app`: Next.js App Router root. Use `[lang]` directories for internationalization (e.g., `/en/`, `/fr/`, `/ar/`).
*   `/src/components`: Reusable React components. Use functional components and hooks only.
*   `/public/locales`: Contains JSON files mapping translations (`fr`, `ar`).
*   `/scripts`: Custom Node.js scripts for build tasks or generation tools.
*   `/functions`: Firebase Cloud Functions backend code.

## 3. Coding Standards
*   **Functional Components Only:** Use React hooks. Do not use class components.
*   **Client vs Server Components:** Default to Server Components for performance. Explicitly use `"use client"` at the very top of files that require interactivity, hooks (`useState`, `useEffect`), or DOM access.
*   **Styling Strategy:** Use the defined semantic CSS classes from `DESIGN.md` in `globals.css` (e.g., `.button-fuchsia`, `.card`) over inline utility classes for core UI elements to ensure consistency.
*   **Localization (i18n):** Never hardcode user-facing strings. Always use `useTranslation('common')` and add keys to `public/locales/[lang]/common.json`.

## 4. Git & Deployment
*   **Git Script:** Use `npm run git` to push quickly.
*   **Firebase Hosting:** Use `npm run deploy:hosting` to build and deploy static Next.js assets to Firebase. Default full `npm run deploy` will attempt to build functions which may require missing environments.

## 5. Automatic AI Documentation
*   **Reading Context:** Before editing any page in `/src/app/[lang]/`, agents MUST read its corresponding documentation file in `/docs/pages/*.md`.
*   **Updating Documentation:** If an agent modifies the structure, components, state, or logic of a page, they MUST update the corresponding markdown file in `/docs/pages/` so that future agents have accurate, up-to-date context.
