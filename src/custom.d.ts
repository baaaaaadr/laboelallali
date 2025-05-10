// src/custom.d.ts
declare module 'accept-language' {
  interface AcceptLanguage {
    languages: (supportedLanguages: string[]) => void;
    get: (header: string | string[] | null | undefined) => string | null;
  }
  const acceptLanguage: AcceptLanguage;
  export default acceptLanguage;
}
