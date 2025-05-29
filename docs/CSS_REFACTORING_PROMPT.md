# CSS Architecture Refactoring - Comprehensive AI Prompt

## 🎯 **REFACTORING OBJECTIVE**
Refactor the Laboratoire El Allali PWA's CSS architecture to eliminate style conflicts, create a unified theming system, and establish maintainable styling patterns that work reliably with Tailwind CSS v4.

## 📊 **CURRENT STATE ANALYSIS**

### **Critical Issues Identified:**

#### **1. Multiple Sources of Truth**
- `src/styles/theme.ts`: Comprehensive design tokens (colors, typography, spacing, components)
- `src/app/globals.css`: CSS variables defined separately with different naming conventions
- `tailwind.config.js`: Theme extension commented out due to Tailwind v4 issues
- **Problem**: Colors and design tokens scattered across 3 different systems

#### **2. CSS Specificity Wars**
- Global header rule: `header.header-main *` forces all content to be white
- Mobile menu needs different colors but gets overridden
- Bottom navigation affected by header rules despite being separate components
- **Problem**: High-specificity selectors cause unpredictable inheritance

#### **3. Architectural Inconsistencies**
- Some components use `theme.ts` values via JavaScript
- Some components use CSS variables (e.g., `var(--color-bordeaux-primary)`)
- Some components use direct Tailwind utilities
- Some components use global CSS classes (e.g., `.button-fuchsia`)
- **Problem**: No consistent pattern for applying styles

#### **4. Tailwind v4 Integration Issues**
- Button elements require special handling due to form normalization
- Arbitrary values don't work reliably on interactive elements
- CSS cascade conflicts between utilities and custom styles
- **Problem**: Tailwind v4's strict patterns not properly implemented

#### **5. Maintenance Problems**
- 1000+ line `globals.css` file with mixed concerns
- Colors defined multiple times with different names
- Frequent need for `!important` overrides
- Style debugging requires checking multiple files

## 🏗️ **REFACTORING STRATEGY**

### **Phase 1: Unify Design Token System**

#### **Step 1.1: CSS Variables Bridge**
Create a bridge between `theme.ts` and CSS variables:

```typescript
// src/styles/cssVariables.ts
import { colors, typography, spacing } from './theme';

export const generateCSSVariables = () => {
  return {
    // Light mode variables
    ':root': {
      // Brand colors from theme.ts
      '--color-bordeaux-primary': colors.bordeaux.primary,
      '--color-bordeaux-dark': colors.bordeaux.dark,
      '--color-bordeaux-light': colors.bordeaux.light,
      '--color-bordeaux-pale': colors.bordeaux.pale,
      '--color-fuchsia-accent': colors.fuchsia.accent,
      '--color-fuchsia-bright': colors.fuchsia.bright,
      // ... all other colors
      
      // Semantic tokens
      '--text-primary': colors.gray[900],
      '--text-secondary': colors.gray[600],
      '--background-default': colors.white,
      // ... semantic mappings
    },
    
    // Dark mode variables
    'html.dark': {
      '--text-primary': '#F5F5F5',
      '--text-secondary': '#C8B5BA',
      '--background-default': '#1A0F12',
      // ... dark mode mappings
    }
  };
};
```

#### **Step 1.2: Automated CSS Generation**
Create a build script to generate CSS variables from `theme.ts`:

```javascript
// scripts/generateCSSVariables.js
const fs = require('fs');
const { generateCSSVariables } = require('../src/styles/cssVariables');

const cssVariables = generateCSSVariables();
const cssContent = Object.entries(cssVariables)
  .map(([selector, vars]) => {
    const varDeclarations = Object.entries(vars)
      .map(([prop, value]) => `  ${prop}: ${value};`)
      .join('\n');
    return `${selector} {\n${varDeclarations}\n}`;
  })
  .join('\n\n');

fs.writeFileSync('src/styles/variables.css', cssContent);
```

### **Phase 2: Component Architecture Cleanup**

#### **Step 2.1: Establish Component Styling Patterns**

