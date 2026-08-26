# Page: /contact

## Purpose
This page acts as the laboratory's primary contact, coordinates, and FAQ screen. It provides multiple ways for patients to communicate (phone numbers, WhatsApp, email, landline, fax), displays active working hours, integrates an interactive map, and displays practical guidelines and FAQs.

## Directory & File
- **Path:** `src/app/[lang]/contact/page.tsx`
- **Type:** Client Component (`"use client"`) with dynamic parameters unwrapping via `React.use(params)`.

## Context & Key Components

### 1. SimpleMap (Leaflet integration)
- Dynamically imported with server-side rendering disabled (`ssr: false`) and a fallback loading spinner state.
- Disabling SSR is essential because Leaflet maps directly access browser-only variables (`window`, `navigator`) which trigger Next.js hydration errors if executed on the server.
- Uses coordinates defined in `LAB_COORDINATES` constant (`latitude: 30.4173116`, `longitude: -9.5897999`).

### 2. Device-Aware Contact Actions
- **isMobile Checking:** Evaluates the user's browser user agent and viewport width (`window.innerWidth < 768`) to identify mobile devices.
- **Desktop Behavior Interception:** On desktop computers, clicking the "Call Us" / Phone links does not trigger native tel-anchors. Instead, it prevents the default behavior and displays the overlay `ContactModal` to present laboratory contact details clearly.
- **Mobile Behavior:** Directly initiates cellular phone calls via a `tel:` schema link.

### 3. Practical Information & FAQ Sections
- Displays pre-analytical recommendations, required patient documents, and hours.
- Four FAQs rendered by a `[1,2,3,4].map(...)` over `faq_questions.q{n}` / `a{n}` (namespace `common`). Plain always-visible cards — **not** an accordion, and there is no reusable disclosure component here.
- **`a3` — "Comment puis-je récupérer mes résultats ?" — was rewritten in août 2026 (demande n° 17).** It still promised online results "bientôt" long after `/resultats` had shipped. It now says the patient can consult them right away, and card 3 alone carries a CTA to `/${lang}/resultats` via a `num === 3` condition inside the map, plus the `faq_questions.a3_cta` key.
  - **The CTA is a separate `<Link>` on purpose, NOT a `<Trans>` with an embedded anchor.** This repo uses `<Trans>` nowhere; introducing component interpolation for one card would add a whole i18n pattern for no benefit. The chevron is flipped with `rotate-180` in RTL.
  - **Wording constraint:** do not write "à tout moment" or "24h/24". Online consultation depends on the lab's CyberLab server, and `/resultats` shows an outage panel (`OutageOptIn` + `VerdictPanel`) that would contradict the promise two clicks later.

## Data & Constants
All laboratory metadata is loaded from `/src/constants/contact.ts`:
- `LAB_NAME`: Translated laboratory label.
- `LAB_ADDRESS`: Full physical street address.
- `LAB_COORDINATES`: Latitude, longitude, and direct Google Maps directions URL.
- `LAB_CONTACT`: Object specifying `LANDLINE`, `WHATSAPP` arrays, `COMPANIES` hotline, `FAX` number, and primary `EMAIL`.
- `LAB_HOURS`: Working hours strings.

## Notes for AI
- **Map Issues:** Never remove `{ ssr: false }` from the `SimpleMap` import. If the map fails to show up or throws errors, it is usually because the Leaflet styles are not loaded or the parent container doesn't have an explicit height defined.
- **Icon styling in Dark Mode:** All icons (e.g., `Phone`, `Mail`, `MapPin`) must have color classes that remain legible when switching between light and dark modes (e.g., matching the theme primary color).
