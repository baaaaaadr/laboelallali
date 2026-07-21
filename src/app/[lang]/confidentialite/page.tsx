"use client";

/**
 * /confidentialite — public privacy policy page (loi 09-08 / CNDP).
 * Static content pulled from i18n (confidentialite.*). No auth, no data access.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldCheck, FileText, Server, UserCog, Scale, Lock, Clock, Mail, Activity } from 'lucide-react';

export default function ConfidentialitePage() {
  const { t } = useTranslation('common');

  const sections = [
    { icon: FileText, title: 'confidentialite.collect_title', text: 'confidentialite.collect_text' },
    { icon: Server, title: 'confidentialite.results_title', text: 'confidentialite.results_text' },
    { icon: UserCog, title: 'confidentialite.profile_title', text: 'confidentialite.profile_text' },
    // Declares the single usage datum the app stores (date of last results view),
    // which powers the lab's adoption dashboard. See docs/pages/admin.md.
    { icon: Activity, title: 'confidentialite.usage_title', text: 'confidentialite.usage_text' },
  ];
  const rights = [
    'confidentialite.rights_access',
    'confidentialite.rights_rectify',
    'confidentialite.rights_delete',
    'confidentialite.rights_oppose',
    'confidentialite.rights_complaint',
  ];
  const afterRights = [
    { icon: Lock, title: 'confidentialite.security_title', text: 'confidentialite.security_text' },
    { icon: Clock, title: 'confidentialite.retention_title', text: 'confidentialite.retention_text' },
    { icon: Mail, title: 'confidentialite.contact_title', text: 'confidentialite.contact_text' },
  ];

  return (
    <div className="min-h-[80vh] py-12 px-4 sm:px-6 lg:px-8 bg-[var(--background-default)]">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="flex items-start gap-3">
          <ShieldCheck size={30} className="text-[var(--color-bordeaux-primary)] flex-shrink-0 mt-1" />
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-bordeaux-primary)]">
              {t('confidentialite.title', 'Politique de confidentialité')}
            </h1>
            <p className="text-[var(--text-secondary)] mt-2">
              {t('confidentialite.intro')}
            </p>
          </div>
        </div>

        {sections.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.title} className="card p-6">
              <h2 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2 mb-2">
                <Icon size={20} className="text-[var(--color-fuchsia-accent)]" />
                {t(s.title)}
              </h2>
              <p className="text-[var(--text-secondary)] leading-relaxed">{t(s.text)}</p>
            </div>
          );
        })}

        <div className="card p-6">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2 mb-3">
            <Scale size={20} className="text-[var(--color-fuchsia-accent)]" />
            {t('confidentialite.rights_title', 'Vos droits')}
          </h2>
          <ul className="space-y-2">
            {rights.map((r) => (
              <li key={r} className="flex gap-2 text-[var(--text-secondary)] leading-relaxed">
                <span className="text-[var(--color-fuchsia-accent)] flex-shrink-0">•</span>
                <span>{t(r)}</span>
              </li>
            ))}
          </ul>
        </div>

        {afterRights.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.title} className="card p-6">
              <h2 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2 mb-2">
                <Icon size={20} className="text-[var(--color-fuchsia-accent)]" />
                {t(s.title)}
              </h2>
              <p className="text-[var(--text-secondary)] leading-relaxed">{t(s.text)}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
