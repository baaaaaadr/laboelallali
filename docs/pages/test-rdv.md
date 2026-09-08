# Page: /test-rdv — Parcours patient unifié

> **Page de VALIDATION.** Elle remplacera `/rendez-vous` **et** `/glabo`, qui seront alors
> supprimées. Tant qu'elle est en test : non indexable (`noindex` + exclue de `next-sitemap.config.js`)
> et accessible depuis le menu **uniquement à l'équipe** (`isStaff`, `Header.tsx`).
> Renommer la route = modifier **une seule** constante : `JOURNEY_SEGMENT` dans `src/lib/journey/route.ts`.

## Purpose

Regrouper en une seule page le parcours complet du patient, de l'ordonnance jusqu'au prélèvement.
Il était éclaté entre quatre endroits sans lien : `/rendez-vous`, `/glabo`, l'envoi d'ordonnance
(dupliqué dans les deux) et le panier de `/analyses`. Deux conséquences mesurées avant ce
changement : le patient qui composait son panier n'avait **aucun** bouton pour prendre rendez-vous,
et le laboratoire recevait un e-mail où le champ `type_analyse` valait la chaîne fixe
`"Rendez-vous Laboratoire"` — pas un mot des analyses souhaitées.

La page **répond tout de suite** quand la réponse est calculable (prix, délai, jeûne, tous présents
dans le panier), et n'appelle une réponse humaine que pour une ordonnance photographiée ou une
demande en texte libre.

## Directory & File

- **Route :** `src/app/[lang]/test-rdv/page.tsx` — coquille de ~55 lignes : résout la `params`
  Promise, pose la frontière `<Suspense>` (obligatoire, `useSearchParams()`), lit `?service=` et
  injecte le `noindex`. **Rien d'autre n'y vit** : c'est ce qui rendra la reprise par
  `/rendez-vous` et `/glabo` triviale (chacune rendra `<PatientJourneyPage lang variant="lab"|"home" />`).
- **Composants :** `src/components/features/journey/`
- **Logique pure :** `src/lib/journey/`

## Arborescence des composants

```
PatientJourneyPage.tsx        orchestrateur : hooks, envoi, liste des sections (~430 l.)
 └ JourneyAuthGate.tsx        portail de connexion (~150 l.)
    └ GlaboBenefits.tsx       les 3 avantages GLABO, extraits de glabo/page.tsx
 └ SectionShell.tsx           étape dépliante (numéro, résumé, coche) + <ChoiceCard>
 └ sections/
    PrescriptionSection.tsx   Q1 oui/non + modes de transmission (CUMULABLES)
    FreeTextPanel.tsx         zone de texte, libellé selon oui/non
    JourneyCartSection.tsx    <CartView> réutilisé + explications + CTA catalogue
    AnalysisExplanations.tsx  UN SEUL dépliant, puis la liste à plat des utilités
    ImmediateAnswerCard.tsx   prix / jeûne / délai, ou « réponse du biologiste attendue »
    WantToKnowSection.tsx     4 cases à cocher
    LocationSection.tsx       3 lieux + adresse/accès conditionnels
    DateTimeSection.tsx       DatePicker + <select> de créneaux
    ReplyChannelSection.tsx   WhatsApp / e-mail / appel / SMS
    IdentitySection.tsx       nom / téléphone / e-mail pré-remplis
    ResultsAccessSection.tsx  3 états d'accès aux résultats
    SubmitSection.tsx         les 2 boutons + SubmitProgressModal
 └ hooks/
    useJourneyForm.ts         tout l'état + dérivés + carte de révélation
    useJourneyCart.ts         panier localStorage + carte des analyses en différé
    usePrescriptionUpload.ts  pré-téléversement en arrière-plan
    useResultsAccess.ts       3 états d'accès (appel DIFFÉRÉ)
    useJourneyDraft.ts        brouillon sessionStorage (aller-retour /login et /analyses)
    useJourneySections.ts     résumé replié + coche verte / pastille ambre par étape
```

