# Banc d'essai du parcours patient

Le dépôt n'a **aucun lanceur de tests** (voir `CLAUDE.md` § Testing) : ces
fichiers forment un banc maison, à lancer à la main.

| Commande | Ce qu'elle vérifie |
|---|---|
| `node scripts/test-journey.js` | Ce que le **laboratoire reçoit** : e-mail (objet + HTML), document Firestore, message WhatsApp, carte des 4 groupes. 18 cas, aucun réseau. |
| `node scripts/test-journey-ui.js` | Ce que le **patient voit et fait** : les deux mises en page pilotées dans un vrai navigateur, jusqu'à l'envoi. |

## Pourquoi des doublures, et pas la vraie page

Le parcours vit derrière `JourneyAuthGate` : sans compte Google connecté ET
sans profil Firestore portant un téléphone, la page n'affiche que son portail
de connexion. Un pilote qui ouvrirait `http://localhost:3000/fr/test-rdv2`
n'atteindrait donc jamais le formulaire — et ajouter une porte dérobée « mode
test » dans le code de production serait bien pire que de ne pas tester.

Les doublures de `scripts/testing/stub-*.tsx` remplacent exactement six
frontières, et rien d'autre :

| Doublure | Remplace | Pourquoi |
|---|---|---|
| `stub-auth` | `@/contexts/AuthContext` | fournit un patient connecté, profil complet |
| `stub-navigation` | `next/navigation` | pas de routeur Next hors application |
| `stub-firebase` | `@/config/firebase`, `firebase/firestore`, `firebase/storage`, `firebase/functions` | **aucune écriture réelle** ; les documents sont capturés dans `window.__firestore` |
| `stub-i18n` | `react-i18next` | lit les **vrais** fichiers `public/locales/*/*.json` — un libellé manquant se voit |
| `stub-toast` | `react-hot-toast` | capture les messages dans `window.__toasts` |
| `stub-uploader` | `@/components/ui/MultiFileUploader` | `react-pdf` ne se résout pas hors Next |

Tout le reste — `useJourneyForm`, `useJourneySections`, `useJourneyGroups`,
`useJourneySubmission`, `computeCartView`, `buildEmailPayload`,
`buildWhatsAppMessage` — est le **code de production, sans modification**.
`fetch('/api/send-appointment')` est intercepté et sa charge utile capturée :
c'est elle qu'on inspecte, exactement celle qui partirait en production.

⚠ Aucune feuille de style n'est chargée : ce banc vérifie la **structure et les
textes**, jamais l'apparence. Pour l'apparence, ouvrir les pages à la main.

## Banc « résultats » (`npm run test:results:ui`)

`node scripts/test-results-ui.js` monte la vraie page `/resultats` sous le vrai
`ResultsProvider`, et vérifie ce qu'elle **demande au serveur** : nombre,
ordre et arguments de chaque appel à `fetchResults`. C'est la garde de
non-régression du parcours patient, et c'est lui qui a mis en évidence la
boucle d'appels après une erreur (80 appels en 3 s, corrigée le 23/09/2026).

Il a ses **propres** doublures ; celles du parcours ci-dessus restent
inchangées, pour ne rien casser chez leurs utilisateurs :

| Doublure | Remplace | Pourquoi une nouvelle |
|---|---|---|
| `stub-auth-store` | `@/contexts/AuthContext` (et l'import relatif `./AuthContext` du contexte des résultats, via un greffon esbuild) | profil **complet** et **modifiable en cours d'essai** (`window.__setAuth`), références **stables** entre deux rendus |
| `stub-firebase-results` | `@/config/firebase`, `firebase/functions`, `firebase/firestore`, `firebase/analytics` | **enregistre chaque appel** dans `window.__calls` et délègue à `window.__callables[nom]` ; `getDoc`/`getDocs` lisent `window.__docs`/`__collections` |
| `stub-react-pdf` | `react-pdf` | pdf.js et son worker viennent d'un CDN |
| `stub-i18n-stable` | `react-i18next` | enveloppe `stub-i18n` avec une fonction `t` **stable** |
| `stub-navigation-stable` | `next/navigation` | routeur **stable** ; `replace` enregistré avec le préfixe `replace:` |
| `stub-dynamic` | `next/dynamic` | le composant chargé à la demande n'est jamais rendu (la fenêtre de recherche de l'en-tête) |

