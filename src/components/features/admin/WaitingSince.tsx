'use client';

/**
 * « en attente depuis 2 j 16 h » next to a request's date (Dr Aziz, 12/10/2026:
 * « ça donne une idée sur le retard qu'on a »). Ticks every minute; amber past
 * 24 h, red past 72 h.
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

export function waitParts(ms: number, now: number) {
  const mins = Math.max(0, Math.floor((now - ms) / 60000));
  return { d: Math.floor(mins / 1440), h: Math.floor((mins % 1440) / 60), m: mins % 60, mins };
}

export default function WaitingSince({ since }: { since: number }) {
  const { t } = useTranslation('common');
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);
  if (!since || Number.isNaN(since)) return null;
  const { d, h, m, mins } = waitParts(since, now);
  const text =
    d > 0
      ? t('admin.wait_days', '{{d}} j {{h}} h', { d, h })
      : h > 0
        ? t('admin.wait_hours', '{{h}} h {{m}} min', { h, m })
        : t('admin.wait_minutes', '{{m}} min', { m });
  const color =
    mins >= 72 * 60 ? 'var(--status-error)' : mins >= 24 * 60 ? 'var(--status-warning)' : 'var(--text-secondary)';
  return (
    <span className="font-semibold" style={{ color }} data-testid="req-waiting">
      {' · '}
      {t('admin.wait_since', 'en attente depuis')} <bdi>{text}</bdi>
    </span>
  );
}
