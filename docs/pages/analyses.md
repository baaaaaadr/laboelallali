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
- **Module-level `catalogCache`** (top of the page file): the catalog is language-independent (each entry has both FR and AR fields), but switching language remounts the whole `[lang]` subtree. Without the cache the ~324-doc Firestore fetch re-ran on every fr↔ar switch (a multi-second "reload"). Now the fetcher reuses `catalogCache` when present (no refetch — just re-render with the other language), and the parent's `analyses`/`bilans`/`loading` state is **seeded from the cache** so there's no loader flash. Memory only; a full page reload refetches. The results page's "Détails des analyses" uses a SEPARATE loader (`src/lib/analyses/catalog.ts`).

### 2. Tab Navigation & Filtering
- **TabsNavigation:** Switches views between `Nos Bilans` (packaged bundles), `Catalogue Complet` (individual tests), or category-specific collections.
- **SortToolbar:** Provides controls to sort analyses by name (alphabetically) or popularity (descending request count).
- **Search Bar:** Real-time filter matching search queries against test names, category labels, or tags (supporting both French and Arabic).

### 3. Modals & Detail Popups
- **BilanDetailsModal:** Shows the composition of a bilan, listing all grouped analyses. Used for **catalog discovery only** (BilanCard "Voir détails"). NOT used from within the cart.
- **AnalysisDetailsModal:** Detailed requirements (e.g. fasting time, delays). Can be opened from within the cart by clicking an individual analysis row.
- **CartDetailsModal:** Mobile bottom-sheet cart overlay (full-screen on mobile). Thin shell component — delegates body to `<CartView>` and `<CartPreparation>`, footer to `<CartActions>`.

### 4. Cart Components

#### Thin Shells (layout only, no business logic)
- **CartSidePanel** (`src/components/features/catalog/CartSidePanel.tsx`): Desktop sidebar (~134 lines). Contains tab nav + clear button, renders `<CartView>` or `<CartPreparation>` in the body, `<CartActions>` in the footer.
- **CartDetailsModal** (`src/components/features/catalog/CartDetailsModal.tsx`): Mobile modal (~169 lines). Same structure as CartSidePanel but wrapped in a Headless UI `<Dialog>` with slide-up transition. Accepts `initialTab` prop to open on a specific tab.

#### Shared Body Components (`src/components/features/catalog/cart/`)
- **CartView.tsx**: Shared body for the "Mon Devis" tab. Renders all cart lines via `<CartLineRow>` followed by `<CartTotalsBreakdown>`. Handles the empty-cart state.
- **CartLineRow.tsx**: One row in the cart (bilan or analyse). Bilans are expandable inline (local `expanded` state) — clicking a bilan row toggles `<CartBilanComposition>`. Analyses open `AnalysisDetailsModal` on click. Duplicate analyses are shown greyed + strikethrough + `(déjà incluse dans Bilan X)` tag. Displays `effectivePrice` (deduplicated price), not the gross price.
- **CartBilanComposition.tsx**: Animated expandable block showing composition entries for a bilan, via `<CartCompositionItem>`.
- **CartCompositionItem.tsx**: One composition analysis with a checkbox. Four visual states: normal (✓ enabled), excluded by user (✗ enabled, grey italic, strikethrough), duplicate from another item (✓ disabled, grey italic, strikethrough, source tag), duplicate+excluded (✗ enabled, same grey treatment).
- **CartTotalsBreakdown.tsx**: Encadré showing sub-total / frais de prélèvement / **Total** based on `cartView`.
- **CartPreparation.tsx**: Shared content for the "Ma Préparation" tab — administrative documents, sample types, special instructions, fasting warning, result delay + total.
- **CartActions.tsx**: Shared footer — WhatsApp button + PDF button (delegates to `useCartPdfHandler`). The PDF button shows a spinner (`Loader2`) and is disabled while a PDF is being generated (`isGeneratingPdf`). Renders `<PdfPreviewModal>` for the desktop preview flow. Accepts an optional `isRtl` prop (forwarded by CartSidePanel / CartDetailsModal) to set the preview modal direction.
- **PdfPreviewModal.tsx** (`src/components/features/catalog/cart/PdfPreviewModal.tsx`): Large Headless UI `<Dialog>` (`z-[60]`, `max-w-5xl h-[92vh]`) that previews the generated PDF in an `<iframe>` (browser-native PDF viewer via a blob object URL). Footer has a "Fermer" button and a `.button-bordeaux` "Télécharger" button. **Desktop only** — never mounted with content on mobile (mobile downloads directly). Props: `isOpen`, `onClose`, `pdfUrl` (blob URL | null), `onDownload`, `isRtl`.
- **useCartPdfHandler.ts**: Shared hook encapsulating PDF auth check + generation + the adaptive download/preview behavior. Accepts optional `onAuthFail()` callback (used by CartDetailsModal to close itself before redirecting to login). Detects mobile vs PC (same heuristic as `/contact`: mobile UA OR `window.innerWidth < 768`). Returns `{ handleDownloadPdf, isAuthReady, isGeneratingPdf, pdfPreview, closePdfPreview, downloadFromPreview }`. Manages the preview object URL via a ref and revokes it on close/unmount.

#### Floating UI
- **TotalCalculator:** A floating cart counter showing selected tests count and total cost. Clicking it opens CartDetailsModal.

