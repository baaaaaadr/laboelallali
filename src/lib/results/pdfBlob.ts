/**
 * Turning a result PDF into something the browser can show or save.
 *
 * Moved out of `/resultats` when the viewer became a shared component: both the
 * viewer (to render) and the result cards (to download/share a PDF that is not
 * open) need these, and neither should own them.
 *
 * Pure, no React. Nothing here writes to disk or to storage — the Blob lives in
 * memory and the caller is responsible for revoking any object URL it creates.
 * See the golden rules at the top of `src/app/[lang]/resultats/page.tsx`.
 */

/** base64 → in-memory PDF Blob (never persisted to disk). */
export function base64ToPdfBlob(b64: string): Blob {
  const clean = (b64 || '').replace(/\s+/g, '');
  const bin = atob(clean);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: 'application/pdf' });
}

/** PC heuristic (same idea used elsewhere in the app): not a mobile UA + wide viewport. */
export function isDesktopViewer(): boolean {
  if (typeof window === 'undefined') return false;
  const mobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  return !mobileUA && window.innerWidth >= 768;
}
