'use client';

/**
 * Tiny presentational chart primitives for the admin dashboard.
 *
 * Hand-built in SVG/CSS on purpose: the project ships no charting library and a
 * dashboard seen by three people does not justify one. Every colour comes from the
 * design-system CSS variables, so both themes work without a second palette.
 *
 * Conventions kept deliberately boring and readable:
 *  - one hue per chart (never a rainbow); status colours only where they mean
 *    good/warning, and always paired with a text label;
 *  - a recessive grid, thin marks, `tabular-nums` on every figure;
 *  - each chart is a single `role="img"` with an `aria-label` that states the data,
 *    so a screen reader gets the point without reading the geometry.
 */

import React from 'react';

/** Shown instead of a flat line when a metric has not collected anything yet. */
export function ChartEmpty({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center text-center px-4 py-8 rounded-lg bg-[var(--background-secondary)] text-sm text-[var(--text-tertiary)]">
      {label}
    </div>
  );
}

/** Section wrapper: title + optional subtitle, then the chart, then the "why". */
export function ChartCard({
  title,
  subtitle,
  hint,
  children,
}: {
  title: string;
  subtitle?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card p-5">
      <p className="text-base font-semibold text-[var(--text-primary)] leading-snug">{title}</p>
      {subtitle && <p className="text-xs text-[var(--text-tertiary)] mt-0.5 mb-3">{subtitle}</p>}
      {!subtitle && <div className="mb-3" />}
      {children}
      {hint && (
        <p className="text-xs text-[var(--text-secondary)] mt-3 pt-3 border-t border-dashed border-[var(--border-default)] leading-relaxed">
          {hint}
        </p>
      )}
    </div>
  );
}

/** A single big figure with a caption — used when a chart would say less. */
export function StatBig({ value, caption }: { value: string; caption: React.ReactNode }) {
  return (
    <>
      <div className="text-3xl font-bold text-[var(--text-primary)] tabular-nums leading-none">{value}</div>
      <div className="text-sm text-[var(--text-secondary)] mt-1.5">{caption}</div>
    </>
  );
}

/**
 * Cumulative curve (area + line). `points` are ordered oldest → newest.
 * Scales to the max value; the last point is emphasised with a dot + its value.
 */
export function AreaChart({
  points,
  ariaLabel,
  emptyLabel,
}: {
  points: { label: string; value: number }[];
  ariaLabel: string;
  emptyLabel: string;
}) {
  const max = Math.max(...points.map((p) => p.value), 0);
  if (!points.length || max === 0) return <ChartEmpty label={emptyLabel} />;

  const W = 600;
  const L = 24;
  const R = 580;
  const TOP = 12;
  const BASE = 138;
  const top = max * 1.1 || 1; // headroom so the peak isn't glued to the ceiling
  const x = (i: number) => (points.length === 1 ? R : L + (i * (R - L)) / (points.length - 1));
  const y = (v: number) => BASE - (v / top) * (BASE - TOP);

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const area = `${line} L${R},${BASE} L${L},${BASE} Z`;
  const last = points[points.length - 1];

  return (
    <svg viewBox={`0 0 ${W} 168`} className="w-full h-auto block" role="img" aria-label={ariaLabel}>
      {[BASE, 106, 74, 42, TOP].map((gy) => (
        <line
          key={gy}
          x1={L}
          y1={gy}
          x2={R}
          y2={gy}
          stroke="var(--border-default)"
          strokeWidth="1"
          opacity={gy === BASE ? 1 : 0.45}
        />
      ))}
      <path d={area} fill="var(--color-fuchsia-accent)" opacity="0.13" />
      <path d={line} fill="none" stroke="var(--color-fuchsia-accent)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(points.length - 1)} cy={y(last.value)} r="4.5" fill="var(--color-fuchsia-accent)" />
      {points.map((p, i) => (
        <text
          key={p.label}
          x={x(i)}
          y="158"
          textAnchor="middle"
          style={{ fill: 'var(--text-tertiary)', fontSize: 11 }}
        >
          {p.label}
        </text>
      ))}
      <text
        x={R}
        y={Math.max(y(last.value) - 9, 11)}
        textAnchor="end"
        style={{ fill: 'var(--text-primary)', fontSize: 12, fontWeight: 700 }}
      >
        {last.value}
      </text>
    </svg>
  );
}

