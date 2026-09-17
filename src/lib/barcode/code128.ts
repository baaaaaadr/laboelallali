/**
 * Code 128 encoder — turns a patient code into bar geometry.
 *
 * Why this exists: the patient shows their lab code on their phone at the front
 * desk, and the counter scanner emulates a keyboard — it types the number into
 * Qalam's patient search. Code 128 is what every counter scanner reads by
 * default, it packs digits two at a time, and unlike EAN-13 it has no fixed
 * length. Nothing on npm was needed: `qrcode` (already a dependency) only does
 * QR, and a Code 128 encoder is ~100 lines.
 *
 * Ported verbatim from `marketing/scripts/generer-code-barres.js`, the script
 * that produced the test sheets the lab scanned before buying a 2D reader. That
 * implementation was verified by decoding its own output back (7 cases) and by
 * cross-checking the check character against a reference value
 * (Code128-C "1234" → 82). `scripts/test-barcode.js` re-runs both here.
 *
 * Pure: no React, no DOM, no `'use client'` — like `../results/stats`. ~1 KB, so
 * it is imported statically (the dynamic-import rule in this repo exists for
 * heavy client-only libs such as `jspdf`, not for this).
 */

/**
 * The 107 Code 128 patterns. Each is a run of element widths in modules,
 * alternating bar / space / bar / space / bar / space.
 *
 * Index 0-102 are data values, 103 = Start A, 104 = Start B, 105 = Start C,
 * 106 = Stop.
 *
 * ⚠ `PATTERNS[106]` is `"2331112"` — **seven** digits, not six. That is correct:
 * the Stop pattern carries a 13-module termination bar. It looks like a typo.
 * It is not. Do not "fix" it.
 */
const PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
] as const;

const START_B = 104;
const START_C = 105;
const STOP = 106;
/** Value 99 in set B switches to set C. */
const CODE_C_FROM_B = 99;

/** Default quiet zone, in modules, on each side. */
export const QUIET_MODULES = 10;

export interface BarcodeOptions {
  /** Pixel width of one module. Must be a whole number — see `fitModuleWidth`. */
  moduleWidth?: number;
  /** Bar height in pixels. */
  height?: number;
  /** Quiet zone in modules, per side. */
  quiet?: number;
}

export class Code128Error extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'Code128Error';
  }
}

/**
 * Translate a string into Code 128 values.
 *
 * All digits → set C (two digits per symbol, half the width). An odd length puts
 * the first digit in set B, then switches to C. Anything else → set B throughout.
 *
 * Throws on an empty string: an empty symbol still encodes to Start + check +
 * Stop, which scans as nothing at all. Callers must render a waiting message
 * instead of an unreadable barcode.
 */
export function encodeValues(data: string): number[] {
  if (data === '') {
    throw new Code128Error('Cannot encode an empty string.');
  }

  const digitsOnly = /^\d+$/.test(data);
  const values: number[] = [];

  if (!digitsOnly) {
    values.push(START_B);
    for (const ch of data) {
      const code = ch.charCodeAt(0);
      if (code < 32 || code > 126) {
        throw new Code128Error(`Character not supported in Code 128 B: "${ch}"`);
      }
      values.push(code - 32);
    }
    return values;
  }

  let rest = data;
  if (data.length % 2 === 1) {
    values.push(START_B, data.charCodeAt(0) - 32, CODE_C_FROM_B);
    rest = data.slice(1);
  } else {
    values.push(START_C);
  }
  for (let i = 0; i < rest.length; i += 2) {
    values.push(parseInt(rest.slice(i, i + 2), 10));
  }
  return values;
}

/**
 * Check character: Start value plus each value weighted by its rank (1, 2, 3…),
 * modulo 103. The scanner recomputes it; if it does not match, it stays silent.
 */
export function checksum(values: number[]): number {
  let sum = values[0];
  for (let i = 1; i < values.length; i++) sum += i * values[i];
  return sum % 103;
}

/** Successive bar/space widths in modules, check character and Stop included. */
export function modules(data: string): number[] {
  const values = encodeValues(data);
  values.push(checksum(values), STOP);
  const widths: number[] = [];
  for (const v of values) {
    for (const w of PATTERNS[v]) widths.push(Number(w));
  }
  return widths;
}

export interface BarcodeBar {
  /** Left edge in pixels, quiet zone included. */
  x: number;
  /** Width in pixels. */
  w: number;
}

export interface BarcodeGeometry {
  /** Total width in pixels, both quiet zones included. */
  width: number;
  height: number;
  /** Bars only — spaces are the background showing through. */
  bars: BarcodeBar[];
}

/**
 * Lay the symbol out in pixels.
 *
 * Only bars are returned: the spaces are the (white) surface behind them. The
 * quiet zone is part of the symbol — without it many scanners refuse to decode,
 * which is why it is baked into `width` rather than left to the caller's CSS.
 *
 * React maps `bars` onto `<rect shapeRendering="crispEdges">`, so nothing here
 * needs `dangerouslySetInnerHTML`, and the geometry stays unit-testable.
 */
export function barcodeGeometry(data: string, opts: BarcodeOptions = {}): BarcodeGeometry {
  const moduleWidth = opts.moduleWidth ?? 3;
  const height = opts.height ?? 120;
  const quiet = opts.quiet ?? QUIET_MODULES;

  const widths = modules(data);
  const totalModules = widths.reduce((a, b) => a + b, 0) + quiet * 2;

  const bars: BarcodeBar[] = [];
  let x = quiet * moduleWidth;
  widths.forEach((width, i) => {
    const px = width * moduleWidth;
    // Even indices are bars, odd are spaces.
    if (i % 2 === 0) bars.push({ x, w: px });
    x += px;
  });

  return { width: totalModules * moduleWidth, height, bars };
}

/**
 * Largest whole-pixel module width that keeps the symbol within `targetPx`.
 *
 * Whole pixels are mandatory. A module of 7.4px rasterizes into bars of unequal
 * width, and the scanner then reads the wrong ratios. Rounding down and leaving
 * a few pixels unused is the correct trade.
 *
 * Returns at least 1. A result below 2 means the code is too long for the space:
 * callers should rotate the symbol rather than render something unreadable.
 */
export function fitModuleWidth(data: string, targetPx: number, quiet = QUIET_MODULES): number {
  const totalModules = modules(data).reduce((a, b) => a + b, 0) + quiet * 2;
  return Math.max(1, Math.floor(targetPx / totalModules));
}

/** Total width in modules — lets a caller size a symbol without laying it out. */
export function totalModules(data: string, quiet = QUIET_MODULES): number {
  return modules(data).reduce((a, b) => a + b, 0) + quiet * 2;
}

/** Exposed for the verification bench only (`scripts/test-barcode.js`). */
export const __patterns = PATTERNS;
