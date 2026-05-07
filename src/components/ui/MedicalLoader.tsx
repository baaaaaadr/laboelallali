"use client";


const TUBE_CSS = `
@keyframes ml-rise {
  0%, 100% { transform: translateY(28px); }
  50%       { transform: translateY(2px);  }
}
@keyframes ml-bubble {
  0%   { opacity: 0;   transform: translateY(0);     }
  15%  { opacity: 0.7; }
  100% { opacity: 0;   transform: translateY(-44px); }
}
@keyframes ml-drip {
  0%   { opacity: 0;   transform: translateY(-3px); }
  20%  { opacity: 1;   transform: translateY(0);    }
  80%  { opacity: 0.8; transform: translateY(10px); }
  100% { opacity: 0;   transform: translateY(16px); }
}
@keyframes ml-shimmer {
  0%, 100% { opacity: 0.22; }
  50%       { opacity: 0.42; }
}
@keyframes ml-glow {
  0%, 100% { opacity: 0.6; }
  50%       { opacity: 1;   }
}
.ml-rise    { animation: ml-rise 3s ease-in-out infinite; transform-box: fill-box; transform-origin: center bottom; }
.ml-b1      { animation: ml-bubble 3s ease-out infinite 0s;    transform-box: fill-box; transform-origin: center center; }
.ml-b2      { animation: ml-bubble 3s ease-out infinite 1.1s;  transform-box: fill-box; transform-origin: center center; }
.ml-b3      { animation: ml-bubble 3s ease-out infinite 2s;    transform-box: fill-box; transform-origin: center center; }
.ml-drip    { animation: ml-drip 2.6s ease-in infinite; transform-box: fill-box; transform-origin: center top; }
.ml-shimmer { animation: ml-shimmer 2.4s ease-in-out infinite; }
.ml-glow    { animation: ml-glow 3s ease-in-out infinite; }
`;

interface MedicalLoaderProps {
  label?: string;
  fullScreen?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export default function MedicalLoader({
  label,
  fullScreen = false,
  size = 'md',
}: MedicalLoaderProps) {
  const scale = { sm: 0.58, md: 1, lg: 1.32 }[size];
  const W = Math.round(56 * scale);
  const H = Math.round(152 * scale);

  return (
    <>
      <style>{TUBE_CSS}</style>
      <div
        className={
          fullScreen
            ? 'fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/40 backdrop-blur-md'
            : 'flex flex-col items-center justify-center py-12 w-full'
        }
        role="status"
        aria-label={label ?? 'Chargement en cours'}
      >
        <svg
          width={W}
          height={H}
          viewBox="0 0 56 152"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <defs>
            {/* Clip to tube inner shape */}
            <clipPath id="ml-clip">
              <path d="M16 23 L40 23 L40 118 Q40 136 28 136 Q16 136 16 118 Z" />
            </clipPath>

            {/* Blood gradient: darker on edges, vivid centre */}
            <linearGradient id="ml-blood" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%"   stopColor="#6B0016" />
              <stop offset="45%"  stopColor="#9B001E" />
              <stop offset="100%" stopColor="#6B0016" />
            </linearGradient>

            {/* Cap gradient */}
            <linearGradient id="ml-cap-grad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%"   stopColor="#5a0016" />
              <stop offset="50%"  stopColor="#9A0020" />
              <stop offset="100%" stopColor="#5a0016" />
            </linearGradient>

            {/* Subtle glow behind tube bottom */}
            <radialGradient id="ml-glow-grad" cx="50%" cy="80%" r="60%">
              <stop offset="0%"   stopColor="#9B001E" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#9B001E" stopOpacity="0"    />
            </radialGradient>
          </defs>

          {/* ── GLOW (bottom halo, pulses) ── */}
          <ellipse cx="28" cy="136" rx="18" ry="8" fill="url(#ml-glow-grad)" className="ml-glow" />

          {/* ── RUBBER STOPPER / CAP ── */}
          {/* Top ridge */}
          <rect x="22" y="1"  width="12" height="4"  rx="2" fill="#420010" />
          {/* Cap body */}
          <rect x="14" y="4"  width="28" height="16" rx="5" fill="url(#ml-cap-grad)" />
          {/* Cap bottom collar */}
          <rect x="14" y="18" width="28" height="5"  rx="1.5" fill="#420010" />
          {/* Shine on cap */}
          <rect x="18" y="7"  width="5"  height="9"  rx="2.5" fill="rgba(255,255,255,0.17)" />

          {/* ── GLASS TUBE BODY ── */}
          <path
            d="M16 23 L40 23 L40 118 Q40 136 28 136 Q16 136 16 118 Z"
            fill="rgba(255,238,242,0.15)"
            stroke="#800020"
            strokeWidth="2"
            strokeLinejoin="round"
          />

          {/* ── BLOOD (animated group that rises and falls) ── */}
          <g clipPath="url(#ml-clip)">
            <g className="ml-rise">
              {/* Main blood fill */}
              <rect x="16" y="60" width="24" height="90" fill="url(#ml-blood)" />

              {/* Wave — layer 1 (dark crest) */}
              <path
                d="M16 60 C19 55 23 65 27 60 C31 55 35 65 39 60 C40 58 40 60 40 60 L40 70 L16 70 Z"
                fill="#A80022"
              />
              {/* Wave — layer 2 (light highlight on crest) */}
              <path
                d="M16 60 C19.5 57.5 23 62.5 26.5 60 C30 57.5 33.5 62.5 37 60 L40 60 L40 62.5 L16 62.5 Z"
                fill="rgba(255,70,70,0.28)"
              />

              {/* Rising bubbles */}
              <circle cx="21" cy="95"  r="2"   fill="rgba(255,110,90,0.5)"  className="ml-b1" />
              <circle cx="34" cy="108" r="1.5" fill="rgba(255,90,75,0.45)"  className="ml-b2" />
              <circle cx="26" cy="120" r="1.3" fill="rgba(255,110,90,0.4)"  className="ml-b3" />
            </g>
          </g>

          {/* ── GLASS REFLECTION (left edge, shimmers) ── */}
          <rect
            x="19" y="25" width="3.5" height="90"
            rx="1.75"
            fill="rgba(255,255,255,0.27)"
            clipPath="url(#ml-clip)"
            className="ml-shimmer"
          />
          {/* Secondary faint reflection on right */}
          <rect
            x="36" y="25" width="2" height="70"
            rx="1"
            fill="rgba(255,255,255,0.08)"
            clipPath="url(#ml-clip)"
          />

          {/* ── GRADUATION MARKS (right side of tube, outside clip) ── */}
          <line x1="39" y1="50"  x2="42.5" y2="50"  stroke="rgba(128,0,32,0.5)" strokeWidth="1"   />
          <line x1="39" y1="70"  x2="41.5" y2="70"  stroke="rgba(128,0,32,0.35)" strokeWidth="0.8" />
          <line x1="39" y1="90"  x2="42.5" y2="90"  stroke="rgba(128,0,32,0.5)" strokeWidth="1"   />
          <line x1="39" y1="110" x2="41.5" y2="110" stroke="rgba(128,0,32,0.35)" strokeWidth="0.8" />

          {/* ── DRIP (forms under cap, falls periodically) ── */}
          <ellipse cx="28" cy="27" rx="2.2" ry="2.8" fill="#BB0020" className="ml-drip" />
        </svg>

        {label && (
          <p className="mt-5 text-[var(--color-bordeaux-primary)] font-semibold text-sm text-center px-6 animate-pulse tracking-wide">
            {label}
          </p>
        )}
      </div>
    </>
  );
}
