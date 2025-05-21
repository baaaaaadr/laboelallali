/**
 * Laboratoire El Allali Theme Configuration
 * 
 * This file contains all design tokens and theme variables used throughout the application.
 * Always reference these values instead of hardcoding colors or spacing values.
 */

const colors = {
  // Primary Bordeaux Colors
  bordeaux: {
    primary: '#800020',     // Bordeaux principal
    dark: '#600018',        // Version plus sombre (hover)
    light: '#B84C63',       // Version plus claire (accents)
    pale: '#F7E7EA',        // Version très pâle (backgrounds)
  },
  
  // Accent Fuchsia Colors
  fuchsia: {
    accent: '#FF4081',      // Fuchsia principal
    bright: '#F50057',      // Fuchsia intense (CTA)
    light: '#FF80AB',       // Version claire (états)
    pale: '#FFF0F5',        // Version très pâle (notifications)
  },
  
  // Neutral Colors
  gray: {
    900: '#111827',         // Texte principal
    800: '#1F2937',         // Texte secondaire
    600: '#4B5563',         // Texte désactivé
    300: '#D1D5DB',         // Bordures
    200: '#E5E7EB',         // Fond clair
    100: '#F3F4F6',         // Fond très clair
  },
  white: '#FFFFFF',         // Blanc pur
  
  // Functional Colors
  functional: {
    success: '#059669',     // Vert - confirmations
    warning: '#D97706',     // Orange - alertes
    error: '#B91C1C',       // Rouge plus sombre pour les erreurs
    info: '#0369A1',        // Bleu - informations
  },
  
  // Medical-specific Colors
  medical: {
    normal: '#FF4081',      // Valeurs normales (fuchsia pour dynamisme)
    warning: '#D97706',     // Valeurs à surveiller
    alert: '#600018',       // Valeurs critiques (bordeaux pour sérieux)
    background: '#FDF8F9',  // Fond très léger bordeaux/fuchsia
  },
};

const typography = {
  // Font Sizes
  fontSize: {
    xs: '0.75rem',          // 12px
    sm: '0.875rem',         // 14px
    base: '1rem',           // 16px
    lg: '1.125rem',         // 18px
    xl: '1.25rem',          // 20px
    '2xl': '1.5rem',        // 24px
    '3xl': '1.875rem',      // 30px
    '4xl': '2.25rem',       // 36px
  },
  
  // Font Weights
  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  
  // Font Families
  fontFamily: {
    primary: 'Inter, system-ui, sans-serif',
    secondary: '"Public Sans", system-ui, sans-serif',
  },
  
  // RTL Typography (Arabic)
  rtl: {
    lineHeight: 1.8,
    letterSpacing: '0.025em',
    textAlign: 'right',
    direction: 'rtl',
  },
};

const spacing = {
  1: '0.25rem',             // 4px
  2: '0.5rem',              // 8px
  3: '0.75rem',             // 12px
  4: '1rem',                // 16px
  5: '1.25rem',             // 20px
  6: '1.5rem',              // 24px
  8: '2rem',                // 32px
  12: '3rem',               // 48px
  16: '4rem',               // 64px
};

const layout = {
  container: {
    maxWidth: '1200px',
    columns: 12,
    gutter: '24px',
  },
  
  // Standard Margins
  margins: {
    card: '20px',
    section: '32px',
    formField: '16px',
    button: '8px',
  },
  
  // Border Radius
  borderRadius: {
    sm: '4px',
    md: '8px',
    lg: '12px',
    xl: '16px',
    full: '9999px',
  },
};

