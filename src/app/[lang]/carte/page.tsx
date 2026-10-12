"use client";

/**
 * /[lang]/carte — the lab's business card in the app (Dr Aziz, 12/10/2026,
 * devis line 63): clickable details, « Enregistrer dans mes contacts » (vCard),
 * the card as image and PDF. See docs/pages/carte.md.
 */
import React, { use } from 'react';
import BusinessCard from '@/components/features/qr/BusinessCard';

export default function CartePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = use(params);
  return <BusinessCard lang={lang} />;
}
