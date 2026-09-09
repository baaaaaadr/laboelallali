"use client";

import React from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { fr, ar } from 'date-fns/locale';
import { Calendar, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * Date et créneau souhaités, câblés sur les horaires réels d'ouverture via
 * `useLabSchedule` (le hook porte les trois pièges documentés : `useNow()` nul
 * jusqu'au montage, semis non destructif, et le créneau vidé quand la nouvelle
 * date ne le propose plus).
 *
 * ⚠ `onDateChange` DOIT être le `setDate` du hook, jamais un `setState` direct :
 * c'est lui qui vide le créneau périmé. Sans cela le `<select>` s'affiche vide
 * tout en conservant sa valeur, et le laboratoire reçoit une demande pour une
 * heure de fermeture.
 */
export interface DateTimeSectionProps {
  lang: string;
  selectedDate: Date | null;
  selectedTime: string;
  timeSlots: string[];
  isDayBookable: (date: Date) => boolean;
  onDateChange: (date: Date | null) => void;
  onTimeChange: (time: string) => void;
  /** Affiche la note "les prélèvements à domicile se font le matin". */
  showHomeMorningNote?: boolean;
  /**
   * `false` quand le patient n'a pas encore choisi de réserver un créneau
   * (`wantsAppointment`, `useJourneyForm.ts`) : les champs restent utilisables
   * mais cessent d'être exigés — astérisques et `required` HTML retirés, texte
   * d'aide remplacé. Défaut `true`.
   */
  required?: boolean;
}

export default function DateTimeSection({
  lang,
  selectedDate,
  selectedTime,
  timeSlots,
  isDayBookable,
  onDateChange,
  onTimeChange,
  showHomeMorningNote = false,
  required = true,
}: DateTimeSectionProps) {
  const { t } = useTranslation(['journey', 'appointment']);
  const dateLocale = lang === 'ar' ? ar : fr;

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="journey-date"
            className="block text-sm font-medium text-[var(--text-primary)] mb-1.5"
          >
            <Calendar className="inline h-4 w-4 me-1.5 text-[var(--color-bordeaux-primary)]" aria-hidden="true" />
            {t('when.date_label')}
            {required && <span className="text-[var(--status-error)] ms-1">*</span>}
          </label>
          <DatePicker
            id="journey-date"
            selected={selectedDate}
            onChange={onDateChange}
            dateFormat="dd/MM/yyyy"
            minDate={new Date()}
            filterDate={isDayBookable}
            locale={dateLocale}
            placeholderText="JJ/MM/AAAA"
            className="block w-full rounded-lg border border-[var(--border-default)] bg-[var(--background-default)] text-[var(--text-primary)] p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-fuchsia-accent)]"
            wrapperClassName="w-full"
            required={required}
          />
        </div>

        <div>
          <label
            htmlFor="journey-time"
            className="block text-sm font-medium text-[var(--text-primary)] mb-1.5"
          >
            <Clock className="inline h-4 w-4 me-1.5 text-[var(--color-bordeaux-primary)]" aria-hidden="true" />
            {t('when.time_label')}
            {required && <span className="text-[var(--status-error)] ms-1">*</span>}
          </label>
          <select
            id="journey-time"
            value={selectedTime}
            onChange={(e) => onTimeChange(e.target.value)}
            className="block w-full rounded-lg border border-[var(--border-default)] bg-[var(--background-default)] text-[var(--text-primary)] p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-fuchsia-accent)] appearance-none"
            required={required}
          >
            <option value="">{t('when.choose_time')}</option>
            {timeSlots.map((slot) => (
              <option key={slot} value={slot}>
                {slot}
              </option>
            ))}
          </select>
          {selectedDate && timeSlots.length === 0 && (
            <p className="mt-1 text-xs text-[var(--status-warning)]">{t('when.no_slots')}</p>
          )}
        </div>
      </div>

      <p className="mt-3 text-xs text-[var(--text-tertiary)]">
        {required ? t('when.help') : t('when.optional_note')}
      </p>
      {showHomeMorningNote && (
        <p className="mt-1 text-xs text-[var(--color-fuchsia-accent)]">
          {t('when.home_morning_note')}
        </p>
      )}
    </div>
  );
}
