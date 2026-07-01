/**
 * CyberLab results API — transport layer.
 *
 * Pure and Firebase-free so it can be unit-tested and reused. Implements the
 * signed request described in docs/integrations/cyberlab-results-api.md §7.3:
 * every request carries an application key plus an HMAC-SHA256 signature over
 * `timestamp + "." + nonce + "." + body`, with a 120s anti-replay window on the
 * server side.
 *
 * No result content is ever logged from here — callers must keep it that way.
 */
import * as crypto from "crypto";

/** One of the caller categories the lab server applies access rights for. */
export type RequesterType = "patient" | "medecin" | "correspondant";

export interface CyberlabConfig {
  /** Base origin, scheme included, e.g. `https://sub.example.com` (no trailing slash). */
  apiUrl: string;
  apiKey: string;
  hmacSecret: string;
}

export interface CyberlabRequest {
  type: RequesterType;
  requester_id: string;
  max_results: number;
}

/** Passed through untouched to the client — shape mirrors the lab API response. */
export interface CyberlabResult {
  dossier_id: string;
  patient_nom: string;
  patient_prenom: string;
  date_dossier: string;
  etat: string;
  analyses_summary: string;
  pdf_base64: string;
}

export interface CyberlabResponse {
  type: RequesterType;
  requester_id: string;
  results: CyberlabResult[];
}

export type CyberlabErrorKind =
  | "unauthorized"
  | "not_found"
  | "rate_limited"
  | "server"
  | "network";

/** Transport-level failure. Carries no response body (may contain medical data). */
export class CyberlabError extends Error {
  readonly kind: CyberlabErrorKind;
  readonly status?: number;
  constructor(kind: CyberlabErrorKind, status?: number) {
    super(`cyberlab_${kind}${status ? `_${status}` : ""}`);
    this.name = "CyberlabError";
    this.kind = kind;
    this.status = status;
  }
}

/**
 * Build the signed security headers for a request body.
 * The exact `body` string signed here MUST be the exact string sent on the wire,
 * otherwise the server-side HMAC will not match.
 */
export function signRequest(
  body: string,
  apiKey: string,
  hmacSecret: string
): Record<string, string> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomUUID();
  const payload = `${timestamp}.${nonce}.${body}`;
  const signature = crypto
    .createHmac("sha256", hmacSecret)
    .update(payload)
    .digest("hex");

  return {
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "X-Timestamp": timestamp,
    "X-Nonce": nonce,
    "X-Signature": signature,
  };
}

function mapStatusToKind(status: number): CyberlabErrorKind {
  if (status === 401) return "unauthorized";
  if (status === 404) return "not_found";
  if (status === 429) return "rate_limited";
  return "server";
}

/**
 * Normalize a configured base URL: default to https:// when no scheme is given
 * and drop any trailing slash. Keeps callers tolerant of a bare hostname in
 * config while guaranteeing a valid absolute URL for `fetch`.
 */
export function normalizeApiUrl(url: string): string {
  const trimmed = url.trim();
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return withScheme.replace(/\/+$/, "");
}

/**
 * POST a signed request to the lab results API and return the parsed JSON.
 * Throws {@link CyberlabError} (never with a body) on any non-2xx / network error.
 */
export async function callCyberlab(
  cfg: CyberlabConfig,
  req: CyberlabRequest
): Promise<CyberlabResponse> {
  // Serialize once: the same string is both signed and sent.
  const body = JSON.stringify({
    type: req.type,
    requester_id: req.requester_id,
    max_results: req.max_results,
  });
  const headers = signRequest(body, cfg.apiKey, cfg.hmacSecret);

  let res: Response;
  try {
    res = await fetch(`${normalizeApiUrl(cfg.apiUrl)}/api/v1/results`, {
      method: "POST",
      headers,
      body,
      // Fail fast on a dead/unreachable origin rather than hanging the caller.
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    // DNS/TLS/connection failure or timeout — no status, no body.
    throw new CyberlabError("network");
  }

  if (!res.ok) {
    throw new CyberlabError(mapStatusToKind(res.status), res.status);
  }

  try {
    return (await res.json()) as CyberlabResponse;
  } catch {
    throw new CyberlabError("server", res.status);
  }
}
