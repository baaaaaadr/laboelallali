/**
 * The language of a visitor arriving from the printed QR code
 * (`laboelallali.com/qr`, Dr Aziz, 12/10/2026) — used by `src/middleware.ts`.
 *
 * Elsewhere the site, without a cookie, defaults to Arabic. A QR code is the
 * one entry where we know nothing else about the person, so the phone's own
 * language decides: the first French or Arabic tag of `Accept-Language` wins
 * (« fr-MA,fr;q=0.9,ar;q=0.8 » → fr), anything else falls back to Arabic.
 * Pure — tested by `scripts/test-qr-ui.js`.
 */
export function qrLanguage(acceptLanguage: string | null | undefined, fallback = 'ar'): 'fr' | 'ar' {
  for (const part of String(acceptLanguage || '').split(',')) {
    const tag = part.split(';')[0].trim().toLowerCase();
    if (tag.startsWith('fr')) return 'fr';
    if (tag.startsWith('ar')) return 'ar';
  }
  return fallback === 'fr' ? 'fr' : 'ar';
}

/** The permanent address printed on every support. Never change it. */
export const QR_PATH = '/qr';

/** The buttons of the « Scannez-moi » page — also the whitelist of the click counter. */
export const QR_KEYS = [
  'results',
  'doctor',
  'whatsapp',
  'call',
  'directions',
  'hours',
  'rdv',
  'glabo',
  'prescription',
  'prices',
  'prep',
  'card',
  'review',
  'install',
  'doctors',
  'jobs',
] as const;
export type QrKey = (typeof QR_KEYS)[number];
