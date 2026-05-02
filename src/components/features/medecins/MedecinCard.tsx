'use client';

import { Medecin } from '@/types/medecin';
import { useTranslation } from 'react-i18next';
import { MapPin, Phone, Mail } from 'lucide-react';

interface MedecinCardProps {
  medecin: Medecin;
  lang: string;
}

const MedecinCard = ({ medecin, lang }: MedecinCardProps) => {
  const { t } = useTranslation('common');

  return (
    <div className="card bg-[var(--background-card)] p-4 sm:p-5 rounded-xl border border-[var(--border-default)] flex flex-col gap-3 transition-all hover-lift">
      <div className="flex justify-between items-start gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg sm:text-xl text-[var(--color-fuchsia-accent)] font-bold truncate-none break-words mb-1">
            Dr. {medecin.prenom} {medecin.nom}
          </h3>
          <p className="text-sm sm:text-base text-[var(--color-bordeaux-primary)] font-semibold break-words">
            {medecin.specialite}
          </p>
        </div>

        <span className={`inline-block px-3 py-1 rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap flex-shrink-0 ${
          medecin.secteur === 'public'
            ? 'bg-[var(--status-success)]/10 text-[var(--status-success)]'
            : 'bg-[var(--status-info)]/10 text-[var(--status-info)]'
        }`}>
          {medecin.secteur === 'public'
            ? (lang === 'ar' ? 'عمومي' : 'Public')
            : (lang === 'ar' ? 'خاص' : 'Privé')
          }
        </span>
      </div>

      <div className="flex flex-col gap-1.5 mt-1">
        {medecin.adresse && (
          <div className="flex items-start gap-2 text-sm sm:text-base text-[var(--text-primary)]">
            <MapPin size={18} className="flex-shrink-0 text-[var(--color-fuchsia-accent)] mt-0.5" />
            <p className="break-words overflow-wrap-anywhere">{medecin.adresse}</p>
          </div>
        )}
        
        <div className="flex items-center gap-2 text-sm sm:text-base text-[var(--text-secondary)]">
          <div className="w-[18px] flex justify-center flex-shrink-0">🏙️</div>
          <p className="truncate">{medecin.commune}, {medecin.province}</p>
        </div>

        {medecin.tel_professionnel && (
          <div className="flex items-center gap-2 text-sm sm:text-base">
            <Phone size={18} className="flex-shrink-0 text-[var(--color-bordeaux-primary)]" />
            <a
              href={`tel:${medecin.tel_professionnel}`}
              className="text-[var(--color-bordeaux-primary)] hover:underline break-all"
            >
              {medecin.tel_professionnel}
            </a>
          </div>
        )}

        {medecin.email && (
          <div className="flex items-center gap-2 text-sm sm:text-base">
            <Mail size={18} className="flex-shrink-0 text-[var(--color-bordeaux-primary)]" />
            <a
              href={`mailto:${medecin.email}`}
              className="text-[var(--color-bordeaux-primary)] hover:underline break-all overflow-wrap-anywhere"
            >
              {medecin.email}
            </a>
          </div>
        )}
      </div>
    </div>
  );
};

export default MedecinCard;
