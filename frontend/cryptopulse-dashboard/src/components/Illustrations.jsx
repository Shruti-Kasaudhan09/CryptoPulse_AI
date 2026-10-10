/* Original illustrations for CryptoPulse AI (hand-built SVG, no external
   assets). Coins are neutral monograms, not official logos. Motion is pure
   CSS (see .float-* in index.css) and switches off for reduced-motion users. */

function CoinDisc({ x, y, r, glyph, from, to, id, className = "" }) {
  return (
    <g className={className}>
      <defs>
        <linearGradient id={`coin-${id}`} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor={from} />
          <stop offset="100%" stopColor={to} />
        </linearGradient>
        <radialGradient id={`coin-shine-${id}`} cx="0.3" cy="0.25" r="0.8">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="45%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* coin edge (gives a 3D "cutout" thickness) */}
      <ellipse cx={x} cy={y + r * 0.14} rx={r} ry={r} fill={to} opacity="0.55" />
      <circle cx={x} cy={y} r={r} fill={`url(#coin-${id})`} />
      <circle cx={x} cy={y} r={r * 0.8} fill="none" stroke="#fff" strokeOpacity="0.35" strokeWidth={r * 0.06} />
      <circle cx={x} cy={y} r={r} fill={`url(#coin-shine-${id})`} />
      <text x={x} y={y + r * 0.36} textAnchor="middle" fontSize={r * 1.05} fontWeight="700"
        fill="#fff" fontFamily="Inter, system-ui, sans-serif">{glyph}</text>
    </g>
  );
}

export function HeroArt({ className = "" }) {
  const candles = [
    [40, 150, 190, true], [62, 135, 175, true], [84, 150, 185, false], [106, 118, 162, true],
    [128, 104, 150, true], [150, 120, 158, false], [172, 90, 138, true], [194, 72, 118, true],
  ];
  return (
    <svg viewBox="0 0 420 320" className={className} role="img"
      aria-label="Illustration: floating crypto coins orbiting a rising price chart">
      <defs>
        <radialGradient id="hero-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.35" />
          <stop offset="60%" stopColor="#8b5cf6" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="hero-line" x1="0" x2="1">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#a78bfa" />
        </linearGradient>
        <linearGradient id="hero-panel" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.09" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      <circle cx="220" cy="160" r="150" fill="url(#hero-glow)" />
      {/* orbit rings */}
      <g className="spin-slow" style={{ transformOrigin: "220px 160px" }}>
        <ellipse cx="220" cy="160" rx="170" ry="62" fill="none" stroke="#38bdf8" strokeOpacity="0.25" strokeDasharray="2 7" />
        <circle cx="390" cy="160" r="3.5" fill="#38bdf8" />
        <circle cx="50" cy="160" r="2.5" fill="#a78bfa" />
      </g>
      <ellipse cx="220" cy="160" rx="120" ry="138" fill="none" stroke="#a78bfa" strokeOpacity="0.14" />

      {/* glass chart panel */}
      <g className="float-b">
        <rect x="24" y="52" width="232" height="176" rx="18" fill="url(#hero-panel)"
          stroke="#ffffff" strokeOpacity="0.12" />
        <circle cx="44" cy="72" r="4" fill="#f0607a" /><circle cx="58" cy="72" r="4" fill="#fbbf24" />
        <circle cx="72" cy="72" r="4" fill="#22c55e" />
        {[110, 140, 170, 200].map((y) => (
          <line key={y} x1="36" x2="244" y1={y} y2={y} stroke="#fff" strokeOpacity="0.05" />
        ))}
        {candles.map(([x, top, bot, up], i) => (
          <g key={i}>
            <line x1={x} x2={x} y1={top - 8} y2={bot + 6} stroke={up ? "#4ade80" : "#fb7185"} strokeOpacity="0.8" />
            <rect x={x - 6} y={top} width="12" height={bot - top} rx="3" fill={up ? "#22c55e" : "#f0607a"} fillOpacity="0.85" />
          </g>
        ))}
        <path d="M34 196 C 70 184, 90 190, 112 164 S 160 150, 180 128 S 220 96, 246 86"
          fill="none" stroke="url(#hero-line)" strokeWidth="3" strokeLinecap="round" className="draw-line" />
        <circle cx="246" cy="86" r="5" fill="#fff" />
        <circle cx="246" cy="86" r="10" fill="#38bdf8" fillOpacity="0.3" className="pulse-ring" />
      </g>

      {/* AI score chip */}
      <g className="float-c">
        <rect x="262" y="206" width="138" height="62" rx="16" fill="#0d1119" stroke="#ffffff" strokeOpacity="0.14" />
        <text x="280" y="230" fontSize="10" fill="#6b7489" fontFamily="Inter, sans-serif" letterSpacing="1">CRYPTOPULSE</text>
        <text x="280" y="255" fontSize="22" fontWeight="700" fill="#f4f6fb" fontFamily="JetBrains Mono, monospace">75</text>
        <text x="312" y="255" fontSize="11" fill="#4ade80" fontFamily="Inter, sans-serif">▲ Constructive</text>
      </g>

      {/* floating coins */}
      <CoinDisc id="h-btc" x={318} y={92} r={38} glyph="₿" from="#f7931a" to="#b86400" className="float-a" />
      <CoinDisc id="h-eth" x={378} y={178} r={24} glyph="Ξ" from="#8fa4ff" to="#4056c4" className="float-b" />
      <CoinDisc id="h-sol" x={262} y={30} r={18} glyph="◎" from="#9945ff" to="#14c07f" className="float-c" />

      {/* sparkles */}
      {[[300, 150], [210, 28], [404, 110], [20, 250]].map(([x, y], i) => (
        <path key={i} className="twinkle" style={{ animationDelay: `${i * 0.7}s` }}
          d={`M${x} ${y - 6} L${x + 1.5} ${y - 1.5} L${x + 6} ${y} L${x + 1.5} ${y + 1.5} L${x} ${y + 6} L${x - 1.5} ${y + 1.5} L${x - 6} ${y} L${x - 1.5} ${y - 1.5} Z`}
          fill="#e0f2fe" />
      ))}
    </svg>
  );
}

export function AiOrb({ size = 120, thinking = false, className = "" }) {
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} className={className} role="img"
      aria-label="CryptoPulse AI assistant">
      <defs>
        <radialGradient id="orb-core" cx="0.35" cy="0.3" r="0.8">
          <stop offset="0%" stopColor="#e0f2fe" />
          <stop offset="30%" stopColor="#38bdf8" />
          <stop offset="75%" stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#1e1b4b" />
        </radialGradient>
        <radialGradient id="orb-halo" cx="0.5" cy="0.5" r="0.5">
          <stop offset="55%" stopColor="#38bdf8" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="60" cy="60" r="58" fill="url(#orb-halo)" className={thinking ? "pulse-fast" : "pulse-ring"} />
      <g className="spin-slow" style={{ transformOrigin: "60px 60px" }}>
        <ellipse cx="60" cy="60" rx="52" ry="18" fill="none" stroke="#a78bfa" strokeOpacity="0.5" />
        <circle cx="112" cy="60" r="3" fill="#a78bfa" />
      </g>
      <g className="spin-rev" style={{ transformOrigin: "60px 60px" }}>
        <ellipse cx="60" cy="60" rx="18" ry="52" fill="none" stroke="#38bdf8" strokeOpacity="0.45" />
        <circle cx="60" cy="8" r="2.5" fill="#38bdf8" />
      </g>
      <circle cx="60" cy="60" r="30" fill="url(#orb-core)" />
      {/* neural sparkle */}
      <path d="M48 62 L56 54 L64 64 L72 52" fill="none" stroke="#fff" strokeWidth="2.6"
        strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.9" />
      <circle cx="48" cy="62" r="2.2" fill="#fff" /><circle cx="72" cy="52" r="2.2" fill="#fff" />
    </svg>
  );
}

