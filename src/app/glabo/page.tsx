"use client";

import React, { useState, useEffect } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { fr, ar } from "date-fns/locale";
import { format } from "date-fns";
import { useTranslation } from 'react-i18next';
import { useParams } from 'next/navigation';

const GlaboPage = () => {
  const params = useParams();
  const { t, i18n } = useTranslation(['common']);
  const currentLang = params.lang as string || 'fr';
  
  const [nom, setNom] = useState('');
  const [telephone, setTelephone] = useState('');
  const [email, setEmail] = useState('');
  const [adresse, setAdresse] = useState('');
  const [lieuPrelevement, setLieuPrelevement] = useState('domicile'); // 'domicile' ou 'travail'
  const [instructionsAcces, setInstructionsAcces] = useState(''); // Pour code d'immeuble, etc.
  const [geolocStatus, setGeolocStatus] = useState(''); // Pour afficher "Chargement...", "Erreur...", ou l'adresse trouvée
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [selectedTime, setSelectedTime] = useState('');
  const [hasOrdonnance, setHasOrdonnance] = useState('non'); // 'oui' ou 'non'
  const [commentaires, setCommentaires] = useState('');
  
  // Set i18n language
  useEffect(() => {
    if (i18n.language !== currentLang) {
      i18n.changeLanguage(currentLang);
    }
  }, [currentLang, i18n]);

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

  // Fonction de géolocalisation
  const handleGeolocate = () => {
    // Vérifie si la géolocalisation est supportée par le navigateur
    if (!navigator.geolocation) {
      setGeolocStatus(t('geolocation_not_supported', "La géolocalisation n'est pas supportée par votre navigateur."));
      return;
    }
    
    // Affiche le statut de chargement
    setGeolocStatus(t('loading_location', "Chargement de la localisation..."));
    
    // Options pour la géolocalisation (haute précision, timeout de 10s)
    const options = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    };
    
    // Fonction de succès
    const success = (position: GeolocationPosition) => {
      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;
      
      // Créer un lien Google Maps avec les coordonnées
      const googleMapsLink = `https://www.google.com/maps?q=${latitude},${longitude}`;
      
      setGeolocStatus(t('location_found', "Localisation approximative trouvée."));
      setAdresse(t('coordinates_text', `Coordonnées : Lat: {{lat}}, Lon: {{lon}}\nLien Google Maps: {{link}}\nVeuillez compléter votre adresse ci-dessus si nécessaire.`, {
        lat: latitude.toFixed(6),
        lon: longitude.toFixed(6),
        link: googleMapsLink
      }));
    };
    
    // Fonction d'erreur
    const error = (err: GeolocationPositionError) => {
      let errorMessage = "";
      switch (err.code) {
        case err.PERMISSION_DENIED:
          errorMessage = t('permission_denied', "Vous avez refusé l'accès à votre position.");
          break;
        case err.POSITION_UNAVAILABLE:
          errorMessage = t('position_unavailable', "Les informations de localisation ne sont pas disponibles.");
          break;
        case err.TIMEOUT:
          errorMessage = t('timeout', "La demande de localisation a expiré.");
          break;
        default:
          errorMessage = t('unknown_error', `Erreur inconnue: {{message}}`, { message: err.message });
      }
      setGeolocStatus(t('geolocation_error', `Erreur de géolocalisation: {{errorMessage}}`, { errorMessage }));
    };
    
    // Lance la géolocalisation
    navigator.geolocation.getCurrentPosition(success, error, options);
  };

  // Soumission du formulaire : génère un mailto: avec toutes les infos
  const laboWhatsapp = "212654079592"; // Numéro en format international sans +
  
  // Fonction pour extraire le lien Google Maps des coordonnées, s'il existe
  const extractGoogleMapsLink = (addressText: string): string | null => {
    const googleMapsLinkMatch = addressText.match(/https:\/\/www\.google\.com\/maps\?q=[-+]?[0-9]*\.?[0-9]+,[-+]?[0-9]*\.?[0-9]+/);
    return googleMapsLinkMatch ? googleMapsLinkMatch[0] : null;
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    // Validation simple
    if (!nom.trim() || !telephone.trim() || !selectedDate || !selectedTime) {
      alert(t('required_fields_alert', "Veuillez remplir tous les champs obligatoires (nom, téléphone, date, heure)."));
      return;
    }
    
    // Formatage de la date
    const formattedDate = selectedDate ? format(selectedDate, "dd/MM/yyyy") : "";
    const laboEmail = "laboelallali@gmail.com";
    const sujet = t('glabo_request_subject', `Demande de Prélèvement GLABO - {{name}}`, { name: nom });
    
    // Extraction du lien Google Maps s'il existe dans l'adresse
    const googleMapsLink = extractGoogleMapsLink(adresse);
    
    // Formattage de l'adresse pour le message
    let formattedAddress = adresse;
    if (googleMapsLink) {
      // Si un lien Google Maps est trouvé, le mettre en évidence pour le staff du laboratoire
      formattedAddress = adresse.replace(googleMapsLink, 
        `${googleMapsLink} ⇖ ${t('click_for_maps', "CLIQUEZ SUR CE LIEN POUR OUVRIR GOOGLE MAPS")}`);
    }
    
    // Déterminer le texte du lieu de prélèvement
    const samplingPlaceText = lieuPrelevement === 'domicile' 
      ? t('at_home', 'À mon domicile')
      : t('at_work', 'Sur mon lieu de travail');
      
    // Création du message pour la demande GLABO
    const messageText = t('glabo_email_template', 
      `Bonjour,

Je souhaite demander un prélèvement à domicile/travail (GLABO) :

Nom : {{name}}
Téléphone : {{phone}}{{email}}
Lieu du prélèvement : {{samplingPlace}}
{{address}}{{accessInstructions}}
Date souhaitée : {{date}}
Heure souhaitée : {{time}}{{comments}}

{{prescription}}

Merci de me contacter pour confirmer les détails.

Cordialement.`, 
      {
        name: nom,
        phone: telephone,
        email: email ? `\nEmail : ${email}` : '',
        samplingPlace: samplingPlaceText,
        address: formattedAddress ? `Adresse : ${formattedAddress}` : t('address_not_specified', 'Adresse non spécifiée (à confirmer par téléphone).'),
        accessInstructions: instructionsAcces ? `\nInstructions d'accès : ${instructionsAcces}` : '',
        date: formattedDate,
        time: selectedTime,
        comments: commentaires ? `\nCommentaires : ${commentaires}` : '',
        prescription: hasOrdonnance === 'oui' 
          ? t('have_prescription', `J'ai une ordonnance et je vous l'enverrai en pièce jointe dans mon email.`)
          : t('no_prescription', "Je n'ai pas d'ordonnance.")
      }
    );
    
    // Fonction pour afficher l'alerte avec les instructions et le bouton de copie
    function showEmailAlert() {
      // Essayer de copier le texte dans le presse-papier
      const copyToClipboard = () => {
        try {
          navigator.clipboard.writeText(messageText).then(() => {
            alert("Message copié dans le presse-papier ! Vous pouvez maintenant le coller dans votre client email.");
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
        alert(`Veuillez envoyer un email à : ${laboEmail}\n\nSujet : ${sujet}\n\nEt copiez ce message dans le corps de l'email :\n\n${messageText}`);
      };

      // Demander si l'utilisateur souhaite copier le message automatiquement
      if (confirm(`Il semble que l'ouverture automatique de votre client email n'a pas fonctionné.\n\nVoulez-vous copier le message dans le presse-papier ?\n(Cliquez sur OK pour copier, sur Annuler pour voir le message à copier manuellement)`)) {
        copyToClipboard();
      } else {
        showCopyInstructions();
      }
    }
    
    // Essayer de lancer le client email natif
    try {
      const encodedBody = encodeURIComponent(messageText);
      const encodedSubject = encodeURIComponent(sujet);
      const mailtoLink = `mailto:${laboEmail}?subject=${encodedSubject}&body=${encodedBody}`;
      
      window.location.href = mailtoLink;
      
      setTimeout(() => {
        showEmailAlert();
      }, 500);
    } catch {
      showEmailAlert();
    }
  };

  // Génère le lien WhatsApp avec message prérempli
  const handleWhatsapp = () => {
    if (!nom.trim() || !telephone.trim() || !selectedDate || !selectedTime) {
      alert("Veuillez remplir tous les champs obligatoires (nom, téléphone, date, heure).");
      return;
    }
    
    const formattedDate = selectedDate ? format(selectedDate, "dd/MM/yyyy") : "";
    
    // Extraction du lien Google Maps s'il existe dans l'adresse
    const googleMapsLink = extractGoogleMapsLink(adresse);
    
    // Formattage de l'adresse pour le message
    let formattedAddress = adresse;
    if (googleMapsLink) {
      // Si un lien Google Maps est trouvé, le mettre en évidence pour le staff du laboratoire
      formattedAddress = adresse.replace(googleMapsLink, 
        `${googleMapsLink} ⇖ ${t('click_for_maps', "CLIQUEZ SUR CE LIEN POUR OUVRIR GOOGLE MAPS")}`);
    }

    // Déterminer le texte pour le lieu de prélèvement
    const samplingPlaceText = lieuPrelevement === 'domicile' 
      ? t('at_home', 'À mon domicile')
      : t('at_work', 'Sur mon lieu de travail');

    const placeSummary = lieuPrelevement === 'domicile' 
      ? t('home_sampling', 'à domicile')
      : t('work_sampling', 'sur mon lieu de travail');
    
    // Construction du message WhatsApp avec traductions
    const message = t('whatsapp_message_template',
      `Bonjour, je souhaite demander un prélèvement {{place}} (GLABO).
Nom : {{name}}
Téléphone : {{phone}}{{email}}
Lieu du prélèvement : {{samplingPlace}}
{{address}}{{accessInstructions}}
Date souhaitée : {{date}}
Heure souhaitée : {{time}}{{comments}}
{{prescription}}`,
      {
        place: placeSummary,
        name: nom,
        phone: telephone,
        email: email ? `\nEmail : ${email}` : '',
        samplingPlace: samplingPlaceText,
        address: formattedAddress ? `Adresse : ${formattedAddress}` : t('address_not_specified', 'Adresse non spécifiée (à confirmer par téléphone).'),
        accessInstructions: instructionsAcces ? `\nInstructions d'accès : ${instructionsAcces}` : '',
        date: formattedDate,
        time: selectedTime,
        comments: commentaires ? `\nCommentaires : ${commentaires}` : '',
        prescription: hasOrdonnance === 'oui' 
          ? t('have_prescription_whatsapp', `Je dispose d'une ordonnance que je vous enverrai séparément par WhatsApp.`)
          : t('no_prescription', "Je n'ai pas d'ordonnance.")
      }
    );
    
    const whatsappLink = `https://wa.me/${laboWhatsapp}?text=${encodeURIComponent(message)}`;
    window.open(whatsappLink, '_blank');
  };

  // Gestion de la sélection de l'option ordonnance
  const handleOrdonnanceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setHasOrdonnance(e.target.value);
  };

  // Déterminer la locale pour le DatePicker en fonction de la langue
  const dateLocale = currentLang === 'ar' ? ar : fr;
  const isRTL = currentLang === 'ar';
  
  return (
    <main className={`p-4 md:p-8 font-sans ${isRTL ? 'rtl' : 'ltr'}`}>
      <h1 className="text-3xl font-bold text-[var(--primary-bordeaux)] mb-6 font-['Inter','Public Sans',sans-serif]">
        {t('glabo_title', 'Demander un prélèvement à domicile ou au travail (GLABO)')}
      </h1>
      <form className="max-w-lg mx-auto" onSubmit={handleSubmit}>
        {/* Nom complet */}
        <div className="mb-4">
          <label htmlFor="nomComplet" className="block text-sm font-medium text-[var(--primary-bordeaux)] mb-1">
            {t('name', "Nom complet")}
          </label>
          <input
            type="text"
            id="nomComplet"
            name="nomComplet"
            className="w-full p-2 border border-[var(--gray-300)] rounded-md shadow-sm focus:ring-[var(--accent-fuchsia)] focus:border-[var(--accent-fuchsia)]"
            autoComplete="name"
            value={nom}
            onChange={e => setNom(e.target.value)}
          />
        </div>
        {/* Numéro de téléphone */}
        <div className="mb-4">
          <label htmlFor="telephone" className="block text-sm font-medium text-[var(--primary-bordeaux)] mb-1">
            {t('phone', "Numéro de téléphone")}
          </label>
          <input
            type="tel"
            id="telephone"
            name="telephone"
            className="w-full p-2 border border-[var(--gray-300)] rounded-md shadow-sm focus:ring-[var(--accent-fuchsia)] focus:border-[var(--accent-fuchsia)]"
            autoComplete="tel"
            inputMode="tel"
            value={telephone}
            onChange={e => setTelephone(e.target.value)}
          />
        </div>
        {/* Adresse email (optionnel) */}
        <div className="mb-4">
          <label htmlFor="email" className="block text-sm font-medium text-[var(--primary-bordeaux)] mb-1">
            {t('email', "Adresse e-mail")} ({t('optional', "optionnel")})
          </label>
          <input
            type="email"
            id="email"
            name="email"
            className="w-full p-2 border border-[var(--gray-300)] rounded-md shadow-sm focus:ring-[var(--accent-fuchsia)] focus:border-[var(--accent-fuchsia)]"
            autoComplete="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
        </div>
        {/* Lieu du prélèvement */}
        <div className="mb-4">
          <label htmlFor="lieuPrelevement" className="block text-sm font-medium text-[var(--primary-bordeaux)] mb-1">
            {t('sampling_place', "Lieu de prélèvement")}
          </label>
          <select
            id="lieuPrelevement"
            name="lieuPrelevement"
            value={lieuPrelevement}
            onChange={e => setLieuPrelevement(e.target.value)}
            className="w-full p-2 border border-[var(--gray-300)] rounded-md shadow-sm focus:ring-[var(--accent-fuchsia)] focus:border-[var(--accent-fuchsia)]"
          >
            <option value="domicile">{t('at_home', "À mon domicile")}</option>
            <option value="travail">{t('at_work', "Sur mon lieu de travail")}</option>
          </select>
        </div>
        {/* Adresse de prélèvement (optionnel) */}
        <div className="mb-4">
          <label htmlFor="adresse" className="block text-sm font-medium text-[var(--primary-bordeaux)] mb-1">
            {t('address_instructions', "Adresse (indiquez pour le prélèvement)")}
          </label>
          <textarea
            id="adresse"
            name="adresse"
            rows={2}
            className="w-full p-2 border border-[var(--gray-300)] rounded-md shadow-sm focus:ring-[var(--accent-fuchsia)] focus:border-[var(--accent-fuchsia)]"
            value={adresse}
            onChange={e => setAdresse(e.target.value)}
          />
          <button 
            type="button" 
            onClick={handleGeolocate}
            className="text-sm text-[var(--accent-fuchsia)] hover:underline mt-2 flex items-center gap-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
            </svg>
            {t('locate_position', "Localisez-moi (Optionnel)")}
          </button>
          {geolocStatus && (
            <p className="text-xs text-gray-600 mt-1">{geolocStatus}</p>
          )}
        </div>
        {/* Instructions d'accès (optionnel) */}
        <div className="mb-4">
          <label htmlFor="instructionsAcces" className="block text-sm font-medium text-[var(--primary-bordeaux)] mb-1">
            {t('access_instructions', "Instructions d'accès (code immeuble, étage, etc.")} - {t('optional', "optionnel")}
          </label>
          <input
            type="text"
            id="instructionsAcces"
            name="instructionsAcces"
            className="w-full p-2 border border-[var(--gray-300)] rounded-md shadow-sm focus:ring-[var(--accent-fuchsia)] focus:border-[var(--accent-fuchsia)]"
            value={instructionsAcces}
            onChange={e => setInstructionsAcces(e.target.value)}
          />
        </div>
        {/* Date souhaitée */}
        <div className="mb-4">
          <label htmlFor="date" className="block text-sm font-medium text-[var(--primary-bordeaux)] mb-1">
            {t('desired_date', "Date souhaitée")}
          </label>
          <DatePicker
            id="date"
            selected={selectedDate}
            onChange={(date: Date | null) => setSelectedDate(date)}
            dateFormat="dd/MM/yyyy"
            minDate={new Date()}
            locale={dateLocale}
            placeholderText={t('date_placeholder', "Sélectionnez une date")}
            className="w-full p-2 border border-[var(--gray-300)] rounded-md shadow-sm focus:ring-[var(--accent-fuchsia)] focus:border-[var(--accent-fuchsia)]"
          />
        </div>
        {/* Heure souhaitée */}
        <div className="mb-4">
          <label htmlFor="heure" className="block text-sm font-medium text-[var(--primary-bordeaux)] mb-1">
            {t('desired_time', "Heure souhaitée")}
          </label>
          <select
            id="heure"
            name="heure"
            value={selectedTime}
            onChange={e => setSelectedTime(e.target.value)}
            className="w-full p-2 border border-[var(--gray-300)] rounded-md shadow-sm focus:ring-[var(--accent-fuchsia)] focus:border-[var(--accent-fuchsia)]"
          >
            <option value="" disabled>{t('choose_time', "-- Choisissez une heure --")}</option>
            {timeSlots.map((slot) => (
              <option key={slot} value={slot}>{slot}</option>
            ))}
          </select>
        </div>
        {/* Ordonnance (optionnel) */}
        <div className="mb-4">
          <label htmlFor="ordonnance" className="block text-sm font-medium text-[var(--primary-bordeaux)] mb-1">
            {t('prescription_question', "Avez-vous une ordonnance ?")}
          </label>
          <select
            id="ordonnance"
            name="ordonnance"
            value={hasOrdonnance}
            onChange={handleOrdonnanceChange}
            className="w-full p-2 border border-[var(--gray-300)] rounded-md shadow-sm focus:ring-[var(--accent-fuchsia)] focus:border-[var(--accent-fuchsia)]"
          >
            <option value="non">{t('no', "Non")}</option>
            <option value="oui">{t('yes', "Oui")}</option>
          </select>
          {hasOrdonnance === 'oui' && (
            <p className="text-xs text-gray-500 mt-1">
              {t('prescription_note', "Note : N'oubliez pas de joindre votre ordonnance lors de l'envoi de votre email ou message WhatsApp.")}
            </p>
          )}
        </div>
        {/* Commentaires (optionnel) */}
        <div className="mb-4">
          <label htmlFor="commentaires" className="block text-sm font-medium text-[var(--primary-bordeaux)] mb-1">
            {t('comments', "Notes ou commentaires supplémentaires")} ({t('optional', "optionnel")})
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
            {t('send_request_email', "Envoyer ma demande de prélèvement par email")}
          </button>
          <button
            type="button"
            onClick={handleWhatsapp}
            className="bg-green-500 text-white font-semibold py-2 px-4 rounded-lg hover:bg-green-600 transition-colors w-full md:w-auto flex items-center justify-center gap-2"
            aria-label="Demander prélèvement par WhatsApp"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16" className="w-5 h-5">
              <path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z"/>
            </svg>
            {t('send_whatsapp', "Demander prélèvement par WhatsApp")}
          </button>
        </div>
        {/* Rappel ordonnance */}
        <div className="mt-4 text-sm text-[var(--primary-bordeaux)] bg-[var(--gray-100)] rounded-lg px-4 py-2 border border-[var(--gray-300)]">
          <strong>{t('reminder', "Rappel")}&nbsp;:</strong> {t('prescription_reminder', "Si vous avez une ordonnance, n'oubliez pas de l'attacher à votre email ou à votre message WhatsApp")}!
        </div>
      </form>
    </main>
  );
};

export default GlaboPage;
