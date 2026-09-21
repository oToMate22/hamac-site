import type React from 'react'

type IllustrationKind = 'maison' | 'appartement' | 'terrain'

const svgProps = {
  viewBox: '0 0 160 100',
  fill: 'none',
  xmlns: 'http://www.w3.org/2000/svg',
  role: 'img' as const,
  'aria-hidden': true,
}

function SketchPatterns({ prefix }: { prefix: string }) {
  return (
    <defs>
      <pattern id={`${prefix}-hatch`} width="3" height="3" patternUnits="userSpaceOnUse">
        <line x1="0" y1="0" x2="0" y2="3" stroke="currentColor" strokeWidth="0.5" opacity="0.34" />
      </pattern>
      <pattern id={`${prefix}-cross`} width="3.5" height="3.5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="3.5" stroke="currentColor" strokeWidth="0.42" opacity="0.3" />
        <line x1="1.75" y1="0" x2="1.75" y2="3.5" stroke="currentColor" strokeWidth="0.42" opacity="0.22" />
      </pattern>
      <pattern id={`${prefix}-grid`} width="8" height="8" patternUnits="userSpaceOnUse">
        <path d="M8 0H0V8" stroke="currentColor" strokeWidth="0.35" opacity="0.12" />
      </pattern>
    </defs>
  )
}

function PineTree({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} stroke="currentColor" strokeLinejoin="round">
      <path d="M0 0 5.5-11 11 0Z" strokeWidth="0.95" />
      <path d="M1.5 0 5.5-8.5 9.5 0Z" strokeWidth="0.75" opacity="0.5" />
      <line x1="5.5" y1="0" x2="5.5" y2="4.5" strokeWidth="0.8" />
    </g>
  )
}

function DeciduousTree({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`} stroke="currentColor">
      <circle cx="0" cy="-2" r="5.5" strokeWidth="0.9" />
      <path d="M-3-4c1-2 3-2 4 0M1-6c1-1 3 0 3 2" strokeWidth="0.55" opacity="0.45" />
      <line x1="0" y1="3.5" x2="0" y2="8" strokeWidth="0.85" strokeLinecap="round" />
    </g>
  )
}

function SurveyStake({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`} stroke="currentColor" strokeLinecap="round">
      <line x1="0" y1="0" x2="0" y2="-7" strokeWidth="0.9" />
      <line x1="-2.5" y1="-7" x2="2.5" y2="-7" strokeWidth="0.85" />
      <circle cx="0" cy="0" r="1.1" fill="currentColor" opacity="0.85" />
    </g>
  )
}

function MaisonIllustration() {
  return (
    <svg {...svgProps}>
      <SketchPatterns prefix="maison" />
      <path d="M6 88h148" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" opacity="0.85" />

      <PineTree x={12} y={72} scale={0.95} />
      <PineTree x={28} y={68} scale={1.15} />
      <PineTree x={142} y={70} scale={0.9} />

      <path
        d="M8 88V72c0-2 2-4 6-4h34c3 0 5 2 5 5v15"
        stroke="currentColor"
        strokeWidth="1.15"
        strokeLinejoin="round"
      />
      <path
        d="M14 76c6 2 12 2 18 0M16 80c5 1.5 10 1.5 15 0M18 84c4 1 8 1 12 0"
        stroke="currentColor"
        strokeWidth="0.7"
        opacity="0.55"
        strokeLinecap="round"
      />
      <path d="M46 88V74" stroke="currentColor" strokeWidth="0.9" opacity="0.45" />

      <g stroke="currentColor" strokeWidth="0.85" opacity="0.8">
        <path d="M18 84h8v3h-8zM28 84h8v3h-8zM24 81h6v2h-6z" />
        <path d="M22 76c6-1 10-1 14 0" strokeWidth="0.8" />
        <line x1="28" y1="76" x2="28" y2="81" />
      </g>

      <path d="M68 88V56h72v32" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />
      <path d="M68 56h72" stroke="currentColor" strokeWidth="1.1" />
      <rect x="68" y="56" width="72" height="32" fill="url(#maison-hatch)" />

      <rect x="78" y="62" width="28" height="18" stroke="currentColor" strokeWidth="1" />
      <path d="M82 66l10 8M94 66l-10 8" stroke="currentColor" strokeWidth="0.55" opacity="0.45" />

      <path d="M58 56V30h82v26H68" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />
      <rect x="58" y="48" width="82" height="8" fill="url(#maison-cross)" />

      <rect x="66" y="34" width="34" height="18" stroke="currentColor" strokeWidth="1" />
      <rect x="104" y="34" width="28" height="18" stroke="currentColor" strokeWidth="1" />
      <path d="M70 38l12 10M88 38l-12 10M108 38l10 8M122 38l-10 8" stroke="currentColor" strokeWidth="0.5" opacity="0.4" />

      <g stroke="currentColor" strokeWidth="0.75" opacity="0.75">
        <ellipse cx="92" cy="53" rx="5" ry="1.5" />
        <line x1="90" y1="53" x2="90" y2="56" />
        <line x1="94" y1="53" x2="94" y2="56" />
      </g>

      <path d="M62 84c2-4 4-4 6 0M134 84c2-4 4-4 6 0" stroke="currentColor" strokeWidth="0.8" opacity="0.65" />
    </svg>
  )
}

