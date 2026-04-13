# Design System (DESIGN.md)

This document is the visual source of truth for the Labo El Allali PWA. Any new UI component must adhere strictly to these guidelines.

## 1. Typography
*   **Primary Font:** `Inter` (sans-serif)
*   **Heading Font:** `Public Sans` (sans-serif)
*   **Font Weights:** Regular (400), Medium (500), Bold (700)

## 2. Color Palette
The application uses CSS variables defined in `/src/styles/system/variables.css` and mapped to Tailwind/globals.css.

*   **Primary Accent (Bordeaux):** `var(--color-bordeaux-primary)` - Used for headers, primary buttons, and main branding elements.
*   **Secondary Accent (Fuchsia):** `var(--color-fuchsia-accent)` - Used for hover states, active links, and secondary call-to-actions.
*   **Backgrounds:**
    *   Light Mode: `var(--background-default)` (typically white/off-white)
    *   Dark Mode: `var(--background-secondary)` (deep charcoal/darkbordeaux tones `#1F1014`)
*   **Text:**
    *   Primary Text: `var(--text-primary)` (Dark gray in light mode, light gray/white in dark mode)
    *   Inverted Text: `var(--color-white)` used over bordeaux/fuchsia elements.

## 3. UI Patterns & Components
*   **Buttons:** Always use existing CSS utility classes from `globals.css` instead of writing raw Tailwind unless extending.
    *   Primary: `.button-bordeaux`
    *   Secondary/Highlight: `.button-fuchsia`
    *   All buttons have a border radius of `0.5rem` (8px) and use `transition: all 0.2s ease;`.
*   **Cards:** Use the `.card` class. It encompasses borders, background colors compatible with light/dark themes, and dropshadows.
*   **Layout Container:** Use the `.container` class for maximum width scoping across viewports.

## 4. Dark Mode Strategy
*   Controlled by the `.dark` class toggled on the `html` element.
*   Backgrounds shift to deep elegant shades (e.g., `#1F1014` gradients).
*   Avoid standard stark black (`#000000`).

## 5. Animations
*   Use `.fade-in-section` for scroll reveal animations.
*   UI interactions (hover, click) should have a crisp but subtle transition (`duration-200 ease`).
