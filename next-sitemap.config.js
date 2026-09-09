// next-sitemap.config.js
/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'https://www.laboelallali.com',
  generateRobotsTxt: true,
  // '/admin/*' ne couvre PAS '/admin' lui-meme, ni '/fr/admin' : l'espace
  // du personnel se retrouvait dans le sitemap public. Les pages sont
  // protegees, mais elles n'ont rien a faire dans l'index de Google.
  exclude: [
    '/server-sitemap.xml',
    '/admin', '/admin/*', '/*/admin', '/*/admin/*',
    '/test-rdv', '/*/test-rdv',
    '/test-rdv2', '/*/test-rdv2',
  ],
  robotsTxtOptions: {
    policies: [
      {
        userAgent: '*',
        allow: '/',
        // Ceinture et bretelles : ces pages portent deja une balise `robots`
        // noindex servie dans le HTML et sont absentes du sitemap.
        disallow: [
          '/admin', '/*/admin',
          '/test-rdv', '/*/test-rdv',
          '/test-rdv2', '/*/test-rdv2',
        ],
      },
    ],
    additionalSitemaps: [
      `${process.env.NEXT_PUBLIC_SITE_URL || 'https://www.laboelallali.com'}/sitemap.xml`,
    ],
  },
  // Handle i18n routes
  i18n: {
    defaultLocale: 'fr',
    locales: ['fr', 'ar'],
  },
}
