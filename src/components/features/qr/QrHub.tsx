'use client';

/**
 * « Scannez-moi » — the page behind the ONE QR code printed everywhere
 * (reception, envelopes, reports, business card, posters — Dr Aziz, 12/10/2026,
 * devis line 64). The permanent address is `laboelallali.com/qr`; the
 * middleware sends it to `/{lang}/qr?scan=1` in the PHONE's language.
 *
 * One screen of big tiles, grouped, on the same photo + overlay as the home
 * hero (the `.hero-tile` glass recipe — readable in light and dark mode). The
 * first group is the reason most people scan: their results.
 *
 * Anonymous counter (devis line 65): one `scan` when the page is opened from
 * the QR (`?scan=1`, removed from the address at once so a reload does not
 * count twice) and one `click` per tile — `recordQrEvent`, counts only.
 */
import React, { useEffect } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { httpsCallable } from 'firebase/functions';
import {
  CalendarDays,
  Clock,
  ContactRound,
  FileText,
  FlaskConical,
  Home,
  Briefcase,
  MapPin,
  MessageCircle,
  Phone,
  ReceiptText,
  Star,
  Stethoscope,
  Upload,
  UserRound,
  Languages,
} from 'lucide-react';
import { getClientFunctions } from '@/config/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useLabStatus } from '@/hooks/useLabStatus';
import PWAInstallButton from '@/components/features/pwa/PWAInstallButton';
import { GOOGLE_REVIEW_URL, LAB_CONTACT, LAB_COORDINATES } from '@/constants/contact';
import type { QrKey } from '@/lib/qr/qrLanguage';

/** Fire-and-forget: a counter must never slow down or break the page. */
function record(event: 'scan' | 'click', key?: QrKey) {
  void (async () => {
    try {
      const functions = await getClientFunctions();
      if (!functions) return;
      await httpsCallable(functions, 'recordQrEvent')(key ? { event, key } : { event });
    } catch {
      /* counting is a bonus */
    }
  })();
}

interface Tile {
  key: QrKey;
  href: string;
  external?: boolean;
  icon: React.ReactNode;
  label: string;
  desc?: string;
  /** A phone number: kept left-to-right, or Arabic shows « 84 33 84 28 05 ». */
  descLtr?: boolean;
}