export function WalletArt({ className = "" }) {
  return (
    <svg viewBox="0 0 260 200" className={className} role="img" aria-label="Illustration: a wallet with coins">
      <defs>
        <linearGradient id="wallet-body" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#1e293b" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
        <linearGradient id="wallet-flap" x1="0" x2="1">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      <ellipse cx="130" cy="186" rx="92" ry="8" fill="#000" opacity="0.4" />
      <CoinDisc id="w-btc" x={96} y={58} r={26} glyph="₿" from="#f7931a" to="#b86400" className="float-a" />
      <CoinDisc id="w-eth" x={150} y={40} r={20} glyph="Ξ" from="#8fa4ff" to="#4056c4" className="float-b" />
      <CoinDisc id="w-sol" x={190} y={72} r={16} glyph="◎" from="#9945ff" to="#14c07f" className="float-c" />
      <rect x="40" y="82" width="180" height="100" rx="18" fill="url(#wallet-body)" stroke="#fff" strokeOpacity="0.12" />
      <path d="M40 104 Q 40 82 62 82 L 200 82 Q 220 82 220 100 L 220 108 L 40 108 Z" fill="url(#wallet-flap)" opacity="0.9" />
      <rect x="168" y="118" width="62" height="36" rx="12" fill="#0b1220" stroke="#38bdf8" strokeOpacity="0.5" />
      <circle cx="186" cy="136" r="6" fill="#38bdf8" />
      <path d="M60 140 L 90 128 L 112 146 L 140 118" fill="none" stroke="#4ade80" strokeWidth="3"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
