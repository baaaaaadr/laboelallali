# Supervision du serveur de résultats (CyberLab)

Surveillance automatique du serveur de résultats du laboratoire, avec alertes
email au personnel et notification opt-in des patients au rétablissement.

**Origine :** les 13–14/08/2026 le serveur CyberLab (derrière Cloudflare,
`f8e6t9.coraliaflat.com`) est tombé par intermittence (codes 522/523) à cause de
coupures d'électricité au labo. Les patients voyaient « Panne temporaire » mais
personne n'était prévenu. Ce système comble ce trou.

## Vue d'ensemble

Trois briques :
1. **`checkCyberlabHealth`** (`functions/src/monitoring/healthCheck.ts`) — fonction
   planifiée, sonde le serveur **toutes les 5 min**, envoie des emails aux
   **changements d'état uniquement**, et draine la liste d'attente patients au
   rétablissement.
2. **`joinOutageWaitlist`** (`functions/src/monitoring/waitlist.ts`) — callable qui
   inscrit un patient connecté sur la liste « préviens-moi au rétablissement ».
3. **Hook impact patient** dans `fetchResults` (`functions/src/cyberlab/fetchResults.ts`)
   — quand un vrai patient tombe sur la panne, incrémente un compteur et (max 1/30 min)
   alerte le personnel — signal précoce qui peut devancer le test de 5 min.

La logique de décision est isolée, **pure et testable**, dans
`functions/src/monitoring/stateMachine.ts` (aucun Firebase / réseau / horloge),
exercée par `functions/scripts/test-health-check.js`.

## Envoi d'email centralisé

L'envoi d'email de toute l'app passe par **un seul endroit** : le mailer partagé
`functions/src/email/mailer.ts` (`sendMail`, identifiants depuis Secret Manager
`SMTP_USER`/`SMTP_PASS`). Deux façons de l'appeler :
- **En interne** (même codebase) : la supervision (`healthCheck.ts`) et le hook
  impact-patient (`fetchResults.ts`) appellent `sendMail` directement.
- **Depuis le site Next** : la route `/api/send-appointment` (RDV + glabo) appelle
  la fonction HTTPS **`sendEmail`** (`functions/src/email/sendEmailHttp.ts`,
  europe-west1), protégée par le secret `INTERNAL_EMAIL_TOKEN` (en-tête
  `X-Internal-Token`), qui appelle à son tour `sendMail`. La route garde un
  **repli SMTP direct** si l'appel échoue, donc une notification de réservation
  n'est jamais perdue.

Config côté site (`.env.local`, non commité) : `SEND_EMAIL_FN_URL`
(`https://europe-west1-labo-el-allali-pwa.cloudfunctions.net/sendEmail`) +
`INTERNAL_EMAIL_TOKEN`. Sans ces variables, la route bascule sur le repli SMTP
(`SMTP_USER`/`SMTP_PASS`). Le mot de passe Gmail est le même partout, rangé dans
Secret Manager (source de vérité). **Historique/piège :** avant cette refonte, le
mot de passe n'existait que dans un `.env.local` embarqué dans le build déployé
(invisible dans Secret Manager / les variables Cloud Run) — d'où sa difficulté à
retrouver ; il est maintenant dans Secret Manager.

## Région (piège important)

La fonction planifiée tourne en **`europe-west1`**, PAS en `europe-southwest1`
comme les callables : **Cloud Scheduler n'a pas de localisation `europe-southwest1`**
(même contrainte que `cleanupExpiredPrescriptions`). Aligner la région casserait
la création du job (HTTP 400) et la fonction ne serait jamais planifiée.
`joinOutageWaitlist` reste en `europe-southwest1` (comme les autres callables).

## Machine d'état

Sonde : `callCyberlab({type:'patient', requester_id:'7587', max_results:1, include_pdf:'none'})`
— l'identifiant de test béni par l'éditeur, liste seule, sans PDF → zéro contenu médical.

Un échec de sonde est **re-testé 20 s plus tard** avant d'être déclaré « down »
(filtre anti-blip ; le 2ᵉ avis gagne).

Classification (`classifyProbe`) :

| Résultat sonde | État | reason |
|---|---|---|
| succès, ou 404 (`not_found`), ou 429 (`rate_limited`) | **UP** (le serveur répond) | — |
| `network` (injoignable / timeout 20 s) | **DOWN** | `server` |
| `server` (5xx, dont Cloudflare 522/523) | **DOWN** | `server` |
| 401 (`unauthorized`) | **DOWN** | `config` (nos clés, pas une coupure) |
| kind inattendu | **DOWN** | `config` |

Transitions & emails (voir `evaluate()`) :

- **UP→DOWN** : l'état est écrit d'abord (`downAlertPending: true`), *puis* l'alerte
  est envoyée ; `lastDownAlertAt` n'est posé qu'**après** un envoi réussi →
  garantie *at-least-once* (un envoi raté est réessayé au check suivant). Garde
  anti-flapping : pas de nouvelle alerte si la précédente a < 30 min (`ALERT_DEDUP_MS`).
- **DOWN (toujours)** : heartbeat ; rappel au plus une fois par **6 h** (`REMINDER_EVERY_MS`).
- **DOWN→UP** : (1) drain de la liste d'attente — emails patients d'abord (la
  promesse), suppression après envoi réussi ; (2) un doc `outages/{id}` (durée +
  impact — preuve chiffrée pour le prestataire du serveur) ; (3) email de
  rétablissement au personnel ; puis remise à zéro des compteurs. `lastDownAlertAt`
  est **conservé** (garde anti-flapping sur un down/up/down rapide).
- **UP stable** : heartbeat ; si `waitlistPending` traîne (crash en plein drain,
  ou opt-in qui a couru après le rétablissement) → balayage de rattrapage.

