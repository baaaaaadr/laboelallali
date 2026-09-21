# Installation de la PWA — architecture et pièges

> Référence transverse : l'installation n'appartient à aucune page. Elle est
> proposée depuis le **bas de page**, le **menu mobile** et la **tuile de
> l'accueil**, et pilotée par un magasin unique.
> Vérification : `npm run test:pwa`.

## Le défaut à l'origine de cette architecture (21/09/2026)

Un patient, sur Android : **« J'appuie ici, il ne se passe rien »** — le bouton
« Installer l'appli » du bas de page.

Le code suivait DEUX choses avec DEUX mécanismes différents :

| Question | Mécanisme d'alors |
|---|---|
| « est-ce que je m'affiche ? » | état React `showButton`, mis à `true` une fois, quasi jamais remis à `false` |
| « est-ce que je peux agir ? » | variable globale `window.deferredPrompt` |

La seconde était effacée dans **trois** cas, sans que la première en soit
informée. Le bouton restait alors affiché, d'apparence normale, et inerte :

1. **Après un refus.** `finally { window.deferredPrompt = null }` s'exécutait
   quel que soit le choix du patient. Chrome ne réémet jamais
   `beforeinstallprompt` sans rechargement : un patient qui annulait une fois
   ne pouvait plus jamais installer.
2. **Au montage de n'importe quel bouton.** `PWAInstallButton` faisait
   `window.deferredPrompt = null` dans son effet de montage. Trois instances
   coexistent : celle qui montait en dernier effaçait la capture des autres.
   Revenir sur l'accueil suffisait à casser le bouton du bas de page.
3. **Aucun redessin.** L'état « désactivé » lisait la globale PENDANT le rendu.
   Une globale ne déclenche pas de rendu React.

**Défaut jumeau, aussi grave :** sur **iPhone**, le bouton du bas de page et
l'icône du menu n'apparaissaient **jamais**. iOS n'émet pas
`beforeinstallprompt`, et la visibilité en dépendait entièrement.

## La règle, sans exception

> **Un élément visible et cliquable fait toujours quelque chose.**
> Soit il lance le dialogue natif, soit il ouvre la fiche « comment installer ».
> Il n'existe pas de troisième cas.

## Les fichiers

```
src/lib/pwa/platform.ts        détection PURE (agent + maxTouchPoints), testable sans navigateur
src/lib/pwa/installStore.ts    LE magasin : capture, état, prompt(), abonnés
src/hooks/useInstallState.ts   le pont React (useSyncExternalStore)
src/components/features/pwa/
  PWAInstallButton.tsx         les 5 présentations (footer, icon, tile, banner, button)
  InstallHelpDialog.tsx        la fiche « comment installer », par plateforme
  IOSInstallBanner.tsx         bandeau proactif iOS (ne décide plus s'il s'affiche)
  PWAComponents.tsx            monte le service worker + le bandeau
  ServiceWorkerRegistration.tsx
src/app/layout.tsx             ⚠ la CAPTURE PRÉCOCE, dans le <head>
public/offline.html            page de repli hors connexion
src/lib/sw.js                  service worker (pré-cache la page hors connexion)
```

### Les trois points de montage

| Où | Variante | Fichier |
|---|---|---|
| Bas de page | `footer` | `src/components/layout/Footer.tsx` |
| Menu mobile, rangée d'icônes | `icon` | `src/components/layout/Header.tsx` |
| 5ᵉ tuile du hero | `tile` | `src/components/features/home/HeroShortcuts.tsx` |

## Les trois états

| état | bas de page / menu | tuile de l'accueil |
|---|---|---|
| `installed` | rien | « Application installée », non cliquable |
| `installable` | vrai bouton d'installation | vrai bouton |
| `needs_help` | bouton → fiche d'aide | bouton → fiche d'aide |

`needs_help` est l'état par DÉFAUT — serveur compris. C'est ce qui règle le trou
iPhone : le bouton existe désormais partout, et explique.

## ⚠ Les cinq pièges

### 1. La capture doit être PRÉCOCE

`beforeinstallprompt` est émis par Chrome très tôt, souvent **avant**
l'hydratation. Un écouteur posé dans un `useEffect` le rate, et plus aucun
bouton ne peut fonctionner de toute la visite.

La capture vit donc dans une **balise `<script>` inline du `<head>` du layout
RACINE** (`src/app/layout.tsx`), et dépose l'événement dans
`window.__pwaInstallPrompt`.

> La version précédente était dans le layout `[lang]` avec
> `strategy="afterInteractive"` : next/script l'injecte **après** l'hydratation,
> donc trop tard, et le segment `[lang]` ne couvre pas les pages d'erreur.

### 2. Personne d'autre n'écrit `window.__pwaInstallPrompt`

Seuls le script précoce et `installStore.ts` y touchent. **Ne jamais la remettre
à `null` au montage d'un composant** — c'est la cause n° 2 du défaut.

### 3. `getSnapshot()` doit renvoyer une référence STABLE

`useSyncExternalStore` compare par identité. Renvoyer un objet neuf à chaque
appel provoque un redessin en boucle et l'erreur *« The result of getSnapshot
should be cached »*. D'où `publish()`, qui compare champ à champ.

### 4. Les écouteurs du magasin ne sont JAMAIS retirés

