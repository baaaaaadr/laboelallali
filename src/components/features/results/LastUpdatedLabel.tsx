'use client';

/**
 * Live "Actualisé il y a X" label. Shows the largest unit (sec → min → h → jour)
 * and ticks every 20 s; grammar/locale handled by Intl.RelativeTimeFormat.
 *
 * Shared by /resultats and « Mes patients » (moved out of the results page
 * unchanged, 23/09/2026).
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

export default function LastUpdatedLabel({ timestamp }: { timestamp: number }) {
  const { t, i18n } = useTranslation('common');
  const [now, setNow] = useState(() => Date.now());

  // Seconds aren't shown individually (just "quelques secondes"), so a slow tick
  // is enough to catch the minute/hour/day transitions without visual churn.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 20000);
    return () => clearInterval(id);
  }, []);

  const sec = Math.max(0, Math.floor((now - timestamp) / 1000));
  // Under a minute → a stable phrase (no jittery per-second counter).
  if (sec < 60) return <>{t('resultats.updated_seconds', 'Actualisé il y a quelques secondes')}</>;

  let value: number;
  let unit: Intl.RelativeTimeFormatUnit;
  if (sec < 3600) {
    value = Math.floor(sec / 60);
    unit = 'minute';
  } else if (sec < 86400) {
    value = Math.floor(sec / 3600);
    unit = 'hour';
  } else {
    value = Math.floor(sec / 86400);
    unit = 'day';
  }

  const locale = i18n.language === 'ar' ? 'ar' : 'fr';
  let ago: string;
  try {
    ago = new Intl.RelativeTimeFormat(locale, { numeric: 'always' }).format(-value, unit);
  } catch {
    ago = `${value}`;
  }
  return <>{t('resultats.updated_ago', { ago, defaultValue: 'Actualisé {{ago}}' })}</>;
}
