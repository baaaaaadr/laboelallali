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

## Section « Consultation des résultats d'un proche » (ayant droit)

Ajoutée avec la fonctionnalité de rattachement (voir `docs/pages/admin.md` et `docs/pages/resultats.md`). Clés : `confidentialite.relatives_title` / `relatives_text`, fr **et** ar.

**Pourquoi elle ne peut pas être omise.** Le rattachement est à la fois :
1. un **nouveau traitement de données personnelles** — le libellé nominatif d'un tiers (« Maman — Fatima »), saisi par le personnel parce que le serveur du laboratoire ne renvoie volontairement aucun `patient_nom` pour `type: "patient"` ; c'est la seule donnée nominative d'un tiers que le système stocke ;
2. une **nouvelle divulgation de données médicales à un tiers**.

Sous la loi 09-08, cela se déclare. Le texte affirme quatre choses, dans cet ordre, et elles doivent le rester : c'est **le laboratoire** qui décide et saisit (jamais l'application, jamais le proche) ; ce qui est enregistré (numéro de dossier + libellé) ; que le titulaire est **prévenu par e-mail** et que **son propre compte est inchangé** ; comment faire retirer l'autorisation.

⚠ **Rester aligné avec `docs/integrations/cyberlab-results-api.md` §9-§10**, qui est la source de vérité du contrat du callable. Si le comportement serveur change (qui peut rattacher, ce qui est stocké, qui est notifié), les deux documents changent ensemble.
