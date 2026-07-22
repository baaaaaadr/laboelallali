import React from 'react';
import { CheckCircle, AlertCircle } from 'lucide-react';

export type VerdictTone = 'success' | 'warning' | 'error';

/**
 * Verdict panel — states what was observed, what it means, and the one thing to
 * do next (constat · signification · action). Born as the /admin "Tester" tab's
 * TestVerdict: a bare one-liner ("Aucun résultat") left staff and patients with
 * nowhere to go, so every outcome gets its own explicit panel instead.
 *
 * Shared by /admin (test verdicts) and /resultats (patient-facing states).
 * `actions` renders below the todo line — buttons (copy / WhatsApp / retry) or a
 * message preview the reader can transmit as-is.
 */
export default function VerdictPanel({
  tone,
  title,
  body,
  todo,
  actions,
}: {
  tone: VerdictTone;
  title: string;
  body: string;
  todo?: string;
  actions?: React.ReactNode;
}) {
  const colour = `var(--status-${tone})`;
  const Icon = tone === 'success' ? CheckCircle : AlertCircle;
  return (
    <div
      className="rounded-lg border p-3 space-y-1.5"
      style={{ borderColor: colour, background: 'var(--background-secondary)' }}
    >
      <p className="flex items-center gap-2 text-sm font-semibold" style={{ color: colour }}>
        <Icon size={16} className="flex-shrink-0" /> {title}
      </p>
      <p className="text-sm text-[var(--text-secondary)]">{body}</p>
      {todo && (
        <p className="text-sm font-medium text-[var(--text-primary)] border-s-2 ps-2.5" style={{ borderColor: colour }}>
          {todo}
        </p>
      )}
      {actions && <div className="flex flex-wrap items-center gap-2 pt-1.5">{actions}</div>}
    </div>
  );
}
