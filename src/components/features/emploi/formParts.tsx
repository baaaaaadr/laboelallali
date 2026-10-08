"use client";

/**
 * Small presentational pieces of the « Emploi & Stage » form. No state here:
 * everything lives in `ApplicationForm.tsx`.
 *
 * ⚠ Chip colours are INLINE styles: the global button rules beat Tailwind
 * colour utilities on <button> (measured in the admin: grey text on bordeaux).
 * Titles are <p>, not <h2>: `base/reset.css` sizes and colours h1/h2 unlayered.
 */
import React from 'react';
import { FileText, Paperclip, X } from 'lucide-react';

export const inputClass =
  'w-full rounded-lg px-3 py-3 border bg-[var(--background-default)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-fuchsia-accent)] text-base sm:text-sm';

const border = (error?: string | null) =>
  error ? 'border-[var(--status-error)]' : 'border-[var(--border-default)]';

export function Section({
  id,
  step,
  title,
  children,
}: {
  id: string;
  step: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="card p-5 sm:p-6 space-y-5"
      style={{ scrollMarginTop: 'var(--header-total-height)' }}
    >
      <p className="flex items-center gap-3 text-lg font-bold text-[var(--text-primary)]">
        <span
          className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-lg bg-[var(--color-bordeaux-primary)]/10 dark:bg-[var(--color-bordeaux-primary)]/20 text-[var(--color-bordeaux-primary)] font-bold text-sm"
          aria-hidden="true"
        >
          {step}
        </span>
        <span>{title}</span>
      </p>
      {children}
    </section>
  );
}

export function Label({
  htmlFor,
  id,
  children,
  required,
  optional,
}: {
  htmlFor?: string;
  id?: string;
  children: React.ReactNode;
  required?: boolean;
  /** The translated « facultatif », shown after the label. */
  optional?: string;
}) {
  const Tag = htmlFor ? 'label' : 'p';
  return (
    <Tag
      {...(htmlFor ? { htmlFor } : {})}
      id={id}
      className="block text-sm font-medium text-[var(--text-primary)] mb-1.5"
    >
      {children}
      {required && <span className="text-[var(--status-error)] ms-1">*</span>}
      {optional && <span className="ms-1 font-normal text-[var(--text-tertiary)]">({optional})</span>}
    </Tag>
  );
}

export function FieldError({ id, error }: { id: string; error?: string | null }) {
  if (!error) return null;
  return (
    <p id={`${id}-error`} className="mt-1 text-xs text-[var(--status-error)]" role="alert">
      {error}
    </p>
  );
}

export function TextField({
  id,
  label,
  value,
  onChange,
  error,
  required,
  optional,
  help,
  type = 'text',
  inputMode,
  autoComplete,
  placeholder,
  dir,
  maxLength = 60,
  min,
  max,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string | null;
  required?: boolean;
  optional?: string;
  help?: string;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  autoComplete?: string;
  placeholder?: string;
  dir?: 'ltr' | 'rtl';
  maxLength?: number;
  min?: string;
  max?: string;
}) {
  return (
    <div data-field={id}>
      <Label htmlFor={`f-${id}`} required={required} optional={optional}>
        {label}
      </Label>
      <input
        id={`f-${id}`}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode={inputMode}
        autoComplete={autoComplete}
        placeholder={placeholder}
        dir={dir}
        maxLength={maxLength}
        min={min}
        max={max}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`${inputClass} ${border(error)}`}
      />
      {help && !error && <p className="mt-1 text-xs text-[var(--text-tertiary)]">{help}</p>}
      <FieldError id={id} error={error} />
    </div>
  );
}

// Selected text = the page background: white on bordeaux in light mode, dark
// on the pink that bordeaux becomes in dark mode (white on that pink was 2:1).
const chipStyle = (on: boolean): React.CSSProperties =>
  on
    ? {
        background: 'var(--color-bordeaux-primary)',
        color: 'var(--background-default)',
        borderColor: 'var(--color-bordeaux-primary)',
        transition: 'none',
      }
    : {
        background: 'var(--background-default)',
        color: 'var(--text-primary)',
        borderColor: 'var(--border-default)',
        transition: 'none',
      };

