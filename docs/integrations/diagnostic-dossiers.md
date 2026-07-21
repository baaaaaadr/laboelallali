# Diagnostiquer un dossier qui ne remonte pas (ou sans PDF)

Outils et méthode pour répondre à la question « pourquoi ce patient ne voit-il pas son
résultat / son PDF ? », **sans passer par l'application** — donc sans confondre un
problème d'app avec un problème de serveur.

Les deux scripts sont dans `functions/scripts/`, n'utilisent que Node (aucune
dépendance), lisent la config dans `functions/.env` + `functions/.secret.local`,
et reproduisent **exactement** la signature HMAC de `functions/src/cyberlab/client.ts`
sans l'importer (mesure indépendante du code applicatif).

> **Confidentialité.** Ils n'impriment que des métadonnées : identifiant de dossier,
> date, état, taille du PDF. Jamais de nom, jamais de valeur d'analyse, jamais le
> contenu d'un PDF. Rien n'est écrit sur disque, sauf `--save-pdf` (explicite).

## 1. `diag-dossier.js` — tout tester sur un identifiant

```bash
cd functions
node scripts/diag-dossier.js <requester_id> [--type patient] [--dossier <id>] [--compare 7587] [--save-pdf]
```

Enchaîne les 5 façons de demander les résultats et affiche, pour chacune, ce que le
serveur renvoie réellement :

