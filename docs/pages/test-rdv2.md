# Page: /test-rdv2 — Parcours patient, regroupé en 4 blocs

> **Page de VALIDATION, variante B.** Mêmes questions que `/test-rdv`, mais réparties en
> **quatre** blocs dépliants au lieu de huit. Les deux coexistent le temps que le laboratoire
> tranche ; **une seule survivra** et deviendra `/rendez-vous`.
> Non indexable (`noindex` servi dans le HTML + exclue de `next-sitemap.config.js` + `Disallow`
> dans `robots.txt`) et atteignable **uniquement par l'équipe** : deux cartes côte à côte en haut
> de `/admin`, et deux entrées dans le tiroir mobile du `Header` (`isStaff`).
> Renommer la route = modifier **une seule** constante : `JOURNEY_V2_SEGMENT` dans
> `src/lib/journey/route.ts`.

## Purpose

Demande du **Dr Aziz, 09/09/2026**, relayée par le propriétaire :

> « aziz trouve qu'on a séparé en trop d'étapes, donc il faudra regrouper en 3 ou 4 groupements
> logiques pour ne pas intimider les patients et que ça soit clair ce qu'ils peuvent zapper et ce
> qui est obligatoire. »

Avec, comme contrainte de conception, **les deux cas les plus fréquents** au laboratoire :

- **A.** le patient a une ordonnance et veut le **prix**, les **conditions préanalytiques** et le
  **délai** ;
- **B.** il n'a pas d'ordonnance et veut **choisir ses analyses lui-même**, ou être aidé.

Ni l'un ni l'autre ne veut nécessairement un rendez-vous tout de suite. La mise en page est donc
construite pour qu'ils puissent **s'arrêter après le bloc 2**.

## Directory & File

