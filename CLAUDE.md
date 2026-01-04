# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Laboratoire El Allali PWA - A Progressive Web Application for a medical laboratory in Morocco, built with Next.js 14+ App Router. The application provides appointment booking, home service requests (GLABO), test catalog browsing, and result access for patients.

**Tech Stack:** Next.js 14+ (App Router), TypeScript, Tailwind CSS, Firebase (Firestore, Auth, Storage), next-i18next

**Environment:** Windows development environment (use PowerShell commands)

## Common Commands

### Development
```bash
npm run dev                    # Start development server (http://localhost:3000)
npm run build                  # Build for production (includes prebuild script)
npm run start                  # Start production server
npm run lint                   # Run ESLint
```

### Firebase Deployment
```bash
npm run deploy                 # Build and deploy everything
npm run deploy:hosting         # Build and deploy hosting only
npm run deploy:functions       # Deploy Cloud Functions only
```

### Utilities
```bash
npm run context                # Generate context file (PowerShell script)
npm run tailwind:build         # Build Tailwind CSS
npm run generate:css-vars      # Generate CSS variables from theme.ts
```

## Architecture

### App Router Structure

The app uses Next.js App Router with internationalization built into the routing:

- **Route Pattern:** `/[lang]/*` - All routes are prefixed with locale (fr/ar)
- **Middleware:** Automatically redirects to locale-prefixed routes (`/` → `/fr`)
- **Locale Detection:** Cookie-based (`laboelallali-i18next-lng`), falls back to `fr`

**Key Routes:**
- `/[lang]` - Home page
- `/[lang]/rendez-vous` - Lab appointment booking
- `/[lang]/glabo` - Home service (GLABO) requests
- `/[lang]/analyses` - Test catalog browser
- `/[lang]/contact` - Contact page

### Firebase Integration

**Client-side Firebase** (`src/config/firebase.ts`):
- Lazy-loaded services: `getClientAuth()`, `getClientStorage()`, `getClientAnalytics()`
- Pre-initialized Firestore: `db` export
- All Firebase config from environment variables (see `.env.example`)

**Firestore Collections:**
- `analysisCatalog` - Test catalog (public read, admin write)
- `appointmentRequests` - Appointment submissions (public create only)
- Other collections exist but not exposed in current security rules

**Firebase Hosting:** Deployed via `firebase deploy`, configured in `firebase.json`

**Cloud Functions:** Located in `/functions` directory, separate Node.js project

### Design System & Styling

**PRIMARY SOURCE OF TRUTH:** `src/styles/theme.ts`

This file defines ALL design tokens:
- Colors: Bordeaux primary (`#800020`), Fuchsia accent (`#FF4081`)
- Typography: Font sizes, weights, families
- Spacing: Consistent spacing scale
- Components: Pre-defined component styles (buttons, cards, navigation, etc.)

**CRITICAL STYLING RULES:**
1. **NEVER hardcode colors, spacing, or typography** - always import from `theme.ts`
2. Use Tailwind utilities with arbitrary values referencing theme: `bg-[#800020]`
3. For complex components, use `theme.components.*` style objects
4. Apply theme via inline styles or className with arbitrary values

**Example:**
```typescript
import theme from '@/styles/theme';

// Inline styles (preferred for dynamic values)
<button style={{ background: theme.colors.fuchsia.accent }}>

// Tailwind arbitrary values
<div className="bg-[#800020] text-white">
```

### Internationalization (i18n)

**Configuration:** `i18n.ts` - Supports `fr` (default) and `ar` (RTL)

**Translation Files:** `public/locales/[lang]/[namespace].json`
- `common.json` - Shared translations (navigation, common UI)
- `appointment.json` - Appointment booking
- `catalog.json` - Test catalog
- `glabo.json` - Home service

**RTL Support:**
- Arabic uses RTL layout
- RTL styles defined in `theme.typography.rtl`
- Additional RTL overrides in `src/components/RTLAdditionalStyles.tsx`