function AppartementIllustration() {
  return (
    <svg {...svgProps}>
      <SketchPatterns prefix="appart" />
      <path d="M6 88h148" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" opacity="0.85" />

      <PineTree x={10} y={74} scale={0.85} />
      <PineTree x={146} y={72} scale={0.95} />

      <path d="M18 88V34h22v54" stroke="currentColor" strokeWidth="0.95" opacity="0.35" strokeLinejoin="round" />
      <path d="M18 42h22M18 54h22M18 66h22M18 78h22" stroke="currentColor" strokeWidth="0.55" opacity="0.25" />

      <path d="M44 88V18h78v70" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />
      <rect x="44" y="18" width="78" height="70" fill="url(#appart-hatch)" opacity="0.55" />
      <path d="M44 30h78M44 42h78M44 54h78M44 66h78M44 78h78" stroke="currentColor" strokeWidth="0.75" opacity="0.45" />

      {[22, 34, 46, 58, 70].map((y) => (
        <g key={y}>
          <rect x="52" y={y} width="14" height="8" stroke="currentColor" strokeWidth="0.85" />
          <rect x="70" y={y} width="14" height="8" stroke="currentColor" strokeWidth="0.85" />
          <rect x="88" y={y} width="14" height="8" stroke="currentColor" strokeWidth="0.85" />
          {y < 70 ? (
            <path
              d={`M50 ${y + 10}h18M68 ${y + 10}h18M86 ${y + 10}h18`}
              stroke="currentColor"
              strokeWidth="0.65"
              opacity="0.55"
            />
          ) : null}
        </g>
      ))}

      <path d="M74 88V72h16v16" stroke="currentColor" strokeWidth="1.05" />
      <path d="M78 88V76h8" stroke="currentColor" strokeWidth="0.7" opacity="0.5" />
      <path d="M44 18h78" stroke="currentColor" strokeWidth="1.35" />
      <rect x="44" y="18" width="78" height="5" fill="url(#appart-cross)" />
    </svg>
  )
}

