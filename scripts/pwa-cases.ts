/**
 * Les agents utilisateurs de référence pour l'installation de la PWA.
 *
 * Ce sont de VRAIES chaînes, relevées sur des appareils réels — pas des
 * approximations. C'est le seul moyen d'éprouver `src/lib/pwa/platform.ts`,
 * dont les deux défauts historiques ne se voyaient que sur des agents
 * authentiques :
 *
 *  - l'iPad moderne, qui s'annonce `Macintosh` depuis iPadOS 13 et n'était
 *    donc jamais reconnu comme iOS ;
 *  - le navigateur intégré de Facebook sur iPhone, dont l'agent ne contient
 *    pas le mot « Safari » — ce que l'ancien test interprétait comme
 *    « application déjà installée », faisant disparaître tout point d'entrée
 *    d'installation de l'écran du patient.
 *
 * `maxTouchPoints` fait partie du cas : c'est le seul signal qui distingue un
 * iPad d'un Mac (un Mac n'a pas d'écran tactile).
 */
import type { PwaPlatform } from '../src/lib/pwa/platform';

export interface PlatformCase {
  name: string;
  /** Pourquoi ce cas mérite d'exister. Repris tel quel dans le rapport. */
  why: string;
  userAgent: string;
  maxTouchPoints: number;
  expectPlatform: PwaPlatform;
  expectInApp: boolean;
}

export const PLATFORM_CASES: PlatformCase[] = [
  {
    name: 'iPhone · Safari',
    why: "Le cas iOS normal. Aucun navigateur iOS n'émet `beforeinstallprompt` : il doit recevoir les consignes du menu Partager, jamais un bouton mort.",
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
    maxTouchPoints: 5,
    expectPlatform: 'ios',
    expectInApp: false,
  },
  {
    name: 'iPhone · Chrome (CriOS)',
    why: "Chrome sur iPhone reste du WebKit : mêmes contraintes que Safari. L'ancien test cherchait la sous-chaîne « chrome », absente de « CriOS ».",
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1',
    maxTouchPoints: 5,
    expectPlatform: 'ios',
    expectInApp: false,
  },
  {
    name: 'iPad · iPadOS 17',
    why: "DÉFAUT HISTORIQUE : depuis iPadOS 13 un iPad s'annonce « Macintosh ». `/iPad|iPhone|iPod/` ne matchait plus rien et l'iPad recevait les consignes d'un ordinateur. Seul `maxTouchPoints > 1` le trahit.",
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
    maxTouchPoints: 5,
    expectPlatform: 'ios',
    expectInApp: false,
  },
  {
    name: 'Mac · Safari (non tactile)',
    why: 'Le contre-exemple du cas précédent : même agent, mais aucun point de contact. Ce doit rester un ordinateur.',
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
    maxTouchPoints: 0,
    expectPlatform: 'desktop',
    expectInApp: false,
  },
  {
    name: 'Android · Chrome',
    why: "Le cas où l'installation automatique existe vraiment. C'est le téléphone du patient qui a signalé le défaut.",
    userAgent:
      'Mozilla/5.0 (Linux; Android 13; SM-A536B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
    maxTouchPoints: 5,
    expectPlatform: 'android',
    expectInApp: false,
  },
  {
    name: 'Android · Samsung Internet',
    why: 'Très répandu au Maroc. Sait installer, mais le libellé de son menu diffère : les consignes doivent rester génériques.',
    userAgent:
      'Mozilla/5.0 (Linux; Android 13; SM-A536B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36',
    maxTouchPoints: 5,
    expectPlatform: 'android',
    expectInApp: false,
  },
  {
    name: 'iPhone · navigateur intégré Facebook',
    why: "DÉFAUT HISTORIQUE : agent sans le mot « Safari ». L'ancien test `(isIOS && !isSafari)` le déclarait « application installée » et faisait disparaître toute entrée d'installation. Beaucoup de patients arrivent par un lien Facebook.",
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBDV/iPhone14,3;FBMD/iPhone;FBSN/iOS;FBSV/17.5;FBSS/3;FBID/phone;FBLC/fr_FR;FBOP/5]',
    maxTouchPoints: 5,
    expectPlatform: 'ios',
    expectInApp: true,
  },
  {
    name: 'Android · navigateur intégré Instagram',
    why: "Aucun navigateur intégré ne sait installer une application web : la consigne doit être « ouvrez d'abord dans votre navigateur », pas « menu ⋮ ».",
    userAgent:
      'Mozilla/5.0 (Linux; Android 13; SM-A536B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36 Instagram 320.0.0.42.101 Android',
    maxTouchPoints: 5,
    expectPlatform: 'android',
    expectInApp: true,
  },
  {
    name: 'Ordinateur · Windows Chrome',
    why: "Sait installer, mais l'entrée est dans la barre d'adresse et non dans un menu de téléphone.",
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    maxTouchPoints: 0,
    expectPlatform: 'desktop',
    expectInApp: false,
  },
  {
    name: 'Agent vide',
    why: "Un robot d'indexation ou une capture automatisée ne doit provoquer aucune erreur.",
    userAgent: '',
    maxTouchPoints: 0,
    expectPlatform: 'other',
    expectInApp: false,
  },
];