**Usage Pattern:**
```typescript
'use client';
import { useTranslation } from 'react-i18next';

export default function Component() {
  const { t } = useTranslation('common');
  return <h1>{t('header.nav.home')}</h1>;
}
```

### Component Organization

```
src/components/
├── common/           # Reusable UI components
├── features/         # Feature-specific components
│   ├── catalog/      # Test catalog components
│   ├── home/         # Home page components
│   └── pwa/          # PWA-specific components
├── layout/           # Layout components (Header, Footer, TabBar)
├── providers/        # Context providers
└── ui/               # Base UI components
```

**Component Conventions:**
- Functional components only (no class components)
- TypeScript interfaces for props
- Use `'use client'` directive for client components
- Absolute imports via `@/*` alias

### State Management

- **Global State:** React Context API (`src/contexts/`)
- **Local State:** React hooks (`useState`, `useReducer`)
- **No Redux/Zustand** - Keep it simple with Context

### PWA Configuration

**Service Worker:** `public/sw.js` (copied via `scripts/copy-sw.js` during build)

**Manifest:** `public/manifest.json`

**next-pwa Config:** In `next.config.js`
- Disabled in development (unless `NEXT_PUBLIC_ENABLE_PWA_DEV=true`)
- NetworkFirst caching strategy
- 200 entry cache limit

### Form Handling

**Pattern:** React Hook Form + Yup validation

```typescript
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';

const schema = yup.object().shape({
  // validation rules
});

const { register, handleSubmit, formState: { errors } } = useForm({
  resolver: yupResolver(schema)
});
```

**File Uploads:** Use `react-dropzone` for prescription/document uploads

### Performance Optimizations

- **Images:** Always use `next/image` with optimization
- **Code Splitting:** Use `next/dynamic` for heavy components
- **CSS Optimization:** `experimental.optimizeCss: true` in next.config.js
- **PWA Caching:** Aggressive offline support

### Firestore Security Model

**Current Rules:**
- `analysisCatalog`: Public read access (catalog data synced from Google Sheets)
- `appointmentRequests`: Anyone can create, admin-only read/update
- Default deny all for other collections

**Integration Notes:**
- CyberLab API integration is PENDING (do not implement without instruction)
- Google Sheets → Firestore sync for catalog data (external Apps Script)
- WhatsApp integration: Phase 1 uses `wa.me/` links with pre-formatted messages

### Build Configuration

**TypeScript:** `ignoreBuildErrors: true` in `next.config.js` (TODO: fix and remove)

**Image Optimization:**
- Allowed domains: `firebasestorage.googleapis.com`, `labo-el-allali-pwa.firebasestorage.app`
- Formats: AVIF, WebP
- 60s minimum cache TTL

**Webpack Customizations:**
- Leaflet image assets handling
- `fs` module fallback disabled for client bundle

## Development Practices

### Windows Environment
- Use PowerShell syntax for all commands
- `Remove-Item` instead of `rm`, `New-Item` instead of `mkdir`
- Scripts assume Windows paths

### Code Standards
- All user-facing text MUST use i18n `t()` function
- All design values MUST reference `src/styles/theme.ts`
- Document complex functions with JSDoc
- Prefer extending existing code over creating duplicates

### Firebase Best Practices
- Abstract Firebase calls in service files (though current codebase doesn't follow this pattern strictly)
- Never bypass security rules in client code
- Sensitive operations via Cloud Functions

### Important Files to Reference
- `.windsurfrules` - Comprehensive development rules from previous AI tool (contains detailed component, styling, and architecture guidelines)
- `src/styles/theme.ts` - Complete design system
- `i18n.ts` - i18n configuration
- `src/middleware.ts` - Locale routing logic

## Testing

No test framework currently configured. If adding tests, consider:
- Playwright (already in devDependencies)
- Jest + React Testing Library for unit tests
