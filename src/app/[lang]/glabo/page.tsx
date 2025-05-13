"use client";

import React, { useState, useEffect } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { fr, ar } from "date-fns/locale";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";
// Import directement depuis la source sans alias
import { supportedLngs } from "../../../../i18n";

// Dans Next.js 15.3.1, les params sont une Promise qu'il faut attendre
interface GlaboParams {
  lang: string;
}

// Page de prélèvement à domicile optimisée pour le context [lang]
export default function GlaboPage({ params }: { params: Promise<GlaboParams> }) {
  // On utilise useState et useEffect pour gérer l'attente des params
  const [lang, setLang] = useState<string>('fr');
  const { t, i18n } = useTranslation(['glabo', 'common']); // glabo devient le namespace par défaut
  
  // Effet pour attendre les params et récupérer la langue
  useEffect(() => {
    const loadParams = async () => {
      try {
        const resolvedParams = await params;
        const urlLang = resolvedParams.lang;
        console.log(`[Glabo] Params resolved, language from URL: ${urlLang}`);
        setLang(urlLang);
      } catch (error) {
        console.error("[Glabo] Error resolving params:", error);
      }
    };
    
    loadParams();
  }, [params]);
  
  // Force la langue i18n à correspondre à la langue de l'URL
  useEffect(() => {
    if (i18n.language !== lang) {
      console.log(`[Glabo] Syncing language from URL param: ${lang}, current: ${i18n.language}`);
      i18n.changeLanguage(lang);
    }
  }, [lang, i18n]);
  
  // Déterminer la locale de date-fns en fonction de la langue
  const dateLocale = lang === 'ar' ? ar : fr;
  
  const [nom, setNom] = useState('');
  const [telephone, setTelephone] = useState('');
  const [email, setEmail] = useState('');
  const [adresse, setAdresse] = useState('');
  const [lieuPrelevement, setLieuPrelevement] = useState('domicile'); // 'domicile' ou 'travail'
  const [instructionsAcces, setInstructionsAcces] = useState(''); // Pour code d'immeuble, etc.
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [selectedTime, setSelectedTime] = useState('');
  const [hasOrdonnance, setHasOrdonnance] = useState('non'); // 'oui' ou 'non'
  const [commentaires, setCommentaires] = useState('');

    // --- TITRE DE LA PAGE ---
  // À placer dans le JSX, juste avant le formulaire :
  // <h1 className="text-3xl font-bold text-[var(--primary-bordeaux)] mb-6 text-center">{t('glabo_title', { ns: 'glabo' })}</h1>
// Génère les créneaux horaires disponibles en fonction du jour sélectionné
  function generateTimeSlots(date: Date | null): string[] {
    if (!date) return [];
    const day = date.getDay(); // 0=dimanche, 6=samedi
    const startHour = 7, startMinute = 30;
    let endHour, endMinute;
    if (day === 6) { // samedi
      endHour = 12;
      endMinute = 0;
    } else {
      endHour = 18;
      endMinute = 30;
    }
    const slots: string[] = [];
    let h = startHour, m = startMinute;
    while (h < endHour || (h === endHour && m <= endMinute - 15)) {
      const hh = h.toString().padStart(2, '0');
      const mm = m.toString().padStart(2, '0');
      slots.push(`${hh}:${mm}`);
      m += 15;
      if (m === 60) {
        m = 0;
        h++;
      }
    }
    return slots;
  }

  const timeSlots = generateTimeSlots(selectedDate);
  const laboWhatsapp = "212654079592"; // Numéro en format international sans +

  // Soumission du formulaire
  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    // Validation simple
    if (!nom.trim() || !telephone.trim() || !adresse.trim() || !selectedDate || !selectedTime) {
      alert(t('requiredFields', { ns: 'appointment' }));
      return;
    }
    // Formatage de la date
    const formattedDate = selectedDate ? format(selectedDate, "dd/MM/yyyy") : "";
    const laboEmail = "laboelallali@gmail.com";
    const sujet = `${t('home_service')} - ${nom}`;
    
    // Créer le texte du message
    const messageText = `${t('greeting', { ns: 'glabo' })}\n\n${t('home_service_request', { ns: 'glabo' })}\n\n${t('name')}: ${nom}\n${t('phone')}: ${telephone}${email ? `\n${t('email')}: ${email}` : ''}\n${t('address')}: ${adresse}\n${t('location_type')}: ${lieuPrelevement === 'domicile' ? t('home') : t('workplace')}${instructionsAcces ? `\n${t('access_instructions')}: ${instructionsAcces}` : ''}\n${t('desiredDate', { ns: 'glabo' })}: ${formattedDate}\n${t('desiredTime', { ns: 'glabo' })}: ${selectedTime}${commentaires ? `\n${t('comments', { ns: 'glabo' })}: ${commentaires}` : ''}\n${hasOrdonnance === 'oui' ? t('withPrescription', { ns: 'glabo' }) : t('withoutPrescription', { ns: 'glabo' })}\n\n${t('thanks', { ns: 'glabo' })}`;
    
    // Envoi par email
    try {
      const encodedBody = encodeURIComponent(messageText);
      const encodedSubject = encodeURIComponent(sujet);
      const mailtoLink = `mailto:${laboEmail}?subject=${encodedSubject}&body=${encodedBody}`;
      window.location.href = mailtoLink;
    } catch (error) {
      alert(t('email_error'));      
    }
  };

  // Génère le lien WhatsApp
  const handleWhatsapp = () => {
    if (!nom.trim() || !telephone.trim() || !adresse.trim() || !selectedDate || !selectedTime) {
      alert(t('requiredFields', { ns: 'appointment' }));
      return;
    }
    const formattedDate = selectedDate ? format(selectedDate, "dd/MM/yyyy") : "";
    const message = `${t('greeting', { ns: 'glabo' })}\n\n${t('home_service_request', { ns: 'glabo' })}\n\n${t('name')}: ${nom}\n${t('phone')}: ${telephone}${email ? `\n${t('email')}: ${email}` : ''}\n${t('address')}: ${adresse}\n${t('location_type')}: ${lieuPrelevement === 'domicile' ? t('home') : t('workplace')}${instructionsAcces ? `\n${t('access_instructions')}: ${instructionsAcces}` : ''}\n${t('desiredDate', { ns: 'glabo' })}: ${formattedDate}\n${t('desiredTime', { ns: 'glabo' })}: ${selectedTime}${commentaires ? `\n${t('comments', { ns: 'glabo' })}: ${commentaires}` : ''}\n${hasOrdonnance === 'oui' ? t('withPrescription', { ns: 'glabo' }) : t('withoutPrescription', { ns: 'glabo' })}\n\n${t('thanks', { ns: 'glabo' })}`;
    
    const whatsappLink = `https://wa.me/${laboWhatsapp}?text=${encodeURIComponent(message)}`;
    window.open(whatsappLink, '_blank');
  };

  return (
    <main className="p-4 md:p-8 font-sans">
      <h1 className="text-3xl font-bold text-[var(--primary-bordeaux)] mb-6 font-['Inter','Public Sans',sans-serif] text-center">
        {t('glabo_title', { ns: 'common' })}
      </h1>
      <form className="max-w-lg mx-auto" onSubmit={handleSubmit}>
        {/* Nom complet */}
        <div className="mb-4">
          <label htmlFor="nomComplet" className="block text-sm font-medium text-[var(--primary-bordeaux)] mb-1">
            {t('fullName', { ns: 'glabo' })}
          </label>
          <input
            type="text"
            id="nomComplet"
            name="nomComplet"
            className="w-full p-2 border border-[var(--gray-300)] rounded-md shadow-sm focus:ring-[var(--accent-fuchsia)] focus:border-[var(--accent-fuchsia)]"
            autoComplete="name"
            value={nom}
            onChange={e => setNom(e.target.value)}
            required
          />
        </div>
        
        {/* Numéro de téléphone */}
        <div className="mb-4">
          <label htmlFor="telephone" className="block text-sm font-medium text-[var(--primary-bordeaux)] mb-1">
            {t('phoneNumber', { ns: 'glabo' })}
          </label>
          <input
            type="tel"
            id="telephone"
            name="telephone"
            className="w-full p-2 border border-[var(--gray-300)] rounded-md shadow-sm focus:ring-[var(--accent-fuchsia)] focus:border-[var(--accent-fuchsia)]"
            autoComplete="tel"
            inputMode="tel"
            value={telephone}
            onChange={(e) => setTelephone(e.target.value)}
            required
          />
        </div>
        
        {/* Email (optionnel) */}
        <div className="mb-4">
          <label htmlFor="email" className="block text-sm font-medium text-[var(--primary-bordeaux)] mb-1">
            {t('email', { ns: 'glabo' })}
          </label>
          <input
            type="email"
            id="email"
            name="email"
            className="w-full p-2 border border-[var(--gray-300)] rounded-md shadow-sm focus:ring-[var(--accent-fuchsia)] focus:border-[var(--accent-fuchsia)]"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        
        {/* Adresse de prélèvement */}
        <div className="mb-4">
          <label htmlFor="adresse" className="block text-sm font-medium text-[var(--primary-bordeaux)] mb-1">
            {t('address', { ns: 'glabo' })}
          </label>
          <input
            type="text"
            id="adresse"
            name="adresse"
            className="w-full p-2 border border-[var(--gray-300)] rounded-md shadow-sm focus:ring-[var(--accent-fuchsia)] focus:border-[var(--accent-fuchsia)]"
            autoComplete="street-address"
            value={adresse}
            onChange={(e) => setAdresse(e.target.value)}
            required
          />
        </div>
        
        {/* Lieu de prélèvement */}
        <div className="mb-4">
          <label htmlFor="lieuPrelevement" className="block text-sm font-medium text-[var(--primary-bordeaux)] mb-1">
            {t('location_type', { ns: 'glabo' })}
          </label>
          <select
            id="lieuPrelevement"
            name="lieuPrelevement"
            value={lieuPrelevement}
            onChange={e => setLieuPrelevement(e.target.value)}
            className="w-full p-2 border border-[var(--gray-300)] rounded-md shadow-sm focus:ring-[var(--accent-fuchsia)] focus:border-[var(--accent-fuchsia)]"
          >
            <option value="domicile">{t('home', { ns: 'glabo' })}</option>
            <option value="travail">{t('workplace', { ns: 'glabo' })}</option>
          </select>
        </div>
        
        {/* Instructions d'accès */}
        <div className="mb-4">
          <label htmlFor="instructionsAcces" className="block text-sm font-medium text-[var(--primary-bordeaux)] mb-1">
            {t('access_instructions')}
          </label>
          <input
            type="text"
            id="instructionsAcces"
            name="instructionsAcces"
            placeholder={t('access_instructions_placeholder')}
            className="w-full p-2 border border-[var(--gray-300)] rounded-md shadow-sm focus:ring-[var(--accent-fuchsia)] focus:border-[var(--accent-fuchsia)]"
            value={instructionsAcces}
            onChange={(e) => setInstructionsAcces(e.target.value)}
          />
        </div>
        
        {/* Date souhaitée */}
        <div className="mb-4">
          <label htmlFor="date" className="block text-sm font-medium text-[var(--primary-bordeaux)] mb-1">
            {t('desiredDate', { ns: 'glabo' })}
          </label>
          <DatePicker
            id="date"
            selected={selectedDate}
            onChange={(date) => setSelectedDate(date)}
            dateFormat="dd/MM/yyyy"
            minDate={new Date()}
            locale={dateLocale}
            placeholderText="Sélectionnez une date"
            className="w-full p-2 border border-[var(--gray-300)] rounded-md shadow-sm focus:ring-[var(--accent-fuchsia)] focus:border-[var(--accent-fuchsia)]"
            required
          />
        </div>
        
        {/* Heure souhaitée */}
        <div className="mb-4">
          <label htmlFor="heure" className="block text-sm font-medium text-[var(--primary-bordeaux)] mb-1">
            {t('desiredTime', { ns: 'glabo' })}
          </label>
          <select
            id="heure"
            name="heure"
            value={selectedTime}
            onChange={(e) => setSelectedTime(e.target.value)}
            className="w-full p-2 border border-[var(--gray-300)] rounded-md shadow-sm focus:ring-[var(--accent-fuchsia)] focus:border-[var(--accent-fuchsia)]"
            required
          >
            <option value="">{t('chooseTime', { ns: 'glabo' })}</option>
            {timeSlots.map((slot) => (
              <option key={slot} value={slot}>{slot}</option>
            ))}
          </select>
        </div>

        {/* Ordonnance */}
        <div className="mb-4">
          <label htmlFor="ordonnance" className="block text-sm font-medium text-[var(--primary-bordeaux)] mb-1">
            {t('prescription', { ns: 'glabo' })}
          </label>
          <select
            id="ordonnance"
            name="ordonnance"
            value={hasOrdonnance}
            onChange={e => setHasOrdonnance(e.target.value)}
            className="w-full p-2 border border-[var(--gray-300)] rounded-md shadow-sm focus:ring-[var(--accent-fuchsia)] focus:border-[var(--accent-fuchsia)]"
          >
            <option value="non">{t('no', { ns: 'glabo' })}</option>
            <option value="oui">{t('yes', { ns: 'glabo' })}</option>
          </select>
        </div>
        
        {/* Commentaires (optionnel) */}
        <div className="mb-4">
          <label htmlFor="commentaires" className="block text-sm font-medium text-[var(--primary-bordeaux)] mb-1">
            {t('comments', { ns: 'glabo' })}
          </label>
          <textarea
            id="commentaires"
            name="commentaires"
            rows={3}
            className="w-full p-2 border border-[var(--gray-300)] rounded-md shadow-sm focus:ring-[var(--accent-fuchsia)] focus:border-[var(--accent-fuchsia)]"
            value={commentaires}
            onChange={e => setCommentaires(e.target.value)}
          />
        </div>
        
        {/* Boutons de soumission */}
        <div className="flex flex-col md:flex-row gap-3 justify-end">
          <button
            type="submit"
            className="bg-[var(--accent-fuchsia)] text-white font-semibold py-2 px-4 rounded-lg hover:bg-[var(--fuchsia-bright)] transition-colors w-full md:w-auto flex items-center justify-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
            {t('requestByEmail', { ns: 'glabo' })}
          </button>
          <button
            type="button"
            onClick={handleWhatsapp}
            className="bg-green-500 text-white font-semibold py-2 px-4 rounded-lg hover:bg-green-600 transition-colors w-full md:w-auto flex items-center justify-center gap-2"
            aria-label={t('requestByWhatsApp', { ns: 'glabo' })}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16" className="w-5 h-5">
              <path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z"/>
            </svg>
            {t('requestByWhatsApp', { ns: 'glabo' })}
          </button>
        </div>
      </form>
    </main>
  );
}
