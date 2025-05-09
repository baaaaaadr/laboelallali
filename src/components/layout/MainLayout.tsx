import React, { ReactNode } from 'react';
import Head from 'next/head';

interface MainLayoutProps {
  children: ReactNode;
  title?: string;
}

const MainLayout: React.FC<MainLayoutProps> = ({ 
  children, 
  title = 'Laboratoire El Allali'
}) => {
  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content="Application du Laboratoire El Allali pour les résultats d'analyses et rendez-vous" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#800020" />
      </Head>
      <div className="min-h-screen bg-gray-50">
        {/* Header will go here */}
        <main className="container mx-auto px-4 py-8">
          {children}
        </main>
        {/* Footer will go here */}
      </div>
    </>
  );
};

export default MainLayout;