/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
      "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
      "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
      "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
      extend: {
        // Note: Avec Tailwind v4, ces couleurs personnalisées peuvent ne pas fonctionner
        // comme prévu. On utilisera des notations directes dans le code.
      },
    },
    plugins: [],
  }