### Modules extraits pour être réutilisés (nouveaux, partagés)

| Fichier | Rôle | Pourquoi extrait |
|---|---|---|
| `src/lib/cart/storage.ts` | `CART_STORAGE_KEY`, `readCart`/`writeCart`/`clearCartStorage` | La clé était un littéral dans `analyses/page.tsx` ; deux littéraux dans deux fichiers finissent toujours par diverger. `analyses/page.tsx` l'importe désormais |
| `src/hooks/useLabSchedule.ts` | date + créneau câblés sur `labHours.ts` | Le montage était copié à l'identique dans `/rendez-vous` et `/glabo`, avec ses 3 pièges. `/rendez-vous` et `/glabo` ne l'utilisent PAS encore — à basculer lors de la reprise |
| `src/components/features/auth/GoogleAuthButton.tsx` | bouton Google + repli | Le même montage était écrit à la main dans `login/page.tsx` et `GoogleSignInPrompt.tsx`. Ces deux-là ne l'utilisent PAS encore — migration volontairement remise, `/login` est le chemin critique |
| `src/components/features/journey/GlaboBenefits.tsx` | les 3 avantages GLABO | Le portail et `/glabo` doivent afficher exactement les mêmes |
| `src/components/ui/Disclosure.tsx` | bloc dépliant piloté (résumé, coche verte, chevron RTL) | Le motif était recopié à la main dans `HeroAnalysesDisclosure`, `AnalysesDetails` et `LabStatusWidget` ; ces trois-là ne l'utilisent PAS encore |

## State Management

### `useJourneyForm` (source unique de l'état du formulaire)

| État | Type | Contenu |
|---|---|---|
| `nom`, `telephone`, `email` | `string` | pré-remplis depuis `userProfile`, modifiables |
| `identityTouched` | `boolean` | empêche un chargement TARDIF du profil d'écraser une saisie en cours |
| `phoneError` | `string` | message sous le champ téléphone |
| `hasPrescription` | `null \| 'yes' \| 'no'` | réponse à la question 1 |
| `transmission` | `Record<'upload'\|'freetext'\|'catalog', boolean>` | **cumulables** |
| `freeText` | `string` | plafonné à `FREETEXT_MAX` = 1500 |
| `wantToKnow` | `Record<'prix'\|'delai'\|'jeune'\|'explication', boolean>` | |
| `samplingPlace` | `'laboratoire' \| 'domicile' \| 'travail'` | initialisé à `domicile` si `variant === 'home'` |
| `adresse`, `instructionsAcces` | `string` | visibles seulement hors laboratoire |
| `replyChannel` | `ReplyChannel` | défaut `whatsapp` |
| `selectedDate`, `selectedTime`, `timeSlots`, `now` | via `useLabSchedule` | |

### `useJourneyCart`

| État | Contenu |
|---|---|
| `cartItems` | `CartItem[]` lu depuis `localStorage` **dans un effet** |
| `hydrated` | `false` jusqu'à cette lecture |
| `mapStatus` | `'not_needed' \| 'loading' \| 'ready' \| 'failed'` — exposé en `mapPending` / `mapFailed` |
| `cartView` | `computeCartView(cartItems, map, SAMPLING_FEE)` |
| `preparation` | `usePreparationRules(cartItems, map)` |
| `answerComplete` | `!hasBilan \|\| mapStatus === 'ready'` |

### Dérivés clés (`useJourneyForm`)

```ts
needsHumanAnswer = transmission.upload || transmission.freetext
isHomeService    = samplingPlace !== 'laboratoire'
intentDone       = hasPrescription !== null && (fichier || texte || panier non vide)
```

## Deux mécaniques superposées : la RÉVÉLATION et le REPLIAGE

Ce sont deux choses distinctes ; les confondre est le meilleur moyen de casser la page.