**Pattern 1: Interactive Elements (Buttons, Links)**
```css
/* Use dedicated CSS classes for Tailwind v4 compatibility */
.btn-primary {
  background-color: var(--color-fuchsia-accent);
  color: var(--color-white);
  /* ... other properties */
}

.btn-primary:hover {
  background-color: var(--color-fuchsia-bright);
}
```

**Pattern 2: Layout Components**
```typescript
// Use CSS variables with Tailwind utilities
<div className="bg-[var(--background-default)] text-[var(--text-primary)]">
```

**Pattern 3: Complex Components**
```typescript
// Use theme.ts values via JavaScript for complex calculations
const cardStyles = {
  backgroundColor: `var(--background-secondary)`,
  padding: theme.spacing[4],
  borderRadius: theme.layout.borderRadius.lg,
};
```

#### **Step 2.2: Component Isolation**
Create component-specific stylesheets to prevent conflicts:

```
src/
  styles/
    components/
      header.css
      mobileMenu.css
      bottomNav.css
      buttons.css
      cards.css
```

### **Phase 3: CSS Architecture Reorganization**

#### **Step 3.1: File Structure**
```
src/styles/
  ├── variables.css          # Generated from theme.ts
  ├── base.css              # Resets and base styles
  ├── components/           # Component-specific styles
  │   ├── buttons.css
  │   ├── navigation.css
  │   └── forms.css
  ├── utilities.css         # Custom utility classes
  └── theme.ts             # Source of truth for design tokens
```

#### **Step 3.2: Import Order**
```css
/* globals.css - Clean version */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&display=swap');
@import 'leaflet/dist/leaflet.css';
@import "tailwindcss";

/* Import in specific order */
@import './variables.css';        /* CSS variables from theme.ts */
@import './base.css';            /* Base styles and resets */
@import './components/buttons.css';
@import './components/navigation.css';
@import './utilities.css';       /* Custom utilities */
```

## 🛠️ **IMPLEMENTATION CHECKLIST**

### **Files to Modify:**

#### **High Priority:**
- [ ] `src/styles/theme.ts` - Ensure comprehensive and consistent
- [ ] `src/app/globals.css` - Split into organized modules
- [ ] `tailwind.config.js` - Properly integrate theme.ts
- [ ] Create `src/styles/cssVariables.ts` - Bridge system
- [ ] Create component-specific CSS files

#### **Medium Priority:**
- [ ] `src/components/layout/Header.tsx` - Use consistent styling pattern
- [ ] `src/components/layout/BottomNav.tsx` - Isolate styles
- [ ] Button components - Standardize on CSS class approach
- [ ] Form components - Consistent input styling

#### **Low Priority:**
- [ ] Create CSS linting rules
- [ ] Document styling patterns
- [ ] Add visual regression tests

## 🔧 **TECHNICAL REQUIREMENTS**

### **Tailwind v4 Compatibility:**
- Use CSS classes for button elements (not arbitrary values)
- Avoid complex `@apply` directives
- Leverage CSS variables for theme integration
- Use proper specificity for component isolation

### **Performance Considerations:**
- Minimize CSS bundle size by removing unused styles
- Use CSS custom properties for runtime theme switching
- Implement proper CSS loading order

### **Maintenance Standards:**
- Single source of truth for all design tokens
- Consistent naming conventions across all systems
- Clear component styling boundaries
- Documented styling patterns

## 🎯 **SUCCESS CRITERIA**

1. **No `!important` declarations** needed for standard styling
2. **Single source of truth** for all colors and design tokens
3. **Consistent styling approach** across all components
4. **No cross-component style bleeding**
5. **Reliable Tailwind v4 button styling**
6. **Maintainable CSS architecture** with clear separation of concerns

## 📝 **REFACTORING NOTES**

- Prioritize fixing the most problematic areas first (buttons, navigation)
- Test thoroughly in both light and dark modes
- Maintain existing visual design while improving architecture
- Document new patterns for future development
- Consider using CSS-in-JS for components with complex state-based styling

---

**This refactoring should eliminate the recurring style conflicts and create a sustainable, maintainable CSS architecture for the project.**