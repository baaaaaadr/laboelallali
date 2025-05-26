# Windsurf AI - Laboratoire El Allali PWA - Session Protocol

**Objective:** To ensure consistent, context-aware, and efficient AI assistance for the Laboratoire El Allali PWA project.

**AUTOMATIC CONTEXT LOADING:**
To load all context files, simply use the trigger phrase:
```
check @[laboelallali/memory-bank/AI_ASSISTANT_PROTOCOL.md]
```

This will automatically read and process the following files in order:
1. `.windsurfrules` - The authoritative guide for all technical implementations and standards
2. `memory-bank/productContext.md` - Project purpose, users, and features
3. `memory-bank/decisionLog.md` - Key architectural and technical decisions
4. `memory-bank/PROJECT_STRUCTURE.md` - Detailed project file structure

**PRIMARY PROTOCOL:**

1.  **Rules & Conventions:**
    *   **`.windsurfrules` is the authoritative guide** for all technical implementations, coding standards, architectural patterns, library usage, and styling.
    *   **Strict Adherence Required:** All code and suggestions must comply with these rules unless explicitly overridden.

2.  **Project Context & History:**
    *   **`productContext.md`:** Contains the project's purpose, target users, core features, and vision.
    *   **`decisionLog.md`:** Documents key architectural and technical decisions with their rationale.
    *   **`PROJECT_STRUCTURE.md`:** Details the project's file and directory organization.

3.  **Proactive Context Maintenance (AI Responsibilities):**
    *   **Identify Deviations:** Flag any instructions or outputs that:
        - Contradict `.windsurfrules`
        - Represent new architectural/technical decisions
        - Clarify or refine project context
    *   **Prompt for Documentation Updates:** Request updates to relevant files when needed, such as:
        - *"This approach differs from rule X in `.windsurfrules`. Should we update the rule or make an exception?"*
        - *"This is a new architectural decision. Should I help draft an entry for `decisionLog.md`?"*
        - *"This clarifies a core feature. Should `productContext.md` be updated?"*

4.  **File Structure Management:**
    *   **Reference `PROJECT_STRUCTURE.md`** to understand where components, services, and utilities should be located.
    *   **Propose Updates:** When creating, deleting, or moving files, suggest updates to keep `PROJECT_STRUCTURE.md` current.

**Developer Commitments:**
*   Maintain and update context files with AI assistance
*   Provide clear, specific task requirements
*   Start new sessions for major features or when context refresh is needed

**AUTOMATIC CONTEXT REFRESH:**
Mentioning `@[laboelallali/memory-bank/AI_ASSISTANT_PROTOCOL.md]` in any message will trigger a full context refresh by re-reading all specified files.

**Let's build efficiently and consistently!**