## Modèle de données Firestore

- **`systemStatus/cyberlab`** (doc d'état unique, lecture connectée / écriture
  serveur seule — voir `firestore.rules`) : `up`, `reason`, `since`, `lastCheckAt`
  (heartbeat), `lastOkAt`, `lastError {kind,status}`, `downSince`,
  `downAlertPending`, `lastDownAlertAt`, `lastReminderAt`, `patientsImpacted`,
  `lastPatientImpactAt`, `lastPatientAlertAt`, `waitlistPending`. **Aucune PII.**
- **`outageWaitlist/{uid}`** : `{email, lang, createdAt, attempts?}` — clé = uid
  (idempotent), email pris du **token auth vérifié** (jamais du client), **supprimé
  après l'email de rétablissement** (la suppression EST la politique de rétention ;
  déclaré sur la page confidentialité).
- **`outages/{autoId}`** : historique, 1 doc par panne, écrit au rétablissement.

## Emails (tous en français côté personnel, HTML échappé)

| # | Déclencheur | Sujet |
|---|---|---|
| 1 | UP→DOWN (serveur) | `[Labo El Allali] ALERTE — Serveur de résultats injoignable` |
| 2 | UP→DOWN (config/401) | `[Labo El Allali] ALERTE — Accès aux résultats refusé (configuration)` |
| 3 | Rappel 6 h | `[Labo El Allali] RAPPEL — Serveur de résultats en panne depuis {durée}` |
| 4 | DOWN→UP | `[Labo El Allali] Serveur de résultats rétabli — panne de {durée}` |
| 5 | Patient bloqué (≤1/30 min) | `[Labo El Allali] Un patient est bloqué par la panne des résultats` |
| 6 | DOWN→UP, par patient | `Laboratoire El Allali — Vos résultats sont de nouveau accessibles` (fr/ar) |

Destinataires personnel : `ALERT_EMAILS` (`functions/.env`, défaut = azizelallali@,
laboelallali@, communication.labo.elallali@, hassanelallali@gmail.com).

**Mode simulé :** si `SMTP_USER`/`SMTP_PASS` sont absents ou factices (pas d'`@`),
`sendMail` journalise le sujet et « réussit » sans envoyer — les déploiements et
l'émulateur fonctionnent avant que le mot de passe Gmail existe.

## Configuration / secrets

- `functions/.env` (non secret) : `CYBERLAB_API_URL`, `ALERT_EMAILS`, `APP_URL`,
  `HEALTHCHECK_REQUESTER_ID` (défaut 7587).
- Secrets (Secret Manager) : `CYBERLAB_API_KEY`, `CYBERLAB_HMAC_SECRET` (déjà là),
  `SMTP_USER`, `SMTP_PASS` (**à créer**). Local/émulateur + scripts :
  `functions/.secret.local` (gitignoré).

### Mot de passe d'application Gmail (`SMTP_USER`/`SMTP_PASS`)

Compte `laboelallali@gmail.com`, validation en 2 étapes active :
https://myaccount.google.com/apppasswords → créer un mot de passe d'application
(16 caractères). `SMTP_USER` = l'adresse Gmail, `SMTP_PASS` = ces 16 caractères.
Un reset du mot de passe du compte révoque les mots de passe d'application.

## Déploiement

```
# 1. secrets (une fois)
firebase functions:secrets:set SMTP_USER
firebase functions:secrets:set SMTP_PASS
# CYBERLAB_API_KEY / CYBERLAB_HMAC_SECRET existent déjà

# 2. règles + fonctions (ciblé — pas de --only functions nu)
firebase deploy --only firestore:rules
firebase deploy --only functions:checkCyberlabHealth,functions:joinOutageWaitlist,functions:fetchResults

# 3. invoker allUsers pour le nouveau callable (sinon CORS/403)
cd functions && node scripts/grant-invoker.js

# 4. frontend
npm run deploy:hosting
```

Vérifier le job planifié en `europe-west1` (Console Firebase → Functions, ou
`gcloud scheduler jobs list --location=europe-west1`) : attendu
`firebase-schedule-checkCyberlabHealth-europe-west1`. S'il manque → régression de
région.

## Tests

- **Machine d'état** (aucun réseau/Firebase) : `cd functions && npm run build && node scripts/test-health-check.js`.
- **Sonde réelle** contre le mock : `node scripts/mock-cyberlab-server.js` puis une
  sonde via `lib/cyberlab/client` + `classifyProbe` (mock vivant → up ; port mort → network/down).
- **Email SMTP réel** : `node scripts/send-test-email.js` (nécessite le vrai mot de passe).
- **E2E rétablissement sans toucher au vrai serveur** : dans la console Firestore,
  créer `outageWaitlist/{test}` avec votre email, forcer
  `systemStatus/cyberlab = {up:false, downSince:(il y a 10 min), waitlistPending:true, patientsImpacted:2}`,
  puis forcer une exécution du job → attendu : email personnel de rétablissement +
  email patient + doc `outages` + liste vidée + `up:true`.

## Notes / limites

- **Point de vue unique** : la sonde part d'`europe-west1` via Cloudflare — même
  chemin que les patients (`fetchResults` en `europe-southwest1`), donc « le
  moniteur dit down » ≈ « les patients sont bloqués ». Un incident purement côté
  Cloudflare-edge peut fausser (acceptable ici).
- **Coût plat** : une panne longue ne coûte pas plus (emails aux transitions +
  1 rappel/6 h, 1 doc d'historique). Limite Gmail ~500 destinataires/jour, très
  au-dessus de la charge de conception.
- Le hook impact patient et le mailer sont **best-effort** : ils ne peuvent jamais
  faire échouer la récupération des résultats (tout est en try/catch).
