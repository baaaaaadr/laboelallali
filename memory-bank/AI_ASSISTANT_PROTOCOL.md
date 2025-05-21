# Windsurf AI - Laboratoire El Allali PWA - Session Protocol

**Objective:** To ensure consistent, context-aware, and efficient AI assistance for the Laboratoire El Allali PWA project.

**START OF EVERY SESSION: Please review and adhere to the following protocol:**

1.  **Primary Rules & Conventions:**
    *   **Consult `.windsurfrules` (in project root).** This is the **authoritative guide** for all technical implementations, coding standards, architectural patterns, library usage, and styling for this project. Adherence is mandatory.

2.  **Project Context & History:**
    *   **Consult `memory-bank/productContext.md`:** For a high-level understanding of the project's purpose, target users, core features, and overall vision.
    *   **Consult `memory-bank/decisionLog.md`:** To understand key architectural and technical decisions already made and their rationale. Avoid proposing solutions that contradict logged decisions without explicit discussion.

3.  **Proactive Context Maintenance (Your Role, AI):**
    *   **Identify Deviations & New Decisions:** As we work, if you notice my instructions or our collaborative output leads to a decision that:
        *   Contradicts a rule in `.windsurfrules`.
        *   Represents a new, significant architectural or technical choice not yet logged.
        *   Clarifies or refines a previous point in `productContext.md`.
    *   **Prompt for Updates:** Please **prompt me to update the relevant file(s)** (`.windsurfrules`, `productContext.md`, or `decisionLog.md`, or `PROJECT_STRUCTURE.md`). For example, you could say:
        *   *"This approach seems to differ from rule X in `.windsurfrules`. Should we update the rule, or is this an exception?"*
        *   *"This is a new architectural decision (e.g., choosing X library for Y feature). Should I help you draft an entry for `decisionLog.md`?"*
        *   *"This clarifies a core feature. Should `productContext.md` be updated to reflect this?"*

4.  **Project File Structure Awareness (See `PROJECT_STRUCTURE.md`):**
    *   **(Future Task):** I created and you need to maintain the `PROJECT_STRUCTURE.md` file detailing the project's file and directory layout with descriptions.
    *   **Your Role (AI):** Once available, consult this file to understand where components, services, utilities, etc., are located and should be created.
    *   **Update `PROJECT_STRUCTURE.md`:** When you create, delete, or move files as part of your code generation, please **remind me or propose an update** to this structure file.

**My Commitment (Developer):**
*   I will strive to keep these context files updated with your help to remind me and do it for me.
*   I will provide clear, specific prompts for each task.
*   I will start new chat sessions for distinct major features or if context seems lost, beginning with a reference to this `AI_ASSISTANT_PROTOCOL.md` file.

**Let's build efficiently and consistently!**