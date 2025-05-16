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
      display: "0634293900",
      url: "https://wa.me/212634293900"
    },
    {
      display: "0707291873",
      url: "https://wa.me/212707291873"
    }
  ],
  COMPANIES: {
    display: "0664727681",
    url: "tel:0664727681"
  },
  FAX: "0528828758",
  EMAIL: {
    display: "laboelallali@gmail.com",
    url: "mailto:laboelallali@gmail.com"
  }
};

export const LAB_HOURS = {
  WEEKDAYS: "Lundi au Samedi: 7h30 à 18h30",
  SUNDAY: "Dimanche: 08h00 à 18h00"
};

// Default WhatsApp number (first number from the WHATSAPP array)
export const LAB_WHATSAPP_NUMBER = LAB_CONTACT.WHATSAPP[0].display;
