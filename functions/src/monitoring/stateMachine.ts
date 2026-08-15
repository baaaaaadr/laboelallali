/**
 * Pure state machine for the CyberLab server health check — no Firebase, no
 * network, no clock (mirrors the `cyberlab/client.ts` philosophy) so it can be
 * unit-driven by `functions/scripts/test-health-check.js`.
 *
 * The scheduled function (`monitoring/healthCheck.ts`) probes the lab server,
 * classifies the result with `classifyProbe`, reads the persisted state from
 * `systemStatus/cyberlab`, and applies `evaluate()`'s patch + actions.
 *
 * Alerting contract (owner-confirmed):
 *  - emails ONLY on state transitions (down detected / recovered), never per check;
 *  - a reminder while the outage lasts, at most once per REMINDER_EVERY_MS;
 *  - at-least-once alerts: the down alert is marked sent only AFTER the email
 *    succeeds (`downAlertPending` stays true otherwise and the next check retries);
 *  - flap guard: a new down alert is suppressed while the previous one is younger
 *    than ALERT_DEDUP_MS (recovery emails are never suppressed — patients on the
 *    waitlist were promised one).
 */

/** How the probe ended. `error` carries only {kind, status} — never a body. */
export type ProbeOutcome =
  | { up: true }
  | {
      up: false;
      reason: "server" | "config";
      error: { kind: string; status: number | null };
    };

/**
 * Persisted state (all date fields are epoch millis in this pure layer; the
 * plumbing converts to/from Firestore Timestamps).
 */
export interface HealthState {
  up: boolean;
  reason: "server" | "config" | null;
  since: number | null;
  lastCheckAt: number | null;
  lastOkAt: number | null;
  lastError: { kind: string; status: number | null } | null;
  downSince: number | null;
  /** True while a down alert is owed to the staff (unsent or failed send). */
  downAlertPending: boolean;
  lastDownAlertAt: number | null;
  lastReminderAt: number | null;
  patientsImpacted: number;
  waitlistPending: boolean;
  /** Written by fetchResults' patient-impact hook; reset on recovery. */
  lastPatientAlertAt?: number | null;
  lastPatientImpactAt?: number | null;
}

export type HealthAction =
  | { type: "alert_down"; reason: "server" | "config"; error: { kind: string; status: number | null } }
  | { type: "reminder"; downSince: number; patientsImpacted: number }
  | {
      type: "recover";
      outage: {
        startedAt: number;
        endedAt: number;
        durationMs: number;
        reason: "server" | "config" | null;
        lastError: { kind: string; status: number | null } | null;
        patientsImpacted: number;
      };
    }
  | { type: "sweep_waitlist" };

export interface Evaluation {
  /** Merge-patch for the state doc (dates as millis; plumbing converts). */
  patch: Partial<HealthState>;
  actions: HealthAction[];
}

/** Suppress a repeated down alert while the previous one is this recent. */
export const ALERT_DEDUP_MS = 30 * 60 * 1000; // 30 min

/** While an outage lasts, remind the staff at most this often. */
export const REMINDER_EVERY_MS = 6 * 60 * 60 * 1000; // 6 h

/** First run / missing doc: assume up so a first failed probe alerts normally. */
export function defaultState(): HealthState {
  return {
    up: true,
    reason: null,
    since: null,
    lastCheckAt: null,
    lastOkAt: null,
    lastError: null,
    downSince: null,
    downAlertPending: false,
    lastDownAlertAt: null,
    lastReminderAt: null,
    patientsImpacted: 0,
    waitlistPending: false,
  };
}

/**
 * Classify one probe attempt. `err` is null on success, otherwise an error —
 * ideally a CyberlabError-shaped `{kind, status?}`.
 *
 *  - 404 (`not_found`) / 429 (`rate_limited`): the server ANSWERED → UP. This
 *    also means deleting the lab-side test patient can never cause a false alarm.
 *  - 401 (`unauthorized`): server up but OUR key/signature is rejected → DOWN
 *    with reason "config" (the staff email says "not a power cut").
 *  - `network` (DNS/conn refused/20 s timeout) and `server` (5xx, incl.
 *    Cloudflare 522/523) → DOWN with reason "server".
 *  - Anything unexpected (a bug of ours) → DOWN "config": it IS an outage for
 *    patients, but nobody should go check the lab's power supply over it.
 */
