"use client";

import React from 'react';
import Link from 'next/link';
import { CheckCircle2, Clock3, Send, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useResultsAccess } from '../hooks/useResultsAccess';

/**
 * Dernière étape du parcours : activer l'accès aux résultats en ligne, pour que
 * le bilan que le patient vient de programmer lui revienne dans l'application.
 *
 * Réutilise les callables déjà en production (`myAccessRequest`,
 * `requestResultsAccess`) et le même découpage d'états que `/resultats`.
 *
 * ⚠ `enabled` n'est vrai qu'une fois la section RÉVÉLÉE : sans cela chaque
 * ouverture du parcours coûterait un appel de fonction, y compris aux patients
 * qui n'iront jamais jusqu'en bas.
 *
 * ⚠ Une panne ici ne doit JAMAIS empêcher l'envoi de la demande : le hook
 * retombe silencieusement sur l'état "aucune demande" et cette section reste
 * purement informative.
 *
 * Note : la plupart des patients arrivent déjà en "demande en cours" — une
 * demande est créée automatiquement à l'inscription (`autoRequestResultsAccess`
 * sur /login, file d'accueil du laboratoire).
 */
export interface ResultsAccessSectionProps {
  lang: string;
  enabled: boolean;
}

export default function ResultsAccessSection({ lang, enabled }: ResultsAccessSectionProps) {
  const { t } = useTranslation('journey');
  const { state, requesting, error, request } = useResultsAccess(enabled, {
    needProfile: t('access.need_profile'),
    generic: t('access.error'),
  });

  if (state === 'granted') {
    return (
      <div className="rounded-xl border border-[var(--status-success)]/40 bg-[var(--status-success)]/5 p-4 flex items-start gap-3">
        <CheckCircle2
          className="h-5 w-5 mt-0.5 flex-shrink-0 text-[var(--status-success)]"
          aria-hidden="true"
        />
        <div>
          <p className="font-semibold text-sm text-[var(--text-primary)]">
            {t('access.already_active')}
          </p>
          <Link
            href={`/${lang}/resultats`}
            className="mt-2 inline-block text-sm font-medium text-[var(--color-bordeaux-primary)] hover:underline"
          >
            {t('access.already_active_cta')}
          </Link>
        </div>
      </div>
    );
  }

  if (state === 'checking' || state === 'idle') {
    return (
      <p className="text-sm text-[var(--text-secondary)] flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        {t('access.checking')}
      </p>
    );
  }

  if (state === 'pending') {
    return (
      <div className="rounded-xl border border-[var(--status-info)]/40 bg-[var(--status-info)]/5 p-4 flex items-start gap-3">
        <Clock3
          className="h-5 w-5 mt-0.5 flex-shrink-0 text-[var(--status-info)]"
          aria-hidden="true"
        />
        <p className="text-sm text-[var(--text-primary)]">{t('access.pending')}</p>
      </div>
    );
  }

  return (
    <div>
      {state === 'rejected' && (
        <p className="mb-3 text-sm text-[var(--status-warning)]">{t('access.rejected')}</p>
      )}
      <p className="text-sm text-[var(--text-secondary)] mb-4">{t('access.desc')}</p>
      {error && (
        <p className="mb-3 text-sm text-[var(--status-error)]" role="alert">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={() => void request()}
        disabled={requesting}
        className="button-bordeaux flex items-center gap-2 disabled:opacity-60"
      >
        {requesting ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <Send className="h-4 w-4" aria-hidden="true" />
        )}
        {requesting ? t('access.requesting') : t('access.cta')}
      </button>
    </div>
  );
}
