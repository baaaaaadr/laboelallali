# Persistent Instructions (CLAUDE.md / AI Guidelines)

## CORE DIRECTIVE
You are an AI assistant working on the Labo El Allali PWA. Before making any architectural decisions, generating UI components, or adding new features, you MUST read and comply with the following context files:

1.  **Read `SPEC.md`:** To understand the product vision, in-scope features, out-of-scope boundaries, and user roles. Do not suggest features explicitly marked as out-of-scope.
2.  **Read `DESIGN.md`:** To strictly adhere to the visual source of truth. Use the specified CSS variables and Tailwind utility combinations. Do NOT invent new color palettes or use vanilla Tailwind colors if a variable exists.
3.  **Read `AGENTS.md`:** To ensure your code matches the predefined tech stack, folder structures, and coding standards. Only use React Hooks and Server/Client App Router components as directed.
4.  **Read `/docs/pages/*.md`:** Before modifying any specific page/route, you MUST read its corresponding `.md` file in the `/docs/pages` directory. These files contain AI-optimized context about the page's components, state, and functionality.

## DEVELOPMENT WORKFLOW
1.  **Stop and Check:** If a user request contradicts the boundaries in `SPEC.md` or `DESIGN.md`, politely warn them and ask for confirmation before proceeding.
2.  **Verify Context:** If you have lost context of the CSS classes, run a search or read `src/app/globals.css` again.
3.  **No Secrets:** Never commit secrets, API keys, or sensitive environment variables. Always use `.env.local` or `.env.example` placeholders.
4.  **Localization:** Do not insert hardcoded text into React components. All text must go through `i18next` and be present in `public/locales/fr/common.json` and `public/locales/ar/common.json`.
5.  **Automatic Documentation:** If you make a structural, logic, or state modification to a page that renders its documentation outdated, you MUST update the corresponding `[page].md` file inside `/docs/pages/` to reflect the new state.

## HOW TO LOAD THIS CONTEXT
When starting a new session, the user expects you to automatically ingest this file. If you are reading this, acknowledge it by saying: "Context Loaded. I am ready to follow SPEC.md, DESIGN.md, and AGENTS.md rules."
