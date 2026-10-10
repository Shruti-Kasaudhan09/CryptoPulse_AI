import { MODEL_COLORS, MODEL_LABELS } from "../lib/format";

export function Card({ title, subtitle, action, icon, children, className = "", bodyClass = "", hover = "lift" }) {
  return (
    <section
      className={`glass rise min-w-0 rounded-2xl ${hover} ${className}`}
      aria-label={typeof title === "string" ? title : undefined}
    >
      {(title || action) && (
        <header className="flex flex-wrap items-start justify-between gap-3 px-6 pt-6">
          <div className="flex min-w-0 items-start gap-2.5">
            {icon && (
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-raised text-sm text-accent" aria-hidden="true">
                {icon}
              </span>
            )}
            <div className="min-w-0">
              {title && <h2 className="font-display text-[15px] font-semibold text-ink">{title}</h2>}
              {subtitle && <p className="mt-1 text-xs leading-relaxed text-muted">{subtitle}</p>}
            </div>
          </div>
          {action}
        </header>
      )}
      <div className={`px-6 pb-6 pt-5 ${bodyClass}`}>{children}</div>
    </section>
  );
}

/** Direction is never color-alone: arrow glyph + word + color. */
export function Direction({ dir, className = "" }) {
  const up = dir === "UP";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold ${
        up ? "bg-emerald-500/10 text-good ring-1 ring-emerald-500/20" : "bg-rose-500/10 text-bad ring-1 ring-rose-500/20"
      } ${className}`}
    >
      <span aria-hidden="true">{up ? "▲" : "▼"}</span>
      {up ? "Up" : "Down"}
    </span>
  );
}

export function Delta({ value, digits = 2, pill = false }) {
  if (value == null) return <span className="text-muted">—</span>;
  const up = value >= 0;
  const text = (
    <>
      <span aria-hidden="true">{up ? "▲ " : "▼ "}</span>
      {up ? "+" : ""}
      {value.toFixed(digits)}%
    </>
  );
  if (!pill) return <span className={`tabular font-medium ${up ? "text-good" : "text-bad"}`}>{text}</span>;
  return (
    <span className={`tabular inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${
      up ? "bg-emerald-500/10 text-good" : "bg-rose-500/10 text-bad"}`}>
      {text}
    </span>
  );
}

export function ChartTooltip({ active, payload, label, formatter, labelFormatter }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line bg-surfacesolid px-3 py-2 text-xs shadow-2xl backdrop-blur">
      <div className="mb-1 font-medium text-ink2">{labelFormatter ? labelFormatter(label) : label}</div>
      {payload
        .filter((p) => p.value != null)
        .map((p) => (
          <div key={p.dataKey} className="flex items-center gap-2 py-0.5">
            <span className="h-2 w-2 rounded-full" style={{ background: p.color || p.stroke }} aria-hidden="true" />
            <span className="text-ink2">{p.name}</span>
            <span className="tabular ml-auto pl-4 font-medium text-ink">
              {formatter ? formatter(p.value, p.dataKey) : p.value}
            </span>
          </div>
        ))}
    </div>
  );
}

export function Legend({ items }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink2" aria-label="Legend">
      {items.map((it) => (
        <li key={it.key} className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-block w-4 rounded"
            style={{
              height: it.dashed ? 0 : 2,
              background: it.dashed ? "transparent" : it.color,
              borderTop: it.dashed ? `2px dashed ${it.color}` : undefined,
            }}
          />
          {it.label}
        </li>
      ))}
    </ul>
  );
}

export function ModelSwatch({ model }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        aria-hidden="true"
        className="inline-block h-2.5 w-2.5 rounded-full ring-2 ring-white/5"
        style={{ background: MODEL_COLORS[model] || "var(--muted)" }}
      />
      {MODEL_LABELS[model] || model}
    </span>
  );
}

export function Segmented({ options, value, onChange, label }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg border border-line bg-black/20 p-0.5 text-xs">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-md px-2.5 py-1 font-medium transition ${
            value === o.value
              ? "bg-white/10 text-ink shadow-[0_0_0_1px_rgba(255,255,255,0.08)]"
              : "text-muted hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Sparkline({ values, width = 96, height = 32, id = "s" }) {
  if (!values?.length) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [
    (i / (values.length - 1)) * width,
    height - 2 - ((v - min) / span) * (height - 4),
  ]);
  const line = pts.map((p) => p.join(",")).join(" ");
  const area = `0,${height} ${line} ${width},${height}`;
  const up = values[values.length - 1] >= values[0];
  const color = up ? "var(--good)" : "var(--critical)";
  const gid = `spark-${id}`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#${gid})`} />
      <polyline points={line} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function Stat({ label, value, hint }) {
  return (
    <div className="glass tilt rounded-xl !bg-black/20 px-3 py-2.5">
      <div className="text-[11px] uppercase tracking-wider text-muted">{label}</div>
      <div className="tabular mt-1 text-sm font-semibold text-ink">{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-muted">{hint}</div>}
    </div>
  );
}

/* Coin identity: a neutral monogram badge in each coin's common color
   (not an official logo). */
export const COIN_STYLE = {
  BTC: { glyph: "₿", bg: "linear-gradient(135deg,#f7931a,#ffb347)" },
  ETH: { glyph: "Ξ", bg: "linear-gradient(135deg,#627eea,#8fa4ff)" },
  SOL: { glyph: "◎", bg: "linear-gradient(135deg,#9945ff,#14f195)" },
};

export function CoinBadge({ coin, size = 36 }) {
  const s = COIN_STYLE[coin] || { glyph: coin?.[0], bg: "var(--raised)" };
  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white shadow-lg"
      style={{ width: size, height: size, background: s.bg, fontSize: size * 0.48 }}
    >
      {s.glyph}
    </span>
  );
}

/** Semicircular gauge for 0-100 scores. */
export function Gauge({ value, size = 220, label }) {
  const v = Math.max(0, Math.min(100, value ?? 0));
  const r = size / 2 - 14;
  const cx = size / 2;
  const cy = size / 2;
  const arc = Math.PI * r;
  const filled = (v / 100) * arc;
  const angle = Math.PI * (1 - v / 100);
  const kx = cx + r * Math.cos(angle);
  const ky = cy - r * Math.sin(angle);
  return (
    <svg width="100%" viewBox={`0 0 ${size} ${size / 2 + 16}`} role="img" aria-label={label}>
      <defs>
        <linearGradient id="gauge-grad" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="#f0607a" />
          <stop offset="50%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#22c55e" />
        </linearGradient>
        <filter id="gauge-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none"
        stroke="rgba(255,255,255,0.07)" strokeWidth="14" strokeLinecap="round" />
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none"
        stroke="url(#gauge-grad)" strokeWidth="14" strokeLinecap="round"
        strokeDasharray={`${filled} ${arc}`} style={{ transition: "stroke-dasharray 0.8s ease" }} />
      <circle cx={kx} cy={ky} r="9" fill="white" opacity="0.35" filter="url(#gauge-glow)" />
      <circle cx={kx} cy={ky} r="6" fill="white" stroke="#06080d" strokeWidth="3" />
    </svg>
  );
}
