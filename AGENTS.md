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
    *   `scripts/concat-docs.js` — concatenates all AI context files into `docs/FULL_CONTEXT.md` for use with external AIs. Run with `npm run docs:concat`.
*   `/functions`: Firebase Cloud Functions backend code.

## 3. Coding Standards
*   **Functional Components Only:** Use React hooks. Do not use class components.
*   **Client vs Server Components:** Default to Server Components for performance. Explicitly use `"use client"` at the very top of files that require interactivity, hooks (`useState`, `useEffect`), or DOM access.
*   **Styling Strategy:** Use the defined semantic CSS classes from `DESIGN.md` in `globals.css` (e.g., `.button-fuchsia`, `.card`) over inline utility classes for core UI elements to ensure consistency.
*   **Localization (i18n):** Never hardcode user-facing strings. Always use `useTranslation('common')` and add keys to `public/locales/[lang]/common.json`.

## 4. Git & Deployment
*   **Git Script:** Use `npm run git` to push quickly.
*   **Firebase Hosting:** Use `npm run deploy:hosting` to build and deploy static Next.js assets to Firebase. Default full `npm run deploy` will attempt to build functions which may require missing environments.

## 5. Automatic AI Documentation — MANDATORY PROTOCOL

### At the start of every conversation
An agent MUST proactively read ALL files in `/docs/pages/` before starting any work. Do not rely on conversation summaries alone — the markdown files are the authoritative source of truth for each page.

### While working
Before editing any file inside `src/app/[lang]/[page]/`, read the corresponding `/docs/pages/[page].md` file first to load accurate context.

### After completing any task
If the task changed the **structure, components, state, props, or business logic** of a page:
1. Update `/docs/pages/[page].md` to reflect the new state accurately.
2. The doc must be good enough that a future agent reading ONLY that file has correct, complete context — no "see the code" shortcuts.
3. Do this BEFORE declaring the task complete.

### What the docs must contain (minimum)
- Purpose of the page
- All major components used (with file paths)
- All significant state variables (name, type, what they hold)
- Key handlers / derived state (e.g., `useMemo`, `useCallback`)
- Data fetching and mutation patterns
- Any non-obvious constraints or gotchas (auth requirements, dedup rules, etc.)
