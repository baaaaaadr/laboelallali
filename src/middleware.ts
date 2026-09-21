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
    //
    // ⚠ LES ANTISLASHS SONT DOUBLÉS, et ce n'est pas cosmétique. Cette chaîne
    // est une chaîne JavaScript ordinaire : `'\.'` y valait simplement `.` et
    // `'\w'` valait `w`, car JavaScript supprime un antislash devant un
    // caractère qui n'est pas une séquence d'échappement connue. Next recevait
    // donc `[^/]+.w+` — « n'importe quel caractère, suivi de w répété » — au
    // lieu de « extension de fichier ». L'exclusion des fichiers n'a JAMAIS
    // fonctionné.
    //
    // Conséquence observée en production le 21/09/2026 : `/offline.html`
    // répondait 307 vers `/ar/offline.html`, puis 404. Les fichiers racine
    // courants (`robots.txt`, `sitemap.xml`, `manifest.json`, `sw.js`) y
    // échappaient seulement parce qu'ils EXISTENT et sont servis par le CDN de
    // Firebase avant d'atteindre le serveur Next.
    //
    // `offline.html` est aussi nommé explicitement : il est servi au moment où
    // le réseau est défaillant, c'est le dernier endroit où l'on veut d'une
    // redirection de langue.
    '/((?!api|_next/static|_next/image|images|assets|favicon.ico|sw.js|locales|manifest.json|offline.html|(?:[^/]+/)*?[^/]+\.\w+).*)'
  ],
};

// Fonction pour gérer les requêtes vers manifest.json
function handleManifestRequest(req: NextRequest) {
  const url = req.nextUrl.clone();
  // Si la requête est pour /fr/manifest.json, on la redirige vers /manifest.json
  if (url.pathname.endsWith('/manifest.json')) {
    url.pathname = '/manifest.json';
    return NextResponse.rewrite(url);
  }
  return null;
}

export function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  let lng: string | undefined | null = null;

  // Gérer les requêtes vers manifest.json
  if (pathname.endsWith('/manifest.json')) {
    return handleManifestRequest(req);
  }

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
    // Langue par défaut (arabe) si aucune détection n'est possible
    if (!lng) {
      lng = fallbackLng; 
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
