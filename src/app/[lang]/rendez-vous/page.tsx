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
        const urlLang = resolvedParams.lang;
        console.log(`[RendezVous] Params resolved, language from URL: ${urlLang}`);
        setLang(urlLang);
      } catch (error) {
        console.error("[RendezVous] Error resolving params:", error);
      }
    };
    
    loadParams();
  }, [params]);
  
  // Synchroniser le langage i18n avec le paramètre de l'URL quand il change
  useEffect(() => {
    if (i18n.language !== lang) {
      console.log(`[RendezVous] Syncing language from URL param: ${lang}, current: ${i18n.language}`);
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
  const [prescriptionFile, setPrescriptionFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string>('');
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [commentaires, setCommentaires] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

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

  // Gère le téléchargement de fichier d'ordonnance
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setPrescriptionFile(file);
    setFileError('');
    
    if (file) {
      // Valider le type de fichier
      const validTypes = ['image/jpeg', 'image/png', 'application/pdf'];
      if (!validTypes.includes(file.type)) {
        setFileError(t('invalid_file_type', { ns: 'appointment' }));
        setPrescriptionFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        setFilePreview(null);
        return;
      }
      
      // Valider la taille du fichier (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        setFileError(t('file_too_large', { ns: 'appointment' }));
        setPrescriptionFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        setFilePreview(null);
        return;
      }
      
      // Créer un aperçu pour les images
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setFilePreview(e.target?.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        setFilePreview(null); // Pas d'aperçu pour les PDFs
      }
    } else {
      setFilePreview(null);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    // Reset status states
    setSubmitSuccess(false);
    setSubmitError(null);
    
    // Validation simple
    if (!nom.trim() || !telephone.trim() || !selectedDate || !selectedTime) {
      alert(t('requiredFields', { ns: 'appointment' }));
      return;
    }
    
    setIsLoading(true);
    
    try {
      // 1. Upload prescription file if exists
      let downloadURL = null;
      
      if (prescriptionFile) {
        // Create a storage reference with a timestamp and original filename
        const timestamp = Date.now();
        const fileName = prescriptionFile.name;
        const storageRef = ref(storage, `ordonnances/${timestamp}-${fileName}`);
        
        // Upload the file
        await uploadBytes(storageRef, prescriptionFile);
        
        // Get download URL
        downloadURL = await getDownloadURL(storageRef);
      }
      
      // 2. Format date for Firestore
      const formattedDate = selectedDate ? format(selectedDate, "dd/MM/yyyy") : "";
      
      // 3. Prepare data for Firestore
      const appointmentData = {
        name: nom,
        phone: telephone,
        email: email || null,
        desiredDate: formattedDate,
        desiredTime: selectedTime,
        comments: commentaires || "",
        prescriptionImageUrl: downloadURL,
        submittedAt: serverTimestamp(),
        status: "new_appointment_request",
        type: "lab_appointment"
      };
      
      // 4. Save to Firestore
      await addDoc(collection(db, "appointmentRequests"), appointmentData);
      
      // 5. Show success message
      setSubmitSuccess(true);
      
      // 6. Reset the form
      setNom('');
      setTelephone('');
      setEmail('');
      setSelectedDate(new Date());
      setSelectedTime('');
      setPrescriptionFile(null);
      setFilePreview(null);
      setCommentaires('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      
    } catch (error) {
      console.error("Error submitting appointment request:", error);
      setSubmitError(t('appointment_request_error', { ns: 'appointment' }));
    } finally {
      setIsLoading(false);
    }
    // Formatage de la date
    const formattedDate = selectedDate ? format(selectedDate, "dd/MM/yyyy") : "";
    const laboEmail = "laboelallali@gmail.com";
    const sujet = `${t('emailSubject', { ns: 'appointment' })} - ${nom}`;
    
    // Créer le texte du message non-encodé (lisible)
    const messageText = t('emailBody', {
      name: nom,
      phone: telephone,
      email: email ? `\nEmail : ${email}` : '',
      date: formattedDate,
      time: selectedTime,
      comments: commentaires ? `\n${t('comments', { ns: 'appointment' })} : ${commentaires}` : '',
      prescription: prescriptionFile ? `\n${t('withPrescription', { ns: 'appointment' })}` : `\n${t('withoutPrescription', { ns: 'appointment' })}`
    });
    
    // Fonction pour afficher l'alerte avec les instructions et le bouton de copie
    function showEmailAlert() {
      // Essayer de copier le texte dans le presse-papier
      const copyToClipboard = () => {
        try {
          navigator.clipboard.writeText(messageText).then(() => {
            alert(t('messageCopied', { ns: 'appointment' }));
          }).catch(() => {
            // Fallback si le navigateur n'autorise pas clipboard API
            showCopyInstructions();
          });
        } catch {
          // Fallback pour les navigateurs sans support de l'API clipboard
          showCopyInstructions();
        }
      };
      
      // Afficher les instructions pour la sélection manuelle
      const showCopyInstructions = () => {
        alert(`${t('emailInstructions', { ns: 'appointment' })} : ${laboEmail}\n\n${t('emailSubject', { ns: 'appointment' })} : ${sujet}\n\n${messageText}`);
      };

      // Demander si l'utilisateur souhaite copier le message automatiquement
      copyToClipboard();
    }
    
    // Maintenant géré par le téléchargement Firebase et l'enregistrement Firestore
    // Remarque : Le code ci-dessus est conservé comme référence pour le moment mais n'est plus exécuté
  };

  // Génère le lien WhatsApp avec message prérempli
  const handleWhatsapp = () => {
    if (!nom.trim() || !telephone.trim() || !selectedDate || !selectedTime) {
      alert(t('requiredFields', { ns: 'appointment' }));
      return;
    }
    const formattedDate = selectedDate ? format(selectedDate, "dd/MM/yyyy") : "";
    const message = t('emailBody', {
      name: nom,
      phone: telephone,
      email: email ? `\nEmail : ${email}` : '',
      date: formattedDate,
      time: selectedTime,
      comments: commentaires ? `\n${t('comments', { ns: 'appointment' })} : ${commentaires}` : '',
      prescription: prescriptionFile ? `\n${t('withPrescription', { ns: 'appointment' })}` : `\n${t('withoutPrescription', { ns: 'appointment' })}`
    });
    const whatsappLink = `https://wa.me/${laboWhatsapp}?text=${encodeURIComponent(message)}`;
    window.open(whatsappLink, '_blank');
    
    // Également enregistrer dans Firebase pour le suivi
    try {
      setIsLoading(true);
      
      const appointmentData = {
        name: nom,
        phone: telephone,
        email: email || null,
        desiredDate: formattedDate,
        desiredTime: selectedTime,
        comments: commentaires || "",
        prescriptionImageUrl: null, // Pas de fichier pour WhatsApp - il sera envoyé directement
        submittedAt: serverTimestamp(),
        status: "whatsapp_appointment_request",
        type: "lab_appointment"
      };
      
      addDoc(collection(db, "appointmentRequests"), appointmentData)
        .catch(error => console.error("Error saving WhatsApp request to Firestore:", error))
        .finally(() => setIsLoading(false));
    } catch (error) {
      console.error("Error saving WhatsApp request:", error);
      setIsLoading(false);
    }
  };

  return (
    <main className="p-4 md:p-8 font-sans">
      <h1 className="text-3xl font-bold text-[var(--primary-bordeaux)] mb-6 font-['Inter','Public Sans',sans-serif]">
        {t('appointment', { ns: 'appointment' })}
      </h1>
      {submitSuccess && (
        <div className="max-w-lg mx-auto mb-6 p-4 bg-green-100 border border-green-200 text-green-800 rounded-md">
          {t('appointment_request_success', { ns: 'appointment' })}
        </div>
      )}
      
      {submitError && (
        <div className="max-w-lg mx-auto mb-6 p-4 bg-red-100 border border-red-200 text-red-800 rounded-md">
          {submitError}
        </div>
      )}
      
      <form className="max-w-lg mx-auto" onSubmit={handleSubmit}>
        {/* Nom complet */}
        <div className="mb-4">
          <label htmlFor="nomComplet" className="block text-sm font-medium text-[var(--primary-bordeaux)] mb-1">
            {t('fullName', { ns: 'appointment' })}
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
            {t('phoneNumber', { ns: 'appointment' })}
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
            {t('email', { ns: 'appointment' })}
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
        {/* Date souhaitée */}
        <div className="mb-4">
          <label htmlFor="date" className="block text-sm font-medium text-[var(--primary-bordeaux)] mb-1">
            {t('desiredDate', { ns: 'appointment' })}
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
            {t('desiredTime', { ns: 'appointment' })}
          </label>
          <select
            id="heure"
            name="heure"
            value={selectedTime}
            onChange={(e) => setSelectedTime(e.target.value)}
            className="w-full p-2 border border-[var(--gray-300)] rounded-md shadow-sm focus:ring-[var(--accent-fuchsia)] focus:border-[var(--accent-fuchsia)]"
            required
          >
            <option value="">{t('chooseTime', { ns: 'appointment' })}</option>
            {timeSlots.map((slot) => (
              <option key={slot} value={slot}>{slot}</option>
            ))}
          </select>
        </div>

        {/* Téléchargement d'ordonnance */}
        <div className="mb-4">
          <label htmlFor="prescriptionFile" className="block text-sm font-medium text-[var(--primary-bordeaux)] mb-1">
            {t('prescription_upload_label', { ns: 'appointment' })}
          </label>
          <input
            type="file"
            id="prescriptionFile"
            name="prescriptionFile"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".jpg,.jpeg,.png,.pdf"
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4
              file:rounded-md file:border-0 file:text-sm file:font-semibold
              file:bg-[var(--accent-fuchsia)] file:text-white hover:file:bg-[var(--fuchsia-bright)]
              file:cursor-pointer file:transition-colors"
          />
          {fileError && (
            <p className="mt-1 text-sm text-red-600">{fileError}</p>
          )}
          {prescriptionFile && !fileError && (
            <div className="mt-2">
              <p className="text-sm text-gray-600">{t('file_selected', { ns: 'appointment' })} {prescriptionFile.name}</p>
              {filePreview && (
                <div className="mt-2 max-w-xs">
                  <img 
                    src={filePreview} 
                    alt="Aperçu"
                    className="h-24 object-contain border border-gray-200 rounded-md" 
                  />
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Commentaires (optionnel) */}
        <div className="mb-4">
          <label htmlFor="commentaires" className="block text-sm font-medium text-[var(--primary-bordeaux)] mb-1">
            {t('comments', { ns: 'appointment' })}
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
            disabled={isLoading}
            className={`bg-[var(--accent-fuchsia)] text-white font-semibold py-2 px-4 rounded-lg hover:bg-[var(--fuchsia-bright)] transition-colors w-full md:w-auto flex items-center justify-center gap-2 ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {isLoading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {t('submitting', { ns: 'appointment' })}
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
                {t('submit_appointment_request', { ns: 'appointment' })}
              </>
            )}
          </button>
          <button
            type="button"
            onClick={handleWhatsapp}
            className="bg-green-500 text-white font-semibold py-2 px-4 rounded-lg hover:bg-green-600 transition-colors w-full md:w-auto flex items-center justify-center gap-2"
            aria-label={t('requestByWhatsApp', { ns: 'appointment' })}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16" className="w-5 h-5">
              <path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z"/>
            </svg>
            {t('requestByWhatsApp', { ns: 'appointment' })}
          </button>
        </div>
      </form>
    </main>
  );
}