- **Route :** `src/app/[lang]/test-rdv2/page.tsx` (~45 l.) + `layout.tsx` (le `noindex`, composant
  **serveur** — un composant client ne peut pas exporter `metadata`, et une balise posée en
  `useEffect` n'est pas dans le HTML servi ; vérifié en production le 09/09/2026 sur `/test-rdv`).
- **Composant :** `src/components/features/journey/GroupedJourneyPage.tsx` (~420 l.).
- **Carte des groupes (pure) :** `src/lib/journey/groups.ts`.
- **En-têtes des blocs :** `src/components/features/journey/hooks/useJourneyGroups.ts`.

## Les quatre blocs

| # | Bloc | Contient | Obligation |
|---|---|---|---|
| 1 | **Vos analyses** | `prescription` (question + modes + téléversement + texte libre), `cart` | Obligatoire |
| — | *Votre réponse* | `ImmediateAnswerCard` + le choix « réponse d'abord / réserver » | **hors accordéon**, jamais repliable |
| 2 | **Pour vous répondre** | `identity`, `channel` | Obligatoire |
| 3 | **Votre rendez-vous** | `place` (+ adresse), `when` | Suit `wantsAppointment` |
| 4 | **Pour aller plus loin** | `want`, `access` | Facultatif |
| — | *Envoyer ma demande* | `SubmitSection` | **hors accordéon** |

### Pourquoi cet ordre

`contact` passe **avant** `rendezvous`, délibérément. Les cas A et B ont fini leur demande à la fin
du bloc 2 ; tout ce qui suit doit pouvoir être ignoré sans remords. Mettre le rendez-vous au milieu
obligerait ces deux patients — les plus nombreux — à traverser un bloc dont ils n'ont pas besoin.

### Pourquoi des sous-blocs et pas des sous-accordéons

À l'intérieur d'un groupe, les anciennes sections deviennent de simples sous-titres séparés par un
filet (`SubSection`, local à `GroupedJourneyPage.tsx`). Emboîter un accordéon dans un accordéon
rendrait les dix étapes à nouveau visibles une par une : exactement le reproche auquel cette page
répond.

### Ce qui rend l'obligation lisible

Trois signaux superposés, et aucun n'est redondant :

1. **Une phrase en haut de page** (`group.legend`) : « Seuls les blocs marqués *Obligatoire* sont
   nécessaires pour envoyer votre demande. Vous pouvez ignorer les autres. » Elle bascule sur
   `group.legend_ready` (fond vert) dès que `countRemainingRequired()` tombe à 0.
2. **Une puce sur chaque en-tête** — « Obligatoire » (bordeaux) / « Facultatif » (gris), visible
   replié comme déplié.
3. **Un marqueur d'état** — coche verte / pastille ambre, la règle existante de `Disclosure`.

## Ce que cette page NE change pas

C'est le point le plus important pour l'arbitrage : **seule la disposition diffère**. Tout le reste
est partagé, par construction, avec `PatientJourneyPage` :

| Partagé | Fichier |
|---|---|
| état du formulaire, révélation en deux vagues, `wantsAppointment` | `hooks/useJourneyForm.ts` |
| résumés et marqueurs par section | `hooks/useJourneySections.ts` |
| panier rapporté du catalogue | `hooks/useJourneyCart.ts` |
| brouillon + aller-retour catalogue | `hooks/useJourneyPersistence.ts` |
| validation, Firestore, e-mail, WhatsApp | `hooks/useJourneySubmission.tsx` |
| téléversement d'ordonnance | `sections/PrescriptionUploadPanel.tsx` |

Le banc d'essai le **vérifie** : `scripts/test-journey-ui.js` envoie la même demande depuis les deux
pages et compare les deux charges utiles octet par octet (hors `expiresAt`, un horodatage).

> ⚠ Ne jamais réintroduire de logique d'envoi locale dans l'une des deux pages. La perdante sera
> supprimée, et avec elle tout correctif qui n'aurait vécu que là.

## La seule divergence de comportement, et sa raison

`/test-rdv` ouvre la première section « seulement si le panier est vide ».
`/test-rdv2` ouvre le bloc 1 **tant que l'intention n'est pas exprimée** (`!form.intentDone`).

Le défaut, relevé au banc d'essai : un patient qui arrive **du catalogue** a un panier, donc la
règle d'origine repliait tout — mais les blocs 2, 3 et 4 **n'existent pas encore**, puisque la
vague 2 attend la réponse à « avez-vous une ordonnance ? ». Il voyait donc **une seule ligne
fermée**, contenant la seule question qui lui restait. Sur `/test-rdv` le même patient voit deux
lignes fermées (ordonnance + panier) : moins pire, mais la question obligatoire y est cachée
pareillement. Le pilote assert les deux comportements, celui de v1 inclus.

Semis **unique**, au montage. Aucun repliage ni dépliage automatique ensuite — piège documenté sur
`/test-rdv` : une version repliait tout dès que l'intention devenait vraie, et l'étape 1 se
refermait au nez du patient avant qu'il ait choisi son mode de transmission.

## Nouveauté partagée : le bloc fautif s'ouvre tout seul

`validate()` ne renvoie plus seulement un message mais `{ message, section }`
(`JourneyValidationProblem`). Sur `/test-rdv2`, `groupOfSection()` traduit la section en bloc, le
bloc s'ouvre et la page y défile ; sur `/test-rdv`, c'est la section elle-même. Sans cela,
« Merci d'indiquer votre nom et votre téléphone » s'affichait au-dessus d'un accordéon
entièrement replié et le patient devait deviner lequel des quatre ouvrir.

⚠ Le défilement passe par un **état** (`focusGroup`) et non par un appel direct dans le
gestionnaire : le bloc doit d'abord avoir été ouvert par React, sinon on défile vers un en-tête
replié et le champ fautif reste invisible.

## State Management

`GroupedJourneyBody` ne détient que quatre choses en propre :

| État | Rôle |
|---|---|
| `restoredUrls` | URL d'ordonnances restaurées d'un brouillon (les `File` ne survivent pas au `sessionStorage`) |
| `openGroup` | le bloc ouvert — un seul à la fois |
| `focusGroup` | le bloc vers lequel défiler après un refus de validation |
| `seeded` (`useRef`) | garantit le semis unique |

Tout le reste vient des hooks partagés.

### `useJourneyGroups`

Agrège la sortie de `useJourneySections` en quatre en-têtes. Deux règles à connaître :

- le **résumé** d'un bloc n'affiche le panier que s'il est non vide — sinon « Aucune analyse
  sélectionnée pour l'instant » viendrait contredire une ordonnance déjà photographiée, juste à
  côté ;
- le bloc 3, quand `wantsAppointment` est faux, affiche `group.rendezvous_skipped`
  (« Aucun créneau demandé pour l'instant ») **plutôt qu'un tiret** : un bloc marqué « Facultatif »
  avec un résumé vide laisse croire à un oubli.

⚠ Un résumé n'est visible que **replié** — contrat de `Disclosure` : déplié, le contenu se suffit.

## Vérification

Deux bancs, à lancer à la main (le dépôt n'a aucun lanceur de tests) :

```
node scripts/test-journey.js       # 565 vérifications — ce que le LABORATOIRE reçoit
node scripts/test-journey-ui.js    # 129 vérifications — ce que le PATIENT voit et fait
```

Voir `scripts/testing/README.md` pour la liste exacte des six frontières doublées et la raison de
chacune. Le composant monté par le pilote est le **code de production, sans modification** ; en
particulier `fetch('/api/send-appointment')` est intercepté et sa charge utile inspectée telle
quelle.

⚠ Le pilote ne charge **aucune feuille de style** : il vérifie la structure et les textes, jamais
l'apparence. Pour l'apparence, ouvrir les deux pages à la main, en fr et en ar, clair et sombre.

⚠ Le titre de la section d'envoi et le bouton portent le **même libellé**
(`submit.title` = `submit.send_request` = « Envoyer ma demande »). Un `getByText` attrape le `<h2>`
et le clic ne fait rien : viser `#journey-submit button` (`clickSubmit()` dans le pilote).

## Notes for AI

- **Ajouter une section au parcours** = l'ajouter à `JOURNEY_GROUP_SECTIONS` dans
  `src/lib/journey/groups.ts`, sinon elle est affichée **nulle part** sur `/test-rdv2`.
  `scripts/test-journey.js` refuse toute section orpheline.
- **`answer` n'appartient à aucun groupe**, volontairement : c'est ce que le patient est venu
  chercher, ça ne doit pas coûter un clic. `groupOfSection('answer')` renvoie `null`.
- **Nouvelles clés i18n** : bloc `group.*` dans `public/locales/{fr,ar}/journey.json`. Le banc
  affiche la clé brute si elle manque d'un côté — c'est ainsi que l'absence de
  `section.required_label` / `section.optional_label` **côté arabe** a été trouvée (lot précédent).
- **Le retour du catalogue** : `openCatalog()` mémorise `test-rdv2` dans `sessionStorage`
  (`rememberJourneyOrigin`), et `journeyPath()` s'en sert pour que le bouton « Prendre RDV » de
  `CartActions.tsx` — rendu très loin de là — ramène sur la bonne mise en page. Portée : l'onglet.
  Un patient qui n'ouvre jamais `/test-rdv2` n'est jamais concerné.
- **`GoogleSignInPrompt`** : `test-rdv2` est dans `HIDDEN_ROUTES`. Ne jamais interrompre une
  conversion en cours.

## Reste à faire

1. Faire trancher le Dr Aziz entre `/test-rdv` et `/test-rdv2`.
2. **Point à lui soumettre** : même avec un panier rapporté du catalogue, le patient doit encore
   répondre « avez-vous une ordonnance ? » avant que la suite apparaisse (`intentDone` dans
   `useJourneyForm.ts`). C'est une information dont le laboratoire a besoin, mais c'est un tap de
   plus pour le cas fréquent B. Le lever changerait **les deux** mises en page.
3. Une fois l'arbitrage rendu : basculer la gagnante sur `/rendez-vous` et `/glabo`, supprimer la
   perdante **et son dossier de route**, retirer les deux cartes de `/admin`, les deux entrées du
   `Header`, les `Disallow` et les exclusions de sitemap, et remplacer les constantes de
   `src/lib/journey/route.ts`.