function TerrainIllustration() {
  const plotPath = 'M26 86 L 118 86 L 142 48 L 58 28 Z'

  return (
    <svg {...svgProps}>
      <SketchPatterns prefix="land" />

      <rect x="4" y="8" width="152" height="78" fill="url(#land-grid)" />

      <path d="M4 88h152" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" opacity="0.85" />

      <PineTree x={8} y={68} scale={0.95} />
      <PineTree x={148} y={66} scale={1} />
      <DeciduousTree x={128} y={62} />

      <path
        d={plotPath}
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinejoin="round"
        strokeDasharray="5 3.5"
      />

      <path d="M58 28 L 142 48 L 118 86 L 58 28 Z" fill="url(#land-cross)" opacity="0.55" />

      <path
        d="M34 78c18-5 36-5 54 0M38 70c16-4 32-4 48 0M42 62c14-3.5 28-3.5 42 0M46 54c12-3 24-3 36 0M50 46c10-2.5 20-2.5 30 0"
        stroke="currentColor"
        strokeWidth="0.72"
        opacity="0.42"
        strokeLinecap="round"
      />

      <path
        d="M72 86 L 88 52 L 104 86"
        stroke="currentColor"
        strokeWidth="0.65"
        opacity="0.28"
        strokeDasharray="2.5 2"
      />

      <path
        d="M68 74 L 92 74 L 96 58 L 72 58 Z"
        stroke="currentColor"
        strokeWidth="0.85"
        strokeDasharray="3 2.5"
        opacity="0.55"
      />
      <text x="73" y="67" fill="currentColor" fontSize="4.5" opacity="0.45" fontFamily="DM Sans, sans-serif">
        zone constructible
      </text>

      <path
        d="M72 86 Q 80 68 88 52"
        stroke="currentColor"
        strokeWidth="0.8"
        strokeDasharray="2 2"
        opacity="0.4"
      />

      <path d="M26 86 L 26 78 M118 86 L 118 78" stroke="currentColor" strokeWidth="0.55" opacity="0.35" />
      {[78, 82, 86].map((y) => (
        <line key={y} x1="22" y1={y} x2="30" y2={y} stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
      ))}

      <SurveyStake x={26} y={86} />
      <SurveyStake x={118} y={86} />
      <SurveyStake x={142} y={48} />
      <SurveyStake x={58} y={28} />

      <g stroke="currentColor" strokeLinecap="round" opacity="0.48">
        <path d="M30 94h52M30 92v4M82 92v4" strokeWidth="0.6" />
        <path d="M134 48 L 148 42 M134 48 L 140 58" strokeWidth="0.55" />
      </g>
      <text x="48" y="98" fill="currentColor" fontSize="4.2" opacity="0.38" fontFamily="DM Sans, sans-serif">
        24 m
      </text>
      <text x="144" y="44" fill="currentColor" fontSize="4.2" opacity="0.38" fontFamily="DM Sans, sans-serif">
        18 m
      </text>

      <g opacity="0.42">
        <text x="36" y="76" fill="currentColor" fontSize="4" fontFamily="DM Sans, sans-serif">
          256
        </text>
        <text x="40" y="68" fill="currentColor" fontSize="4" fontFamily="DM Sans, sans-serif">
          258
        </text>
        <text x="44" y="60" fill="currentColor" fontSize="4" fontFamily="DM Sans, sans-serif">
          260
        </text>
      </g>

      <g transform="translate(14 22)" stroke="currentColor" strokeWidth="0.75" opacity="0.5">
        <circle cx="0" cy="0" r="5" />
        <path d="M0-3.5V-6M0 3.5V6M-3.5 0H-6M3.5 0H6" strokeLinecap="round" />
        <path d="M0-6.5V-8.5" strokeWidth="1" />
        <text x="-2" y="-10.5" fill="currentColor" fontSize="4.5" fontFamily="DM Sans, sans-serif">
          N
        </text>
      </g>

      <DeciduousTree x={46} y={72} />
      <path d="M46 80c4 2 8 1.5 12-1" stroke="currentColor" strokeWidth="0.6" opacity="0.35" strokeLinecap="round" />
    </svg>
  )
}

const ILLUSTRATIONS: Record<IllustrationKind, () => React.ReactElement> = {
  maison: MaisonIllustration,
  appartement: AppartementIllustration,
  terrain: TerrainIllustration,
}

export function EstimationTypeIllustration({ kind }: { kind: IllustrationKind }) {
  const Illustration = ILLUSTRATIONS[kind]
  return <Illustration />
}
