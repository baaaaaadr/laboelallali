"use client";

import React, { useState, useEffect, useRef } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { fr, ar } from "date-fns/locale";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import { supportedLngs } from "../../../../i18n";
import { useForm } from "react-hook-form";
import { db, storage } from "../../../config/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { LAB_CONTACT } from "../../../constants/contact";
import { generateTimeSlots } from "../../../utils/timeSlots";
import toast from 'react-hot-toast';
import { User, Phone, Mail, Calendar, Clock, FileText, MessageSquare, Send, CalendarDays } from 'lucide-react';
import MultiFileUploader from "../../../components/ui/MultiFileUploader";
import SubmitProgressModal, { SubmitState } from "../../../components/ui/SubmitProgressModal";

interface RendezVousParams {
  lang: string;
}

// Page de rendez-vous optimisée pour le context [lang]
export default function RendezVousPage({ params }: { params: Promise<RendezVousParams> }) {
  // On utilise useState et useEffect pour gérer l'attente des params
  const [lang, setLang] = useState<string>('fr');
  const { t, i18n } = useTranslation(['appointment', 'common']); // 'appointment' devient le namespace par défaut
  
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

  // Synchroniser le langage i18n avec le paramètre de l'URL quand il change
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
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [selectedTime, setSelectedTime] = useState('');
  const [prescriptionFiles, setPrescriptionFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string>('');
  const [filePreviews, setFilePreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [commentaires, setCommentaires] = useState('');
  
  // Nouveaux états pour la gestion multi-étapes de la soumission
  type SubmitState = 'idle' | 'uploading_image' | 'saving_database' | 'sending_email' | 'success';
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [isWhatsappLoading, setIsWhatsappLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const timeSlots = generateTimeSlots(selectedDate);
  // Get WhatsApp number from constants (remove leading 0 and add country code)
  const laboWhatsapp = LAB_CONTACT.WHATSAPP[0].url.replace('https://wa.me/', '');

  // The MultiFileUploader component handles its own file change logic
  // we just pass it the state

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitError(null);
    
    // Validation simple
    if (!nom.trim() || !telephone.trim() || !selectedDate || !selectedTime) {
      toast.error(t('requiredFields', { ns: 'appointment' }));
      return;
    }
    
    try {
      // Ensure Firestore is initialized
      if (!db) {
        throw new Error(t('appointment:errors.db_not_initialized', 'Le service de base de données n\'est pas disponible. Veuillez réessayer.'));
      }

      // 1. Upload prescription files if exist
      let downloadURLs: string[] = [];

      if (prescriptionFiles.length > 0) {
        setSubmitState('uploading_image');
        await new Promise(resolve => setTimeout(resolve, 1500)); // Artificial delay to let user read
        
        if (!storage) {
          throw new Error(t('appointment:errors.storage_not_initialized', 'Le service de stockage n\'est pas disponible. Veuillez réessayer.'));
        }

        for (const file of prescriptionFiles) {
          const timestamp = Date.now();
          const fileName = file.name;
          const storageRef = ref(storage, `ordonnances/${timestamp}-${fileName}`);
          await uploadBytes(storageRef, file);
          const url = await getDownloadURL(storageRef);
          downloadURLs.push(url);
        }
      }

      // 2. Format date for Firestore
      const formattedDate = selectedDate ? format(selectedDate, "dd/MM/yyyy") : "";

      // 3. Prepare data for Firestore
      setSubmitState('saving_database');
      await new Promise(resolve => setTimeout(resolve, 1200)); // Artificial delay
      
      const appointmentData = {
        name: nom,
        phone: telephone,
        email: email || null,
        desiredDate: formattedDate,
        desiredTime: selectedTime,
        comments: commentaires || "",
        prescriptionImageUrls: downloadURLs,
        submittedAt: serverTimestamp(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        status: "new_appointment_request",
        type: "lab_appointment"
      };

      // 4. Save to Firestore
      await addDoc(collection(db, "appointmentRequests"), appointmentData);
      
      // 5. Envoi d'un email de notification via notre route API
      setSubmitState('sending_email');
      await new Promise(resolve => setTimeout(resolve, 1200)); // Artificial delay
      
      // Split name if it contains spaces for better email formatting
      const nameParts = nom.trim().split(' ');
      const prenom = nameParts.length > 1 ? nameParts.shift() : '';
      const lastName = nameParts.join(' ');
      
      try {
        const response = await fetch('/api/send-appointment', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            nom: lastName || nom,
            prenom: prenom,
            telephone,
            email,
            date_souhaitee: formattedDate,
            heure_souhaitee: selectedTime,
            type_analyse: "Rendez-vous Laboratoire",
            commentaires,
            ordonnanceUrls: downloadURLs,
            isHomeService: false
          })
        });
        
        if (!response.ok) {
          console.warn('⚠️ Notification par email échouée, mais le RDV est bien enregistré.');
        }
      } catch (emailError) {
        console.warn('⚠️ Erreur lors de l\'envoi de l\'email, le RDV est bien enregistré.', emailError);
      }

      // 6. Afficher l'animation de succès
      setSubmitState('success');
      toast.success(t('appointment_request_success', { ns: 'appointment' }));

      // 7. Reset the form after a short delay so the user can see the success animation
      setTimeout(() => {
        setSubmitState('idle');
        setNom('');
        setTelephone('');
        setEmail('');
        setSelectedDate(new Date());
        setSelectedTime('');
        setPrescriptionFiles([]);
        setFilePreviews([]);
        setCommentaires('');
      }, 2500);
      
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error("Error submitting appointment request:", error);
      }
      setSubmitError(t('appointment_request_error', { ns: 'appointment' }));
      setSubmitState('idle');
    }
  };

  // Génère le lien WhatsApp avec message prérempli et upload de l'ordonnance
  const handleWhatsapp = async () => {
    if (!nom.trim() || !telephone.trim() || !selectedDate || !selectedTime) {
      toast.error(t('requiredFields', { ns: 'appointment' }));
      return;
    }

    setIsWhatsappLoading(true);

    try {
      // Ensure Firestore is initialized
      if (!db) {
        throw new Error(t('appointment:errors.db_not_initialized', 'Le service de base de données n\'est pas disponible. Veuillez réessayer.'));
      }

      let downloadURLs: string[] = [];

      // Upload prescription files if exist
      if (prescriptionFiles && prescriptionFiles.length > 0) {
        // Ensure storage is initialized
        if (!storage) {
          throw new Error(t('appointment:errors.storage_not_initialized', 'Le service de stockage n\'est pas disponible. Veuillez réessayer.'));
        }

        // Upload all files
        for (const file of prescriptionFiles) {
          const timestamp = Date.now();
          const fileName = file.name;
          const storageRef = ref(storage, `ordonnances/${timestamp}-${fileName}`);
          
          await uploadBytes(storageRef, file);
          const url = await getDownloadURL(storageRef);
          downloadURLs.push(url);
        }
      }

      const formattedDate = selectedDate ? format(selectedDate, "dd/MM/yyyy") : "";

      // Format prescription text for WhatsApp
      let prescriptionText = "";
      if (downloadURLs.length > 0) {
        prescriptionText = `\n📎 ${t('prescriptionLink', { ns: 'appointment' })}:`;
        downloadURLs.forEach((url, idx) => {
          prescriptionText += `\n- Page ${idx + 1}: ${url}`;
        });
      } else {
        prescriptionText = `\n${t('withoutPrescription', { ns: 'appointment' })}`;
      }

      // Build message
      const message = t('emailBody', {
        name: nom,
        phone: telephone,
        email: email ? `\nEmail : ${email}` : '',
        date: formattedDate,
        time: selectedTime,
        comments: commentaires ? `\n${t('comments', { ns: 'appointment' })} : ${commentaires}` : '',
        prescription: prescriptionText
      });

      const whatsappLink = `https://wa.me/${LAB_CONTACT.WHATSAPP_ID}?text=${encodeURIComponent(message)}`;
      window.open(whatsappLink, '_blank');

      // Save to Firestore for tracking
      const appointmentData = {
        name: nom,
        phone: telephone,
        email: email || null,
        desiredDate: formattedDate,
        desiredTime: selectedTime,
        comments: commentaires || "",
        prescriptionImageUrl: downloadURL,
        submittedAt: serverTimestamp(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        status: "whatsapp_appointment_request",
        type: "lab_appointment"
      };

      await addDoc(collection(db, "appointmentRequests"), appointmentData);

      toast.success(t('whatsapp_redirect_success', { ns: 'appointment' }));

      // Reset form
      setNom('');
      setTelephone('');
      setEmail('');
      setSelectedDate(new Date());
      setSelectedTime('');
      setPrescriptionFiles([]);
      setFilePreviews([]);
      setCommentaires('');

    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error("Error in WhatsApp handler:", error);
      }
      toast.error(t('whatsapp_error', { ns: 'appointment' }));
    } finally {
      setIsWhatsappLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[var(--background-default)] py-12 px-4 sm:px-6 lg:px-8 font-primary transition-colors duration-300">
      <div className="max-w-3xl mx-auto">
        {/* En-tête de la page */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center p-3 bg-[var(--color-fuchsia-pale)] dark:bg-[var(--background-tertiary)] rounded-lg mb-4">
            <CalendarDays className="h-8 w-8 text-[var(--brand-accent)]" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-[var(--brand-primary)] dark:text-[var(--text-primary)] mb-4 font-['Inter','Public Sans',sans-serif]">
            {t('appointment', { ns: 'appointment' })}
          </h1>
          <p className="text-[var(--text-secondary)] max-w-xl mx-auto text-lg">
            Planifiez votre visite au laboratoire rapidement et facilement.
          </p>
        </div>
      
      {submitError && (
        <div className="max-w-lg mx-auto mb-6 p-4 bg-[var(--status-error)]/10 border border-[var(--status-error)]/30 text-[var(--status-error)] rounded-lg">
          {submitError}
        </div>
      )}
      
        {/* Formulaire dans une carte */}
        <div className="relative card border border-[var(--border-default)] overflow-hidden">
          
          <SubmitProgressModal 
            submitState={submitState} 
            hasFiles={prescriptionFiles.length > 0} 
          />

          <div className="p-6 md:p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Nom complet */}
                <div>
                  <label htmlFor="nomComplet" className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
                    {t('fullName', { ns: 'appointment' })} <span className="text-[var(--status-error)]">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <User className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      id="nomComplet"
                      name="nomComplet"
                      className="block w-full pl-10 pr-3 py-2.5 bg-[var(--background-secondary)] border border-[var(--border-default)] rounded-lg focus:ring-2 focus:ring-[var(--color-fuchsia-accent)] focus:border-transparent transition-all duration-200 text-[var(--text-primary)]"
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
                    {t('phoneNumber', { ns: 'appointment' })} <span className="text-[var(--status-error)]">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Phone className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="tel"
                      id="telephone"
                      name="telephone"
                      className="block w-full pl-10 pr-3 py-2.5 bg-[var(--background-secondary)] border border-[var(--border-default)] rounded-lg focus:ring-2 focus:ring-[var(--color-fuchsia-accent)] focus:border-transparent transition-all duration-200 text-[var(--text-primary)]"
                      autoComplete="tel"
                      inputMode="tel"
                      value={telephone}
                      onChange={(e) => setTelephone(e.target.value)}
                      placeholder="06 XX XX XX XX"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Email (optionnel) */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
                  {t('email', { ns: 'appointment' })} <span className="text-gray-400 text-xs ml-1">(Optionnel)</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    className="block w-full pl-10 pr-3 py-2.5 bg-[var(--background-secondary)] border border-[var(--border-default)] rounded-lg focus:ring-2 focus:ring-[var(--color-fuchsia-accent)] focus:border-transparent transition-all duration-200 text-[var(--text-primary)]"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ahmed.benali@email.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Date souhaitée */}
                <div>
                  <label htmlFor="date" className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
                    {t('desiredDate', { ns: 'appointment' })} <span className="text-[var(--status-error)]">*</span>
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
                      className="block w-full pl-10 pr-3 py-2.5 bg-[var(--background-secondary)] border border-[var(--border-default)] rounded-lg focus:ring-2 focus:ring-[var(--color-fuchsia-accent)] focus:border-transparent transition-all duration-200 text-[var(--text-primary)]"
                      required
                    />
                  </div>
                </div>

                {/* Heure souhaitée */}
                <div>
                  <label htmlFor="heure" className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
                    {t('desiredTime', { ns: 'appointment' })} <span className="text-[var(--status-error)]">*</span>
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
                      className="block w-full pl-10 pr-3 py-2.5 bg-[var(--background-secondary)] border border-[var(--border-default)] rounded-lg focus:ring-2 focus:ring-[var(--color-fuchsia-accent)] focus:border-transparent transition-all duration-200 text-[var(--text-primary)] appearance-none"
                      required
                    >
                      <option value="">{t('chooseTime', { ns: 'appointment' })}</option>
                      {timeSlots.map((slot) => (
                        <option key={slot} value={slot}>{slot}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Téléchargement d'ordonnance */}
              <MultiFileUploader 
                files={prescriptionFiles}
                setFiles={setPrescriptionFiles}
                filePreviews={filePreviews}
                setFilePreviews={setFilePreviews}
                error={fileError}
                setError={setFileError}
              />
              
              {/* Commentaires (optionnel) */}
              <div>
                <label htmlFor="commentaires" className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
                  {t('comments', { ns: 'appointment' })} <span className="text-gray-400 text-xs ml-1">(Optionnel)</span>
                </label>
                <div className="relative">
                  <div className="absolute top-3 left-3 pointer-events-none">
                    <MessageSquare className="h-5 w-5 text-gray-400" />
                  </div>
                  <textarea
                    id="commentaires"
                    name="commentaires"
                    rows={4}
                    className="block w-full pl-10 pr-3 py-2.5 bg-[var(--background-secondary)] border border-[var(--border-default)] rounded-lg focus:ring-2 focus:ring-[var(--color-fuchsia-accent)] focus:border-transparent transition-all duration-200 text-[var(--text-primary)] resize-none"
                    value={commentaires}
                    onChange={e => setCommentaires(e.target.value)}
                    placeholder="Précisez ici toute information utile pour le laboratoire..."
                  />
                </div>
              </div>
              
              {/* Ligne de séparation */}
              <hr className="border-gray-200 dark:border-[var(--border-default)]" />

              {/* Boutons de soumission */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleWhatsapp}
                  style={{ backgroundColor: '#25D366' }}
                  className="flex-1 text-white font-medium py-3 px-4 rounded-lg hover:opacity-90 transition-all duration-200 shadow-sm hover:shadow flex items-center justify-center gap-2 group"
                  aria-label={t('requestByWhatsApp', { ns: 'appointment' })}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16" className="w-5 h-5 group-hover:scale-110 transition-transform">
                    <path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z"/>
                  </svg>
                  {t('requestByWhatsApp', { ns: 'appointment' })}
                </button>
                <button
                  type="submit"
                  disabled={submitState !== 'idle' || isWhatsappLoading}
                  className={`flex-1 button-bordeaux group ${submitState !== 'idle' || isWhatsappLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                  {submitState !== 'idle' && submitState !== 'success' ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {t('submitting', { ns: 'appointment' })}
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                      {t('submit_appointment_request', { ns: 'appointment' })}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
