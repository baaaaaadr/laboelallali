// src/custom.d.ts
declare module 'accept-language' {
  interface AcceptLanguage {
    languages: (supportedLanguages: string[]) => void;
    get: (header: string | string[] | null | undefined) => string | null;
  }
  const acceptLanguage: AcceptLanguage;
  export default acceptLanguage;
}

// Window ENV interface for Firebase config
interface Window {
  ENV?: {
    NEXT_PUBLIC_FIREBASE_API_KEY?: string;
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?: string;
    NEXT_PUBLIC_FIREBASE_PROJECT_ID?: string;
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?: string;
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?: string;
    NEXT_PUBLIC_FIREBASE_APP_ID?: string;
    NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID?: string;
  };
}
