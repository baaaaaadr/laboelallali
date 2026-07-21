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
- **`CheckupReminder` (auth-gated, first child of the content container):** `src/components/features/results/CheckupReminder.tsx` with `variant="home"`, statically imported. Renders `null` for everyone except linked **patient** accounts once their results are ready (no minimum age anymore) — see §2.2. Sits ABOVE ServicesHub.
- **`ServicesHub` (eager, priority CTA):** rendered right after the reminder in the content container, directly under the hero. Statically imported (NOT `next/dynamic`, NOT wrapped in `LazySection`) so the flagship Résultats call-to-action never flickers or waits on intersection. See §2.1. **It replaces the former `MainServices` section** (which only surfaced 3 services and duplicated analyses/glabo). `MainServices.tsx` still exists on disk but is now unused/orphaned.
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

### 2.2 Checkup reminder (`CheckupReminder`) — personalized "time for a new bilan" nudge
- File: `src/components/features/results/CheckupReminder.tsx` (results domain — it consumes `useResults`); shared with `/resultats` via a `variant: 'home' | 'results'` prop (home = larger paddings/h2, results = compact).
- **Self-contained gating** (host pages stay free of auth code): returns `null` unless `user && userProfile.requester_id` AND `status === 'ready'` AND the newest bilan has a **parseable date** (`newestMonthsAgo !== null`). **No minimum-age threshold anymore — it is always shown** for eligible patients (owner request). Also hidden for `userProfile.type === 'medecin' | 'correspondant'` (the "*votre* dernier bilan" copy is personal; legacy patients with `type` undefined still see it). No extra network call — reads the login-time prefetched `ResultsContext`.
- **Date logic:** the bilan date + age come from the shared pure helper `computeResultsStats(results)` in `src/lib/results/stats.ts` (`newestIso`, `newestMonthsAgo`). `monthsSince(iso, now)` also lives there (floored full calendar months; `null` on missing/invalid/future dates) and is **re-exported** from `CheckupReminder.tsx` for back-compat. The newest date is derived from the parseable `date_dossier` values — NEVER `lastUpdated` (server-sync time), NEVER `results[0]` (list is unsorted).
- **Buckets/tone:** `months === 0` → `resultats.checkup_title_recent` ("moins d'un mois"); 1–11 → `resultats.checkup_title_months` `{count}`; 12–23 → `checkup_title_year`; ≥ 24 → `checkup_title_years` (count = floor(months/12)). The nudge is now a **single soft phrase** `resultats.checkup_nudge_gentle` ("Pensez à programmer votre prochain bilan…") in all cases — the old escalating `checkup_nudge_yearly` is retired. Title plurals: fr `_one/_other`, ar full CLDR 6-form set.
- **CTAs:** primary `.button-bordeaux` → `/${lang}/rendez-vous`; secondary `.button-bordeaux-outline` (bordeaux outline, hover-fills; new class in `src/styles/index.css` — its `!important` color defeats the unlayered global `a { color: var(--text-accent) }`) → `/${lang}/analyses?tab=bilans`.
- **Style:** deliberately a `.card` with a fuchsia `border-s-4` accent + `CalendarClock` icon tile — NOT a gradient banner, so it doesn't read as a duplicate of ServicesHub's fuchsia banner right below. RTL-safe (flex+gap, `text-start`, `border-s`, no directional chevrons). No hydration risk: SSR renders `null` (status `idle`), the widget appears after the client prefetch (below the fold — hero is `min-h-screen`).

### 3. Real-Time Status Widget (`LabStatusWidget` + `useLabStatus`)
- `src/components/features/home/LabStatusWidget.tsx`, overlaid on the hero by `HomeClient` (absolute, top-centre mobile / top-right desktop). Discreet pill that expands to the hours + countdown card on hover (desktop, `group-hover`) or click (mobile, `open` state).
- **Hours live in ONE place: `src/constants/labHours.ts`** (`LAB_WEEKLY_HOURS`, indexed 0=dimanche…6=samedi). Lun–Ven 7h30–18h30, Sam 7h30–13h00, **dimanche fermé**. Must stay in sync with `LAB_HOURS` (`src/constants/contact.ts`) and the `opening_hours_text` i18n key. `getLabOpeningStatus(date)` is a pure function returning `{ isOpen, minutesUntilChange, nextChangeTime }`.
- **Timezone:** everything goes through `getLabClock()` → `Intl.DateTimeFormat` with `timeZone: 'Africa/Casablanca'`, never the device's or the server's local time (the SSR runtime is on UTC; Morocco is UTC+1, UTC+0 during Ramadan). The countdown is wall-clock arithmetic, so it may be off by 1 h across the two Ramadan clock changes — `isOpen` itself never is.
- **Three-state rendering — do NOT reintroduce `suppressHydrationWarning` here.** `useLabStatus` starts with `currentTime = null` and returns `isClient: false`, so the server render and the FIRST client render agree on a neutral grey `…` pill; the real status only appears after mount. This was a real production bug (fixed 2026-07-21): the page is statically prerendered (`generateStaticParams` → `.next/server/app/{fr,ar}.html`), so the server baked "Ouvert" at build time; `suppressHydrationWarning` on the badge told React to keep that server text, and since the client's render #1 and #2 both produced the same value React never patched the DOM — the stale "Ouvert" stayed until the status happened to flip. Any consumer must gate on `isClient` before showing `isOpen` (`ContactModal` hides its badge until then).
- **Ticking:** first tick aligned on the next minute boundary, then every 60 s, plus a recompute on `visibilitychange`/`focus`/`pageshow` (timers are frozen in a backgrounded tab or installed PWA).
- Known gap: no public-holiday / exceptional-closure handling; `generateTimeSlots` (`src/utils/timeSlots.ts`, used by rendez-vous + glabo) is a SEPARATE, unreconciled definition (it still offers Sunday slots and stops Saturday at 11h45).

### 4. Device-Aware Contact CTA Actions
- Checks user-agent and window sizing on mount to separate mobile screens from desktop browsers.
- On mobile devices, telephone links directly trigger native calls. On desktop, standard click behaviors are intercepted to open the overlay `ContactModal` instead, avoiding dead links.

## Notes for AI
- **Performance Constraints:** When adding landing page sections, always use `LazySection` wrappers and dynamic imports with `ssr: false` to preserve the premium performance grade.
- **Scroll Animations:** An event listener automatically toggles `.visible` classes on `.fade-in-section` items as the patient scrolls down the page.
