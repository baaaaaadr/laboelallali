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

### Hypothèse CONFIRMÉE — 21/07/2026

Si Hassan a suivi la procédure complète (ouverture du dossier dans Qalam + création du
compte CyberLab) sur **un seul** des quatre patients, `41666`, et nous l'a signalé.
Sonde relancée le lendemain sur les cinq identifiants, sans aucun déploiement entre
les deux mesures :

| Identifiant | Avant | Après | Lecture |
|---|---|---|---|
| `41666`  | 404 | **200 + PDF valide** (155 668 o, `%PDF-` ✓ `%%EOF` ✓) | procédure faite → fonctionne |
| `165783` | 404 | 404 | procédure non faite |
| `163007` | 404 | 404 | procédure non faite |
| `232735` | 404 | 404 | procédure non faite |
| `232527` | 200 + PDF vide | 200 + PDF vide | cas distinct, non résolu |

Quatre patients du même lot, même serveur ; la seule variable est l'action dans Qalam,
et c'est exactement le patient traité qui bascule. **Le lien de cause à effet est
établi : un patient n'apparaît dans la réplique qu'une fois son compte CyberLab créé.**

### Ce que ce test ne prouve PAS — garde-fou contre la sur-interprétation

Il est tentant d'en conclure que « l'accueil oublie l'étape Qalam » et que c'est un
problème systémique. **Les faits disent le contraire**, et il faut le lire avant d'agir :

- les **10 patients inscrits dans l'app répondent normalement**, et **25 de leurs
  dossiers** (2021-08 → 2026-06-17) renvoient un PDF valide (§4 ci-dessus) ;
- le patient `232527` a été publié le **13/07 à 07h50**, le jour même où l'accueil lui
  a accordé l'accès à l'app — l'étape Qalam **a donc bien été faite**, et au bon moment.

Les 4 identifiants de juillet n'étaient pas des utilisateurs de l'app : c'étaient des
patients du laboratoire choisis au hasard pour vérifier si le problème était lié aux
dossiers récents.

⚠️ **Ce qu'on sait vs ce qu'on suppose.** Le seul fait établi est que l'API ne les
connaît pas (`404 requester_not_found`). La cause n'est **pas** démontrée. Trois
hypothèses restent ouvertes, et elles n'ont pas du tout les mêmes conséquences :

| Hypothèse | Conséquence |
|---|---|
| **A.** Aucun compte CyberLab n'a jamais été créé pour eux (personne n'a demandé d'accès) | comportement normal, rien à corriger |
| **B.** Les comptes ont été créés mais la publication n'a pas abouti | **problème systémique, urgent** |
| **C.** Ces numéros ne sont pas des identifiants patient exploitables par l'API | notre lecture des identifiants est à revoir |

**Seul Si Hassan peut trancher**, et la question à lui poser est exactement : « as-tu
créé le compte CyberLab de ces trois patients, oui ou non ? » Tant qu'elle n'a pas de
réponse, ne pas conclure.

Élément qui **affaiblit l'hypothèse C** sans l'éliminer : `232527` (qui fonctionne) et
`232735` (404) sont des numéros voisins, tous deux récents — le format et l'ancienneté
ne peuvent donc pas expliquer la différence à eux seuls.

**Ne pas relier ce constat au taux d'utilisation de 0 %** du tableau de bord : le suivi
d'usage n'a démarré que le **20/07**, soit deux jours avant la mesure. Un compteur à
zéro sur deux jours ne démontre rien.

**Trois états possibles, trois actions différentes** — c'est la grille de lecture du
widget « Tester » de `/admin` :

1. **404 `requester_not_found`** → le patient est inconnu de la réplique. Soit le
   numéro est faux, soit son compte CyberLab n'a pas été créé dans Qalam. *Action :
   créer le compte CyberLab, puis retester.*
2. **200 + `pdf_base64` vide** → la fiche du dossier est là, le document ne l'est pas.
   Le patient voit la ligne mais ne peut pas l'ouvrir. *Action : faire republier le
   dossier par le laboratoire.* C'est le cas de `232527` / dossier `130726314`, dont
   Si Hassan confirme que le PDF existe et s'imprime dans Qalam.
3. **200 + PDF valide** → rien à faire.

