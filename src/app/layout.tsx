import type { Metadata } from 'next'
import './globals.css'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'

// WARNING: Custom fonts not added in pages/_document.js will only load for a single page. For production, move font imports to _document.js. See: https://nextjs.org/docs/messages/no-page-custom-fonts
export const metadata: Metadata = {
  title: 'Laboratoire El Allali - Analyses Médicales à Agadir',
  description: 'Laboratoire d\'analyses médicales de référence à Agadir, Maroc. Analyses de sang, bilans de santé, prélèvements à domicile et résultats rapides.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="flex flex-col min-h-screen bg-gray-50">
        <Header />
        <main className="flex-grow">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  )
}