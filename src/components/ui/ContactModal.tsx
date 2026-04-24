"use client";

import React, { useState, useEffect } from 'react';
import { Phone, MessageCircle, Mail, Clock, X, Check, Copy } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LAB_CONTACT, LAB_WHATSAPP_NUMBER, LAB_HOURS } from '@/constants/contact';
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

  if (!isOpen) return null;

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const contactItems = [
    {
      id: 'phone',
      icon: <Phone size={20} />,
      label: 'TÉLÉPHONE',
      value: LAB_CONTACT.LANDLINE.display,
      copyValue: LAB_CONTACT.LANDLINE.display.replace(/\s+/g, ''),
      iconColor: 'text-red-600 dark:text-red-400',
      iconBg: 'bg-red-50 dark:bg-red-400/20'
    },
    {
      id: 'whatsapp',
      icon: <MessageCircle size={20} />,
      label: 'WHATSAPP',
      value: `+212 ${LAB_WHATSAPP_NUMBER.replace(/^0/, '')}`,
      copyValue: `+212${LAB_WHATSAPP_NUMBER.replace(/^0/, '')}`,
      iconColor: 'text-green-600 dark:text-green-400',
      iconBg: 'bg-green-50 dark:bg-green-400/20'
    },
    {
      id: 'email',
      icon: <Mail size={20} />,
      label: 'EMAIL',
      value: LAB_CONTACT.EMAIL.display,
      copyValue: LAB_CONTACT.EMAIL.display,
      iconColor: 'text-blue-600 dark:text-blue-400',
      iconBg: 'bg-blue-50 dark:bg-blue-400/20'
    }
  ];

  // On utilise directement LAB_HOURS
  const mondayToFridayText = LAB_HOURS.WEEKDAYS;
  const saturdayText = LAB_HOURS.SATURDAY;
  
  const extractHours = (text: string) => {
    const parts = text.split(':');
    return parts.length > 1 ? parts.slice(1).join(':').trim() : text;
  };
  const extractDay = (text: string) => {
    return text.split(':')[0] || text;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 font-primary">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-md transition-all duration-300" 
        onClick={onClose}
      />

      {/* Modal Container */}
      <div 
        className="relative w-full max-w-md bg-[var(--background-card)] rounded-lg shadow-2xl overflow-hidden transform transition-all border border-[var(--border-default)]"
        role="dialog"
        aria-modal="true"
      >
        {/* Gradient Header - Labo Theme */}
        <div className="relative bg-gradient-to-br from-[var(--color-bordeaux-primary)] to-[var(--color-fuchsia-accent)] p-6 md:p-8 text-white">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors focus:outline-none"
            aria-label={t('close_menu')}
          >
            <X size={18} className="text-white" />
          </button>
          
          <div className="flex items-start gap-4">
            <div className="bg-white/20 p-3 rounded-lg shadow-inner flex-shrink-0">
              <Phone size={28} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                <p className="text-xs font-bold tracking-wider uppercase !text-white/90">{t('assistance')}</p>
                
                {/* Online indicator */}
                <div className="flex items-center gap-2 bg-black/25 rounded-lg px-3 py-1 shadow-sm">
                  <span className={`w-2 h-2 rounded-lg ${labStatus.isOpen ? 'bg-[var(--status-success)] animate-pulse' : 'bg-[var(--status-error)]'}`}></span>
                  <span className="text-xs font-bold whitespace-nowrap !text-white">{labStatus.isOpen ? t('online') : t('closed')}</span>
                </div>
              </div>
              <h2 className="text-2xl font-bold leading-tight truncate !text-white">{t('hotline_contact')}</h2>
              <p className="text-sm !text-white/90 mt-1 font-medium">{t('reply_fast')}</p>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 md:p-8">
          <div className="space-y-3">
            {contactItems.map((item) => (
              <div 
                key={item.id}
                className="flex items-center p-4 rounded-lg border border-[var(--border-default)] bg-[var(--background-secondary)] hover:bg-[var(--background-tertiary)] transition-colors cursor-pointer group shadow-sm"
                onClick={() => handleCopy(item.copyValue, item.id)}
                title="Cliquer pour copier"
              >
                <div className={`p-3 rounded-lg mr-4 flex-shrink-0 ${item.iconBg} ${item.iconColor}`}>
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
                    <Copy size={16} className="text-[var(--text-tertiary)] opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Horaires Section */}
          <div className="mt-6 p-5 rounded-lg border border-[var(--color-fuchsia-accent)]/20 bg-[var(--background-secondary)] shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Clock size={16} className="text-[var(--color-fuchsia-accent)]" />
              <h3 className="text-xs font-bold tracking-widest text-[var(--color-fuchsia-accent)] uppercase">{t('opening_hours')}</h3>
            </div>
            
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center border-b border-[var(--border-default)] pb-3">
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
