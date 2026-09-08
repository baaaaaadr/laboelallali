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
  ],
  robotsTxtOptions: {
    policies: [
      {
        userAgent: '*',
        allow: '/',
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