## State Management
- `analyses` & `bilans`: The raw arrays loaded from the Firestore databases.
- `selectedItems` (CartItem[]): Holds items currently in the cart. Persisted via `localStorage` under `laboElAllali_selectedItems_v2`.
  - Type: `{ type: 'analyse'; item: AnalyseItem } | { type: 'bilan'; item: BilanItem; excludedCodes?: string[] }`
  - `excludedCodes` (bilan only): array of raw composition codes the user has unchecked in the expandable bilan view. Absent = empty = all analyses included. Backwards-compatible with existing localStorage data.
- `cartView` (CartView): Derived state computed by `computeCartView(selectedItems, normalizedAnalysesMap, SAMPLING_FEE)` via `useMemo`. **Single source of truth** for all cart display and pricing — replaces the old manual `totalCost` computation.
- `activeTab`: Current visual tab ('bilans', 'all', or category strings).
- `sortBy`: Active sort option ('popularity', 'name', 'category').
- `closedCategories`: Track accordion collapsed state when sorted by category.
- `visibleCount`: Number of items currently shown (lazy rendering / infinite scroll, `ITEMS_PER_PAGE = 24`).

## Cart Logic Layer (`src/lib/cart/`)

### `cartView.ts`
Pure function `computeCartView(items, normalizedAnalysesMap, samplingFee?)` — the **single source of truth** for pricing and deduplication.

Key types:
```typescript
CompositionEntry { code, normalizedCode, name, price, isExcluded, isDuplicate, sourceName? }
CartLineView { cartItem, itemKey, type, displayName, composition?, effectivePrice, isDuplicate?, duplicateSourceName? }
CartView { lines, uniqueAnalysesCount, itemsTotal, samplingFee, total }
```

Dedup algorithm: an `ownership` Map tracks the first non-excluded occurrence of each normalized code. If a code is already owned, it is flagged as `isDuplicate` with `sourceName`. Excluded codes do not claim ownership (a later item can become the source). `effectivePrice` is the sum of non-excluded, non-duplicate composition entries.

### `cartItem.ts`
Immutable helpers:
- `toggleBilanCompositionExclusion(items, bilanId, rawCode): CartItem[]` — toggles a code's exclusion inside the target bilan (returns new array, no mutation).
- `isBilanCompositionExcluded(item, rawCode): boolean`
- `normalizeCode(code): string` — strips whitespace, uppercases.

## Handlers in `analyses/page.tsx`
- `handleToggleBilanComposition(bilanId, code)`: Calls `toggleBilanCompositionExclusion` and updates `selectedItems`. Passed to CartSidePanel and CartDetailsModal via `onToggleBilanComposition` prop.
- `handleWhatsAppSend()`: Builds a WhatsApp message from `selectedItems` and opens `wa.me` link.
- Cart modal open/close: `isCartModalOpen` state, auto-closes if cart becomes empty.

## PDF Export
- Protected by auth via `useCartPdfHandler` (shared hook). Both CartSidePanel (desktop) and CartDetailsModal (mobile) use the same hook — no divergence possible.
- If unauthenticated or profile lacks `phone`: calls `onAuthFail()` (closes modal) then redirects to `/login` or `/profile`.
- PDF generation: `src/lib/pdf/generateDevisPdf.ts`. Uses `computeCartView` output; excluded/duplicate analyses are filtered before being sent to the PDF renderer.
- `generateDevisPdf(opts)` returns `{ blob, fileName }`. It accepts an optional `download` flag (default `true`). When `download: true` it triggers the direct download itself (hidden anchor + blob URL); when `download: false` it only generates and returns the blob so the caller can preview it.
- **Adaptive Download Behavior (device-aware):**
  - **Mobile** (mobile UA OR width `< 768`): `generateDevisPdf({ download: true })` → clean direct download via a hidden anchor tag with a Blob URL (bypassing jsPDF's legacy `window.open` routines so no blank tabs/pages are left open on iOS Safari). Unchanged behavior.
  - **PC / Desktop:** `generateDevisPdf({ download: false })` → the returned blob is turned into an object URL and shown first in a large preview modal (`PdfPreviewModal`, rendered via `<iframe>`). The user reviews the document, then clicks "Télécharger" (`downloadFromPreview`) to actually save it. While generating, the button is disabled and shows a spinner (`isGeneratingPdf`). The object URL is revoked on close/unmount to avoid leaks.

## Notes for AI
- **Single source of truth:** All pricing and dedup logic lives in `computeCartView`. Never recompute prices inline in components — always derive from `cartView`.
- **Dedup visual treatment:** Duplicate analyses (already covered by another cart item) are shown with grey italic text, strikethrough price, and a `(déjà incluse dans Bilan X)` tag. Their price is 0 in the total. Do NOT present this as "savings" or "économies" — it is a transparency feature.
- **Expandable bilans:** Clicking a bilan row in the cart expands it inline. There is no modal for bilan detail from within the cart. `BilanDetailsModal` is only for catalog browsing.
- **excludedCodes backwards-compatibility:** Existing localStorage carts without `excludedCodes` are treated as having all analyses included (`excludedCodes ?? []`). No migration needed.
- **Frais de Prélèvement:** Constant `SAMPLING_FEE = 20 MAD`. Added to total only if cart is non-empty.
- **Ownership transfer:** If the user excludes an analysis from Bilan A that was the deduplicated source, ownership transfers to the next non-excluded occurrence (Bilan B or individual). Recomputed live by `computeCartView`.
