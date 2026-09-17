'use client';

/**
 * "Your patient code" card on `/profile`.
 *
 * The lab dossier number (`requester_id`) was stored on every profile but shown
 * nowhere — patients had no way to know it, and at the counter they spell their
 * name while the front desk searches. This card shows it big, and as a Code 128
 * symbol the counter scanner reads straight off the phone: the scanner emulates
 * a keyboard, so the number types itself into Qalam's patient search. No
 * integration with Qalam is involved.
 *
 * When the account also carries relatives' dossiers (ayant droit), the selector
 * switches which code is shown — it is usually the son who comes to the desk for
 * his parents, so he needs to present THEIR code, not his.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Barcode as BarcodeIcon, Check, Copy, Maximize2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import Barcode from '@/components/common/Barcode';
import IdentitySelector from '@/components/common/IdentitySelector';
import ScanFullscreen from '@/components/features/profile/ScanFullscreen';
import { findIdentity, resolveIdentities } from '@/lib/results/identities';

/** Width of the inline preview, in px. The real scan happens full screen. */
const PREVIEW_WIDTH = 280;
const PREVIEW_HEIGHT = 90;

export interface PatientCodeCardProps {
  lang: string;
}

export function PatientCodeCard({ lang }: PatientCodeCardProps) {
  const { t } = useTranslation('common');
  const { userProfile } = useAuth();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);

  const isRtl = lang === 'ar';

  const identities = useMemo(
    () => resolveIdentities(userProfile, t('profile.code.me', 'Moi')),
    [userProfile, t]
  );

  // The selection is local and never persisted, exactly like the one on
  // /resultats: on a shared family phone, remembering "I was looking at Dad"
  // is a risk, not a convenience.
  const selected = findIdentity(identities, selectedId) ?? identities[0] ?? null;

  // A revoked link must not leave a dangling selection pointing at a code the
  // account may no longer show.
  useEffect(() => {
    if (selectedId && !findIdentity(identities, selectedId)) setSelectedId(null);
  }, [identities, selectedId]);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(id);
  }, [copied]);

  // No dossier at all: the account exists but the lab has not activated access.
  // Show why, never an empty barcode — an empty symbol still encodes to
  // Start + check + Stop and scans as nothing, which looks like a broken reader.
  if (!selected) {
    return (
      <div className="card p-8">
        <div className="flex items-center gap-3 mb-2">
          <BarcodeIcon className="w-5 h-5 text-[var(--brand-primary)]" />
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            {t('profile.code.title', 'Mon code patient')}
          </h2>
        </div>
        <p className="text-sm text-[var(--text-secondary)]">
          {t(
            'profile.code.pending',
            "Votre code apparaîtra ici dès que le laboratoire aura activé votre accès aux résultats."
          )}
        </p>
      </div>
    );
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(selected.requester_id);
      setCopied(true);
    } catch {
      /* clipboard refused (http, permissions) — the digits are on screen anyway */
    }
  };

  return (
    <div className="card p-8">
      <div className="flex items-center gap-3 mb-2">
        <BarcodeIcon className="w-5 h-5 text-[var(--brand-primary)]" />
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">
          {t('profile.code.title', 'Mon code patient')}
        </h2>
      </div>
      <p className="text-sm text-[var(--text-secondary)] mb-5">
        {t(
          'profile.code.desc',
          "Présentez ce code à l'accueil pour ouvrir votre dossier sans rien épeler."
        )}
      </p>

      <IdentitySelector
        identities={identities}
        value={selected.requester_id}
        onChange={setSelectedId}
        isRtl={isRtl}
        label={t('profile.code.whose', 'Quel code afficher ?')}
        className="mb-5"
      />

      {/* barcode-surface carries the mandatory true white. Never a .card, which
          is pink (#FFF0F5) in light mode — see src/styles/index.css. */}
      <div className="barcode-surface rounded-lg p-4 flex flex-col items-center gap-3" dir="ltr">
        <Barcode
          value={selected.requester_id}
          targetWidth={PREVIEW_WIDTH}
          height={PREVIEW_HEIGHT}
          ariaLabel={t('profile.code.aria', 'Code patient {{code}}', {
            code: selected.requester_id,
          })}
        />
        {/* Latin digits, dir=ltr: this number is read aloud and typed into the
            lab software — it must never become Arabic-Indic or be reordered. */}
        <p
          className="text-3xl font-bold tabular-nums"
          style={{ color: '#000', letterSpacing: '0.18em' }}
        >
          {selected.requester_id}
        </p>
      </div>

      <div className="flex flex-wrap gap-3 mt-5">
        <button
          type="button"
          onClick={() => setScanOpen(true)}
          className="button-bordeaux flex items-center gap-2"
        >
          <Maximize2 className="w-4 h-4" />
          {t('profile.code.present', "Présenter à l'accueil")}
        </button>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-2 min-h-[44px] px-4 rounded-lg border border-[var(--border-default)] text-[var(--text-primary)]"
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          {copied ? t('copy_success', 'Copié !') : t('copy', 'Copier')}
        </button>
      </div>

      {scanOpen && (
        <ScanFullscreen
          code={selected.requester_id}
          personLabel={selected.label}
          onClose={() => setScanOpen(false)}
        />
      )}
    </div>
  );
}

export default PatientCodeCard;