**Conséquence opérationnelle :** l'étape Qalam est **indispensable** et, d'après les
faits ci-dessus, elle est **déjà faite** par l'accueil au moment où il traite une
demande d'accès. Le risque n'est donc pas un défaut de procédure, mais un **oubli
ponctuel** — invisible côté accueil comme côté patient, puisque personne ne reçoit
d'erreur. C'est exactement ce que le widget « Tester » de `/admin` sert à détecter
avant d'inviter le patient à se connecter, en une seconde.

**Seule anomalie réelle restante : `232527` / dossier `130726314`** — fiche présente,
PDF absent à la source. Isolée sur 26 dossiers observés.

### Sondes du 22/07/2026 — hypothèse A retenue, et une piste sérieuse sur le PDF

Re-mesure complète (5 identifiants + 3 témoins, appels espacés de 60-75 s pour éviter
le `429`), après la réponse de Si Hassan du 22/07 confirmant la procédure Qalam :

| Identifiant | Dossier(s) | Résultat |
|---|---|---|
| `41666`  | `010726001` du **01/07/2026** | 200 + **PDF valide** 155 668 o (`%PDF-` ✓ `%%EOF` ✓) |
| `165783` | — | 404 `requester_not_found` (4 modes) |
| `163007` | — | 404 `requester_not_found` (4 modes) |
| `232735` | — | 404 `requester_not_found` (4 modes) |
| `232527` | `130726314` du 13/07/2026 | 200, **PDF vide dans les 5 modes** (inchangé) |
| `7587`   | `150426014`, `010224062`, `080921178` | PDF valides |
| `142807` | `300626536/681/828` du **30/06/2026** | **3 PDF valides** (133-146 Ko) |
| `TESTA` (correspondant) | 3 dossiers du 30/06 | PDF valides |

**Conclusions.**
1. **Hypothèse A confirmée en pratique, B et C écartées.** Les trois 404 persistent à
   l'identique alors que `41666` — même lot, même format de numéro — répond parfaitement
   depuis que la procédure a été faite pour lui. C réfutée (le format est exploitable) ;
   B réfutée (le seul compte créé a fonctionné immédiatement, aucun cas « créé mais
   invisible »). Reste **A : personne n'a créé leur compte CyberLab**, ce qui est normal —
   ces trois patients n'ont jamais demandé d'accès à l'application. *Réserve : Si Hassan
   n'a pas répondu littéralement « non, je ne les ai pas créés » ; la question fermée
   reste posée pour verrouiller le point.*
2. **Vérification adversariale du code refaite indépendamment** (transport, identifiants,
   `type`, `include_pdf`, `dossier_id`, taille, parsing) : conclusion identique à celle
   du 21/07 — aucun mécanisme applicatif ne peut produire ces symptômes. La seule piste
   théorique restante (un `type` valide mais inadéquat) est **exclue empiriquement** :
   les sondes testent les trois types.
3. **Les PDF récents remontent bien.** Le 01/07 (`41666`) et le 30/06 (`142807`, trois
   dossiers) renvoient tous des PDF valides. Il n'y a **pas** de rupture systémique à
   partir d'une date. `232527` est bien une anomalie isolée.
4. **Piste sérieuse sur `232527`, renforcée par ces mesures.** Comparer les deux cas de
   juillet est éclairant :

   | | `41666` | `232527` |
   |---|---|---|
   | Dossier | 01/07 | 13/07 08h42 |
   | Publication (compte CyberLab) | 21/07, soit **20 jours après** le PDF | 13/07 **07h50**, soit **avant** le prélèvement |
   | PDF via l'API | ✅ présent | ❌ vide |

   Le seul dossier dont le PDF manque est **le seul publié avant que son PDF existe**.
   Cohérent avec : *la réplique est alimentée au moment de la publication et n'est jamais
   remise à jour ensuite.* **Ce n'est pas démontré** (un seul cas), mais c'est testable, et
   la conséquence serait opérationnelle : tout patient dont on crée le compte le matin,
   avant l'édition de son résultat, verrait sa ligne sans pouvoir ouvrir le PDF.

**Test décisif suivant (Si Hassan) :** republier le dossier `130726314` maintenant que
son PDF existe, puis relancer `node scripts/diag-dossier.js 232527 --dossier 130726314`.
- PDF apparaît → hypothèse confirmée **et** on tient la manipulation de rattrapage.
- PDF toujours absent → c'est côté serveur, escalade Si Brahim avec la chronologie.

**Question de fond pour Si Brahim :** la réplique peut-elle être alimentée **en continu**
plutôt qu'au seul moment de la création du compte ? Cela supprimerait cette classe de
problème au lieu de la rattraper au cas par cas.

