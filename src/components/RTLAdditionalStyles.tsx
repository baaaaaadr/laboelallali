'use client';

/**
 * Client component that provides additional RTL styles
 */
export default function RTLAdditionalStyles() {
  return (
    <style dangerouslySetInnerHTML={{ __html: `
      [dir="rtl"] { text-align: right; }
      [dir="rtl"] .rtl-mirror { transform: scaleX(-1); }
      [dir="rtl"] .rtl-reverse { flex-direction: row-reverse; }
      [dir="rtl"] .rtl-content { direction: rtl; text-align: right; }
      [dir="rtl"] input, [dir="rtl"] select, [dir="rtl"] textarea { text-align: right; }
      [dir="rtl"] .form-group label { text-align: right; }
      [dir="rtl"] .ml-3 { margin-left: 0; margin-right: 0.75rem; }
      [dir="rtl"] .mr-3 { margin-right: 0; margin-left: 0.75rem; }
      [dir="rtl"] .text-left { text-align: right; }
      [dir="rtl"] .text-right { text-align: left; }
      [dir="rtl"] .rtl-filter-section { direction: rtl; text-align: right; }
      [dir="rtl"] .rtl-filter-section label { text-align: right; }
      [dir="rtl"] .rtl-filter-section input, 
      [dir="rtl"] .rtl-filter-section select { text-align: right !important; direction: rtl; }
      [dir="rtl"] .rtl-filter-section #search { text-align: right !important; }
      [dir="rtl"] .rtl-filter-section #category { text-align: right !important; }
    `}} />
  );
}
