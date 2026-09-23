# Page: /confidentialite

## Purpose
Public privacy policy page (Moroccan loi 09-08 / CNDP). Explains what personal data is collected, where results and profile data live, the user's rights, security measures, and retention. Linked from the signup consent checkbox and (ideally) the footer. No authentication, no data access — purely static content.

## Directory & File
- **Path:** `src/app/[lang]/confidentialite/page.tsx`
- **Type:** Client Component (`"use client"`)

## Context & Key Components
- No state, no auth, no data fetching. Renders content entirely from i18n.
- `useTranslation('common')`; all copy under `confidentialite.*` in `public/locales/{fr,ar}/common.json`.
- Structure: intro, `sections` cards (collect / results location / profile location / **usage tracking** / **relatives** / **prescribing doctors**), a rights list (5 items), then `afterRights` cards (security / retention / **outage waitlist** / contact). Icons from lucide-react (`ShieldCheck`, `FileText`, `Server`, `UserCog`, `Scale`, `Lock`, `Clock`, `Mail`, `Activity`, `BellRing`, `Users`, `Stethoscope`).
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

### Mise à jour — la demande vient maintenant du patient (17/09/2026)

Le patient peut désormais **demander** lui-même le rattachement d'un proche depuis `/resultats`. Cela ne change rien à qui **décide** : le laboratoire reste seul à accorder, et seulement après vérification en personne. Deux points à refléter si le texte de la page est retouché :

- la demande enregistre le **nom et la date de naissance du proche**, fournis par le demandeur — une donnée personnelle de tiers de plus, en amont du libellé ;
- le motif de l'octroi (**titulaire présent / autorisation écrite / autorité parentale**) est conservé. C'est une donnée de preuve, pas une donnée de santé, et c'est ce qui permet au laboratoire de répondre « sur quelle base ? » en cas de contestation.

## Section « Accès des médecins prescripteurs » (23/09/2026)

Ajoutée avec l'espace « Mes patients » (voir `docs/pages/mes-patients.md`). Carte `Stethoscope` dans `sections`, juste après celle des proches. Clés : `confidentialite.practitioner_title` / `practitioner_text`, fr **et** ar.

**Pourquoi elle ne peut pas être omise.** C'est une **nouvelle divulgation de données médicales à un tiers** — le médecin prescripteur lit, dans l'application, les résultats de ses patients, avec leur nom et prénom (renvoyés par le serveur du laboratoire pour ce type d'accès). Sous la loi 09-08, cela se déclare, au même titre que l'accès d'un proche.

Le texte affirme, dans cet ordre, et chaque affirmation doit rester vraie :
1. **seul le médecin prescripteur**, et **seulement les analyses qu'il a lui-même prescrites** — règle tenue par le **serveur du laboratoire** (un dossier prescrit par un confrère répond 404, vérifié le 23/09/2026), pas par l'application ;
2. il ne voit ni les autres bilans du patient, ni son compte, ni ses proches ;
3. c'est le prolongement de l'envoi habituel des résultats au prescripteur ;
4. l'accès est **accordé nominativement par le laboratoire**, **après engagement écrit du médecin**, et **retirable à tout moment** (carte « Accès médecin » de `/admin`, niveau admin) ;
5. les résultats ne sont **jamais conservés** dans l'application (lus à la demande).

⚠ **BROUILLON — à faire valider par Aziz avant d'activer le premier vrai médecin.** En particulier « **après engagement écrit du médecin** » n'est vrai que si le laboratoire fait réellement signer un engagement : c'est une étape de `docs/procedures/activation-medecin.md` (modèle fourni). Si le laboratoire ne le fait pas, **retirer ces mots** du texte fr ET ar — ne jamais laisser une promesse que la pratique ne tient pas.

**Télémétrie du médecin :** l'application enregistre, sur le compte du médecin, la date de sa dernière consultation (`practitioner.lastUsedAt`, au plus une fois toutes les 6 h) et un compteur global **anonyme** (`usageDaily.practitionerConsultations`) — jamais quel patient il a ouvert. C'est de même nature que ce que déclare la carte « Suivi d'utilisation » (`usage_*`), dont le texte couvre ce cas sans modification.
