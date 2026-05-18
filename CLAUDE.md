# Persistent Instructions (CLAUDE.md / AI Guidelines)

## CORE DIRECTIVE
You are an AI assistant working on the Labo El Allali PWA. Before making any architectural decisions, generating UI components, or adding new features, you MUST read and comply with the following context files:

1.  **Read `SPEC.md`:** To understand the product vision, in-scope features, out-of-scope boundaries, and user roles. Do not suggest features explicitly marked as out-of-scope.
2.  **Read `DESIGN.md`:** To strictly adhere to the visual source of truth. Use the specified CSS variables and Tailwind utility combinations. Do NOT invent new color palettes or use vanilla Tailwind colors if a variable exists.
3.  **Read `AGENTS.md`:** To ensure your code matches the predefined tech stack, folder structures, and coding standards. Only use React Hooks and Server/Client App Router components as directed.
4.  **Read ALL `/docs/pages/*.md` files:** At the start of every conversation, BEFORE responding to the user's first task, proactively read every `.md` file in `/docs/pages/` using the Read tool. Do not wait for the user to ask. These files are the authoritative, AI-optimized record of each page's components, state, and logic.

## DEVELOPMENT WORKFLOW
1.  **Stop and Check:** If a user request contradicts the boundaries in `SPEC.md` or `DESIGN.md`, politely warn them and ask for confirmation before proceeding.
2.  **Verify Context:** If you have lost context of the CSS classes, run a search or read `src/app/globals.css` again.
3.  **No Secrets:** Never commit secrets, API keys, or sensitive environment variables. Always use `.env.local` or `.env.example` placeholders.
4.  **Localization:** Do not insert hardcoded text into React components. All text must go through `i18next` and be present in `public/locales/fr/common.json` and `public/locales/ar/common.json`.
5.  **Automatic Documentation — MANDATORY:** After completing any task that changes the structure, components, state, or business logic of a page, you MUST update the corresponding `[page].md` file inside `/docs/pages/` BEFORE declaring the task done. This is not optional. An undocumented change is an incomplete change.

## HOW TO LOAD THIS CONTEXT
When starting a new session, the agent MUST:
1. Read this file (CLAUDE.md) — done automatically by Claude Code.
2. Proactively read ALL files in `/docs/pages/` using the Read tool (one call per file, in parallel if possible).
3. Acknowledge context is ready by saying: **"Context Loaded. I have read all `/docs/pages/` documentation and am ready to follow SPEC.md, DESIGN.md, and AGENTS.md rules."**

## END-OF-TASK DOCUMENTATION CHECKLIST
Before saying a task is complete, verify:
- [ ] Did I modify the structure, state, or logic of any page in `src/app/[lang]/`?
- [ ] If yes → did I update the corresponding `/docs/pages/[page].md`?
- [ ] Is the updated doc accurate enough that a future agent reading ONLY that file would have correct context?
