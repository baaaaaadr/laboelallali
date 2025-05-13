// src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import acceptLanguage from 'accept-language';
import { fallbackLng, supportedLngs, cookieName } from '../i18n'; // Ajustez le chemin si nécessaire

acceptLanguage.languages(supportedLngs);

export const config = {
  matcher: [
    // Appliquer uniquement aux chemins qui n'incluent PAS déjà une locale supportée,
    // qui ne sont pas des chemins pour des assets statiques ou l'API Next.js,
    // et qui ne ressemblent pas à des chemins de fichiers avec une extension.
    '/((?!api|_next/static|_next/image|images|assets|favicon.ico|sw.js|locales|(?:[^/]+/)*?[^/]+\.\w+).*)'
  ],
};

export function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  let lng: string | undefined | null = null;

  // Vérifier si le chemin actuel contient déjà une locale supportée
  const pathnameHasLocale = supportedLngs.some(
    (loc) => pathname.startsWith(`/${loc}/`) || pathname === `/${loc}`
  );

  if (pathnameHasLocale) {
    // La langue est dans l'URL, on la prend comme source de vérité
    const potentialLng = pathname.split('/')[1];
    if (supportedLngs.includes(potentialLng)) {
      lng = potentialLng;
    }
  } else {
    // L'URL n'a pas de langue, on essaie de la détecter depuis le cookie ou l'en-tête
    if (req.cookies.has(cookieName)) {
      const cookieLang = req.cookies.get(cookieName)?.value;
      if (cookieLang && supportedLngs.includes(cookieLang)) {
        lng = cookieLang;
      }
    }
    // Décommenter ce bloc si on veut détecter la langue du navigateur
    // if (!lng && req.headers.has('accept-language')) {
    //   lng = acceptLanguage.get(req.headers.get('accept-language'));
    // }
    // Pour garantir que français est toujours la langue par défaut
    if (!lng) {
      lng = fallbackLng; // 'fr' défini dans i18n.ts
    }

    // Rediriger vers le même chemin préfixé par la langue détectée
    // ex: /about -> /fr/about, / -> /fr
    const newPath = pathname === '/' ? '' : pathname;
    const newUrl = new URL(`/${lng}${newPath}`, req.url);
    const response = NextResponse.redirect(newUrl);
    // Mettre à jour le cookie avec la langue de redirection
    if (lng && supportedLngs.includes(lng)) {
      response.cookies.set(cookieName, lng, { path: '/' });
    }
    return response;
  }

  // Si on arrive ici, l'URL avait une langue, ou on n'a pas redirigé (cas peu probable avec le matcher actuel).
  // On s'assure que le cookie est synchronisé avec la langue actuelle (soit de l'URL, soit détectée).
  const response = NextResponse.next();
  if (lng && supportedLngs.includes(lng)) {
    // Si le cookie n'existe pas ou est différent de la langue déterminée (par URL ou détection initiale)
    if (!req.cookies.has(cookieName) || req.cookies.get(cookieName)?.value !== lng) {
      response.cookies.set(cookieName, lng, { path: '/' });
    }
  }
  return response;
}
