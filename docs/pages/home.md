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
- **Below-the-fold Lazy Loading:** To achieve near-instant initial loads and prevent blocking bundle downloads, all sub-sections are imported using dynamic imports (`next/dynamic`) with client-side loading only (`ssr: false`):
  - `WhyChooseUs` (`@/components/features/home/WhyChooseUs`)
  - `MainServices` (`@/components/features/home/MainServices`)
  - `LocationInfo` (`@/components/features/home/LocationInfo`)
  - `PracticalInfo` (`@/components/features/home/PracticalInfo`)
  - `ContactModal` (`@/components/ui/ContactModal`)
- **Viewport Observer (`LazySection`):** Subcomponents are wrapped inside a helper observing the element's position via `react-intersection-observer` (`useInView`). Elements only hydrate and render when they are within 350px of the viewport, significantly optimizing DOM sizing and scroll performance.

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
