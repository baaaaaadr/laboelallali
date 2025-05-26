/** @type {import('tailwindcss').Config} */
const { colors, typography, spacing, layout } = require('./src/styles/theme');

module.exports = {
  darkMode: 'class', // Add this line to enable class-based dark mode
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // colors: { ... }, // COMMENT THIS OUT FOR NOW
      
      // Typography
      fontSize: typography.fontSize,
      fontWeight: typography.fontWeight,
      fontFamily: {
        primary: typography.fontFamily.primary.split(',').map(font => font.trim()),
        secondary: typography.fontFamily.secondary.split(',').map(font => font.trim()),
      },
      
      // Spacing
      spacing: spacing,
      
      // Border Radius
      borderRadius: layout.borderRadius,
      
      // Container
      container: {
        center: true,
        padding: spacing[4],
        maxWidth: layout.container.maxWidth,
      },
    },
  },
  plugins: [],
}