"use client";

import React, { useState, useEffect } from 'react';
import { Building2, Phone, MessageCircle, Mail, Clock, X, Check, Copy, Printer } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LAB_CONTACT, LAB_WHATSAPP_NUMBER } from '@/constants/contact';
import { useLabStatus } from '@/hooks/useLabStatus';

interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ContactModal: React.FC<ContactModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation('common');
  const labStatus = useLabStatus();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Prevent background scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // The labels carry a trailing ":" in the locale files (they are also used as
  // "Fixe : 0528…" elsewhere); the modal shows them as standalone captions.
  const label = (key: string) => t(key).replace(':', '').trim();

  const contactItems = [
    {
      id: 'phone',
      icon: <Phone size={20} />,
      label: label('landline_label'),
      value: LAB_CONTACT.LANDLINE.display,
      copyValue: LAB_CONTACT.LANDLINE.display.replace(/\s+/g, ''),
      iconColor: 'text-red-600 dark:text-red-400',
      iconBg: 'bg-red-50 dark:bg-red-400/20'
    },
    {
      id: 'whatsapp',
      icon: <MessageCircle size={20} />,
      label: label('whatsapp_label'),
      value: `+212 ${LAB_WHATSAPP_NUMBER.replace(/^0/, '')}`,
      copyValue: `+212${LAB_WHATSAPP_NUMBER.replace(/^0/, '')}`,
      iconColor: 'text-green-600 dark:text-green-400',
      iconBg: 'bg-green-50 dark:bg-green-400/20'
    },
    {
      id: 'companies',
      icon: <Building2 size={20} />,
      label: label('companies_label'),
      value: LAB_CONTACT.COMPANIES.display,
      copyValue: LAB_CONTACT.COMPANIES.display.replace(/\s+/g, ''),
      iconColor: 'text-purple-600 dark:text-purple-400',
      iconBg: 'bg-purple-50 dark:bg-purple-400/20'
    },
    {
      id: 'fax',
      icon: <Printer size={20} />,
      label: label('fax_label'),
      value: LAB_CONTACT.FAX,
      copyValue: LAB_CONTACT.FAX.replace(/\s+/g, ''),
      iconColor: 'text-slate-600 dark:text-slate-300',
      iconBg: 'bg-slate-50 dark:bg-slate-400/20'
    },
    {
      id: 'email',
      icon: <Mail size={20} />,
      label: label('email_label'),
      value: LAB_CONTACT.EMAIL.display,
      copyValue: LAB_CONTACT.EMAIL.display,
      iconColor: 'text-blue-600 dark:text-blue-400',
      iconBg: 'bg-blue-50 dark:bg-blue-400/20'
    }
  ];

  // Translated hours — the same keys the contact page and the footer use.
  // NEVER read the French-only LAB_HOURS constant here: an /ar visitor would
  // get "Lundi au Vendredi" inside an otherwise fully Arabic RTL modal.
  const mondayToFridayText = t('monday_to_friday');
  const saturdayText = t('saturday_hours');


  const extractHours = (text: string) => {
    const parts = text.split(':');
    return parts.length > 1 ? parts.slice(1).join(':').trim() : text;
  };
  const extractDay = (text: string) => {
    return text.split(':')[0] || text;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-4 font-primary">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-md transition-all duration-300" 
        onClick={onClose}
      />

      {/* Modal Container */}
      <div 
        className="relative w-full max-w-md max-h-[calc(100vh-2rem)] bg-[var(--background-card)] rounded-lg shadow-2xl overflow-y-auto transform transition-all border border-[var(--border-default)]"
        role="dialog"
        aria-modal="true"
      >
        {/* Gradient Header - Labo Theme */}
        <div className="relative bg-gradient-to-br from-[var(--color-bordeaux-primary)] to-[var(--color-fuchsia-accent)] p-5 md:p-6 text-white">
          {/* Top-right controls: status badge + close button */}
          <div className="absolute top-4 right-4 flex items-center gap-2">
            {/* Hidden until the status is known client-side (see useLabStatus) —
                better no badge for one frame than a wrong "Labo ouvert". */}
            {labStatus.isClient && (
              <div className="flex items-center gap-1.5 bg-black/25 rounded-lg px-2.5 py-1 shadow-sm">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${labStatus.isOpen ? 'bg-[var(--status-success)] animate-pulse' : 'bg-[var(--status-error)]'}`}></span>
                <span className="text-xs font-bold whitespace-nowrap !text-white">{labStatus.isOpen ? t('labo_open') : t('labo_closed')}</span>
              </div>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors focus:outline-none"
              aria-label={t('close_menu')}
            >
              <X size={18} className="text-white" />
            </button>
          </div>

          <div className="flex items-start gap-4 pt-2">
            <div className="bg-white/20 p-2.5 rounded-lg shadow-inner flex-shrink-0">
              <Phone size={24} className="text-white" />
            </div>
            <div className="flex-1 min-w-0 pr-32">
              <p className="text-xs font-bold tracking-wider uppercase !text-white/90 mb-1">{t('assistance')}</p>
              <h2 className="text-xl font-bold leading-tight !text-white">{t('hotline_contact')}</h2>
              <p className="text-xs !text-white/90 mt-1 font-medium">{t('reply_fast')}</p>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 md:p-6">
          <div className="space-y-2">
            {contactItems.map((item) => (
              <div 
                key={item.id}
                className="flex items-center p-3 rounded-lg border border-[var(--border-default)] bg-[var(--background-secondary)] hover:bg-[var(--background-tertiary)] transition-colors cursor-pointer group shadow-sm"
                onClick={() => handleCopy(item.copyValue, item.id)}
                title="Cliquer pour copier"
              >
                <div className={`p-2.5 rounded-lg mr-3 flex-shrink-0 ${item.iconBg} ${item.iconColor}`}>
                  {React.cloneElement(item.icon as React.ReactElement, { className: 'text-current' })}
                </div>
                <div className="flex-1 overflow-hidden">
                  <p className="text-[10px] font-bold tracking-widest text-[var(--text-secondary)] mb-1 uppercase">{item.label}</p>
                  <p className="text-sm font-bold text-[var(--text-primary)] truncate">{item.value}</p>
                </div>
                <div className="pl-3">
                  {copiedId === item.id ? (
                    <div className="flex items-center text-[var(--color-fuchsia-accent)] text-xs font-bold">
                      <Check size={16} className="mr-1" />
                      <span className="hidden sm:inline">{t('copy_success')}</span>
                    </div>
                  ) : (
                    <Copy size={16} className="text-[var(--text-tertiary)]" />
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Horaires Section */}
          <div className="mt-4 p-4 rounded-lg border border-[var(--color-fuchsia-accent)]/20 bg-[var(--background-secondary)] shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Clock size={16} className="text-[var(--color-fuchsia-accent)]" />
              <h3 className="text-xs font-bold tracking-widest text-[var(--color-fuchsia-accent)] uppercase">{t('opening_hours')}</h3>
            </div>
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center border-b border-[var(--border-default)] pb-2">
                <span className="text-[var(--text-secondary)] font-medium">{extractDay(mondayToFridayText)}</span>
                <span className="font-bold bg-[var(--background-tertiary)] px-2 py-1 rounded text-[var(--text-primary)] shadow-sm border border-[var(--border-default)]">
                  {extractHours(mondayToFridayText)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[var(--text-secondary)] font-medium">{extractDay(saturdayText)}</span>
                <span className="font-bold bg-[var(--background-tertiary)] px-2 py-1 rounded text-[var(--text-primary)] shadow-sm border border-[var(--border-default)]">
                  {extractHours(saturdayText)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactModal;
