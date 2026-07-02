/**
 * Shared read-only access to the analyses catalog (Firestore `analyses` collection),
 * used to turn the lab's terse `analyses_summary` codes (e.g. "NFS, GLY, HBA1C")
 * into human-readable names on the results page.
 *
 * Loaded lazily (only when a patient expands "Détails des analyses") and cached at
 * module scope for the session. Public catalog data — safe to keep in memory.
 */
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/config/firebase';
import type { AnalyseItem } from '@/components/features/catalog/AnalysisCard';

let cache: AnalyseItem[] | null = null;
let inflight: Promise<AnalyseItem[]> | null = null;

/** Fetch the analyses catalog once; subsequent calls reuse the cached list. */
export async function loadAnalysesCatalog(): Promise<AnalyseItem[]> {
  if (cache) return cache;
  if (inflight) return inflight;
  if (!db) return [];
  inflight = getDocs(collection(db, 'analyses'))
    .then((snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<AnalyseItem, 'id'>) }))
        // Guard against a stray header row (same pattern as the analyses page).
        .filter((it) => it.Nom_Patient_FR !== 'Nom_Patient_FR');
      cache = list;
      inflight = null;
      return list;
    })
    .catch(() => {
      inflight = null;
      return [];
    });
  return inflight;
}

const norm = (s: string) => s.replace(/\s+/g, '').toUpperCase();

/**
 * Build a code → analyse lookup. Catalog ids carry a category prefix
 * ("H  NFS", "C  GLY"), but the lab summary sends the bare code ("NFS", "GLY").
 * We therefore index BOTH the full normalized id ("HNFS") and the prefix-stripped
 * bare code ("NFS"). A bare code shared by several analyses is AMBIGUOUS and is
 * dropped — better to show the raw code than risk labelling a result with the
 * wrong analysis name (medical safety). Full-id matches always take precedence.
 */
export function buildCodeMap(analyses: AnalyseItem[]): Map<string, AnalyseItem> {
  const full = new Map<string, AnalyseItem>();
  const bare = new Map<string, AnalyseItem>();
  const bareCounts = new Map<string, number>();

  for (const a of analyses) {
    if (!a.id) continue;
    const fullId = norm(a.id);
    full.set(fullId, a);

    const tokens = a.id.trim().split(/\s+/);
    const bareCode = tokens.length > 1 ? norm(tokens.slice(1).join('')) : fullId;
    bareCounts.set(bareCode, (bareCounts.get(bareCode) ?? 0) + 1);
    bare.set(bareCode, a);
  }

  const map = new Map<string, AnalyseItem>();
  for (const [code, item] of bare) {
    if ((bareCounts.get(code) ?? 0) === 1) map.set(code, item); // unambiguous only
  }
  for (const [id, item] of full) map.set(id, item); // exact id wins over a bare code
  return map;
}

/** Resolve one lab code to its patient-facing name, or return the raw code if unknown. */
export function resolveAnalysisName(
  code: string,
  map: Map<string, AnalyseItem>,
  isArabic: boolean
): string {
  const raw = code.trim();
  if (!raw) return raw;
  const hit = map.get(norm(raw));
  if (!hit) return raw;
  return (isArabic ? hit.Nom_Patient_AR : hit.Nom_Patient_FR) || raw;
}