### 1. Révélation — quelles sections EXISTENT (`visible`, dans `useJourneyForm`)
**Vague 1** = « que voulez-vous » : question 1 → modes → contenu (dépôt de fichier, texte, panier).
**Vague 2** = tout le reste (souhaits, lieu, date, canal, identité, accès résultats, envoi),
révélée **d'un coup** dès que `intentDone` passe à vrai. `SectionShell` renvoie `null` quand
`visible === false`.

**Règle non destructive :** masquer une section n'efface JAMAIS sa saisie. **Une seule exception** —
passer « j'ai une ordonnance » à « je n'en ai pas » vide les fichiers, sinon une ordonnance devenue
invisible partirait quand même avec la demande.

### 2. Repliage — quelle section est OUVERTE (`openSection`, accordéon)
Demande du propriétaire (08/09/2026) : « tout doit être collapsé par défaut, comme ça le user voit
la suite logique des grandes étapes et déplie juste ce qu'il veut/doit éditer ». Une seule section
ouverte à la fois. Chaque en-tête replié affiche :

| élément | exemple |
|---|---|
| numéro + titre | `4  Où souhaitez-vous être prélevé ?` |
| résumé de la réponse | `À domicile — 12 rue X` |
| **coche verte** | l'étape est complète |
| **pastille ambre** | l'étape est obligatoire et incomplète |

Ces résumés et marqueurs sont calculés dans **`hooks/useJourneySections.ts`**, à part de
`useJourneyForm` — c'est de la présentation (état + panier + traductions), pas de l'état.

- **État initial** : tout replié, **sauf** quand la page est vierge (aucun panier rapporté du
  catalogue) — sinon le patient tomberait sur UNE ligne fermée sans rien à résumer, un écran mort.
- **⚠ AUCUN repliage automatique en cours de route.** Une première version repliait tout dès que
  `intentDone` devenait vrai ; arriver AVEC un panier — le parcours principal ! — rendait
  `intentDone` vrai à la première réponse et **l'étape 1 se refermait au nez du patient** avant
  qu'il ait pu choisir un mode de transmission. Le patient seul ouvre et ferme.
- **La section « Envoyer ma demande » ne se replie jamais** (`collapsible={false}`) : cacher le
  bouton derrière une flèche cacherait la seule chose que le patient est venu faire.
- La pastille ambre n'apparaît **qu'une fois la vague 2 visible** — reprocher une information
  manquante avant que le patient ait pu répondre serait une réprimande, pas une aide.

Le bloc dépliant lui-même est **`src/components/ui/Disclosure.tsx`**, extrait pour l'occasion : le
motif était déjà recopié à la main dans `HeroAnalysesDisclosure`, `AnalysesDetails` et
`LabStatusWidget` (`docs/pages/contact.md` notait l'absence d'un composant partagé).

## ⚠ Consignes patient ≠ consignes préleveur

Deux champs de la collection `analyses` portent des « consignes », et ils ne s'adressent **pas à la
même personne**. Vérifié sur les 304 documents (08/09/2026) :

| champ | rempli | arabe | contenu réel |
|---|---|---|---|
| `Pre_Analytique_FR/AR` | **304/304** | **oui** | « Urines du matin, flacon stérile, toilette intime. », « Apporter le calcul. », « Abstinence 3-5j. » |
| `CPA_Instructions` | 153/304 | **aucun** | « Congeler plasma citrate rapidement », « Tube EDTA », « Éviter absolument l'hémolyse », « Protéger de la lumière » |

`CPA_Instructions` est la **fiche technique du préleveur**. L'absence totale de traduction arabe
suffit à le prouver : ce champ n'a jamais été écrit pour un patient. Le parcours affichait ces
consignes au patient dans sa première version — le propriétaire l'a repéré :
« je crois que ce sont des consignes pour le préleveur plutôt ».

