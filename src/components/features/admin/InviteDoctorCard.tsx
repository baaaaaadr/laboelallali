'use client';

/**
 * « Inviter un médecin » — where the lab finds the doctor invitation link
 * (owner's decision, 24/09/2026). Demandes tab, above the doctor requests.
 *
 * The two onboarding cases, as the card says:
 *  - the doctor ALREADY has an account → no invitation: find him in the
 *    Patients tab and give him his code (« Accès médecin » card);
 *  - he has no account yet → send him this link, usually over WhatsApp (the lab
 *    has his phone, rarely his e-mail). He signs up, asks, and his request
 *    lands in the queue below.
 *
 * The link is `/{lang}/mes-patients` on this site's origin: the same URL shows
 * the request form before activation and his patients after — his bookmark.
 * Staff level (inviting grants nothing; activation stays admin).
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Copy, MessageCircle, Stethoscope } from 'lucide-react';
import { doctorSpacePath, whatsappInviteLink } from '@/lib/practitioner/invitation';

const PROD_ORIGIN = 'https://www.laboelallali.com';

export default function InviteDoctorCard({ lang }: { lang: string }) {
  const { t } = useTranslation('common');
  // The page is client-rendered, but read the origin after mount anyway: the
  // link must point at the site actually in use (production, a preview…).
  const [origin, setOrigin] = useState(PROD_ORIGIN);
  useEffect(() => {
    try {
      setOrigin(window.location.origin);
    } catch {
      /* keep the production origin */
    }
  }, []);
  const [phone, setPhone] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(id);
  }, [copied]);

  const link = `${origin}${doctorSpacePath(lang)}`;
  const message = t('admin.invite_message', { link });
  const waHref = whatsappInviteLink(phone, message);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      /* clipboard refused (http, permissions) — the link is on screen, selectable */
    }
  };

  return (
    <section className="card p-6 space-y-4" data-testid="invite-doctor-card">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-[var(--color-bordeaux-primary)]/10 flex items-center justify-center flex-shrink-0">
          <Stethoscope size={20} className="text-[var(--color-bordeaux-primary)]" />
        </div>
        <div className="min-w-0">
          {/* A <p>: base/reset.css sizes and colours h2 unlayered. */}
          <p className="font-semibold text-[var(--text-primary)]">{t('admin.invite_title', 'Inviter un médecin')}</p>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            {t(
              'admin.invite_intro',
              'Le médecin a déjà un compte ? Activez-le directement dans l’onglet Patients (carte « Accès médecin »). Sinon, envoyez-lui ce lien : il crée son compte et fait sa demande, qui arrivera ci-dessous.'
            )}
          </p>
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="invite-link" className="block text-sm font-medium text-[var(--text-secondary)]">
          {t('admin.invite_link_label', 'Lien à envoyer au médecin')}
        </label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            id="invite-link"
            type="text"
            readOnly
            value={link}
            dir="ltr"
            onFocus={(e) => e.currentTarget.select()}
            className="flex-1 min-w-0 rounded-lg px-3 py-3 border border-[var(--border-default)] bg-[var(--background-secondary)] text-[var(--text-primary)] sm:text-sm"
            data-testid="invite-link"
          />
          <button
            type="button"
            onClick={copy}
            className="flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-lg border border-[var(--border-default)] text-[var(--text-primary)]"
            data-testid="invite-copy"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? t('admin.invite_copied', 'Lien copié') : t('admin.invite_copy', 'Copier le lien')}
          </button>
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="invite-phone" className="block text-sm font-medium text-[var(--text-secondary)]">
          {t('admin.invite_phone_label', 'Téléphone du médecin (facultatif)')}
        </label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            id="invite-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={t('admin.invite_phone_placeholder', 'Ex. : 06 12 34 56 78')}
            dir="ltr"
            className="flex-1 min-w-0 rounded-lg px-3 py-3 border border-[var(--border-default)] bg-[var(--background-default)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-fuchsia-accent)] sm:text-sm"
          />
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="button-bordeaux justify-center"
            data-testid="invite-whatsapp"
          >
            <MessageCircle size={18} />
            {t('admin.invite_whatsapp', 'Envoyer par WhatsApp')}
          </a>
        </div>
        <p className="text-xs text-[var(--text-secondary)]">
          {t(
            'admin.invite_whatsapp_hint',
            'Sans numéro, WhatsApp vous laisse choisir le contact. Le message contient le lien et les trois étapes.'
          )}
        </p>
      </div>
    </section>
  );
}