/** Vertical bars — for a per-period series (weekly activity, weekly delays). */
export function VBars({
  bars,
  ariaLabel,
  emptyLabel,
  height = 118,
}: {
  bars: { label: string; value: number }[];
  ariaLabel: string;
  emptyLabel: string;
  height?: number;
}) {
  const max = Math.max(...bars.map((b) => b.value), 0);
  if (!bars.length || max === 0) return <ChartEmpty label={emptyLabel} />;

  return (
    <div role="img" aria-label={ariaLabel}>
      <div className="flex items-end gap-1.5" style={{ height }}>
        {bars.map((b, i) => (
          <div
            key={`${b.label}-${i}`}
            className="flex-1 rounded-t bg-[var(--color-fuchsia-accent)]"
            style={{ height: `${Math.max((b.value / max) * 100, b.value > 0 ? 4 : 1)}%` }}
            title={`${b.label} : ${b.value}`}
          />
        ))}
      </div>
      <div className="flex gap-1.5 mt-1.5">
        {bars.map((b, i) => (
          <span key={`${b.label}-l-${i}`} className="flex-1 text-center text-[10px] text-[var(--text-tertiary)] tabular-nums">
            {b.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Horizontal bars — for rankings, funnels and per-bucket rates. */
export function HBars({
  rows,
  ariaLabel,
  emptyLabel,
  scaleMax,
}: {
  rows: { label: string; value: number; display: string; warn?: boolean }[];
  ariaLabel: string;
  emptyLabel: string;
  /**
   * Fixed upper bound for the bar widths. Counts (rankings, funnels) have no
   * natural ceiling and scale against the largest row, but a series that is
   * already a percentage must scale against 100 — otherwise the biggest value
   * is always drawn as a full bar and contradicts the figure printed next to it.
   */
  scaleMax?: number;
}) {
  const dataMax = Math.max(...rows.map((r) => r.value), 0);
  // Emptiness is a property of the data, never of the fixed scale.
  if (!rows.length || dataMax === 0) return <ChartEmpty label={emptyLabel} />;
  const max = scaleMax ?? dataMax;

  return (
    <div className="flex flex-col gap-2.5" role="img" aria-label={ariaLabel}>
      {rows.map((r, i) => (
        <div key={`${r.label}-${i}`} className="grid items-center gap-2.5" style={{ gridTemplateColumns: '5.5rem 1fr auto' }}>
          <span className="text-xs text-[var(--text-secondary)] truncate">{r.label}</span>
          <span className="h-3.5 rounded-lg bg-[var(--background-secondary)] overflow-hidden">
            <span
              className="block h-full rounded-lg"
              style={{
                width: `${Math.max((r.value / max) * 100, r.value > 0 ? 2 : 0)}%`,
                background: r.warn ? 'var(--status-warning)' : 'var(--color-fuchsia-accent)',
              }}
            />
          </span>
          <span className="text-xs font-bold text-[var(--text-primary)] tabular-nums text-end min-w-[3rem]">
            {r.display}
          </span>
        </div>
      ))}
    </div>
  );
}

/** One 100 % stacked bar + a labelled key. Segments carry their own colour. */
export function StackedBar({
  segments,
  ariaLabel,
  emptyLabel,
}: {
  segments: { label: string; value: number; color: string }[];
  ariaLabel: string;
  emptyLabel: string;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  if (!total) return <ChartEmpty label={emptyLabel} />;

  return (
    <div>
      <div className="flex h-4 rounded-lg overflow-hidden gap-0.5" role="img" aria-label={ariaLabel}>
        {segments
          .filter((s) => s.value > 0)
          .map((s) => (
            <span
              key={s.label}
              style={{ width: `${(s.value / total) * 100}%`, background: s.color }}
              title={`${s.label} : ${s.value}`}
            />
          ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
        {segments.map((s) => (
          <span key={s.label} className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: s.color }} />
            {s.label} — <b className="text-[var(--text-primary)] tabular-nums">{s.value}</b>
          </span>
        ))}
      </div>
    </div>
  );
}