Volontaire. L'événement n'est émis qu'une fois, à un instant qu'on ne choisit
pas ; un écouteur retiré au démontage d'un composant est un écouteur qui le
manquera. Le magasin vit aussi longtemps que la page.

### 5. `prompt()` consomme l'événement, refus compris

Règle du navigateur. Le magasin repasse donc à `canInstall: false` dans **tous**
les cas et prévient ses abonnés : les boutons basculent aussitôt vers la fiche
d'aide. La fiche ajoute alors la phrase que personne ne devine seul — *« rechargez
la page pour revoir la proposition »*.

## Détection de plateforme — deux défauts corrigés

```ts
// ❌ L'ancien test, recopié dans cinq fichiers
const isIOS    = /iPad|iPhone|iPod/.test(navigator.userAgent);
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
if (isStandalone || (isIOS && !isSafari)) { /* « installée » */ }
```

- **`(isIOS && !isSafari)` ne voulait pas dire « installée »** mais « iOS sans le
  mot Safari » — c'est-à-dire les **navigateurs intégrés de Facebook et
  Instagram**. Un patient arrivant par un lien Facebook voyait l'application
  déclarée installée, et toute entrée d'installation disparaissait.
- **Un iPad n'était jamais reconnu** : depuis iPadOS 13 il s'annonce `Macintosh`.
  Seul `maxTouchPoints > 1` le distingue d'un Mac.

`isRunningStandalone()` consulte **les deux** signaux — `display-mode` (norme) et
`navigator.standalone` (le seul que connaisse iOS). L'ancien code n'en regardait
qu'un, et pas le même selon les fichiers.

## Page hors connexion

`public/offline.html` **n'existait pas**. `sw.js` y renvoyait depuis toujours ;
l'adresse répondait 307 puis 404 en production (vérifié le 21/09/2026). De plus
le service worker ne pré-cachait rien, donc la page n'aurait pas été servie même
si elle avait existé. Les deux sont corrigés (`CACHE_NAME` passé à `v5`).

⚠ La page est **entièrement autonome** (aucune police, feuille de style, script
ou image externes) et **bilingue en dur** : elle s'affiche hors de React et hors
d'i18next, sans moyen de connaître la langue choisie.

## ⚠ Le matcher du middleware avait un échappement mangé par JavaScript

`src/middleware.ts` excluait les fichiers par `'…[^/]+\.\w+…'` — une chaîne JS
ordinaire, où `\.` vaut `.` et `\w` vaut `w`. Next recevait `[^/]+.w+`, et
**l'exclusion des fichiers n'a jamais fonctionné**. Les fichiers racine courants
y échappaient seulement parce qu'ils EXISTENT et sont servis par le CDN de
Firebase avant d'atteindre Next. `/offline.html`, absent, prenait une
redirection de langue. Antislashs doublés + `offline.html` nommé explicitement.

## Code supprimé le 21/09/2026

| Fichier | Pourquoi |
|---|---|
| `src/hooks/usePWAInstall.ts` | mort — importé nulle part, alors que `CLAUDE.md` le citait comme la logique d'installation |
| `src/hooks/useInstallPrompt.ts` | mort — idem |
| `src/components/features/pwa/PWABanner.tsx` | mort — et utilisait des clés i18n inexistantes |
| 8 clés `pwa.*` | orphelines : elles servaient une modale supprimée depuis longtemps |

Il y avait **cinq** implémentations concurrentes de `beforeinstallprompt`. Il en
reste **une** (plus le script de capture précoce, qui écrit la même globale).

## Vérification

```
npm run test:pwa            # 85 vérifications
npm run test:pwa -- --head  # avec fenêtre visible
```

Deux parties : la détection de plateforme sur de **vraies** chaînes d'agent
(`scripts/pwa-cases.ts`), puis les **trois boutons montés ensemble** dans un vrai
Chromium — c'est leur interaction qui produisait le défaut, un bouton testé seul
ne l'aurait jamais montré. Couvre : iPhone Safari, iPhone Chrome, iPad, Android,
Samsung Internet, Facebook iOS, Instagram Android, ordinateur, capture précoce,
refus puis nouvel appui, acceptation, `appinstalled`, déjà installée par les deux
signaux, remontage croisé, arabe.

Chaque scénario applique la **règle d'or** : après chaque clic sur un élément
visible, quelque chose doit avoir changé.

> ### ⚠ Ce que ce banc NE prouve PAS
> L'événement `beforeinstallprompt` y est **synthétique**. Le dialogue natif
> d'Android n'est jamais réellement affiché, et l'ajout à l'écran d'accueil d'un
> iPhone n'est jamais réellement exécuté. Le banc prouve que **notre** code
> réagit correctement ; la dernière étape appartient au système d'exploitation
> et exige un appareil réel.

## Ce qui n'est PAS en cause (vérifié)

Manifeste, icônes et service worker sont **conformes** aux critères
d'installabilité de Chrome : `display: standalone`, icônes 192 **et** 512 en
`purpose: any` (dimensions PNG réelles vérifiées, fichiers présents), `start_url`
dans le `scope`, `<link rel="manifest">` dans le HTML servi, service worker avec
un handler `fetch` qui répond. Ne pas chercher le problème de ce côté.

⚠ **Ne jamais changer `id` (`/?utm_source=manifest_id`) ni rétrécir `scope`** :
Chrome traite un `id` modifié comme une **autre application**, et toutes les
installations existantes sont orphelines — les patients doivent réinstaller.
