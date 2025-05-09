"use client";

import React, { useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { fr } from "date-fns/locale";
import { format } from "date-fns";

const RendezVousPage = () => {
  const [nom, setNom] = useState('');
  const [telephone, setTelephone] = useState('');
  const [email, setEmail] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [selectedTime, setSelectedTime] = useState('');

  const [commentaires, setCommentaires] = useState('');

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

  // Soumission du formulaire : génère un mailto: avec toutes les infos
  
const laboWhatsapp = "212654079592"; // Numéro en format international sans +

const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    // Validation simple
    if (!nom.trim() || !telephone.trim() || !selectedDate || !selectedTime) {
      alert("Veuillez remplir tous les champs obligatoires (nom, téléphone, date, heure).");
      return;
    }
    // Formatage de la date
    const formattedDate = selectedDate ? format(selectedDate, "dd/MM/yyyy") : "";
    const laboEmail = "laboelallali@gmail.com";
    const sujet = `Demande de Rendez-vous - ${nom}`;
    
    // Créer le texte du message non-encodé (lisible)
    const messageText = `Bonjour,

Je souhaite prendre un rendez-vous au laboratoire :

Nom : ${nom}
Téléphone : ${telephone}${email ? `
Email : ${email}` : ''}
Date souhaitée : ${formattedDate}
Heure souhaitée : ${selectedTime}${commentaires ? `
Commentaires : ${commentaires}` : ''}

Merci.`;
    
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
        } catch (e) {
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
    
    // Essayer de lancer le client email natif (pour les utilisateurs sur mobile ou avec client email configuré)
    try {
      // Approche sécurisée et simplifiée qui ne crée pas de fenêtre vide
      const encodedBody = encodeURIComponent(messageText);
      const encodedSubject = encodeURIComponent(sujet);
      const mailtoLink = `mailto:${laboEmail}?subject=${encodedSubject}&body=${encodedBody}`;
      
      // Utiliser l'API Location plutôt que window.open pour éviter les fenêtres vides
      window.location.href = mailtoLink;
      
      // Attendre un court instant puis afficher les instructions de secours
      setTimeout(() => {
        showEmailAlert();
      }, 500);
    } catch (error) {
      // En cas d'erreur, afficher directement l'alerte
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
    const message = `Bonjour, je souhaite prendre un rendez-vous au laboratoire.\nNom : ${nom}\nTéléphone : ${telephone}${email ? `\nEmail : ${email}` : ''}\nDate souhaitée : ${formattedDate}\nHeure souhaitée : ${selectedTime}${commentaires ? `\nCommentaires : ${commentaires}` : ''}`;
    const whatsappLink = `https://wa.me/${laboWhatsapp}?text=${encodeURIComponent(message)}`;
    window.open(whatsappLink, '_blank');
  };

  return (
    <main className="p-4 md:p-8 font-sans">
      <h1 className="text-3xl font-bold text-[var(--primary-bordeaux)] mb-6 font-['Inter','Public Sans',sans-serif]">
        Prendre un rendez-vous au laboratoire
      </h1>
      <form className="max-w-lg mx-auto" onSubmit={handleSubmit}>
        {/* Nom complet */}
        <div className="mb-4">
          <label htmlFor="nomComplet" className="block text-sm font-medium text-[var(--primary-bordeaux)] mb-1">
            Nom complet
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
            Numéro de téléphone
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
            Adresse email (optionnel)
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
        {/* Date souhaitée */}
        <div className="mb-4">
          <label htmlFor="date" className="block text-sm font-medium text-[var(--primary-bordeaux)] mb-1">
            Date souhaitée
          </label>
          <DatePicker
            id="date"
            selected={selectedDate}
            onChange={(date: Date | null) => setSelectedDate(date)}
            dateFormat="dd/MM/yyyy"
            minDate={new Date()}
            locale={fr}
            placeholderText="Sélectionnez une date"
            className="w-full p-2 border border-[var(--gray-300)] rounded-md shadow-sm focus:ring-[var(--accent-fuchsia)] focus:border-[var(--accent-fuchsia)]"
          />
        </div>
        {/* Heure souhaitée */}
        <div className="mb-4">
          <label htmlFor="heure" className="block text-sm font-medium text-[var(--primary-bordeaux)] mb-1">
            Heure souhaitée
          </label>
          <select
            id="heure"
            name="heure"
            value={selectedTime}
            onChange={e => setSelectedTime(e.target.value)}
            className="w-full p-2 border border-[var(--gray-300)] rounded-md shadow-sm focus:ring-[var(--accent-fuchsia)] focus:border-[var(--accent-fuchsia)]"
          >
            <option value="" disabled>-- Choisissez une heure --</option>
            {timeSlots.map((slot) => (
              <option key={slot} value={slot}>{slot}</option>
            ))}
          </select>
        </div>

        {/* Commentaires (optionnel) */}
        <div className="mb-4">
          <label htmlFor="commentaires" className="block text-sm font-medium text-[var(--primary-bordeaux)] mb-1">
            Notes ou commentaires supplémentaires (optionnel)
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
            Envoyer ma demande de rdv par email
          </button>
          <button
            type="button"
            onClick={handleWhatsapp}
            className="bg-green-500 text-white font-semibold py-2 px-4 rounded-lg hover:bg-green-600 transition-colors w-full md:w-auto flex items-center justify-center gap-2"
            aria-label="Demander RDV par WhatsApp"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16" className="w-5 h-5">
              <path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z"/>
            </svg>
            Demander RDV par WhatsApp
          </button>
        </div>
        {/* Rappel ordonnance */}
        <div className="mt-4 text-sm text-[var(--primary-bordeaux)] bg-[var(--gray-100)] rounded-lg px-4 py-2 border border-[var(--gray-300)]">
          <strong>Rappel&nbsp;:</strong> Si vous avez une ordonnance, n&apos;oubliez pas de l&apos;attacher à votre email ou à votre message WhatsApp&nbsp;!
        </div>
      </form>
    </main>
  );
};

export default RendezVousPage;
