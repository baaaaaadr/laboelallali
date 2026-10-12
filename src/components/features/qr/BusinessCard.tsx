'use client';

/**
 * « Carte de visite » — the lab's business card in the app (Dr Aziz,
 * 12/10/2026, devis line 63). Reached from the « Scannez-moi » page (QR code)
 * and the contact page.
 *
 *  - the card itself, recto and verso: the SAME files as the printed card
 *    (produced by the print work, `marketing/output/imprimerie/carte-visite-numerique-*`,
 *    copied to `public/carte-visite/`) — one source for screen and printer;
 *  - every detail clickable: landline, the lab's WhatsApp, Dr El Allali (call
 *    or WhatsApp), e-mail, site, directions, hours;
 *  - « Enregistrer dans mes contacts »: `laboratoire-el-allali.vcf` (vCard,
 *    `scripts/generate-vcard.js`) — iPhone shows the contact sheet, Android
 *    opens it in Contacts;
 *  - the card as an image (to share on WhatsApp) and as a PDF.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, Download, FileDown, Globe, Mail, MapPin, MessageCircle, Phone, Stethoscope, UserPlus } from 'lucide-react';
import { LAB_CONTACT, LAB_COORDINATES } from '@/constants/contact';

const FILES = {
  recto: '/carte-visite/carte-recto.png',
  verso: '/carte-visite/carte-verso.png',
  pdf: '/carte-visite/carte-visite-laboratoire-el-allali.pdf',
  vcf: '/carte-visite/laboratoire-el-allali.vcf',
};

export default function BusinessCard({ lang }: { lang: string }) {
  const { t } = useTranslation('common');
  const isRtl = lang === 'ar';

  const rows: { key: string; icon: React.ReactNode; label: string; value: string; href: string; external?: boolean; ltr?: boolean }[] = [
    { key: 'landline', icon: <Phone size={20} />, label: t('carte.landline', 'Fixe'), value: '05 28 84 33 84', href: LAB_CONTACT.LANDLINE.url, ltr: true },
    { key: 'whatsapp', icon: <MessageCircle size={20} />, label: t('carte.whatsapp', 'WhatsApp du laboratoire'), value: '06 54 07 95 92', href: LAB_CONTACT.WHATSAPP[0].url, external: true, ltr: true },
    { key: 'doctor', icon: <Stethoscope size={20} />, label: t('carte.doctor', 'Dr El Allali (WhatsApp)'), value: '06 61 29 14 11', href: LAB_CONTACT.DR_WHATSAPP.url, external: true, ltr: true },
    { key: 'doctor_call', icon: <Phone size={20} />, label: t('carte.doctor_call', 'Appeler le Dr El Allali'), value: '06 61 29 14 11', href: 'tel:0661291411', ltr: true },
    { key: 'email', icon: <Mail size={20} />, label: t('carte.email', 'E-mail'), value: LAB_CONTACT.EMAIL.display, href: LAB_CONTACT.EMAIL.url, ltr: true },
    { key: 'site', icon: <Globe size={20} />, label: t('carte.site', 'Site et application'), value: 'www.laboelallali.com', href: 'https://www.laboelallali.com', external: true, ltr: true },
    { key: 'address', icon: <MapPin size={20} />, label: t('carte.address', 'Adresse — itinéraire'), value: t('carte.address_value', '61 Bis, rue de Marrakech, Agadir (face au tribunal de la famille)'), href: LAB_COORDINATES.GOOGLE_MAPS_URL, external: true },
  ];

  const btn = 'button-bordeaux justify-center flex items-center gap-2 w-full';
  const btnOutline =
    'flex items-center justify-center gap-2 w-full min-h-[48px] px-4 rounded-lg border-2 border-[var(--border-default)] text-[var(--text-primary)] font-medium hover:border-[var(--color-bordeaux-primary)]';

  return (
    <div className="min-h-[80vh] py-8 px-4 bg-[var(--background-default)]" data-testid="carte">
      <div className="max-w-xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-bordeaux-primary)]">{t('carte.title', 'Notre carte de visite')}</h1>
          <p className="text-[var(--text-secondary)] mt-1">
            {t('carte.intro', 'Enregistrez le laboratoire dans vos contacts, ou partagez la carte.')}
          </p>
        </div>

        {/* The card, recto then verso — the same files as the printed card. */}
        <div className="space-y-3" dir="ltr">
          {/* eslint-disable-next-line @next/next/no-img-element -- static files, shown as-is */}
          <img src={FILES.recto} alt={t('carte.recto_alt', 'Carte de visite du Laboratoire El Allali, recto')} className="w-full rounded-xl shadow-md" />
          {/* eslint-disable-next-line @next/next/no-img-element -- static files, shown as-is */}
          <img src={FILES.verso} alt={t('carte.verso_alt', 'Carte de visite, verso : plan d’accès')} className="w-full rounded-xl shadow-md" />
        </div>

        {/* Save the contact — the one action most people want. */}
        <div className="space-y-3">
          <a href={FILES.vcf} download="laboratoire-el-allali.vcf" className={btn} data-testid="carte-vcf">
            <UserPlus size={20} className="flex-shrink-0" />
            {t('carte.save_contact', 'Enregistrer dans mes contacts')}
          </a>
          <div className="grid grid-cols-2 gap-3">
            <a href={FILES.recto} download="carte-visite-laboratoire-el-allali.png" className={btnOutline} data-testid="carte-png">
              <Download size={18} className="flex-shrink-0" />
              {t('carte.download_image', 'Image')}
            </a>
            <a href={FILES.pdf} download="carte-visite-laboratoire-el-allali.pdf" className={btnOutline} data-testid="carte-pdf">
              <FileDown size={18} className="flex-shrink-0" />
              {t('carte.download_pdf', 'PDF')}
            </a>
          </div>
        </div>

        {/* Every detail, clickable. */}
        <ul className="card p-2 divide-y divide-[var(--border-default)]" data-testid="carte-rows">
          {rows.map((r) => (
            <li key={r.key}>
              <a
                href={r.href}
                {...(r.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                className="flex items-center gap-3 p-3 min-h-[56px] rounded-lg hover:bg-[var(--background-secondary)]"
                data-row={r.key}
              >
                <span className="flex-shrink-0 text-[var(--color-fuchsia-accent)]" aria-hidden="true">
                  {r.icon}
                </span>
                <span className="min-w-0">
                  <span className="block text-xs text-[var(--text-tertiary)]">{r.label}</span>
                  <span className="block font-medium text-[var(--text-primary)]" dir={r.ltr ? 'ltr' : undefined} style={r.ltr && isRtl ? { textAlign: 'right' } : undefined}>
                    {r.value}
                  </span>
                </span>
              </a>
            </li>
          ))}
          <li className="flex items-center gap-3 p-3 min-h-[56px]">
            <span className="flex-shrink-0 text-[var(--color-fuchsia-accent)]" aria-hidden="true">
              <Clock size={20} />
            </span>
            <span className="min-w-0">
              <span className="block text-xs text-[var(--text-tertiary)]">{t('carte.hours', 'Horaires')}</span>
              <span className="block font-medium text-[var(--text-primary)]">{t('monday_to_friday')}</span>
              <span className="block font-medium text-[var(--text-primary)]">{t('saturday_hours')}</span>
              <span className="block text-sm text-[var(--text-secondary)]">{t('carte.sunday', 'Dimanche fermé')}</span>
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}
