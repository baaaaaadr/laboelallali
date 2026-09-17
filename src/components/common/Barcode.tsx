'use client';

/**
 * Renders a patient code as a Code 128 symbol.
 *
 * Geometry comes from `src/lib/barcode/code128.ts` (pure, unit-verified by
 * `scripts/test-barcode.js`); this component only maps it onto `<rect>`s. No
 * `dangerouslySetInnerHTML`, no canvas — a canvas would reintroduce a DPI
 * question, and blurred bar edges are exactly what makes a scanner fail.
 *
 * It deliberately paints NO background. The white quiet zone must come from an
 * ancestor carrying `.barcode-surface` (see the comment block on that class in
 * `src/styles/index.css`): `.card` is pink, not white, and an inline style would
 * lose to the `!important` rules already in the cascade.
 *
 * That ancestor must also carry `dir="ltr"`. SVG content is not mirrored by the
 * Arabic layout, but the elements laid out around it are — and `dir` is not a
 * valid React SVG prop, so it cannot be set here.
 */

import React, { useMemo } from 'react';
import { barcodeGeometry, fitModuleWidth } from '@/lib/barcode/code128';

/**
 * Below this many pixels per module the symbol stops being reliably readable on
 * a phone screen. Callers with room to spare should rotate rather than shrink.
 */
export const MIN_READABLE_MODULE_PX = 2;

export interface BarcodeProps {
  /** The patient code. An empty or unencodable value renders nothing. */
  value: string;
  /** Pixels available for the whole symbol, quiet zones included. */
  targetWidth: number;
  /** Bar height in pixels. */
  height: number;
  className?: string;
  /** Accessible name. The digits are also shown as text next to the symbol. */
  ariaLabel?: string;
}

export function Barcode({ value, targetWidth, height, className, ariaLabel }: BarcodeProps) {
  const geo = useMemo(() => {
    if (!value || targetWidth <= 0 || height <= 0) return null;
    try {
      const moduleWidth = fitModuleWidth(value, targetWidth);
      return barcodeGeometry(value, { moduleWidth, height });
    } catch {
      // Unencodable (empty, non-ASCII). Never render a partial symbol: a code
      // that scans to the wrong thing is worse than no code at all.
      return null;
    }
  }, [value, targetWidth, height]);

  if (!geo) return null;

  return (
    <svg
      className={className}
      width={geo.width}
      height={geo.height}
      viewBox={`0 0 ${geo.width} ${geo.height}`}
      role="img"
      aria-label={ariaLabel ?? value}
    >
      {geo.bars.map((bar, i) => (
        <rect
          key={i}
          x={bar.x}
          y={0}
          width={bar.w}
          height={geo.height}
          fill="#000"
          shapeRendering="crispEdges"
        />
      ))}
    </svg>
  );
}

/** Does this code fit legibly in `targetWidth`? Drives the rotate fallback. */
export function barcodeFits(value: string, targetWidth: number): boolean {
  if (!value || targetWidth <= 0) return false;
  try {
    return fitModuleWidth(value, targetWidth) >= MIN_READABLE_MODULE_PX;
  } catch {
    return false;
  }
}

export default Barcode;
