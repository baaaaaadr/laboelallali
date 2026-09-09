/**
 * Point d'entrée du banc d'essai : monte l'une des deux mises en page du
 * parcours dans une page vide, avec les seules frontières externes doublées
 * (voir `scripts/testing/README.md`).
 *
 * Le pilote (`scripts/test-journey-ui.js`) pose `window.__lang`,
 * `window.__layout` et le panier dans `localStorage` AVANT d'appeler
 * `window.__mount()`. Rien n'est monté automatiquement : la seed doit précéder
 * le premier rendu, sinon `useJourneyCart` lit un `localStorage` encore vide et
 * la page démarre sans panier.
 */
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';

import PatientJourneyPage from '../../src/components/features/journey/PatientJourneyPage';
import GroupedJourneyPage from '../../src/components/features/journey/GroupedJourneyPage';
import { buildWhatsAppMessage } from '../../src/lib/journey/buildWhatsAppMessage';

declare global {
  interface Window {
    __lang?: string;
    __layout?: 'v1' | 'v2';
    __mount?: () => void;
    __unmount?: () => void;
    __sent?: { url: string; body: unknown }[];
    __firestore?: { collection: string; doc: Record<string, unknown> }[];
    __toasts?: { kind: string; text: string }[];
    __nav?: string[];
    __whatsappUrl?: string | null;
    __buildWhatsAppMessage?: typeof buildWhatsAppMessage;
  }
}

window.__sent = window.__sent || [];
window.__whatsappUrl = null;
// Exposé pour que le pilote puisse relire le message WhatsApp à partir de
// l'instantané réellement envoyé, sans le reconstruire à la main.
window.__buildWhatsAppMessage = buildWhatsAppMessage;

// -- Interception du seul appel réseau de la page -----------------------------
// C'est la charge utile capturée ici qui est inspectée : exactement celle qui
// partirait vers /api/send-appointment en production.
const realFetch = window.fetch.bind(window);
window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : String((input as Request).url ?? input);
  if (url.includes('/api/send-appointment')) {
    window.__sent!.push({ url, body: JSON.parse(String(init?.body ?? '{}')) });
    return new Response(JSON.stringify({ success: true, simulated: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return realFetch(input as RequestInfo, init);
}) as typeof window.fetch;

// -- La navigation WhatsApp ne doit pas quitter la page du banc ---------------
// `handleWhatsApp` ouvre une fenêtre de façon SYNCHRONE sur ordinateur (sinon
// le bloqueur de fenêtres surgissantes mange la redirection). On la remplace
// par un objet qui enregistre l'adresse : c'est elle qu'on inspecte.
window.open = ((): Window | null => {
  // `handleWhatsApp` fait exactement une chose avec cette fenêtre :
  // `popup.location.href = lien`. Un objet portant un `href` en écriture suffit
  // donc, et rien ne quitte la page du banc.
  const fakeLocation = {
    set href(v: string) {
      window.__whatsappUrl = v;
    },
    get href() {
      return window.__whatsappUrl || '';
    },
  };
  return { location: fakeLocation, close: () => undefined } as unknown as Window;
}) as typeof window.open;

let root: Root | null = null;

window.__mount = () => {
  const el = document.getElementById('app')!;
  root = createRoot(el);
  const lang = window.__lang === 'ar' ? 'ar' : 'fr';
  const Page = window.__layout === 'v1' ? PatientJourneyPage : GroupedJourneyPage;
  root.render(<Page lang={lang} variant="neutral" />);
};

window.__unmount = () => {
  root?.unmount();
  root = null;
};
