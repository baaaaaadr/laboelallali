/**
 * The doctor invitation link (owner's decision, 24/09/2026).
 *
 * ONE link, `/{lang}/mes-patients`: before activation the page shows the
 * request form (« Demander mon accès médecin »); once the lab has attached his
 * code, the very same link opens his patients. So the WhatsApp message the lab
 * sends a doctor is also his bookmark. Not signed in → the page sends him to
 * `/login?redirect=…`, which brings him back here after sign-in or sign-up.
 *
 * Pure — tested by `scripts/test-practitioner.js` (section I).
 */

/** Path of the doctor space, for a language. */
export function doctorSpacePath(lang: string): string {
  return `/${lang === 'ar' ? 'ar' : 'fr'}/mes-patients`;
}

/**
 * Is this post-login target the doctor space? The login page then skips the
 * automatic PATIENT results-access request it files for every new account: a
 * doctor signing up through the invitation is not a patient asking for results
 * (he asks for his doctor access on the next screen).
 */
export function isDoctorSpacePath(target: string): boolean {
  return /^\/(fr|ar)\/mes-patients(?:[/?#]|$)/.test(target);
}

/**
 * A phone number as wa.me wants it: digits only, international. Moroccan local
 * numbers (`06 12 34 56 78`) become `212612345678` — same rule as the admin's
 * relance links. '' when there is nothing usable.
 */
export function waDigits(phone: string): string {
  const d = String(phone || '').replace(/\D+/g, '');
  if (!d) return '';
  if (d.startsWith('00')) return d.slice(2);
  if (d.startsWith('212')) return d;
  return d.replace(/^0/, '212');
}

/**
 * wa.me link with a prefilled message. Without a number, WhatsApp opens its
 * contact picker — the lab often has the doctor in its contacts already.
 */
export function whatsappInviteLink(phone: string, message: string): string {
  return `https://wa.me/${waDigits(phone)}?text=${encodeURIComponent(message)}`;
}
