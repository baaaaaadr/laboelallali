'use client';

/**
 * "Faites-en profiter un proche" — a bottom-of-results card letting a patient share,
 * in one tap, that they can now consult their analyses ONLINE at the lab.
 *
 * Deliberately NON-promotional (medical deontology): a patient-voice message about a
 * SERVICE — no superlatives, no prices, no incentive. Mobile → native share sheet;
 * desktop → WhatsApp Web with a NUMBER-LESS `wa.me` link so the patient picks the
 * recipient (it must NEVER write to the lab's own number). We never touch the address
 * book — WhatsApp / the native sheet handles recipient selection (privacy-clean).
 *
 * Self-gated like CheckupReminder: renders null unless a patient account with an active
 * results access (status ready/empty). Hidden for medecin/correspondant (first-person copy).
 */

import { useCallback } from 'react';
import { Users, Share2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useResults } from '@/contexts/ResultsContext';
import { httpsCallable } from 'firebase/functions';
import { getClientAnalytics, getClientFunctions } from '@/config/firebase';
import { LAB_SITE_URL } from '@/constants/contact';

/** True on a desktop browser (no touch UA + wide viewport) — mirrors the results page. */
function isDesktopViewer(): boolean {
  if (typeof window === 'undefined') return false;
  const mobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  return !mobileUA && window.innerWidth >= 768;
}

export default function ShareAccessCard({ lang }: { lang: string }) {
  const { t } = useTranslation('common');
  const { user, userProfile } = useAuth();
  const { status } = useResults();

  const handleShare = useCallback(async () => {
    // Land the prospect on the results page (login/registration funnel).
    const url = `${LAB_SITE_URL}/${lang}/resultats?ref=partage`;
    const title = t('resultats.share_access_title', 'Faites-en profiter un proche');
    const message = t(
      'resultats.share_access_message',
      'Bonjour, je consulte désormais mes analyses médicales en ligne, directement sur mon téléphone, avec le Laboratoire El Allali — simple et sécurisé. Voici le lien si tu veux en profiter :'
    );
    // The link MUST live inside the text: WhatsApp drops a separate `url` field (Web
    // Share) and keeps only it, so we embed the link and never pass `url` separately.
    const shareText = `${message} ${url}`;

    // Best-effort measurement of shares (ROI of the word-of-mouth channel).
    // Two sinks: Analytics for the funnel, and an ANONYMOUS daily counter the admin
    // dashboard can actually query (Analytics data isn't readable from Firestore).
    // Neither records who shared — `recordShare` only bumps a global tally.
    void (async () => {
      try {
        const analytics = await getClientAnalytics();
        if (analytics) {
          const { logEvent } = await import('firebase/analytics');
          logEvent(analytics, 'share_results_access');
        }
      } catch {
        /* analytics is optional */
      }
    })();
    void (async () => {
      try {
        const functions = await getClientFunctions();
        if (functions) await httpsCallable(functions, 'recordShare')({});
      } catch {
        /* the share already happened — never bother the patient about a counter */
      }
    })();

    // Mobile: native share sheet (WhatsApp, SMS, email…). Desktop: WhatsApp Web,
    // NUMBER-LESS so the patient chooses the recipient (never the lab).
    if (!isDesktopViewer() && typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, text: shareText });
      } catch {
        /* user cancelled (AbortError) or refused — nothing to do */
      }
      return;
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank', 'noopener,noreferrer');
  }, [lang, t]);

  // Patient accounts only (first-person copy) with an active results access.
  if (!user) return null;
  if (userProfile?.type === 'medecin' || userProfile?.type === 'correspondant') return null;
  if (status !== 'ready' && status !== 'empty') return null;

  return (
    <section aria-label={t('resultats.share_access_title', 'Faites-en profiter un proche')} className="card p-5">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-[var(--color-bordeaux-primary)]/10 dark:bg-[var(--color-bordeaux-primary)]/20 flex items-center justify-center">
          <Users size={20} className="text-[var(--color-bordeaux-primary)]" />
        </div>
        <div className="min-w-0 text-start">
          <p className="font-semibold text-[var(--text-primary)] leading-snug">
            {t('resultats.share_access_title', 'Faites-en profiter un proche')}
          </p>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            {t(
              'resultats.share_access_desc',
              'Un proche aussi pourrait consulter ses analyses en ligne. Partagez-lui le lien en un clic.'
            )}
          </p>
          <button type="button" onClick={handleShare} className="button-bordeaux-outline justify-center mt-3">
            <Share2 size={16} />
            {t('resultats.share_access_cta', 'Partager')}
          </button>
        </div>
      </div>
    </section>
  );
}
