"use client";

/**
 * /[lang]/qr — « Scannez-moi », the page behind the single QR code printed on
 * every support (Dr Aziz, 12/10/2026). The printed address is the
 * language-less `laboelallali.com/qr`; `src/middleware.ts` sends it here in the
 * phone's language with `?scan=1`. See docs/pages/qr.md.
 */
import React, { use } from 'react';
import QrHub from '@/components/features/qr/QrHub';

export default function QrPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = use(params);
  return <QrHub lang={lang} />;
}
