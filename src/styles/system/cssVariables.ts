/**
 * CSS Variables Generator
 * 
 * This module generates CSS variables from theme.ts tokens
 * ensuring a single source of truth for all design tokens
 */

const theme = require('../theme');

interface CSSVariableMap {
  [key: string]: string | CSSVariableMap;
}

/**
 * Flattens nested theme objects into CSS variable format
 * @param obj - Theme object to flatten
 * @param prefix - CSS variable prefix
 * @returns Flattened CSS variables object
 */
function flattenToCSSVariables(obj: any, prefix: string = ''): CSSVariableMap {
  const result: CSSVariableMap = {};
  
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
 * Generates semantic CSS variables for light and dark modes
 */
export function generateCSSVariables() {
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
export function generateCSSString(): string {
  const variables = generateCSSVariables();
  let css = '';
  
  for (const [selector, vars] of Object.entries(variables)) {
    const varStrings = Object.entries(vars)
      .map(([prop, value]) => `  ${prop}: ${value};`)
      .join('\n');
    
    css += `${selector} {\n${varStrings}\n}\n\n`;
  }
  
  return css;
}
