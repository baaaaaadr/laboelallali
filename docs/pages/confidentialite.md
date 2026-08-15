# Page: /confidentialite

## Purpose
Public privacy policy page (Moroccan loi 09-08 / CNDP). Explains what personal data is collected, where results and profile data live, the user's rights, security measures, and retention. Linked from the signup consent checkbox and (ideally) the footer. No authentication, no data access — purely static content.

## Directory & File
- **Path:** `src/app/[lang]/confidentialite/page.tsx`
- **Type:** Client Component (`"use client"`)

## Context & Key Components
- No state, no auth, no data fetching. Renders content entirely from i18n.
- `useTranslation('common')`; all copy under `confidentialite.*` in `public/locales/{fr,ar}/common.json`.
- Structure: intro, `sections` cards (collect / results location / profile location / **usage tracking**), a rights list (5 items), then `afterRights` cards (security / retention / **outage waitlist** / contact). Icons from lucide-react (`ShieldCheck`, `FileText`, `Server`, `UserCog`, `Scale`, `Lock`, `Clock`, `Mail`, `Activity`, `BellRing`).
- **Outage waitlist card** (`confidentialite.outage_waitlist_*`, `BellRing` icon): declares the opt-in "notify me when the results server is back" processing — an email kept temporarily, only if the patient asks, deleted right after the recovery message. New PII processing → must stay declared here. See `src/components/features/results/OutageOptIn.tsx` + `docs/integrations/server-monitoring.md`.
- Styling: `.card`, bordeaux heading, CSS vars.

## Notes for AI
- Legal/compliance content — keep it aligned with `docs/integrations/cyberlab-results-api.md` §10–§11 (the source of truth for the wording). If the data flow changes (e.g. results ever cached), update this page AND the CyberLab doc.
- Content mirrors the CyberLab bridge promises: results never stored by the app, profile data in Firebase EU region (CNDP declaration), access logged without result content.
