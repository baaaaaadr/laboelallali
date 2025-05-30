/**
 * Script to generate CSS variables from theme.ts
 * Run with: node scripts/generateCSSVariables.js
 */

const fs = require('fs');
const path = require('path');

// Hardcoded theme values (extracted from theme.ts)
const theme = {
  colors: {
    bordeaux: {
      primary: '#800020',
      dark: '#600018',
      light: '#B84C63',
      pale: '#F7E7EA',
    },
    fuchsia: {
      accent: '#FF4081',
      bright: '#F50057',
      light: '#FF80AB',
      pale: '#FFF0F5',
    },
    gray: {
      900: '#111827',
      800: '#1F2937',
      600: '#4B5563',
      300: '#D1D5DB',
      200: '#E5E7EB',
      100: '#F3F4F6',
    },
    white: '#FFFFFF',
    functional: {
      success: '#059669',
      warning: '#D97706',
      error: '#B91C1C',
      info: '#0369A1',
    },
    medical: {
      normal: '#FF4081',
      warning: '#D97706',
      alert: '#600018',
      background: '#FDF8F9',
    },
  },
  typography: {
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
      '4xl': '2.25rem',
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
  },
  spacing: {
    1: '0.25rem',
    2: '0.5rem',
    3: '0.75rem',
    4: '1rem',
    5: '1.25rem',
    6: '1.5rem',
    8: '2rem',
    12: '3rem',
    16: '4rem',
  },
  layout: {
    borderRadius: {
      sm: '4px',
      md: '8px',
      lg: '12px',
      xl: '16px',
      full: '9999px',
    },
  },
};

/**
 * Flattens nested theme objects into CSS variable format
 * @param {object} obj - Theme object to flatten
 * @param {string} prefix - CSS variable prefix
 * @returns {object} Flattened CSS variables object
 */
function flattenToCSSVariables(obj, prefix = '') {
  const result = {};
  
  for (const [key, value] of Object.entries(obj)) {
    const varName = prefix ? `${prefix}-${key}` : key;
    
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      Object.assign(result, flattenToCSSVariables(value, varName));
    } else {
      result[`--${varName}`] = String(value);
    }
  }
  
  return result;
}

/**
 * Generates CSS variables from theme tokens
 */
function generateCSSVariables() {
  const { colors, typography, spacing, layout } = theme;
  
  // Base design tokens (always available)
  const baseTokens = {
    ...flattenToCSSVariables(colors, 'color'),
    ...flattenToCSSVariables(typography.fontSize, 'font-size'),
    ...flattenToCSSVariables(typography.fontWeight, 'font-weight'),
    ...flattenToCSSVariables(spacing, 'space'),
    ...flattenToCSSVariables(layout.borderRadius, 'radius'),
  };
  
  // Semantic tokens for light mode
  const lightSemanticTokens = {
    // Backgrounds
    '--background-default': colors.white,
    '--background-secondary': colors.fuchsia.pale,
    '--background-tertiary': colors.bordeaux.pale,
    '--background-card': colors.white,
    '--background-hover': colors.gray[100],
    
    // Text
    '--text-primary': colors.gray[900],
    '--text-secondary': colors.gray[600],
    '--text-tertiary': colors.gray[600],
    '--text-accent': colors.fuchsia.accent,
    '--text-muted': colors.gray[600],
    
    // Borders
    '--border-default': colors.gray[200],
    '--border-light': colors.gray[100],
    '--border-accent': colors.fuchsia.accent,
    
    // Brand semantic mappings
    '--brand-primary': colors.bordeaux.primary,
    '--brand-primary-hover': colors.bordeaux.dark,
    '--brand-accent': colors.fuchsia.accent,
    '--brand-accent-hover': colors.fuchsia.bright,
    
    // Interactive elements
    '--button-primary-bg': colors.fuchsia.accent,
    '--button-primary-bg-hover': colors.fuchsia.bright,
    '--button-primary-text': colors.white,
    '--button-secondary-bg': colors.bordeaux.primary,
    '--button-secondary-bg-hover': colors.bordeaux.dark,
    '--button-secondary-text': colors.white,
    
    // Status colors
    '--status-success': colors.functional.success,
    '--status-warning': colors.functional.warning,
    '--status-error': colors.functional.error,
    '--status-info': colors.functional.info,
  };
  
  // Semantic tokens for dark mode
  const darkSemanticTokens = {
    // Backgrounds - with bordeaux undertones
    '--background-default': '#1A0F12',
    '--background-secondary': '#241418',
    '--background-tertiary': '#2E1A1F',
    '--background-card': '#241418',
    '--background-hover': '#2E1A1F',
    
    // Text - warm whites and roses
    '--text-primary': '#F5F5F5',
    '--text-secondary': '#C8B5BA',
    '--text-tertiary': '#9C8389',
    '--text-accent': '#FF79A8',
    '--text-muted': '#9C8389',
    
    // Borders
    '--border-default': '#3A2229',
    '--border-light': '#2E1A1F',
    '--border-accent': '#FF79A8',
    
    // Brand semantic mappings
    '--brand-primary': '#D64669',
    '--brand-primary-hover': '#B83A5A',
    '--brand-accent': '#FF79A8',
    '--brand-accent-hover': '#FF5C95',
    
    // Interactive elements
    '--button-primary-bg': '#FF79A8',
    '--button-primary-bg-hover': '#FF5C95',
    '--button-primary-text': '#1A0F12',
    '--button-secondary-bg': '#D64669',
    '--button-secondary-bg-hover': '#B83A5A',
    '--button-secondary-text': '#F5F5F5',
    
    // Status colors
    '--status-success': '#4ADE80',
    '--status-warning': '#FBBF24',
    '--status-error': '#F87171',
    '--status-info': '#60A5FA',
  };
  
  return {
    ':root': {
      ...baseTokens,
      ...lightSemanticTokens,
    },
    'html.dark': darkSemanticTokens,
  };
}

/**
 * Generates CSS string from variables object
 */
function generateCSSString() {
  const variables = generateCSSVariables();
  let css = `/**
 * CSS Variables generated from theme.ts
 * DO NOT EDIT MANUALLY - This file is auto-generated
 * Run: npm run generate:css-vars
 */

`;
  
  for (const [selector, vars] of Object.entries(variables)) {
    const varStrings = Object.entries(vars)
      .map(([prop, value]) => `  ${prop}: ${value};`)
      .join('\n');
    
    css += `${selector} {\n${varStrings}\n}\n\n`;
  }
  
  return css;
}

// Generate and write the CSS file
const cssContent = generateCSSString();
const outputPath = path.join(__dirname, '..', 'src', 'styles', 'system', 'variables.css');

// Ensure directory exists
const dir = path.dirname(outputPath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

// Write the file
fs.writeFileSync(outputPath, cssContent, 'utf8');

console.log('✓ CSS variables generated successfully at:', outputPath);
console.log('✓ Total variables:', Object.keys(generateCSSVariables()[':root']).length);
