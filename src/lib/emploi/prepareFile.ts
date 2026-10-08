/**
 * A CV or a letter, made ready to travel to `submitApplication` (base64).
 *
 * Photos are the common case for the field jobs (coursier, entretien,
 * prélèvement): a phone photo of a paper CV weighs 3 to 10 MB. Every image is
 * therefore re-drawn in the browser — at most 2000 px on its long side, JPEG —
 * which brings it under 1 MB AND drops its metadata (the GPS position a phone
 * writes into a photo has nothing to do in the lab's files).
 *
 * Only what the server accepts leaves the device: PDF, Word, JPEG/PNG (an
 * iPhone HEIC photo is converted when the browser can read it). The server
 * re-checks everything from the file's first bytes anyway.
 */
import { MAX_FILE_BYTES } from './applicationFields';

export const FILE_ACCEPT = [
  '.pdf',
  '.doc',
  '.docx',
  '.jpg',
  '.jpeg',
  '.png',
  '.heic',
  '.heif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif',
].join(',');

export interface PreparedFile {
  name: string;
  /** base64, without the `data:` prefix. */
  data: string;
  size: number;
}

export type PrepareError = 'too_big' | 'format' | 'read';

const IMAGE_MAX_SIDE = 2000;
const IMAGE_QUALITY = 0.85;

const ext = (name: string) => (/\.([A-Za-z0-9]{1,5})$/.exec(name)?.[1] || '').toLowerCase();

function isImage(file: File): boolean {
  return file.type.startsWith('image/') || ['jpg', 'jpeg', 'png', 'heic', 'heif'].includes(ext(file.name));
}

function isDocument(file: File): boolean {
  return (
    ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(
      file.type
    ) || ['pdf', 'doc', 'docx'].includes(ext(file.name))
  );
}

function readBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || '').replace(/^data:[^,]*,/, ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image'));
    img.src = url;
  });
}

/** Re-draw a photo as a JPEG of at most 2000 px. `null` = the browser cannot read it. */
async function redrawImage(file: File): Promise<Blob | null> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const w0 = img.naturalWidth;
    const h0 = img.naturalHeight;
    if (!w0 || !h0) return null;
    const scale = Math.min(1, IMAGE_MAX_SIDE / Math.max(w0, h0));
    const w = Math.max(1, Math.round(w0 * scale));
    const h = Math.max(1, Math.round(h0 * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    // A transparent PNG would turn black in a JPEG: paper white underneath.
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', IMAGE_QUALITY));
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function prepareFile(file: File): Promise<PreparedFile | { error: PrepareError }> {
  try {
    if (isImage(file)) {
      const blob = await redrawImage(file);
      if (!blob) return { error: 'format' };
      if (blob.size > MAX_FILE_BYTES) return { error: 'too_big' };
      const stem = file.name.replace(/\.[A-Za-z0-9]{1,5}$/, '') || 'photo';
      return { name: `${stem}.jpg`, data: await readBase64(blob), size: blob.size };
    }
    if (!isDocument(file)) return { error: 'format' };
    if (file.size > MAX_FILE_BYTES) return { error: 'too_big' };
    if (file.size === 0) return { error: 'read' };
    return { name: file.name, data: await readBase64(file), size: file.size };
  } catch {
    return { error: 'read' };
  }
}

/** "1,2 Mo" / "850 ko" — the size the candidate sees next to his file. */
export function formatSize(bytes: number, lang: string): string {
  const fmt = (n: number, digits: number) =>
    n.toLocaleString(lang === 'ar' ? 'ar-MA' : 'fr-FR', { maximumFractionDigits: digits });
  if (bytes >= 1024 * 1024) return `${fmt(bytes / (1024 * 1024), 1)} ${lang === 'ar' ? 'ميغابايت' : 'Mo'}`;
  return `${fmt(Math.max(1, Math.round(bytes / 1024)), 0)} ${lang === 'ar' ? 'كيلوبايت' : 'ko'}`;
}