| # | Requête | Ce que ça prouve |
|---|---------|------------------|
| 1 | `include_pdf:"none"` | la liste remonte-t-elle ? (= phase 1 de l'app) |
| 2 | `include_pdf:"latest"` | PDF du dossier le plus récent |
| 3 | `include_pdf:"all"` | tous les PDF (mode maximal) |
| 4 | aucun `include_pdf` | comportement historique du serveur |
| 5 | `dossier_id:<id>` | **exactement le bouton « Voir le PDF »** |

Puis des variantes de format d'identifiant (nombre JSON, espaces, zéro initial) et,
avec `--compare <id>`, un **témoin** connu-bon pour prouver que le serveur sait
renvoyer des PDF au même instant. Pour chaque PDF : taille base64, taille décodée,
présence de l'entête `%PDF-` et du marqueur de fin `%%EOF`.

## 2. `diag-pdf-matrix.js` — cartographier plusieurs patients

```bash
cd functions
node scripts/diag-pdf-matrix.js 7587 232527 219418 ...
```

Pour chaque identifiant : liste les dossiers, puis demande **chaque** dossier à
l'unité et note PDF présent / manquant. Termine par une synthèse triée par date —
c'est elle qui tranche entre « un dossier isolé » et « un problème systémique à
partir d'une certaine date ».

⚠️ Le serveur applique une **limite de débit** : au-delà d'environ 25 appels
rapprochés il répond `429`, ce que le script affiche comme `PDF MANQUANT (HTTP 429)`.
Un faux négatif, donc : re-tester l'identifiant seul, avec des pauses.

Pour retrouver les identifiants des comptes de l'app sans ouvrir la console :
`functions/scripts/call-fetch-results.js <uid>` (chemin complet avec Firestore) ou
l'onglet **Patients** de `/admin`.

## 3. Lire le résultat

| Observation | Interprétation |
|---|---|
| `404 requester_not_found` | l'identifiant n'existe pas côté laboratoire (ou faute de frappe — cf. le cas « 67 305 » plus bas). Le patient voit « aucun résultat ». |
| `404 dossier_not_found` | le dossier n'existe pas **ou** n'appartient pas à ce patient (cloisonnement vérifié : un patient ne peut pas ouvrir le dossier d'un autre). |
| liste OK, `pdf_base64: ""` dans **tous** les modes | le dossier existe côté laboratoire mais **aucun fichier PDF n'y est attaché**. Rien à corriger dans l'app : c'est un sujet serveur (Si Brahim). |
| `429` | limite de débit atteinte — relancer plus lentement. |
| liste vide | identifiant valide mais sans dossier. |

## 4. Cas traité le 21/07/2026 — dossier 130726314 (patient 232527)

- Le serveur renvoie le dossier (13/07/2026, état `Final`, 13 analyses) mais
  `pdf_base64` est **vide dans les 5 modes**, y compris `include_pdf:"all"` et la
  requête ciblée par `dossier_id`. Réponse HTTP 200, corps complet = 290 octets :
  rien n'est tronqué, le PDF est absent **à la source**.
- Témoins : **25 dossiers** appartenant à 10 autres patients (2021-08 → 2026-06-17)
  renvoient tous un PDF valide (120 Ko à 920 Ko, `%PDF-` + `%%EOF`).
- Vérification adversariale du code applicatif (transport/taille, identifiants,
  logique UI) : aucun mécanisme côté app ne peut produire ce symptôme. Un identifiant
  abîmé donnerait `404` → « aucun résultat » ; une erreur de transport donnerait
  l'état `error` ; le message « pas de PDF » n'est atteignable qu'après un **200 avec
  une chaîne vide**.
### Rebondissement : la réplique ne contient qu'une partie des patients

Le laboratoire (Si Hassan) a fourni 4 identifiants de patients ayant un bilan en
juillet 2026 : `41666` (01/07), `165783` (07/07), `163007` (13/07), `232735` (21/07).

**Les quatre renvoient `404 requester_not_found`**, dans les trois types
(`patient`/`medecin`/`correspondant`) — alors qu'au même instant les identifiants de
test de Si Brahim (`7587`, `142807`, `TESTA`, `TESTMED`) et les 10 patients inscrits
dans l'app répondent normalement. Le serveur n'est donc pas en panne : **il ne connaît
tout simplement pas ces patients**.

Autre fait décisif : Si Hassan confirme que **le PDF du dossier 130726314 existe bien
dans Qalam**, qu'il est imprimable, et qu'il a été envoyé au patient par WhatsApp. Le
document existe au laboratoire ; il n'est pas visible depuis l'API.

**Hypothèse de travail** (à confirmer par Si Brahim / Si Hassan) : la réplique
interrogée par l'API ne couvre pas tout Qalam, mais seulement les patients « publiés »
en ligne (héritage de l'ancien portail cyberlab.ma), et elle est alimentée à
l'inscription plutôt qu'en continu. Cela expliquerait les deux symptômes d'un coup :

- les 4 patients récents n'ont jamais été publiés → inconnus ;
- le patient 232527 a été publié le **13/07 à 07h50** (jour où le laboratoire lui a
  accordé l'accès à l'app), et son prélèvement est du **13/07 à 08h42**, juste après :
  la fiche du dossier est arrivée dans la réplique, mais le PDF, édité plus tard dans
  la journée, n'a jamais suivi.

**Conséquence opérationnelle majeure si l'hypothèse se confirme :** inscrire un patient
dans l'application ne suffit pas — il faut aussi l'action de publication côté Qalam,
sinon le patient ne verra rien. À intégrer à la procédure d'accueil.

**Test décisif demandé** : publier UN seul des quatre patients (`232735`) et relancer
`node scripts/diag-dossier.js 232735 --compare 7587`. S'il apparaît avec son PDF,
l'hypothèse est confirmée et on tient la marche à suivre.

## 5. Bug applicatif trouvé en chemin — identifiant avec espace

Un profil patient contenait `requester_id = "67 305"` (Qalam affiche les grands
identifiants avec un séparateur de milliers). Le serveur répond
`404 requester_not_found` → **le patient ne voit rien**, sans message expliquant
pourquoi. L'identifiant correct `67305` renvoie bien 2 dossiers avec leurs PDF.

Corrigé par `normalizeRequesterId()` (`functions/src/cyberlab/client.ts`), qui retire
**tous** les espaces (y compris insécables) et est appliqué :

- à l'écriture — `adminSetRequester`, `adminFulfillAccessRequest` ;
- au test — `adminTestResults` ;
- **à la lecture** — `fetchResultsForUser`, ce qui répare les profils déjà enregistrés
  sans migration de données.

Un simple `.trim()` ne suffit pas : l'espace est **à l'intérieur** de l'identifiant.
