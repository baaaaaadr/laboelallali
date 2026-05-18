# Page: /analyses

## Purpose
This page acts as the central medical analyses and bilans catalog page. It allows patients to explore available tests, search for items by name, category, or tags, view detailed requirements, and assemble a shopping cart ("devis") to send directly via WhatsApp or export as a beautifully formatted PDF.

## Directory & File
- **Path:** `src/app/[lang]/analyses/page.tsx`
- **Type:** Client Component (`"use client"`) wrapped with a Suspense wrapper for parameters resolution.

## Key Components

### 1. CatalogDataFetcher
A sub-component responsible for running parallel Firestore queries to fetch the `analyses` and `bilans` collections:
- Filters out header placeholders (e.g. `Nom_Patient_FR !== 'Nom_Patient_FR'`).
- Feeds data directly back to the parent state hooks.

### 2. Tab Navigation & Filtering
- **TabsNavigation:** Switches views between `Nos Bilans` (packaged bundles), `Catalogue Complet` (individual tests), or category-specific collections.
- **SortToolbar:** Provides controls to sort analyses by name (alphabetically) or popularity (descending request count).
- **Search Bar:** Real-time filter matching search queries against test names, category labels, or tags (supporting both French and Arabic).

### 3. Modals & Detail Popups
- **BilanDetailsModal:** Shows the composition of a bilan, listing all grouped analyses.
- **AnalysisDetailsModal:** Detailed requirements (e.g. fasting time, delays).
- **CartDetailsModal:** Detailed patient cart overlay. Manages mobile cart views, displays preparation lists, and handles PDF export triggers.

### 4. Cart Components (Panel & Floating Cart)
- **CartSidePanel:** A desktop-only, slide-out cart overview for quick review.
- **TotalCalculator:** A floating cart counter showing selected tests count and total cost.
- **Deduplication:** Automatic deduplication logic checks if individual tests are already covered inside selected Bilans. If so, overlapping individual items are replaced or skipped to prevent charging patients twice.

## State Management
- `analyses` & `bilans`: The raw arrays loaded from the Firestore databases.
- `selectedItems` (CartItem[]): Holds items currently in the cart (either `{ type: 'analyse', item }` or `{ type: 'bilan', item }`). Persisted via `localStorage` under `laboElAllali_selectedItems_v2`.
- `activeTab`: Current visual tab ('bilans', 'all', or category strings).
- `sortBy`: Active sort option ('popularity', 'name', 'category').
- `closedCategories`: Track accordion collapsed state when sorted by category.
- `visibleCount`: Number of items currently shown (implements lazy rendering / infinite scroll with `ITEMS_PER_PAGE = 24`).

## PDF Export and PDF Integration
- Intercepted by `CartDetailsModal.tsx`.
- Strictly requires authentication. If the user is unauthenticated or their profile lacks a required `phone` number, they are redirected to `/login` or `/profile` respectively before they are allowed to initiate a PDF devis generation.
- The PDF export generation code is handled separately in `src/lib/pdf/generateDevisPdf.ts`.

## Notes for AI
- **Deduplication:** Always ensure any manual updates to the cart collection respect the deduplication rules. A test cannot be present as an individual item if a Bilan containing it is already selected.
- **Frais de Prélèvement:** A constant blood sampling fee (`SAMPLING_FEE = 20`) is added to the total cost if the cart contains at least one item.
