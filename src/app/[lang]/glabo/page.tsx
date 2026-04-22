"use client";

import React, { useState, useEffect } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { fr, ar } from "date-fns/locale";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import { LAB_CONTACT } from "../../../constants/contact";
import { generateTimeSlots } from "../../../utils/timeSlots";
import toast from 'react-hot-toast';
import { User, Phone, Mail, MapPin, Building, Key, Calendar, Clock, FileText, MessageSquare, Send, Activity, ShieldCheck, Clock3 } from 'lucide-react';

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
        setLang(resolvedParams.lang);
      } catch (error) {
        // Silently handle param resolution errors
      }
    };

    loadParams();
  }, [params]);

  // Force la langue i18n à correspondre à la langue de l'URL
  useEffect(() => {
    if (i18n.language !== lang) {
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

  const timeSlots = generateTimeSlots(selectedDate);
  // Get WhatsApp number from constants
  const laboWhatsapp = LAB_CONTACT.WHATSAPP[0].url.replace('https://wa.me/', '');

  // Soumission du formulaire
  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    // Validation simple
    if (!nom.trim() || !telephone.trim() || !adresse.trim() || !selectedDate || !selectedTime) {
      toast.error(t('requiredFields', { ns: 'appointment' }));
      return;
    }
    // Formatage de la date
    const formattedDate = selectedDate ? format(selectedDate, "dd/MM/yyyy") : "";
    const laboEmail = LAB_CONTACT.EMAIL.display;
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
      toast.error(t('email_error'));
    }
  };

  // Génère le lien WhatsApp
  const handleWhatsapp = () => {
    if (!nom.trim() || !telephone.trim() || !adresse.trim() || !selectedDate || !selectedTime) {
      toast.error(t('requiredFields', { ns: 'appointment' }));
      return;
    }
    const formattedDate = selectedDate ? format(selectedDate, "dd/MM/yyyy") : "";
    const message = `${t('greeting', { ns: 'glabo' })}\n\n${t('home_service_request', { ns: 'glabo' })}\n\n${t('name')}: ${nom}\n${t('phone')}: ${telephone}${email ? `\n${t('email')}: ${email}` : ''}\n${t('address')}: ${adresse}\n${t('location_type')}: ${lieuPrelevement === 'domicile' ? t('home') : t('workplace')}${instructionsAcces ? `\n${t('access_instructions')}: ${instructionsAcces}` : ''}\n${t('desiredDate', { ns: 'glabo' })}: ${formattedDate}\n${t('desiredTime', { ns: 'glabo' })}: ${selectedTime}${commentaires ? `\n${t('comments', { ns: 'glabo' })}: ${commentaires}` : ''}\n${hasOrdonnance === 'oui' ? t('withPrescription', { ns: 'glabo' }) : t('withoutPrescription', { ns: 'glabo' })}\n\n${t('thanks', { ns: 'glabo' })}`;
    
    const whatsappLink = `https://wa.me/${laboWhatsapp}?text=${encodeURIComponent(message)}`;
    window.open(whatsappLink, '_blank');
  };

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-[#121212] py-12 px-4 sm:px-6 lg:px-8 font-sans transition-colors duration-300">
      <div className="max-w-6xl mx-auto">
        {/* En-tête de la page */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center p-4 bg-fuchsia-100 dark:bg-fuchsia-900/30 rounded-full mb-4 shadow-sm">
            <Activity className="h-10 w-10 text-[var(--color-fuchsia-accent)]" />
          </div>
          <h1 className="text-3xl md:text-5xl font-bold text-[var(--color-bordeaux-primary)] dark:text-white mb-6 font-['Inter','Public Sans',sans-serif]">
            {t('glabo_title', { ns: 'common' })}
          </h1>
          <p className="text-[var(--text-secondary)] max-w-2xl mx-auto text-lg">
            Bénéficiez de l'expertise de notre laboratoire sans vous déplacer. Nos infirmiers qualifiés se rendent chez vous ou sur votre lieu de travail pour effectuer vos prélèvements en toute sécurité.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          {/* Colonne d'information (gauche sur desktop) */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white dark:bg-[var(--background-secondary)] rounded-2xl shadow-md border border-gray-100 dark:border-[var(--border-default)] p-6">
              <h3 className="text-xl font-bold text-[var(--text-primary)] mb-6 border-b border-gray-100 dark:border-gray-700 pb-4">
                Pourquoi choisir ce service ?
              </h3>
              
              <ul className="space-y-6">
                <li className="flex items-start">
                  <div className="flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400">
                    <ShieldCheck className="h-6 w-6" />
                  </div>
                  <div className="ml-4">
                    <h4 className="text-base font-semibold text-[var(--text-primary)]">Sécurité maximale</h4>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">Prélèvements réalisés dans le respect strict des normes d'hygiène.</p>
                  </div>
                </li>
                <li className="flex items-start">
                  <div className="flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
                    <Clock3 className="h-6 w-6" />
                  </div>
                  <div className="ml-4">
                    <h4 className="text-base font-semibold text-[var(--text-primary)]">Gain de temps</h4>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">Évitez les déplacements et l'attente en salle. Idéal pour les personnes à mobilité réduite ou très occupées.</p>
                  </div>
                </li>
                <li className="flex items-start">
                  <div className="flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-full bg-fuchsia-100 dark:bg-fuchsia-900/20 text-[var(--color-fuchsia-accent)]">
                    <Building className="h-6 w-6" />
                  </div>
                  <div className="ml-4">
                    <h4 className="text-base font-semibold text-[var(--text-primary)]">Flexibilité</h4>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">Intervention à domicile ou directement sur votre lieu de travail selon vos disponibilités.</p>
                  </div>
                </li>
              </ul>
            </div>
            
            {/* Contact direct */}
            <div className="bg-[var(--color-bordeaux-primary)] rounded-2xl shadow-md p-6 text-white text-center">
              <h3 className="text-lg font-semibold mb-2">Une question urgente ?</h3>
              <p className="text-bordeaux-pale text-sm mb-4">Notre équipe est disponible pour vous renseigner.</p>
              <a href={LAB_CONTACT.LANDLINE.url} className="inline-flex items-center justify-center gap-2 bg-white text-[var(--color-bordeaux-primary)] px-6 py-2.5 rounded-full font-bold hover:bg-gray-50 transition-colors w-full">
                <Phone className="h-5 w-5" />
                {LAB_CONTACT.LANDLINE.display}
              </a>
            </div>
          </div>

          {/* Colonne Formulaire (droite sur desktop) */}
          <div className="lg:col-span-8">
            <div className="bg-white dark:bg-[var(--background-secondary)] rounded-2xl shadow-xl border border-gray-100 dark:border-[var(--border-default)] overflow-hidden">
              <div className="p-6 md:p-8">
                <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-6 pb-4 border-b border-gray-100 dark:border-gray-700">
                  Formulaire de demande
                </h2>
                
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Informations personnelles */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">1. Vos informations</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Nom complet */}
                      <div>
                        <label htmlFor="nomComplet" className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
                          {t('fullName', { ns: 'glabo' })} <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <User className="h-5 w-5 text-gray-400" />
                          </div>
                          <input
                            type="text"
                            id="nomComplet"
                            name="nomComplet"
                            className="block w-full pl-10 pr-3 py-2.5 bg-gray-50 dark:bg-[var(--background-tertiary)] border border-gray-200 dark:border-[var(--border-default)] rounded-xl focus:ring-2 focus:ring-[var(--color-fuchsia-accent)] focus:border-transparent transition-all duration-200 text-[var(--text-primary)]"
                            autoComplete="name"
                            value={nom}
                            onChange={e => setNom(e.target.value)}
                            placeholder="Ahmed Benali"
                            required
                          />
                        </div>
                      </div>
                      
                      {/* Numéro de téléphone */}
                      <div>
                        <label htmlFor="telephone" className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
                          {t('phoneNumber', { ns: 'glabo' })} <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Phone className="h-5 w-5 text-gray-400" />
                          </div>
                          <input
                            type="tel"
                            id="telephone"
                            name="telephone"
                            className="block w-full pl-10 pr-3 py-2.5 bg-gray-50 dark:bg-[var(--background-tertiary)] border border-gray-200 dark:border-[var(--border-default)] rounded-xl focus:ring-2 focus:ring-[var(--color-fuchsia-accent)] focus:border-transparent transition-all duration-200 text-[var(--text-primary)]"
                            autoComplete="tel"
                            inputMode="tel"
                            value={telephone}
                            onChange={(e) => setTelephone(e.target.value)}
                            placeholder="06 XX XX XX XX"
                            required
                          />
                        </div>
                      </div>
                      
                      {/* Email (optionnel) */}
                      <div className="md:col-span-2">
                        <label htmlFor="email" className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
                          {t('email', { ns: 'glabo' })} <span className="text-gray-400 text-xs ml-1">(Optionnel)</span>
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Mail className="h-5 w-5 text-gray-400" />
                          </div>
                          <input
                            type="email"
                            id="email"
                            name="email"
                            className="block w-full pl-10 pr-3 py-2.5 bg-gray-50 dark:bg-[var(--background-tertiary)] border border-gray-200 dark:border-[var(--border-default)] rounded-xl focus:ring-2 focus:ring-[var(--color-fuchsia-accent)] focus:border-transparent transition-all duration-200 text-[var(--text-primary)]"
                            autoComplete="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="ahmed.benali@email.com"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
        
                  {/* Informations de localisation */}
                  <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-[var(--border-default)]">
                    <h3 className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">2. Lieu du prélèvement</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Lieu de prélèvement */}
                      <div>
                        <label htmlFor="lieuPrelevement" className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
                          {t('location_type', { ns: 'glabo' })}
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Building className="h-5 w-5 text-gray-400" />
                          </div>
                          <select
                            id="lieuPrelevement"
                            name="lieuPrelevement"
                            value={lieuPrelevement}
                            onChange={e => setLieuPrelevement(e.target.value)}
                            className="block w-full pl-10 pr-3 py-2.5 bg-gray-50 dark:bg-[var(--background-tertiary)] border border-gray-200 dark:border-[var(--border-default)] rounded-xl focus:ring-2 focus:ring-[var(--color-fuchsia-accent)] focus:border-transparent transition-all duration-200 text-[var(--text-primary)] appearance-none"
                          >
                            <option value="domicile">{t('home', { ns: 'glabo' })}</option>
                            <option value="travail">{t('workplace', { ns: 'glabo' })}</option>
                          </select>
                        </div>
                      </div>
                      
                      {/* Adresse de prélèvement */}
                      <div className="md:col-span-2">
                        <label htmlFor="adresse" className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
                          {t('address', { ns: 'glabo' })} <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <MapPin className="h-5 w-5 text-gray-400" />
                          </div>
                          <input
                            type="text"
                            id="adresse"
                            name="adresse"
                            className="block w-full pl-10 pr-3 py-2.5 bg-gray-50 dark:bg-[var(--background-tertiary)] border border-gray-200 dark:border-[var(--border-default)] rounded-xl focus:ring-2 focus:ring-[var(--color-fuchsia-accent)] focus:border-transparent transition-all duration-200 text-[var(--text-primary)]"
                            autoComplete="street-address"
                            value={adresse}
                            onChange={(e) => setAdresse(e.target.value)}
                            placeholder="Numéro, Rue, Quartier, Ville"
                            required
                          />
                        </div>
                      </div>
                      
                      {/* Instructions d'accès */}
                      <div className="md:col-span-2">
                        <label htmlFor="instructionsAcces" className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
                          {t('access_instructions')} <span className="text-gray-400 text-xs ml-1">(Optionnel)</span>
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Key className="h-5 w-5 text-gray-400" />
                          </div>
                          <input
                            type="text"
                            id="instructionsAcces"
                            name="instructionsAcces"
                            placeholder={t('access_instructions_placeholder')}
                            className="block w-full pl-10 pr-3 py-2.5 bg-gray-50 dark:bg-[var(--background-tertiary)] border border-gray-200 dark:border-[var(--border-default)] rounded-xl focus:ring-2 focus:ring-[var(--color-fuchsia-accent)] focus:border-transparent transition-all duration-200 text-[var(--text-primary)]"
                            value={instructionsAcces}
                            onChange={(e) => setInstructionsAcces(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Date et Heure */}
                  <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-[var(--border-default)]">
                    <h3 className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">3. Date et Heure</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Date souhaitée */}
                      <div>
                        <label htmlFor="date" className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
                          {t('desiredDate', { ns: 'glabo' })} <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                            <Calendar className="h-5 w-5 text-gray-400" />
                          </div>
                          <DatePicker
                            id="date"
                            selected={selectedDate}
                            onChange={(date) => setSelectedDate(date)}
                            dateFormat="dd/MM/yyyy"
                            minDate={new Date()}
                            locale={dateLocale}
                            placeholderText="Sélectionnez une date"
                            className="block w-full pl-10 pr-3 py-2.5 bg-gray-50 dark:bg-[var(--background-tertiary)] border border-gray-200 dark:border-[var(--border-default)] rounded-xl focus:ring-2 focus:ring-[var(--color-fuchsia-accent)] focus:border-transparent transition-all duration-200 text-[var(--text-primary)]"
                            required
                          />
                        </div>
                      </div>
                      
                      {/* Heure souhaitée */}
                      <div>
                        <label htmlFor="heure" className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
                          {t('desiredTime', { ns: 'glabo' })} <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Clock className="h-5 w-5 text-gray-400" />
                          </div>
                          <select
                            id="heure"
                            name="heure"
                            value={selectedTime}
                            onChange={(e) => setSelectedTime(e.target.value)}
                            className="block w-full pl-10 pr-3 py-2.5 bg-gray-50 dark:bg-[var(--background-tertiary)] border border-gray-200 dark:border-[var(--border-default)] rounded-xl focus:ring-2 focus:ring-[var(--color-fuchsia-accent)] focus:border-transparent transition-all duration-200 text-[var(--text-primary)] appearance-none"
                            required
                          >
                            <option value="">{t('chooseTime', { ns: 'glabo' })}</option>
                            {timeSlots.map((slot) => (
                              <option key={slot} value={slot}>{slot}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Ordonnance et détails */}
                  <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-[var(--border-default)]">
                    <h3 className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">4. Détails médicaux</h3>
                    
                    {/* Ordonnance */}
                    <div>
                      <label htmlFor="ordonnance" className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
                        Avez-vous une ordonnance ?
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <FileText className="h-5 w-5 text-gray-400" />
                        </div>
                        <select
                          id="ordonnance"
                          name="ordonnance"
                          value={hasOrdonnance}
                          onChange={e => setHasOrdonnance(e.target.value)}
                          className="block w-full pl-10 pr-3 py-2.5 bg-gray-50 dark:bg-[var(--background-tertiary)] border border-gray-200 dark:border-[var(--border-default)] rounded-xl focus:ring-2 focus:ring-[var(--color-fuchsia-accent)] focus:border-transparent transition-all duration-200 text-[var(--text-primary)] appearance-none"
                        >
                          <option value="non">{t('no', { ns: 'glabo' })}</option>
                          <option value="oui">{t('yes', { ns: 'glabo' })}</option>
                        </select>
                      </div>
                    </div>
                    
                    {/* Commentaires (optionnel) */}
                    <div>
                      <label htmlFor="commentaires" className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
                        {t('comments', { ns: 'glabo' })} <span className="text-gray-400 text-xs ml-1">(Optionnel)</span>
                      </label>
                      <div className="relative">
                        <div className="absolute top-3 left-3 pointer-events-none">
                          <MessageSquare className="h-5 w-5 text-gray-400" />
                        </div>
                        <textarea
                          id="commentaires"
                          name="commentaires"
                          rows={3}
                          className="block w-full pl-10 pr-3 py-2.5 bg-gray-50 dark:bg-[var(--background-tertiary)] border border-gray-200 dark:border-[var(--border-default)] rounded-xl focus:ring-2 focus:ring-[var(--color-fuchsia-accent)] focus:border-transparent transition-all duration-200 text-[var(--text-primary)] resize-none"
                          value={commentaires}
                          onChange={e => setCommentaires(e.target.value)}
                          placeholder="Ex: Prise de sang à jeun..."
                        />
                      </div>
                    </div>
                  </div>
        
                  <hr className="border-gray-200 dark:border-[var(--border-default)]" />

                  {/* Boutons de soumission */}
                  <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <button
                      type="button"
                      onClick={handleWhatsapp}
                      style={{ backgroundColor: '#25D366' }}
                      className="flex-1 text-white font-medium py-3 px-4 rounded-xl hover:opacity-90 transition-all duration-200 shadow-sm hover:shadow flex items-center justify-center gap-2 group"
                      aria-label={t('requestByWhatsApp', { ns: 'glabo' })}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16" className="w-5 h-5 group-hover:scale-110 transition-transform">
                        <path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z"/>
                      </svg>
                      {t('requestByWhatsApp', { ns: 'glabo' })}
                    </button>
                    <button
                      type="submit"
                      className="flex-1 button-bordeaux group"
                    >
                      <Send className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                      {t('requestByEmail', { ns: 'glabo' })}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