**Règle, portée par `usePreparationRules` :**
- `patientPreparation` / `patientPreparationAr` → **au patient** (écran) et rappelées au
  laboratoire sous « Consignes données au patient » ;
- `technicalInstructions` → **au laboratoire uniquement**, sous « Consignes techniques (préleveur) » ;
- `specialInstructions` est conservé comme alias déprécié : `CartPreparation` (catalogue) et
  `generateDevisPdf` le lisent encore. **Le catalogue montre donc TOUJOURS les consignes techniques
  au patient — défaut préexistant, hors périmètre de ce lot, à corriger.**

**Filtre du jeûne :** `patientPreparation` retire, phrase par phrase, tout ce qui ne parle que du
jeûne (« Non à jeun. », « Strictement à jeun (12h). »). Le jeûne a déjà sa propre ligne, calculée
sur le maximum du panier. Sans ce filtre, un panier mêlant une analyse à jeun et une autre non
affichait « Jeûne 12h. · Jeûne non obligatoire. » côte à côte — deux phrases qui se contredisent
sous une ligne qui tranchait déjà. Mesuré sur les 94 valeurs distinctes : 8 entièrement supprimées,
12 réduites (« Le matin. À jeun. » → « Le matin. »), 86 conservées.

## Le panier voyage par localStorage, et rien d'autre

`/analyses` écrit `laboElAllali_selectedItems_v2` à **chaque** modification : la clé est donc
toujours à jour au moment du clic sur « Prendre RDV ». Le panier n'est **pas** mis dans l'URL —
plus de 8 Ko pour 20 lignes, et surtout une intention médicale inscrite dans l'historique du
navigateur et dans les en-têtes `Referer`.

**Fait qui simplifie beaucoup :** `computeCartView` et `usePreparationRules` ne consultent la carte
des analyses que pour résoudre la composition des **bilans** (`cartView.ts`, branche `bilan`
uniquement). Comme `BILANS_ENABLED === false`, un panier normal se calcule **sans aucune lecture
Firestore** : prix, `CPA_Jeune_H` et `DRR_Jours` sont lus sur les objets stockés dans le navigateur.

## Portail de connexion (`JourneyAuthGate`)

Compte obligatoire **dès l'ouverture** (décision du propriétaire, 08/09/2026). L'écran d'attente
n'est pas un mur nu : il porte l'identité du service d'origine — `?service=domicile` affiche le
titre GLABO et `<GlaboBenefits/>`, parce que `/glabo` est imprimé sur des devis déjà remis et que
quelqu'un qui scanne ce QR code doit comprendre où il est.

Le portail teste **`user` seul**, pas `userProfile.phone` : un compte Google sans téléphone est le
problème de `/login`, pas du tunnel.

### ⚠ INVARIANT — toute création de compte Google passe par `/login`

Après une connexion réussie, on redirige **systématiquement** vers
`/${lang}/login?redirect=<page courante>`. Une première connexion Google produit un utilisateur
authentifié **sans** profil Firestore et **sans** téléphone ; la complétion du profil et
`autoRequestResultsAccess()` (la file d'accueil du laboratoire) n'existent que sur `/login`.
`getRedirectTarget` y renvoie aussitôt ici quand le profil est complet — coût : un écran de
chargement. Un second effet (`user` présent, `phone` absent) couvre le repli par redirection, où la
page a été détruite et la fonction de rappel n'a jamais tourné.

## Envoi

### Document `appointmentRequests`

Les discriminateurs sont **conservés à l'identique** (le suivi du laboratoire s'appuie dessus) :
`type` ∈ `lab_appointment` | `home_service_appointment` — le **lieu de travail compte comme service
à domicile**, exactement comme le fait `/glabo` — et `status` parmi les 4 valeurs existantes.

Champs **ajoutés** : `source: 'journey'`, `journeyVersion`, `variant`, `uid`, `locale`,
`samplingPlace`, `hasPrescription`, `transmissionModes`, `requestText`, `wantToKnow`,
`replyChannel`, `needsHumanAnswer`, `sentViaWhatsApp`, `cart` (lignes dénormalisées + totaux) et
`preparation`.

