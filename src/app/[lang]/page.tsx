'use client';

import { useParams } from 'next/navigation';

// Import the client component
import HomeClient from './HomeClient';

type PageProps = {
  params: { lang: string };
  searchParams: { [key: string]: string | string[] | undefined };
};

// This is a client component that wraps the server component
export default function Page({ params }: PageProps) {
  // Get the lang from the URL on the client side
  const { lang } = useParams();
  
  // Log the language for debugging
  console.log(`Page rendered for language: ${lang}`);
  
  // All UI and client-side logic has been moved to HomeClient component
  return <HomeClient lang={lang as string} />;
}
