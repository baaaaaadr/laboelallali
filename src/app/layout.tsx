import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Laboratoire El Allali',
  description: 'Analyses médicales à Agadir.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Add CSS for RTL support */}
        <style dangerouslySetInnerHTML={{ __html: `
          [dir="rtl"] { text-align: right; }
          [dir="rtl"] .rtl-mirror { transform: scaleX(-1); }
          [dir="rtl"] .rtl-reverse { flex-direction: row-reverse; }
        `}} />
      </head>
      <body className="flex flex-col min-h-screen bg-gray-50">{children}</body>
    </html>
  );
}
