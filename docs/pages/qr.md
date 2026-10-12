# Page: /qr — « Scannez-moi » (the single printed QR code)

## Purpose
The page behind the ONE QR code printed on every support — reception, envelopes, reports (A4 letterhead), business card, posters (Dr Aziz, 12/10/2026, devis line 64; one QR for all supports, no per-support variants for now). A person who scans has a phone in hand and ten seconds: one screen of big tiles, grouped, results first.

## The permanent address
`https://laboelallali.com/qr` is PRINTED — it must never change. `src/middleware.ts`: a language-less `/qr` (no cookie) takes the PHONE's language (`qrLanguage` in `src/lib/qr/qrLanguage.ts`: first `fr*`/`ar*` tag of `Accept-Language`, else Arabic) and redirects to `/{lang}/qr?scan=1`. The QR image files are produced by the print work (`marketing/scripts/generer-kit-qr.js`, constant `URL_QR`).

## Directory & File
- **Route:** `src/app/[lang]/qr/page.tsx` (client, `use(params)`) → `QrHub`; `layout.tsx` (server): title `qr.meta_title`, `robots: noindex` (reached by scanning, not searching). Excluded from the sitemap (`next-sitemap.config.js`), NOT disallowed in robots.txt (the noindex must stay readable).
- **Component:** `src/components/features/qr/QrHub.tsx`.
- **Shared list:** `QR_KEYS` in `src/lib/qr/qrLanguage.ts` — the tiles' keys, twin of the server whitelist in `functions/src/qr/qrStats.ts` (parity checked by `test:qr:ui`).

## Context & Key Components
- Same look as the home hero: `/images/hero-banner.jpg` + `.hero-banner-overlay` (dark in dark mode) + `.hero-banner` (all text white) + `.hero-tile` glass tiles, `grid-cols-2`. Header: app icon, `qr.title`, `qr.tagline`, language switch to `/{other}/qr` (`qr-lang`).
- Groups (`qr-group-<id>`); tiles carry `data-qr=<key>`:
  - **results**: signed out → « Recevoir mes résultats sur mon téléphone » → `/{lang}/login?redirect=/{lang}/resultats` (sign-up + automatic access request); signed in → « Voir mes résultats » → `/{lang}/resultats`. « Parler au Dr El Allali » → `LAB_CONTACT.DR_WHATSAPP` (his number public: Aziz's decision, 12/10/2026).
  - **contact**: lab WhatsApp, landline (`descLtr`: digits kept left-to-right, else Arabic shows them reversed).
  - **visit**: Google Maps, hours (live `useLabStatus` text in the browser, static text before).
  - **services**: RDV, GLABO, prescription (→ /rendez-vous), prices (/analyses), preparation (/contact#info).
  - **more**: business card (/carte), Google review (`GOOGLE_REVIEW_URL`, `src/constants/contact.ts`), doctors (/mes-patients), jobs (/emploi), and `PWAInstallButton variant="tile"` (all install rules live there).
- External links open in a new tab. `GoogleSignInPrompt` hidden on `qr` (HIDDEN_ROUTES).

## Data — the anonymous counter (devis line 65)
- `recordQrEvent` (public callable, `functions/src/qr/qrStats.ts`): `{event:'scan'}` once when the page opens with `?scan=1` — then `?scan` is removed with `history.replaceState` so a reload does not count twice; `{event:'click', key}` on each tile (install: captured around the tile). Fire-and-forget.
- Stored: `qrDaily/{YYYY-MM-DD}` (lab time) `{day, scans, clicks:{<key>:n}}` — counts only, no person, phone or IP; server-only (default deny).
- Dashboard: `adminDashboardStats.qr = {thisMonth, lastMonth, last30, topClicks}` (`qrSummary`, 62 docs read by id, best-effort) → section « Le QR code « Scannez-moi » » in `AdminDashboard.tsx` (`dash-qr`), hidden when absent.

## Notes for AI
- Never change the printed address `/qr`. Adding a tile = its key in BOTH `QR_KEYS` lists + `qr.*` and `admin.dash_qr_key_*` labels in fr AND ar.
- Bench: `npm run test:qr:ui` (45 checks: language rule, every link, the counter, signed-in, Arabic, the card, the vCard file).
