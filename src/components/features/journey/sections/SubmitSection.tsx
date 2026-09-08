"use client";

import React from 'react';
import { Send, MessageCircle, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import SubmitProgressModal, { type SubmitState } from '@/components/ui/SubmitProgressModal';

/**
 * Les deux boutons d'envoi, conservés tels quels (décision du propriétaire) :
 *  - "Envoyer ma demande" : Firestore + e-mail au laboratoire ;
 *  - "Envoyer par WhatsApp" : ouvre WhatsApp AVEC le message pré-rempli, ET
 *    envoie le même e-mail complet au laboratoire, en signalant que le patient a
 *    choisi WhatsApp. C'est le changement par rapport aux pages actuelles, où le
 *    chemin WhatsApp n'envoyait aucun e-mail — le détail des analyses se serait
 *    perdu dans une conversation.
 *
 * ⚠ L'envoi est bloqué tant qu'une ordonnance est en cours de téléversement
 * (`isPreUploading`) : sinon la demande partirait sans sa pièce jointe.
 */
export interface SubmitSectionProps {
  submitState: SubmitState;
  isWhatsappLoading: boolean;
  isPreUploading: boolean;
  hasFiles: boolean;
  submitError: string | null;
  onSubmit: () => void;
  onWhatsApp: () => void;
}

export default function SubmitSection({
  submitState,
  isWhatsappLoading,
  isPreUploading,
  hasFiles,
  submitError,
  onSubmit,
  onWhatsApp,
}: SubmitSectionProps) {
  const { t } = useTranslation('journey');
  const busy = submitState !== 'idle' || isWhatsappLoading;
  const disabled = busy || isPreUploading;

  return (
    <div>
      <SubmitProgressModal submitState={submitState} hasFiles={hasFiles} />

      {submitError && (
        <p className="mb-4 text-sm text-[var(--status-error)]" role="alert">
          {submitError}
        </p>
      )}

      {isPreUploading && (
        <p className="mb-4 text-sm text-[var(--text-secondary)] flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          {t('submit.wait_upload')}
        </p>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          onClick={onSubmit}
          disabled={disabled}
          className="button-bordeaux flex-1 justify-center flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {submitState !== 'idle' ? (
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          ) : (
            <Send className="h-5 w-5" aria-hidden="true" />
          )}
          {submitState !== 'idle' ? t('submit.sending') : t('submit.send_request')}
        </button>

        <button
          type="button"
          onClick={onWhatsApp}
          disabled={disabled}
          className="flex-1 justify-center flex items-center gap-2 py-3 px-6 rounded-lg font-semibold text-white bg-[var(--status-success)] hover:brightness-90 transition-all shadow-md active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed dark:bg-transparent dark:border-2 dark:border-[var(--status-success)] dark:text-[var(--status-success)]"
        >
          {isWhatsappLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          ) : (
            <MessageCircle className="h-5 w-5" aria-hidden="true" />
          )}
          {t('submit.send_whatsapp')}
        </button>
      </div>

      <p className="mt-4 text-xs text-center text-[var(--text-tertiary)]">
        {t('submit.legal_note')}
      </p>
    </div>
  );
}
