# Page: / (Home Landing Page)

## Purpose
This is the main landing page of the Laboratoire El Allali PWA. It serves as the primary visual gate, detailing services, coordinates, active hours, practical instructions, and direct scheduling shortcuts.

## Directory & Files
- **Server Metadata Entry:** `src/app/[lang]/page.tsx`
- **Main Client Component:** `src/app/[lang]/HomeClient.tsx`
- **Type:** Hybrid (Server metadata + Client layout with optimized code-split subcomponents).

## Architecture & Sub-Components

### 1. Metadata Generation (`generateMetadata`)
- Defined in `src/app/[lang]/page.tsx` as a standard Next.js App Router metadata builder.
- Automatically serves translated titles, keywords, descriptions, and OpenGraph parameters for French and Arabic based on the route context.

### 2. High-Performance Client Shell (`HomeClient`)
- Renders the `HeroBanner` with an interactive "Opening Hours" widget above the fold.
- **`ServicesHub` (eager, priority CTA):** rendered as the FIRST item in the content container, directly under the hero. Statically imported (NOT `next/dynamic`, NOT wrapped in `LazySection`) so the flagship Résultats call-to-action never flickers or waits on intersection. See §2.1. **It replaces the former `MainServices` section** (which only surfaced 3 services and duplicated analyses/glabo). `MainServices.tsx` still exists on disk but is now unused/orphaned.
- **Below-the-fold Lazy Loading:** To achieve near-instant initial loads and prevent blocking bundle downloads, the remaining sub-sections are imported using dynamic imports (`next/dynamic`) with client-side loading only (`ssr: false`):
  - `WhyChooseUs` (`@/components/features/home/WhyChooseUs`)
  - `LocationInfo` (`@/components/features/home/LocationInfo`)
  - `PracticalInfo` (`@/components/features/home/PracticalInfo`)
  - `ContactModal` (`@/components/ui/ContactModal`)
- **Viewport Observer (`LazySection`):** These lazy subcomponents are wrapped inside a helper observing the element's position via `react-intersection-observer` (`useInView`). Elements only hydrate and render when they are within 350px of the viewport, significantly optimizing DOM sizing and scroll performance. (`ServicesHub` is intentionally NOT wrapped — it is the priority section.)

### 2.1 Services Hub (`ServicesHub`) — flagship Résultats promotion
- File: `src/components/features/home/ServicesHub.tsx`. Section heading `services_hub.title` ("Nos services").
- **No `fade-in-section` class** (unlike the other home sections): that class sets `opacity:0` until the scroll handler reveals it, which — because the hero is `min-h-screen` — left the banner as a full-height invisible "white gap" on mobile until scroll. As the priority section it renders visible immediately.
- **Top: full-width gradient banner** — reuses the footer's `.footer-gradient` class (bordeaux → bordeaux-light → fuchsia; dark-mode variant handled by `.dark .footer-gradient`), white text — linking to `/${lang}/resultats` — the flagship "view your results online" CTA. Shows a `ShieldCheck` + `services_hub.results_badge` ("Nouveau") pill, `resultats.home_highlight_title/desc`, and a white `resultats.home_highlight_cta` button. This is the home-page counterpart to the fuchsia nav treatment (see below).
- **Below: quick-access grid** (2/3/5 cols) of the five other services, each an icon card → its page: `rendez-vous` (CalendarDays), `glabo` (Truck), `analyses` (FlaskConical), `medecins` (Stethoscope), `contact` (Phone). Labels are `services_hub.{appointment,glabo,analyses,medecins,contact}`.
- **i18n:** all strings under `services_hub.*` and `resultats.home_highlight_*` in `public/locales/{fr,ar}/common.json` (namespace `common`).
- **Flagship nav treatment (not this page, but related):** Résultats was moved to the 2nd slot (right after Accueil) in the desktop nav, mobile hamburger, and `BottomNav`, each with a fuchsia marker (desktop pill, mobile fuchsia tint + "Nouveau" badge, bottom-nav fuchsia dot). See `src/components/layout/{Header,BottomNav}.tsx`.

### 3. Real-Time Status Widget (`useLabStatus`)
- Integrates the `useLabStatus` hook to compute whether the laboratory is open or closed based on current local times.
- Renders a blinking green status badge if open, and red if closed.
- **Hydration Mismatch Prevention:** Uses `suppressHydrationWarning` and displays the countdown timer only after client-side hydration is confirmed, avoiding Next.js rendering mismatches.

### 4. Device-Aware Contact CTA Actions
- Checks user-agent and window sizing on mount to separate mobile screens from desktop browsers.
- On mobile devices, telephone links directly trigger native calls. On desktop, standard click behaviors are intercepted to open the overlay `ContactModal` instead, avoiding dead links.

## Notes for AI
- **Performance Constraints:** When adding landing page sections, always use `LazySection` wrappers and dynamic imports with `ssr: false` to preserve the premium performance grade.
- **Scroll Animations:** An event listener automatically toggles `.visible` classes on `.fade-in-section` items as the patient scrolls down the page.