⚠ Firestore refuse `undefined` et lève à `addDoc` : `?? null` sur chaque champ optionnel.
⚠ Le panier est dénormalisé **volontairement** (5 champs par ligne) : les prix changent, et le
personnel doit voir ce qui a été annoncé au patient ce jour-là.

### E-mail (`src/app/api/send-appointment/route.ts`)

Cinq blocs ajoutés, **chacun vide quand sa donnée manque** — vérifié : un envoi depuis une ancienne
page produit 2 271 caractères de HTML, strictement sans aucun bloc nouveau ; le parcours en produit
5 568.

1. Tableau des analyses (plafonné à 60 lignes) + sous-total + frais (« déplacement inclus » quand
   c'est un déplacement) + **TOTAL ESTIMÉ** + « Estimation — tarif à confirmer au laboratoire. »
2. Préparation : jeûne, délai, type(s) de prélèvement, **« Consignes données au patient »** et,
   séparément, **« Consignes techniques (préleveur) »**. Quand une partie de la demande échappe au
   catalogue, le titre porte « — calculée sur les seules analyses du catalogue ».
3. « Le patient souhaite connaître : … »
4. « Répondre au patient par : … » + l'avertissement rouge, dont le TEXTE DÉPEND du contexte
   (voir ci-dessous).
5. Provenance : ordonnance oui/non + mode(s) de transmission.

### Les contradictions corrigées le 08/09/2026 (ne pas les réintroduire)

Le propriétaire a relu deux e-mails réels. Chacune de ces phrases était fausse ou trompeuse :

| symptôme | cause | correction |
|---|---|---|
| Bandeau « Nouvelle Demande de Prélèvement **à Domicile** » alors que l'objet disait « LIEU DE TRAVAIL » | titre figé sur `isHomeService` | pour le parcours, le bandeau reprend `lieuLabel` |
| « Service à domicile : Oui » pour une visite en entreprise | idem | supprimé pour le parcours (l'encadré « Lieu de prélèvement » le dit déjà) |
| Trois champs disaient la même chose (`Type d'analyse`, `Service à domicile`, `Type de lieu`) | empilement historique | les deux premiers sont masqués pour le parcours |
| « **le prix et le délai n'ont pas pu être calculés automatiquement** » imprimé juste sous « TOTAL ESTIMÉ 148 DH » | message unique alors que catalogue et texte libre sont **cumulables** | deux textes : avec devis → « le devis ne couvre QUE les analyses du catalogue » ; sans devis → « rien n'a pu être chiffré » |
| « Canal de réponse : Appel » suivi de « a choisi de vous écrire par WhatsApp » | deux notions différentes collées | l'arrivée (« Reçu aussi sur WhatsApp ») remonte en haut avec les métadonnées ; le canal de réponse reste en bas |
| La demande du patient sous l'étiquette « Commentaires » | libellé hérité | « Demande écrite par le patient » |
| Une ordonnance recopiée ligne par ligne arrivait en une seule phrase | `esc()` écrase les `\n` | `escMultiline()` — échappe **puis** convertit en `<br>` |
| Impossible de savoir qu'il fallait rappeler en arabe | `locale` était envoyé puis **jeté** par la route | ligne « Langue du patient » |
| Le nom était réordonné (« Benali Ahmed ») alors que WhatsApp affichait « Ahmed Benali » | découpage au premier espace, pari sur les noms composés | le parcours envoie le nom **tel que saisi**, `prenom` vide |
| Téléphone et e-mail non cliquables | texte brut | `tel:`, `mailto:` et un lien **wa.me** vers le patient |
| Les liens d'ordonnance meurent à 30 jours sans prévenir | `expiresAt` | note sous les boutons |

### ⚠ Un devis SOUS-ÉVALUÉ pouvait partir (corrigé)

`answerComplete` pilotait l'affichage mais **n'était jamais consulté à l'envoi**. Quand la
composition d'un bilan n'était pas résolue, les lignes valorisées à 0 partaient quand même — dans le
corps de l'e-mail **et dans son objet** (« DEVIS 20 DH »). Le laboratoire annonçait alors un prix
faux au patient. Les **totaux** ne sont désormais envoyés que si `cart.answerComplete` ; les
**lignes** partent toujours (le personnel voit quoi chiffrer).

**Sujet** : les deux préfixes existants sont conservés (des filtres de boîte mail s'appuient
dessus), on **ajoute** ` — DEVIS 148 DH`. Le lieu précis (`LIEU DE TRAVAIL`) n'est écrit que pour
`source === 'journey'` ; les anciennes pages gardent `DOMICILE`.

⚠ **Les valeurs partent en CLÉ BRUTE et sont traduites dans la route.** Envoyer la sortie de `t()`
mettrait des libellés arabes dans la boîte française du laboratoire — l'incident déjà survenu sur
`lieuPrelevement`. `esc()` reste sur **tout** ; les prix passent par `Number()` **avant** `esc()`.

### WhatsApp

`src/lib/journey/buildWhatsAppMessage.ts`, littéraux FR/AR **en dur, pas de `t()`** (course sur le
chargement des namespaces depuis un gestionnaire asynchrone — voir le commentaire de
`rendez-vous/page.tsx`). Plafond de 1 800 caractères avant encodage, 15 analyses listées au maximum :
iOS tronque ou refuse silencieusement les `wa.me?text=` trop longs.

**Le chemin WhatsApp envoie AUSSI l'e-mail complet** (nouveauté : les deux anciennes pages
n'envoyaient rien). Ordre d'exécution, qui corrige une incohérence entre elles :
1. Bureau : `window.open('', '_blank')` **synchrone**, avant tout `await`, sinon le bloqueur de
   fenêtres mange la redirection.
2. Attendre le pré-téléversement.
3. `addDoc` **et** l'e-mail **avant** de naviguer : sur mobile `location.href` détruit la page et
   peut tuer une requête en vol.
4. Naviguer, vider le formulaire, le brouillon, puis le panier.

Après un envoi réussi le panier est vidé avec une notification **« Panier vidé après l'envoi —
Annuler »** (8 s), qui le restaure.

## Notes for AI

- **Ne jamais afficher `CPA_Instructions` à un patient.** C'est la fiche technique du préleveur —
  voir la section dédiée plus haut. Le champ patient est `Pre_Analytique_FR/AR`.
- **`openSection` n'est jamais piloté automatiquement** après l'état initial. Voir plus haut : un
  repliage automatique refermait l'étape 1 au nez du patient venu du catalogue.
- **Jamais le mot « symptômes »** (ni `أعراض`). On parle des ANALYSES souhaitées : un laboratoire
  d'analyses ne recueille pas de plainte médicale. Contrôle :
  `grep -ri "sympt\|أعراض" public/locales/*/journey.json src/components/features/journey/`
- **Ne jamais afficher un total faux.** `answerComplete` est à `false` tant que la composition d'un
  bilan n'est pas résolue, et `JourneyCartSection` affiche alors un squelette — parce que
  `<CartView>` embarque son propre bloc de totaux. `loadAnalysesCatalog()` renvoie `[]` (jamais une
  erreur) quand Firestore est injoignable : une liste vide est traitée comme un **échec**
  (`mapStatus === 'failed'` → lignes sans prix + message), sinon la composition serait valorisée à 0.
- **`useNow()` vaut `null` jusqu'au montage.** Jamais de `new Date()` dans un rendu, jamais de
  `selectedDate` initialisé dans `useState`. Toute date passe par `useLabSchedule.setDate`, qui vide
  le créneau devenu impossible (samedi ferme à 13 h).
- **`localStorage` lu dans un effet uniquement** — sinon décalage d'hydratation, et le patient voit
  « panier vide » clignoter avant ses analyses.
- **Le conteneur du bouton Google est un callback ref en `useState`**, pas un `useRef`
  (`GoogleAuthButton.tsx`). Le portail renvoie un loader au premier rendu : avec un objet ref
  l'effet tourne une fois contre `null` et le bouton n'apparaît jamais — **en production
  seulement**, StrictMode masquant le bug en développement.
- **`renderGoogleButton` peut renvoyer `false`** (origine non autorisée). Garder le bouton de
  secours affiché tant qu'il n'a pas renvoyé `true`.
- **`'test-rdv'` est dans `HIDDEN_ROUTES`** de `GoogleSignInPrompt.tsx` : sans cela la carte Google
  flottante s'ouvre par-dessus le bouton du portail, et un refus met **toute** l'offre en sommeil
  30 jours sur cet appareil.
- **Le namespace `journey` est déclaré aux 3 endroits** de `src/app/[lang]/layout.tsx`.
  `fallbackLng` vaut `'ar'` : une clé FR manquante affiche de l'arabe, pas la clé.
- **`requestResultsAccess({ source: 'results_page' })`** — volontaire. La liste blanche serveur
  (`REQUEST_SOURCES`) vaut `signup | results_page | admin` ; une valeur inconnue n'échoue pas, elle
  affiche « Non précisée » dans l'e-mail au personnel. Une entrée dédiée demanderait un déploiement
  de fonctions : à faire au prochain déploiement `functions` pour une autre raison.
- **L'appel `myAccessRequest` est DIFFÉRÉ** (déclenché quand la section devient visible). Sinon
  chaque ouverture du parcours coûterait un aller-retour de fonction.
- **Reprendre le motif de `versionRef`** dans `usePrescriptionUpload` tel quel : il invalide le lot
  en vol quand la liste de fichiers change, et un lot périmé résout `[]` — que `resolveUrls` sait
  rattraper. Ne pas « simplifier ».
- **Ne jamais ajouter une 3ᵉ implémentation du calcul de prix.** `computeCartView` uniquement.
  (`generateDevisPdf.ts` en a déjà une seconde, que `CLAUDE.md` demande de garder synchronisée.)
- **`SubmitProgressModal` est en `absolute inset-0`** : son conteneur parent doit être `relative`
  (c'est le cas dans `JourneyBody`). Ses 4 libellés d'étape sont **codés en dur en français** —
  défaut préexistant, partagé avec `/rendez-vous` et `/glabo`.
- **`scroll-margin-top` = `var(--header-total-height)`**, jamais `64px` : dans la PWA installée
  l'en-tête grandit de la barre d'état et le titre révélé passerait dessous.

## ⛔ Le lien « Parcours (test) » n'est PAS dans la barre de navigation desktop

Il y a été mis, puis retiré le 08/09/2026 après mesure. La barre desktop est **pleine** :

| liens | largeur de la nav | place disponible |
|---|---|---|
| 7 (patient) | 860 px | 866 px → 6 px de marge |
| 8 (équipe, avec Admin) | 959 px | **−93 px** |
| 9 (+ Parcours) | 1114 px | **−248 px** |

Le débordement poussait la **page entière** : 24 px à 1680 px (la barre de défilement horizontale
signalée par le propriétaire), 144 px à 1440, 224 px à 1280. `hidden xl:flex` n'y changeait rien —
le problème n'est pas la petite largeur, c'est la grande. `docs/pages/resultats.md` l'annonçait :
« Adding an 8th permanent link would put this back on the edge — re-measure before doing so. »

### Le fait qui explique tout : la rangée est PLAFONNÉE à 1232 px

`lg:max-w-7xl` + `lg:px-6` : la rangée de l'en-tête fait **1232 px sur un écran de 1280 px comme sur
un écran de 1920 px**. Le budget de la nav est donc figé — 866 px, une fois retirés le logo (40),
le bloc d'actions (302) et les gouttières (24). Agrandir l'écran n'aide en RIEN. C'est le piège qui
fait passer ce bug à côté de toutes les mesures « ça marche sur mon 1920 ».

**Trois corrections, complémentaires :**

1. **Le lien « Parcours (test) » sort de la nav desktop.** Il vit dans le **tiroir mobile** (liste
   verticale, aucune contrainte de largeur) et sur **`/admin`** — le tiroir étant `lg:hidden`, les
   postes fixes ont besoin de cette seconde porte.

2. **De la place est libérée pour que les 8 liens de l'équipe TIENNENT** (il en manquait exactement
   71 px à partir de 1280 px, et 11 px à 1024 px) :
   - `Header.tsx` : `space-x-2 xl:space-x-6` → **`space-x-1.5 xl:space-x-4`** (≈ 56 px) ;
   - `index.css` : le resserrement du padding des liens, qui ne couvrait que la bande 1024-1279 px
     (« au-dessus, la rangée est assez large » — elle ne l'est pas, cf. le plafond à 1232 px),
     s'applique désormais à **tout le desktop** (≈ 96 px), avec un cran supplémentaire sur la seule
     bande 1024-1179 px, la plus serrée de toutes.

   Résultat mesuré : **« Admin » est entièrement visible de 1024 à 1920 px**, contenu = largeur
   visible, zéro lien tronqué.

3. **`min-w-0 overflow-x-auto` sur `.header-main nav`**, en **garde-fou** et non comme correctif.
   Sans `min-w-0`, un élément flex refuse de rétrécir sous la largeur de son contenu : il pousse son
   parent au lieu de se contenir. Avec, si un 9e lien apparaissait un jour, c'est la nav qui
   défilerait, jamais la page.

> **⚠ Le piège dans lequel je suis tombé, à ne pas répéter.** Le point 3 a d'abord été appliqué
> SEUL. Il supprime bien la barre de défilement horizontale… en rétrécissant la nav, donc en
> poussant **le dernier lien — « Admin » — hors du cadre visible**. Le propriétaire s'en est aperçu
> immédiatement : « pourquoi je ne vois plus le menu admin ? ». Contenir un débordement n'est pas le
> corriger : il faut TOUJOURS vérifier qu'aucun lien n'est devenu invisible
> (`rect.right <= nav.right`), pas seulement que `scrollWidth === clientWidth`.

**Ces correctifs réparent aussi un bug arabe invisible :** en RTL le débordement ne créait AUCUNE
barre de défilement (le `dir="rtl"` est sur le conteneur `[lang]`, pas sur `<html>`), mais les
boutons d'en-tête étaient physiquement coupés hors de l'écran — mesuré à `left: −81px` à 1280 px.
Ils sont maintenant à `left: 24px`.

## Reste à faire avant la mise en production

1. Faire valider le parcours par le propriétaire et Dr Aziz sur `/test-rdv`.
2. Basculer `/rendez-vous` → `<PatientJourneyPage variant="lab" />` et `/glabo` →
   `variant="home"`, supprimer les deux anciens fichiers, mettre à jour `rendez-vous.md` et
   `glabo.md`, retirer le lien « Parcours (test) » du `Header`, retirer le `noindex` et l'exclusion
   du sitemap, et remplacer `JOURNEY_SEGMENT`.
3. Migrer `/login` et `GoogleSignInPrompt` vers `GoogleAuthButton`, et `/rendez-vous`+`/glabo` vers
   `useLabSchedule` (facultatif, mais c'est la raison d'être de ces extractions).
4. Le champ `source: 'journey'` permet de **mesurer** l'effet de la connexion obligatoire sur le
   volume de demandes : à comparer avec les demandes sans `source` sur la même période.