export default function QrHub({ lang }: { lang: string }) {
  const { t } = useTranslation('common');
  const { user } = useAuth();
  const status = useLabStatus();
  const other = lang === 'ar' ? 'fr' : 'ar';

  // One scan per real QR visit: count, then drop `?scan=1` from the address.
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('scan') !== '1') return;
      record('scan');
      params.delete('scan');
      const rest = params.toString();
      window.history.replaceState(window.history.state, '', window.location.pathname + (rest ? `?${rest}` : ''));
    } catch {
      /* no address to read */
    }
  }, []);

  const groups: { id: string; title: string; tiles: Tile[] }[] = [
    {
      id: 'results',
      title: t('qr.g_results', 'Mes résultats'),
      tiles: [
        user
          ? { key: 'results', href: `/${lang}/resultats`, icon: <FileText size={22} />, label: t('qr.results_open', 'Voir mes résultats'), desc: t('qr.results_open_desc', 'Vos bilans et ceux de vos proches') }
          : {
              key: 'results',
              href: `/${lang}/login?redirect=/${lang}/resultats`,
              icon: <FileText size={22} />,
              label: t('qr.results_receive', 'Recevoir mes résultats sur mon téléphone'),
              desc: t('qr.results_receive_desc', 'Compte créé en un clic avec Google'),
            },
        { key: 'doctor', href: LAB_CONTACT.DR_WHATSAPP.url, external: true, icon: <Stethoscope size={22} />, label: t('qr.doctor', 'Parler au Dr El Allali'), desc: t('qr.doctor_desc', 'WhatsApp, une question sur vos analyses') },
      ],
    },
    {
      id: 'contact',
      title: t('qr.g_contact', 'Nous contacter'),
      tiles: [
        { key: 'whatsapp', href: LAB_CONTACT.WHATSAPP[0].url, external: true, icon: <MessageCircle size={22} />, label: t('qr.whatsapp', 'WhatsApp du laboratoire'), desc: t('qr.whatsapp_desc', 'Rendez-vous, prix, renseignements') },
        { key: 'call', href: LAB_CONTACT.LANDLINE.url, icon: <Phone size={22} />, label: t('qr.call', 'Appeler le laboratoire'), desc: '05 28 84 33 84', descLtr: true },
      ],
    },
    {
      id: 'visit',
      title: t('qr.g_visit', 'Venir au laboratoire'),
      tiles: [
        { key: 'directions', href: LAB_COORDINATES.GOOGLE_MAPS_URL, external: true, icon: <MapPin size={22} />, label: t('qr.directions', 'Itinéraire'), desc: t('qr.directions_desc', '61 Bis, rue de Marrakech, Agadir') },
        {
          key: 'hours',
          href: `/${lang}/contact#info`,
          icon: <Clock size={22} />,
          label: t('qr.hours', 'Horaires'),
          // Live « ouvert / fermé »: computed in the browser only (see useLabStatus).
          desc: status.isClient ? `${status.statusText} · ${status.countdownText}` : t('qr.hours_desc', 'Lun–ven 7h30–18h30, sam 7h30–13h'),
        },
      ],
    },
    {
      id: 'services',
      title: t('qr.g_services', 'Nos services'),
      tiles: [
        { key: 'rdv', href: `/${lang}/rendez-vous`, icon: <CalendarDays size={22} />, label: t('qr.rdv', 'Prendre rendez-vous') },
        { key: 'glabo', href: `/${lang}/glabo`, icon: <Home size={22} />, label: t('qr.glabo', 'Prélèvement à domicile') },
        { key: 'prescription', href: `/${lang}/rendez-vous`, icon: <Upload size={22} />, label: t('qr.prescription', 'Envoyer mon ordonnance') },
        { key: 'prices', href: `/${lang}/analyses`, icon: <ReceiptText size={22} />, label: t('qr.prices', 'Prix des analyses') },
        { key: 'prep', href: `/${lang}/contact#info`, icon: <FlaskConical size={22} />, label: t('qr.prep', 'Préparer ma prise de sang'), desc: t('qr.prep_desc', 'Jeûne, documents à apporter') },
      ],
    },
    {
      id: 'more',
      title: t('qr.g_more', 'Le laboratoire'),
      tiles: [
        { key: 'card', href: `/${lang}/carte`, icon: <ContactRound size={22} />, label: t('qr.card', 'Carte de visite'), desc: t('qr.card_desc', 'Enregistrer le contact') },
        { key: 'review', href: GOOGLE_REVIEW_URL, external: true, icon: <Star size={22} />, label: t('qr.review', 'Laisser un avis Google') },
        { key: 'doctors', href: `/${lang}/mes-patients`, icon: <UserRound size={22} />, label: t('qr.doctors', 'Espace médecins') },
        { key: 'jobs', href: `/${lang}/emploi`, icon: <Briefcase size={22} />, label: t('qr.jobs', 'Emploi & Stage') },
      ],
    },
  ];

  const tile = (x: Tile) => {
    const inner = (
      <>
        <span className="hero-tile__icon" aria-hidden="true">
          {x.icon}
        </span>
        <span className="hero-tile__label">{x.label}</span>
        {x.desc && (
          <span className="hero-tile__desc" dir={x.descLtr ? 'ltr' : undefined}>
            {x.desc}
          </span>
        )}
      </>
    );
    return x.external ? (
      <a key={x.key} href={x.href} target="_blank" rel="noopener noreferrer" className="hero-tile" onClick={() => record('click', x.key)} data-qr={x.key}>
        {inner}
      </a>
    ) : (
      <Link key={x.key} href={x.href} className="hero-tile" onClick={() => record('click', x.key)} data-qr={x.key}>
        {inner}
      </Link>
    );
  };

  return (
    <div className="relative overflow-hidden -mt-[1px] w-full min-h-screen hero-banner" data-testid="qr-hub">
      <div className="absolute inset-0 z-0">
        {/* eslint-disable-next-line @next/next/no-img-element -- same plain <img> as the home hero */}
        <img src="/images/hero-banner.jpg" alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="hero-banner-overlay" />
      </div>

      <div className="relative z-10 w-full max-w-xl mx-auto px-4 pt-6 pb-10 space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {/* eslint-disable-next-line @next/next/no-img-element -- the app icon, a static file */}
            <img src="/images/icons/icon-192x192.png" alt="" className="h-12 w-12 rounded-xl flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-lg font-bold leading-tight">{t('qr.title', 'Laboratoire El Allali')}</p>
              <p className="text-sm opacity-90">{t('qr.tagline', 'Que souhaitez-vous faire ?')}</p>
            </div>
          </div>
          <Link
            href={`/${other}/qr`}
            className="flex items-center gap-1.5 min-h-[44px] px-3 rounded-lg text-sm font-semibold flex-shrink-0"
            style={{ border: '1px solid rgba(255,255,255,0.45)' }}
            data-testid="qr-lang"
          >
            <Languages size={16} aria-hidden="true" />
            {other === 'ar' ? 'العربية' : 'Français'}
          </Link>
        </div>

        {groups.map((g) => (
          <section key={g.id} className="space-y-2" data-testid={`qr-group-${g.id}`}>
            <p className="text-xs font-semibold uppercase tracking-wide opacity-80">{g.title}</p>
            <div className="grid grid-cols-2 gap-3">
              {g.tiles.map(tile)}
              {g.id === 'more' && (
                <div onClickCapture={() => record('click', 'install')}>
                  <PWAInstallButton variant="tile" className="h-full w-full" />
                </div>
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