// Component-specific styles
const components = {
  // Button Styles
  buttons: {
    primary: {
      background: colors.fuchsia.accent,
      hoverBackground: colors.fuchsia.bright,
      color: colors.white,
      padding: '12px 24px',
      borderRadius: layout.borderRadius.md,
      fontWeight: typography.fontWeight.semibold,
    },
    secondary: {
      background: colors.bordeaux.primary,
      hoverBackground: colors.bordeaux.dark,
      color: colors.white,
      padding: '12px 24px',
      borderRadius: layout.borderRadius.md,
      fontWeight: typography.fontWeight.semibold,
    },
    outline: {
      background: 'transparent',
      border: `2px solid ${colors.bordeaux.primary}`,
      color: colors.bordeaux.primary,
      padding: '10px 22px',
      borderRadius: layout.borderRadius.md,
      fontWeight: typography.fontWeight.medium,
    },
    text: {
      background: 'transparent',
      color: colors.fuchsia.accent,
      padding: '8px 16px',
      fontWeight: typography.fontWeight.medium,
    },
  },
  
  // Card Styles
  cards: {
    default: {
      background: colors.white,
      borderRadius: layout.borderRadius.lg,
      padding: layout.margins.card,
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
    },
    hover: {
      boxShadow: `0 4px 12px rgba(128, 0, 32, 0.15)`,
      borderLeft: `4px solid ${colors.fuchsia.accent}`,
    },
    header: {
      paddingBottom: spacing[3],
      borderBottom: `1px solid ${colors.bordeaux.pale}`,
      marginBottom: spacing[4],
      color: colors.bordeaux.primary,
    },
  },
  
  // Navigation Styles
  navigation: {
    navbar: {
      height: '64px',
      background: colors.bordeaux.primary,
      color: colors.white,
      padding: `0 ${spacing[4]}`,
    },
    logo: {
      height: '40px',
      width: '40px',
      background: colors.white,
      borderRadius: layout.borderRadius.md,
      color: colors.fuchsia.accent,
    },
    link: {
      color: 'rgba(255, 255, 255, 0.85)',
      padding: spacing[3],
    },
    linkHover: {
      color: colors.white,
      textShadow: `0 0 8px ${colors.fuchsia.light}`,
    },
    linkActive: {
      color: colors.white,
      borderBottom: `2px solid ${colors.fuchsia.accent}`,
    },
  },
  
  // Tab Bar Styles (Mobile)
  tabBar: {
    height: '64px',
    background: colors.white,
    borderTop: `1px solid ${colors.bordeaux.pale}`,
    padding: `${spacing[2]} 0`,
  },
  tabItem: {
    color: colors.bordeaux.primary,
    fontSize: typography.fontSize.xs,
  },
  tabItemActive: {
    color: colors.fuchsia.accent,
  },
  tabIcon: {
    fontSize: '24px',
    marginBottom: spacing[1],
  },
  
  // PDF Viewer Styles
  pdfViewer: {
    container: {
      background: colors.medical.background,
      borderRadius: layout.borderRadius.lg,
      padding: spacing[6],
      margin: `${spacing[6]} 0`,
      border: `1px solid ${colors.bordeaux.pale}`,
    },
    header: {
      marginBottom: spacing[4],
      paddingBottom: spacing[4],
      borderBottom: `1px solid ${colors.bordeaux.light}`,
    },
    title: {
      color: colors.bordeaux.primary,
      fontWeight: typography.fontWeight.bold,
    },
    downloadButton: {
      background: colors.fuchsia.accent,
      color: colors.white,
      padding: '8px 16px',
      borderRadius: layout.borderRadius.sm,
      fontWeight: typography.fontWeight.semibold,
    },
  },
  
  // Results List Styles
  results: {
    list: {
      gap: spacing[4],
    },
    card: {
      background: colors.white,
      borderRadius: layout.borderRadius.md,
      padding: spacing[4],
      border: `1px solid ${colors.bordeaux.pale}`,
    },
    cardHover: {
      borderColor: colors.fuchsia.accent,
      boxShadow: `0 4px 12px rgba(255, 64, 129, 0.1)`,
    },
    cardUnread: {
      borderLeft: `4px solid ${colors.fuchsia.accent}`,
      background: colors.fuchsia.pale,
    },
    date: {
      fontSize: typography.fontSize.sm,
      color: colors.bordeaux.light,
      marginBottom: spacing[1],
    },
    title: {
      fontSize: typography.fontSize.lg,
      fontWeight: typography.fontWeight.semibold,
      color: colors.bordeaux.primary,
      marginBottom: spacing[2],
    },
    status: {
      padding: '2px 8px',
      borderRadius: '12px',
      fontSize: typography.fontSize.xs,
      fontWeight: typography.fontWeight.medium,
    },
    statusNormal: {
      background: colors.fuchsia.pale,
      color: colors.bordeaux.dark,
    },
    statusAlert: {
      background: colors.bordeaux.pale,
      color: colors.bordeaux.dark,
    },
  },
  
  // Gradient Header
  gradientHeader: {
    background: `linear-gradient(135deg, ${colors.bordeaux.primary}, ${colors.bordeaux.light})`,
    color: colors.white,
    padding: spacing[6],
    borderRadius: layout.borderRadius.lg,
    marginBottom: spacing[6],
  },
  
  // Loading States
  loading: {
    borderColor: colors.fuchsia.pale,
    borderTopColor: colors.fuchsia.accent,
  },
  
  // Package Cards
  packageCard: {
    background: colors.white,
    border: `1px solid ${colors.bordeaux.pale}`,
    borderRadius: layout.borderRadius.lg,
    padding: spacing[6],
    marginBottom: spacing[4],
  },
  packageHeader: {
    marginBottom: spacing[4],
    color: colors.bordeaux.primary,
  },
  packageTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing[2],
  },
  packagePrice: {
    fontSize: typography.fontSize['3xl'],
    color: colors.bordeaux.primary,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing[2],
  },
  packageCta: {
    background: colors.fuchsia.accent,
    color: colors.white,
    borderRadius: layout.borderRadius.md,
    padding: '12px 24px',
    fontWeight: typography.fontWeight.semibold,
  },
  
  // Booking Progress
  bookingProgress: {
    marginBottom: spacing[8],
  },
  progressStep: {
    color: colors.gray[600],
  },
  progressStepActive: {
    color: colors.bordeaux.primary,
  },
  progressStepCompleted: {
    color: colors.fuchsia.accent,
  },
  progressIcon: {
    width: '40px',
    height: '40px',
    border: '2px solid currentColor',
    borderRadius: '50%',
    marginBottom: spacing[2],
    background: colors.white,
  },
  progressIconCompleted: {
    background: colors.fuchsia.accent,
    color: colors.white,
    borderColor: colors.fuchsia.accent,
  },
  progressLine: {
    background: colors.gray[300],
  },
  progressLineFill: {
    background: colors.fuchsia.accent,
  },
  
  // Quick Actions
  quickActions: {
    margin: `${spacing[6]} 0`,
  },
  actionCard: {
    background: colors.white,
    border: `1px solid ${colors.bordeaux.pale}`,
    borderRadius: layout.borderRadius.lg,
    padding: spacing[5],
  },
  actionCardHover: {
    borderColor: colors.fuchsia.accent,
    background: colors.fuchsia.pale,
  },
  actionIcon: {
    background: colors.bordeaux.pale,
    color: colors.fuchsia.accent,
    width: '48px',
    height: '48px',
    borderRadius: layout.borderRadius.md,
    fontSize: '24px',
  },
  
  // Metrics Dashboard
  metricCard: {
    background: colors.white,
    borderRadius: layout.borderRadius.lg,
    padding: spacing[4],
    border: `1px solid ${colors.bordeaux.pale}`,
  },
  metricIcon: {
    color: colors.fuchsia.accent,
    fontSize: '24px',
    marginBottom: spacing[2],
  },
  metricValue: {
    fontSize: typography.fontSize['3xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.bordeaux.primary,
    marginBottom: spacing[1],
  },
  
  // Family Banner
  familyBanner: {
    background: `linear-gradient(135deg, ${colors.bordeaux.primary}, ${colors.bordeaux.light})`,
    color: colors.white,
    padding: spacing[8],
    borderRadius: layout.borderRadius.lg,
    marginBottom: spacing[8],
  },
  bannerTitle: {
    fontSize: typography.fontSize['3xl'],
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing[3],
  },
  bannerCta: {
    background: colors.fuchsia.accent,
    color: colors.white,
    padding: '12px 32px',
    borderRadius: layout.borderRadius.md,
    fontWeight: typography.fontWeight.semibold,
  },
};

// UX Principles
const uxPrinciples = {
  progressiveDisclosure: {
    description: 'Present information by steps to avoid cognitive overload',
    implementation: 'Hide advanced options behind additional clicks',
  },
  immediateFeeback: {
    description: 'Confirm actions visually (loading, success, error)',
    implementation: 'Use micro-animations to guide attention',
  },
  needBasedSelection: {
    description: 'Guide users with simple questionnaires',
    implementation: 'Offer relevant packages based on profile',
  },
  informationHierarchy: {
    description: 'Critical data first (medical alerts)',
    implementation: 'Secondary information accessible but discrete',
  },
  securityAndTraceability: {
    description: 'Timestamp all access to results',
    implementation: 'Secure temporary sharing system',
  },
};

// Export as CommonJS module
module.exports = {
  colors,
  typography,
  spacing,
  layout,
  components,
  uxPrinciples
};
