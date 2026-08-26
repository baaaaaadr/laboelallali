/**
 * Application-wide contact information constants
 */

// Note: LAB_NAME and LAB_ADDRESS are now managed through translations
// Use useTranslation hook in components to get these values:
// const { t } = useTranslation('common');
// const labName = t('laboratory_name');
// const labAddress = t('laboratory_address');

export const LAB_NAME = "laboratory_name"; // Translation key
export const LAB_NAME_SHORT = "laboratory_name_short"; // Translation key
export const LAB_ADDRESS = "laboratory_address"; // Translation key

export const LAB_COORDINATES = {
  LATITUDE: 30.4173116,
  LONGITUDE: -9.589799900000001,
  GOOGLE_MAPS_URL: "https://maps.app.goo.gl/NUiSsY2AQjeNHcDeA"
};

export const LAB_CONTACT = {
  LANDLINE: {
    display: "0528843384",
    url: "tel:0528843384"
  },
  WHATSAPP: [
    {
      display: "0654079592",
      url: "https://wa.me/212654079592"
    }
  ],
  COMPANIES: {
    display: "0661208635",
    url: "tel:0661208635"
  },
  // Dr El Allali's own WhatsApp — for a medical question, answered by him.
  // Deliberately distinct from WHATSAPP above (the front desk) and from
  // COMPANIES (0661208635 — close-looking number, NOT the same one).
  // No "+" in a wa.me URL.
  DR_WHATSAPP: {
    display: "0661291411",
    url: "https://wa.me/212661291411"
  },
  FAX: "0528828758",
  EMAIL: {
    display: "laboelallali@gmail.com",
    url: "mailto:laboelallali@gmail.com"
  },
  WHATSAPP_ID: "212654079592",
  WHATSAPP_TEL: "tel:0654079592"
};

// Opening hours are NOT duplicated here anymore: the machine-readable schedule
// lives in `./labHours` and the text shown to patients comes from the
// `monday_to_friday` / `saturday_hours` translation keys (fr + ar).

// Default WhatsApp number (first number from the WHATSAPP array)
export const LAB_WHATSAPP_NUMBER = LAB_CONTACT.WHATSAPP[0].display;

// Canonical public site URL (matches the domain used in the lab's PDFs).
export const LAB_SITE_URL = "https://www.laboelallali.com";