**Curiosité relevée (sans impact sur l'app) :** envoyer `requester_id` comme **nombre
JSON** au lieu d'une chaîne donne `404` sur `41666` mais `200` sur `232527` et `142807`.
Notre passerelle envoie **toujours** une chaîne (`normalizeRequesterId` convertit un
nombre en `String`), donc l'app n'est pas exposée — mais le contrat d'API précise bien
« chaîne, pas un nombre » et le serveur n'est visiblement pas homogène là-dessus.

**Côté application, le symptôme est désormais visible.** `/resultats` ne montre plus
« Aucun résultat disponible » quand le serveur répond 404 : nouvel état `unknown_id` qui
explique au patient que son accès n'est pas encore activé au laboratoire et lui fournit
un message tout prêt à envoyer (Copier / WhatsApp). Même chose pour un dossier sans PDF.
Voir `docs/pages/resultats.md` §4h. Cela transforme chaque patient bloqué — jusqu'ici
invisible pour tout le monde — en signal qui remonte au laboratoire.

**Question ouverte, pour Si Hassan d'abord :** republier ce dossier suffit-il à faire
apparaître le PDF ? Manipulation courte, réversible, et qui n'exige de toucher à aucun
dossier médical.

**À escalader vers Si Brahim seulement si la republication échoue :** pourquoi le
document n'a-t-il pas suivi la fiche pour ce dossier précis ? (Indice chronologique :
la fiche a été publiée le 13/07 à 07h50, le prélèvement est de 08h42 et le PDF a été
édité plus tard dans la journée — le document est peut-être arrivé après le seul
instant où la réplique était alimentée.) Deuxième question de fond : la réplique
peut-elle être **alimentée en continu**, plutôt qu'au seul moment de la création du
compte ? Cela supprimerait cette classe de problème.

**Note technique utile :** l'étape « lier une adresse Gmail » décrite par Si Hassan
appartient à la procédure du **portail CyberLab**, pas à la nôtre — notre passerelle
n'envoie jamais d'e-mail, seulement le numéro de dossier. Reste à savoir si la création
du compte suffit à publier le patient sans cette liaison ; si oui, l'accueil économise
une manipulation à chaque inscription.

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

---

## Question ouverte : `date_dossier` est-il vraiment en UTC ? (01/09/2026)

**À poser à Si Brahim / CyberLab. Un e-mail referme le sujet.**

Les horodatages arrivent suffixés `Z` (donc UTC) — par exemple `2026-07-13T08:42:19Z` — mais tout indique qu'ils transportent en réalité **l'heure murale marocaine** : dans ce document même, ce `08:42:19Z` est lu comme « 13/07 08h42 », c'est-à-dire l'heure locale du labo. Or le Maroc est à UTC+1.

**Ce que ça casse.** Tant qu'on n'affichait que des mois, l'écart d'une heure était invisible. Il ne l'est plus :

1. Un bilan prélevé il y a dix minutes se parse **jusqu'à une heure dans le futur**. `monthsSince` rendait alors `null`, ce qui éteignait le rappel de bilan sur `/resultats` **et** dans le panneau d'accueil pendant l'heure qui suit chaque bilan — précisément quand le patient ouvre l'application pour voir son résultat. Corrigé par une fenêtre de tolérance de 6 h (`src/lib/results/stats.ts`), qui rend « 0 mois » plutôt que rien.
2. Le compteur vivant du hero (mois / jours / heures / minutes / secondes) affiche donc `0 j 00:00:00` **figé pendant une heure** après un bilan frais, avant de se mettre à courir. Stable et jamais négatif, mais c'est le contraire de « vivant ».

**Ce qu'on n'a pas fait, et pourquoi.** Aucune correction de fuseau en dur. Le Maroc repasse à UTC+0 pendant le Ramadan, donc un `−1 h` constant serait faux plusieurs semaines par an ; et si le serveur corrige un jour son sérialiseur, ce `−1 h` deviendrait une erreur de `+1 h` que personne ne surveille. Décaler silencieusement un horodatage médical est pire qu'être grossier d'une heure.

**La question exacte :** le champ `date_dossier` de l'API résultats est-il exprimé en UTC, ou s'agit-il de l'heure locale du laboratoire avec un `Z` ajouté par le sérialiseur ? Si c'est le second cas, l'idéal est un décalage explicite (`+01:00`) plutôt qu'un `Z`.