export function classifyProbe(err: { kind?: string; status?: number } | null): ProbeOutcome {
  if (!err) return { up: true };
  const kind = typeof err.kind === "string" ? err.kind : "unexpected";
  const status = typeof err.status === "number" ? err.status : null;
  if (kind === "not_found" || kind === "rate_limited") return { up: true };
  if (kind === "network" || kind === "server") {
    return { up: false, reason: "server", error: { kind, status } };
  }
  // "unauthorized" + unknown shapes.
  return { up: false, reason: "config", error: { kind, status } };
}

/** Decide the state patch + side effects for one (state, probe result) pair. */
export function evaluate(
  state: HealthState | null,
  outcome: ProbeOutcome,
  now: number
): Evaluation {
  const s = state ?? defaultState();
  const actions: HealthAction[] = [];

  if (outcome.up) {
    if (s.up) {
      // Steady up — heartbeat; sweep a waitlist left over from a crash mid-drain
      // (or an opt-in that raced the recovery).
      if (s.waitlistPending) actions.push({ type: "sweep_waitlist" });
      return { patch: { lastCheckAt: now, lastOkAt: now }, actions };
    }
    // DOWN → UP: recovery. lastDownAlertAt is deliberately KEPT (flap guard
    // across a quick down/up/down); downAlertPending is cleared — that alert
    // is obsolete, the recovery email supersedes it.
    actions.push({
      type: "recover",
      outage: {
        startedAt: s.downSince ?? now,
        endedAt: now,
        durationMs: now - (s.downSince ?? now),
        reason: s.reason,
        lastError: s.lastError,
        patientsImpacted: s.patientsImpacted ?? 0,
      },
    });
    return {
      patch: {
        up: true,
        reason: null,
        since: now,
        lastCheckAt: now,
        lastOkAt: now,
        lastError: null,
        downSince: null,
        downAlertPending: false,
        lastReminderAt: null,
        patientsImpacted: 0,
        // Clear the patient-impact dedup so the next outage's first "un patient
        // bloqué" email is never suppressed by the previous outage's window.
        lastPatientAlertAt: null,
        lastPatientImpactAt: null,
      },
      actions,
    };
  }

  // Probe says DOWN.
  const patch: Partial<HealthState> = {
    lastCheckAt: now,
    lastError: outcome.error,
    reason: outcome.reason,
  };
  let alertPending: boolean;
  if (s.up) {
    // UP → DOWN: the transition. State is committed BEFORE any email is sent;
    // the alert is only marked done (downAlertPending=false + lastDownAlertAt)
    // by the plumbing AFTER the send succeeds → at-least-once.
    patch.up = false;
    patch.since = now;
    patch.downSince = now;
    patch.downAlertPending = true;
    alertPending = true;
  } else {
    alertPending = s.downAlertPending ?? false;
  }

  // Fire the down alert when one is owed, UNLESS a previous alert is still
  // within the flap-guard window. A null `lastDownAlertAt` means "never alerted"
  // (first outage, or a prior send failed) → always fire.
  const flapGuardClear =
    s.lastDownAlertAt === null || now - s.lastDownAlertAt >= ALERT_DEDUP_MS;
  if (alertPending && flapGuardClear) {
    actions.push({ type: "alert_down", reason: outcome.reason, error: outcome.error });
  } else if (
    !alertPending &&
    s.downSince !== null &&
    now - s.downSince >= REMINDER_EVERY_MS &&
    now - Math.max(s.lastReminderAt ?? 0, s.lastDownAlertAt ?? 0) >= REMINDER_EVERY_MS
  ) {
    actions.push({
      type: "reminder",
      downSince: s.downSince,
      patientsImpacted: s.patientsImpacted ?? 0,
    });
  }

  return { patch, actions };
}
