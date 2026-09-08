"use client";

import React from 'react';
import { MessageCircle, Mail, Phone, MessageSquare } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ChoiceCard } from '../SectionShell';
import { REPLY_CHANNELS, type ReplyChannel } from '@/lib/journey/types';

/**
 * Par quel canal le patient souhaite la réponse.
 *
 * ⚠ AUCUN envoi automatique : le choix est simplement enregistré et transmis au
 * personnel, qui répond à la main. C'est explicitement hors périmètre du
 * chiffrage, et la note sous les cartes le dit au patient — promettre un envoi
 * automatique par WhatsApp serait mentir.
 *
 * ⚠ La valeur part BRUTE (`whatsapp` | `email` | `call` | `sms`) : c'est
 * `route.ts` qui la traduit en libellé français pour la boîte du laboratoire.
 */
export interface ReplyChannelSectionProps {
  value: ReplyChannel;
  onChange: (channel: ReplyChannel) => void;
}

const ICONS: Record<ReplyChannel, React.ReactNode> = {
  whatsapp: <MessageCircle className="h-5 w-5" />,
  email: <Mail className="h-5 w-5" />,
  call: <Phone className="h-5 w-5" />,
  sms: <MessageSquare className="h-5 w-5" />,
};

export default function ReplyChannelSection({ value, onChange }: ReplyChannelSectionProps) {
  const { t } = useTranslation('journey');

  return (
    <div>
      <div
        role="radiogroup"
        aria-label={t('channel.title')}
        className="grid grid-cols-2 sm:grid-cols-4 gap-2.5"
      >
        {REPLY_CHANNELS.map((channel) => (
          <ChoiceCard
            key={channel}
            selected={value === channel}
            onSelect={() => onChange(channel)}
            title={t(`channel.${channel}`)}
            icon={ICONS[channel]}
          />
        ))}
      </div>
      <p className="mt-3 text-xs text-[var(--text-tertiary)]">{t('channel.no_auto_send_note')}</p>
    </div>
  );
}
