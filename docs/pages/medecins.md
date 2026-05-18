# Page: /medecins

## Purpose
This page hosts the **Agadir Doctor Directory (Annuaire des Médecins)**. It allows patients to search for regional medical practitioners, filter them dynamically by specialization, location, or private/public sector, and quickly access maps, addresses, or telephone calls.

## Directory & File
- **Path:** `src/app/[lang]/medecins/page.tsx`
- **Type:** Client Component (`"use client"`) using parameters and router controls.

## Context & Key Components

### 1. State Management & Filtering
- `allMedecins` (Medecin[]): The raw database records loaded from Firebase.
- `visibleCount` (number): Pagination tracker that limits items rendered on-screen to avoid DOM bloating (`ITEMS_PER_PAGE = 24`).
- `filters` (MedecinFilters):
  - `secteur` ('tous' | 'public' | 'privé'): Filters by sector.
  - `specialite` (string): Filters by exact doctor specialization.
  - `commune` (string): Filters by exact geographical commune.
  - `searchQuery` (string): Search query matching names, surnames, specializations, or communes.

### 2. Client-Side Extraction & Processing
To optimize Firestore usage and query speeds, all practitioners are fetched once upon mounting (`getAllMedecins()` from `@/services/medecinsService`).
- **Dynamic Select Options:** The list of specializations and communes is extracted dynamically at runtime from `allMedecins` using `useMemo` hooks, keeping dropdown values fully in sync with the database without hardcoded values.
- **Client Filtering:** The filtering logic parses all practitioners in memory inside a robust `useMemo` block, updating results instantaneously on keystrokes or option changes.
- **External Search Injection:** A dedicated `useEffect` checks for `?q=` search parameters inside the page URL. If present, it pre-fills the search input automatically (allowing seamless transitions from global navbar searches).

### 3. Infinite Scroll Pagination
- Implements lazy loading utilizing `react-intersection-observer` (`useInView`).
- Renders an inline `MedicalLoader` spinner when scrolling near the bottom of the list.
- Resets back to 24 items immediately if the search queries or dropdown parameters are changed.

## Key Child Components
- **MedecinCard:** Individual card styled dynamically. Displays name, specialty, sector label, telephone buttons, map buttons, and commune.
- **MedicalLoader:** Customized animated loading component.

## Notes for AI
- **Performance:** Never attempt to convert the client-side filtering logic into server-side Firestore query constraints. The database holds several hundred practitioners, which is extremely efficient to fetch once and filter in memory, reducing Firestore read operations and providing instantaneous UI transitions.
- **Localization:** Supports full Arabic and French translation layouts dynamically.