**Pourquoi des références stables :** ce banc COMPTE les appels. Une doublure
qui recréerait `user`, `t` ou le routeur à chaque rendu relancerait les effets
qui en dépendent et inventerait des boucles qui n'existent pas en production —
ou, pire, en masquerait une vraie.

Le serveur de résultats simulé est décrit dans `results-harness-entry.tsx`
(`window.__server`) : identités, erreurs forcées, latence, plafond de 50. Il
applique les mêmes règles que le vrai serveur (identifiant inconnu refusé,
dossier hors périmètre en 404). Données **fictives** uniquement.

Pages montables (`window.__mount(page)`, voir `results-harness-entry.tsx`) :
`resultats`, `mes-patients`, `profile`, `admin` (monter en stagiaire : onglet Patients, sans tableau de bord), `practitioner-card` (la carte admin
seule), `header` (l'en-tête : sans feuille de style, la barre desktop ET le
tiroir mobile sont tous deux dans le DOM) et `home-panel` (le panneau personnel
du héros d'accueil). `freshPage` (`results-bench.js`) accepte aussi `pathname`
(ce que voit `usePathname()`), `authLoading` (monter pendant le chargement de
l'authentification, le compte étant posé plus tard par `window.__setAuth`) et
`storage` (clés `localStorage` posées avant le montage — l'indice du panneau
d'accueil, par exemple) et `responses` (réponses fixes de fonctions Firebase
posées avant le montage, `{ nomDuCallable: valeur }` ; l'appel reste
enregistré). `rawKeys` ignore les adresses e-mail (« prenom.nom@… » ressemble à
une clé).

## Banc « médecin » (`npm run test:practitioner:ui`)

`node scripts/test-practitioner-ui.js` — même mécanique et mêmes doublures que le
banc « résultats ». 237 vérifications :
- l'espace « Mes patients » (M1–M9) : une liste = un appel sans PDF, un patient
  ouvert = un PDF, le sien ; recherche, états bloqués, collision, changement de
  compte, arabe ;
- le verrou de la carte admin « Accès médecin » (M10) ;
- les points d'entrée : M11 le menu « Résultats » (barre et tiroir), M12
  accueil, M13 profil et sélecteur « Moi et ma famille | Mes patients » ;
- l'onglet Patients de l'admin (M14) : une seule fiche par personne ;
- la demande d'accès du médecin (M15 : formulaire avec l'engagement de
  confidentialité, verrou, envoi, en attente, refusée, arabe ; M5 : « Vérifier à
  nouveau » après activation) et, côté admin, l'onglet « Médecins » (M16 : lien
  d'invitation, badge, file des demandes, « Ouvrir sa fiche », refus en deux
  clics) ;
- l'engagement demandé une fois au médecin activé directement (M17 : aucun appel
  au serveur de résultats avant l'acceptation, une acceptation, puis un seul
  appel ; échec ; arabe) ;
- les médecins ayant accès (M18 : usage, engagement, étiquettes, code partagé,
  lien WhatsApp, retrait en deux clics, « Ouvrir sa fiche », stagiaire en lecture
  seule, liste vide) et le tableau de bord « Les médecins » (M19).

L'onglet admin se monte avec des réponses fixes (`freshPage(…, { responses })`) :
`adminListPractitioners`, `adminDashboardStats` (jeu d'essai complet dans M19),
`acceptPractitionerEngagement`…

Les tests purs sont à part : `npm run test:practitioner`.

Pièges propres à ces bancs :

- `buildSync` d'esbuild refuse les greffons : le pilote utilise `build()` (même
  binaire, pas de `.cmd`, donc pas le piège `EINVAL` de Windows).
- `TabsNavigation` utilise `<style jsx>`, que Next compile et qu'esbuild laisse
  tel quel : React signale un attribut `jsx` non booléen. C'est un artefact du
  banc, écarté explicitement dans `assertNoErrors`.
- esbuild compile aussi les cibles des `import()` dynamiques, même jamais
  exécutées : la fenêtre de recherche de l'en-tête tire `medecinsService`, d'où
  `query`/`where`/`orderBy`/`limit` (sans effet) dans `stub-firebase-results`.
- Un emplacement REPLIÉ (hauteur nulle) est « invisible » pour Playwright :
  l'attendre avec `{ state: 'attached' }`, pas avec la visibilité par défaut.
