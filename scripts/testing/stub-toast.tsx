/** Doublure de `react-hot-toast` : les messages sont capturés, rien n'est rendu. */
type Kind = 'plain' | 'success' | 'error';
const w = globalThis as unknown as { __toasts: { kind: Kind; text: string }[] };
w.__toasts = w.__toasts || [];

/** Un toast peut recevoir du JSX (le bouton « Annuler » du panier vidé). */
function textOf(v: unknown): string {
  return typeof v === 'string' ? v : '<jsx>';
}

function toast(message: unknown) {
  w.__toasts.push({ kind: 'plain', text: textOf(message) });
  return { id: String(w.__toasts.length) };
}
toast.success = (m: unknown) => { w.__toasts.push({ kind: 'success', text: textOf(m) }); return { id: 's' }; };
toast.error = (m: unknown) => { w.__toasts.push({ kind: 'error', text: textOf(m) }); return { id: 'e' }; };
toast.dismiss = () => undefined;
toast.custom = toast;

export default toast;
export { toast };
export function Toaster() { return null; }
