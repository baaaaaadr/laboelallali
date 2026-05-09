/**
 * Validates a phone number for Moroccan (06/07) or international (+/00) formats.
 * Strips spaces, dashes, and dots before checking.
 */
export function validatePhone(value: string): boolean {
  const normalized = value.replace(/[\s\-\.]/g, '');
  const isMoroccan = /^0[67]\d{8}$/.test(normalized);
  const isInternational = /^(\+|00)\d{6,15}$/.test(normalized);
  return isMoroccan || isInternational;
}
