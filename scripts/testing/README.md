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
