"use client";
import React from "react";
import { MapPin, Phone, Smartphone, Mail } from "lucide-react";
import dynamic from "next/dynamic";

// Dynamically import LocationMap with SSR disabled
const LocationMap = dynamic(
  () => import("@/components/features/maps/LocationMap"),
  { ssr: false }
);


const ContactPage = () => {
  return (
    <main className="p-4 md:p-8 bg-[var(--medical-background)] min-h-screen flex flex-col items-center">
      <div className="w-full max-w-4xl mx-auto">

      <h1 className="text-[var(--primary-bordeaux)] text-2xl font-bold mb-4">
        Nous Contacter et Informations du Laboratoire
      </h1>
      <section className="mt-8">
        <h2 className="text-2xl font-semibold text-[var(--bordeaux-dark)] mb-4">
          Coordonnées du Laboratoire
        </h2>
        <div className="space-y-4 bg-white rounded-xl shadow p-6 border border-[var(--gray-200)] max-w-xl">
          <a
            href="https://maps.app.goo.gl/NUiSsY2AQjeNHcDeA"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center text-base text-[var(--gray-800)] hover:text-[var(--primary-bordeaux)] transition-colors group"
          >
            <span className="mr-2 text-[var(--primary-bordeaux)]">
              <MapPin size={20} />
            </span>
            <span>
              <strong>Adresse :</strong> 61 Bis, Rue de Marrakech, 80020, Agadir
            </span>
          </a>
          <a
            href="tel:0528843384"
            className="flex items-center text-base text-[var(--gray-800)] hover:text-[var(--primary-bordeaux)] transition-colors group"
          >
            <span className="mr-2 text-[var(--primary-bordeaux)]">
              <Phone size={20} />
            </span>
            <span>
              <strong>Fixe :</strong> 0528843384
            </span>
          </a>
          <div className="flex flex-col gap-2">
            <div className="flex items-center text-base text-[var(--gray-800)] gap-2">
              <span className="mr-2 text-[var(--accent-fuchsia)]">
                <Smartphone size={20} />
              </span>
              <strong>WhatsApp :</strong>
              <a
                href="https://wa.me/2120634293900"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg font-semibold btn-primary shadow hover:scale-105 transition-transform text-white"
                style={{ background: 'var(--accent-fuchsia)' }}
              >
                0634293900
              </a>
              <a
                href="https://wa.me/2120707291873"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg font-semibold btn-primary shadow hover:scale-105 transition-transform text-white"
                style={{ background: 'var(--accent-fuchsia)' }}
              >
                0707291873
              </a>
            </div>
            <a
              href="tel:0664727681"
              className="flex items-center text-base text-[var(--gray-800)] hover:text-[var(--accent-fuchsia)] transition-colors group mt-2"
            >
              <span className="mr-2 text-[var(--accent-fuchsia)]">
                <Smartphone size={20} />
              </span>
              <span>
                <strong>Sociétés et autres :</strong> 0664727681
              </span>
            </a>
          </div>
          <a
            href="mailto:laboelallali@gmail.com"
            className="flex items-center text-base text-[var(--gray-800)] hover:text-[var(--primary-bordeaux)] transition-colors group"
          >
            <span className="mr-2 text-[var(--primary-bordeaux)]">
              <Mail size={20} />
            </span>
            <span>
              <strong>Email :</strong> laboelallali@gmail.com
            </span>
          </a>
          <div className="flex items-center text-base text-[var(--gray-800)] mt-1">
            <span className="mr-2 text-[var(--primary-bordeaux)]">
              <Phone size={20} />
            </span>
            <span>
              <strong>Fax :</strong> 0528828758
            </span>
          </div>
        </div>
      </section>
      <section className="mt-8">
        <h2 className="text-2xl font-semibold text-[var(--bordeaux-dark)] mb-4">
          Horaires d&apos;Ouverture
        </h2>
        <div className="inline-block bg-white rounded-lg px-4 py-2 border border-[var(--gray-200)]">
          <div className="flex flex-col gap-1 text-base text-[var(--gray-800)]">
            <span><span className="font-medium">Lun-Sam :</span> 7h30 - 18h30</span>
            <span><span className="font-medium">Dim :</span> 08h00 - 18h00</span>
          </div>
        </div>
      </section>
      <section className="mt-8">
        <h2 className="text-2xl font-semibold text-[var(--bordeaux-dark)] mb-4">
          Notre Emplacement
        </h2>
        <div className="w-full h-64 md:h-80 rounded-lg border border-[var(--gray-300)] bg-[var(--gray-200)] overflow-hidden mb-4 relative">

          <LocationMap
            latitude={30.4173116}
            longitude={-9.589799900000001}
            name="Laboratoire El Allali"
            address="61 bis, Rue de Marrakech, 80020 Quartier Industriel, Agadir, Maroc"
          />
        </div>
        <div className="flex flex-col sm:flex-row gap-3 mt-2">
          <a
            href="https://maps.app.goo.gl/NUiSsY2AQjeNHcDeA"
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-2 bg-[var(--primary-bordeaux)] text-white font-semibold rounded-lg shadow hover:bg-[var(--bordeaux-dark)] transition-colors text-center"
          >
            Ouvrir dans Google Maps
          </a>
          <a
            href="https://www.google.com/maps/dir/?api=1&destination=61+Bis+Rue+de+Marrakech+80020+Agadir"
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-2 bg-[var(--accent-fuchsia)] text-white font-semibold rounded-lg shadow hover:bg-pink-700 transition-colors text-center"
          >
            Naviguer vers le labo
          </a>
        </div>
      </section>
      </div>
    </main>
  );
};

export default ContactPage;
