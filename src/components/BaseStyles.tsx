'use client';

/**
 * Client component that provides base styles using styled-jsx
 */
export default function BaseStyles() {
  return (
    <style jsx global>{`
      /* Base imports for fonts */
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&family=Public+Sans:wght@400;500;700&display=swap');
      
      /* Base styles */
      html, body {
        font-family: 'Inter', system-ui, -apple-system, sans-serif;
      }
      
      /* Custom colors as CSS variables */
      :root {
        --primary-bordeaux: #800020;
        --bordeaux-dark: #600018;
        --bordeaux-light: #B84C63;
        --bordeaux-pale: #F7E7EA;
        --accent-fuchsia: #FF4081;
        --fuchsia-bright: #F50057;
        --fuchsia-light: #FF80AB;
        --fuchsia-pale: #FFF0F5;
        --medical-background: #FDF8F9;
      }
      
      /* Custom background color */
      .bg-bordeaux-custom {
        background-color: #800020;
        color: white;
      }
    `}</style>
  );
}
