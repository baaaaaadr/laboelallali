# DESIGN.md - Labo El Allali Design System

This file follows the Google Stitch `DESIGN.md` standard for AI agent ingestion. It is the absolute source of truth for all visual, typographic, and layout decisions for the Labo El Allali PWA.

## 1. Project Context
* **Project:** Labo El Allali PWA
* **Domain:** Medical / Healthcare (Laboratory)
* **Brand Vibe:** Professional, clean, reassuring, clinical yet approachable.
* **Styling Engine:** Tailwind CSS + Custom CSS Variables.

## 2. Color System
All colors must use existing CSS variables (`/src/styles/system/variables.css`) mapped to Tailwind utilities. Do not invent hex codes.

### Core Palette
* **Primary Accent (Bordeaux):** `var(--color-bordeaux-primary)` | `bg-bordeaux` / `text-bordeaux`
    * *Usage:* Main headers, primary buttons, footer background, primary branding.
* **Secondary Accent (Fuchsia):** `var(--color-fuchsia-accent)` | `bg-fuchsia` / `text-fuchsia`
    * *Usage:* Hover states, active links, secondary call-to-actions, map pins, notification badges.
* **Surface Tints (Soft Pink):** `var(--color-pink-surface)` | `bg-pink-surface`
    * *Usage:* Service cards background, highlight boxes.

### Semantic Colors
* **Success:** `var(--color-success)` (Green)
* **Warning:** `var(--color-warning)` (Amber)
* **Error:** `var(--color-error)` (Red)
* **Info:** `var(--color-info)` (Blue)

### Backgrounds & Surfaces
* **Light Mode:** * Default: `var(--background-default)` (White/Off-white)
    * Card Surface: `var(--background-surface)` (Very light pink tint)
* **Dark Mode:** * Default: `var(--background-secondary)` (`#1F1014` - Deep charcoal/bordeaux tone)
    * Card Surface: `var(--background-surface-dark)` (`#2A161C`)

### Text Hierarchy
* **Text Primary:** `var(--text-primary)` (Dark gray/slate in light mode, off-white in dark mode)
* **Text Secondary:** `var(--text-secondary)` (Muted gray)
* **Text Inverted:** `var(--color-white)` (Used over bordeaux/fuchsia solid backgrounds)

## 3. Typography
* **Primary Font (Body/UI):** `Inter`, sans-serif.
* **Heading Font:** `Public Sans`, sans-serif.
* **Font Weights:** Regular (400), Medium (500), Bold (700).

### Type Scale
* H1: `text-4xl md:text-5xl font-bold font-heading`
* H2: `text-2xl md:text-3xl font-bold font-heading text-bordeaux`
* H3: `text-xl font-bold font-heading`
* Body: `text-base font-primary text-primary`
* Small/Caption: `text-sm font-primary text-secondary`

## 4. Spacing and Layout
* **Base Unit:** 4px grid (Tailwind defaults: `p-4` = 16px, `gap-6` = 24px).
* **Layout Container:** Use the `.container` class (max-width bounded, centered, with lateral padding).
* **Section Spacing:** Use `py-16` or `py-24` for vertical rhythm between major page sections.
* **Component Gaps:** Use `gap-6` or `gap-8` for grid items (like service cards).

## 5. Component Styles
### Buttons
Always use existing CSS utility classes from `globals.css` instead of raw Tailwind unless extending.
* **Primary:** `.button-bordeaux` (Solid bordeaux, white text, 8px radius).
* **Secondary/Highlight:** `.button-fuchsia` (Solid fuchsia, white text, 8px radius).
* **Outline:** `.button-outline` (Transparent, bordeaux border, bordeaux text).
* **Corner Radius:** All buttons must have a border radius of `0.5rem` (`rounded-lg`).
* **Transitions:** All buttons use `transition: all 0.2s ease;`.

### Cards
* **Base:** Use the `.card` class.
* **Styling:** Soft pink/off-white background in light mode, 8px border-radius (`rounded-lg`), subtle borders, and smooth hover states.
* **Shadows:** `.shadow-sm` by default, `.shadow-md` on hover.

## 6. Depth & Elevation
* Level 0: Standard background (`bg-default`).
* Level 1: Cards and isolated components (`shadow-sm`).
* Level 2: Dropdowns, Modals, sticky headers (`shadow-lg`, `z-50`).

## 7. Animations & Motion
* **Scroll Reveal:** Use `.fade-in-section` for components entering the viewport.
* **Micro-interactions:** UI interactions (hover, focus, active) should have a crisp but subtle transition (`duration-200 ease-in-out`). No bouncy or slow animations.

## 8. Responsive Behavior
* **Mobile-First:** Default classes are for mobile (stack layouts).
* **Breakpoints:** Standard Tailwind breakpoints (`md:` for tablet, `lg:` for desktop).
* **Navigation:** Top bar collapses into a hamburger menu on `< md` screens.
* **Grids:** Use `grid-cols-1` for mobile, `md:grid-cols-2`, `lg:grid-cols-3` or `lg:grid-cols-4` for cards.

## 9. Do's and Don'ts
* **DO:** Use `text-bordeaux` for section titles to reinforce brand identity.
* **DO:** Ensure adequate contrast between text and background.
* **DON'T:** Use pure black (`#000000`). Use dark charcoal/bordeaux tinted darks.
* **DON'T:** Invent new colors or spacing units. Stick to the tokens.
* **DON'T:** Overuse the fuchsia accent; keep it for CTAs and highlights.

## 10. Agent Prompt Guide
*AI Agents reading this file: When modifying or creating UI components, strictly use the tokens defined above. Validate color classes against the system variables. If asked to "create a new card", apply `.card`, `rounded-lg`, and the appropriate typography scale.*