/** A row of choice chips — one choice (`radio`) or several (`checkbox`). */
export function Chips({
  id,
  label,
  options,
  value,
  onToggle,
  multiple = false,
  error,
  required,
  optional,
  help,
}: {
  id: string;
  label: string;
  options: { value: string; label: string }[];
  /** The selected value(s). */
  value: string | string[];
  onToggle: (v: string) => void;
  multiple?: boolean;
  error?: string | null;
  required?: boolean;
  optional?: string;
  help?: string;
}) {
  const selected = (v: string) => (Array.isArray(value) ? value.includes(v) : value === v);
  return (
    <div data-field={id}>
      <Label id={`l-${id}`} required={required} optional={optional}>
        {label}
      </Label>
      <div
        role={multiple ? 'group' : 'radiogroup'}
        aria-labelledby={`l-${id}`}
        aria-invalid={!!error}
        className="flex flex-wrap gap-2"
        data-testid={`chips-${id}`}
      >
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role={multiple ? 'checkbox' : 'radio'}
            aria-checked={selected(o.value)}
            onClick={() => onToggle(o.value)}
            className="min-h-[44px] px-3.5 rounded-lg border text-sm font-medium"
            style={chipStyle(selected(o.value))}
            data-value={o.value}
          >
            {o.label}
          </button>
        ))}
      </div>
      {help && !error && <p className="mt-1.5 text-xs text-[var(--text-tertiary)]">{help}</p>}
      <FieldError id={id} error={error} />
    </div>
  );
}

/** One file slot: choose, see what is attached, replace or remove. */
export function FilePicker({
  id,
  label,
  required,
  optional,
  accept,
  file,
  sizeLabel,
  busy,
  error,
  onPick,
  onClear,
  chooseLabel,
  replaceLabel,
  removeLabel,
  busyLabel,
}: {
  id: string;
  label: string;
  required?: boolean;
  optional?: string;
  accept: string;
  file: { name: string } | null;
  sizeLabel?: string;
  busy: boolean;
  error?: string | null;
  onPick: (f: File) => void;
  onClear: () => void;
  chooseLabel: string;
  replaceLabel: string;
  removeLabel: string;
  busyLabel: string;
}) {
  return (
    <div data-field={id}>
      <Label htmlFor={`f-${id}`} required={required} optional={optional}>
        {label}
      </Label>
      <div
        className={`rounded-lg border-2 border-dashed p-3 flex flex-wrap items-center gap-3 ${
          error ? 'border-[var(--status-error)]' : 'border-[var(--border-default)]'
        }`}
      >
        {/* The file on its OWN row: sharing it with the buttons squeezed the
            name to 0 px on a phone (measured at 390 px). */}
        {file && (
          <span className="flex items-center gap-2 min-w-0 w-full text-sm text-[var(--text-primary)]" data-testid={`file-${id}`}>
            <FileText size={18} className="flex-shrink-0 text-[var(--color-bordeaux-primary)]" />
            <span className="truncate" dir="ltr">
              {file.name}
            </span>
            {sizeLabel && <span className="flex-shrink-0 text-xs text-[var(--text-tertiary)]">{sizeLabel}</span>}
          </span>
        )}
        <label
          htmlFor={`f-${id}`}
          className="cursor-pointer inline-flex items-center gap-2 min-h-[44px] px-3.5 rounded-lg border text-sm font-medium"
          style={chipStyle(false)}
        >
          <Paperclip size={16} className="flex-shrink-0" />
          {busy ? busyLabel : file ? replaceLabel : chooseLabel}
        </label>
        <input
          id={`f-${id}`}
          type="file"
          accept={accept}
          className="sr-only"
          disabled={busy}
          data-testid={`input-${id}`}
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = ''; // the same file can be chosen again after a removal
            if (f) onPick(f);
          }}
        />
        {file && !busy && (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-1 min-h-[44px] px-2 text-sm text-[var(--text-secondary)]"
            data-testid={`remove-${id}`}
          >
            <X size={16} />
            {removeLabel}
          </button>
        )}
      </div>
      <FieldError id={id} error={error} />
    </div>
  );
}
