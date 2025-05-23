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
      
      /* Button reset for consistent base styles */
      button, .menu-action-button {
        -webkit-appearance: none;
        -moz-appearance: none;
        appearance: none;
        background-color: transparent;
        border: none;
        padding: 0;
        margin: 0;
        font: inherit;
        cursor: pointer;
        outline: inherit;
        text-align: center;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      
      /* Menu action button styles - Outline variant */
      .menu-action-button {
        width: 100%;
        padding: 0.75rem 1.25rem;
        border-radius: 0.5rem;
        background-color: transparent;
        border: 1.5px solid var(--primary-bordeaux);
        color: var(--primary-bordeaux);
        font-weight: 500;
        font-size: 0.9375rem;
        line-height: 1.5;
        transition: all 0.2s ease;
        position: relative;
        overflow: hidden;
      }
      
      .menu-action-button::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: var(--primary-bordeaux);
        opacity: 0;
        z-index: -1;
        transition: opacity 0.2s ease;
      }
      
      .menu-action-button:hover {
        color: white;
        transform: translateY(-1px);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      }
      
      .menu-action-button:hover::before {
        opacity: 1;
      }
      
      .menu-action-button:active {
        transform: translateY(0);
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
      }
      
      .menu-action-button:focus {
        outline: none;
        box-shadow: 0 0 0 2px var(--accent-fuchsia);
      }
    `}</style>
  );
}
