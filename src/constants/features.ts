/**
 * Temporary feature switches.
 *
 * Every switch here must say WHY it exists and HOW to undo it — a flag nobody
 * dares flip back is worse than no flag at all.
 */

/**
 * "Nos bilans" — the packaged check-up bundles (Firestore collection `bilans`).
 *
 * **OFF since 26/08/2026**, at Dr Aziz's request: the bundles need reworking
 * before being shown to patients again ("juste le cacher pour le moment").
 *
 * NOTHING was deleted. Set this back to `true` and everything returns as it was.
 *
 * What `false` hides:
 * - the "Nos bilans" tab of `/analyses` — only the full catalogue remains, and
 *   the tab bar itself disappears since a single tab is just a decorative button
 *   (`src/app/[lang]/analyses/page.tsx`, see `TAB_ORDER`);
 * - bilan hits in the global search, which would otherwise route to a tab that
 *   no longer exists (`UniversalSearchModal`);
 * - the "Nos bilans" tile of the home services grid, replaced by a
 *   "Catalogue des analyses" tile pointing at the same page — the entry point is
 *   too useful to drop, but its old label would have been a lie (`ServicesHub`).
 *
 * What still works untouched: every `?tab=bilans` link (they land on the full
 * catalogue), the cart, bilan pricing and dedup logic, and the PDF quote — a
 * cart saved in localStorage with bilans in it keeps working.
 */
export const BILANS_ENABLED = false;
