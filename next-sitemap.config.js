// next-sitemap.config.js
/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'https://laboelallali.vercel.app',
  generateRobotsTxt: true,
  exclude: ['/server-sitemap.xml', '/admin/*'],
  robotsTxtOptions: {
    policies: [
      {
        userAgent: '*',
        allow: '/',
      },
    ],
    additionalSitemaps: [
      `${process.env.NEXT_PUBLIC_SITE_URL || 'https://laboelallali.vercel.app'}/sitemap.xml`,
    ],
  },
  // Handle i18n routes
  i18n: {
    defaultLocale: 'fr',
    locales: ['fr', 'ar'],
  },
}
