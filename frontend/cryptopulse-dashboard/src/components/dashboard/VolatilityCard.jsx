import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { longDate, pct, shortDate } from "../../lib/format";
import { Async, CardSkeleton } from "../States";
import { Card, ChartTooltip } from "../ui";

const LEVELS = [
  { key: "Low", word: "Low", icon: "●", cls: "text-good", seg: "bg-emerald-400" },
  { key: "Medium", word: "Moderate", icon: "◆", cls: "text-warn", seg: "bg-amber-400" },
  { key: "High", word: "High", icon: "▲", cls: "text-bad", seg: "bg-rose-400" },
];

export default function VolatilityCard({ q }) {
  return (
    <Card title="Volatility" subtitle="14-day std of daily returns vs this coin's history" icon="≋">
      <Async q={q} skeleton={<CardSkeleton lines={4} />}>
        {(d) => {
          const lv = LEVELS.find((l) => l.key === d.level) || LEVELS[1];
          const series = d.series.map((p) => ({ ...p, pct: p.value * 100 }));
          return (
            <div className="space-y-4">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <div className={`font-display text-3xl font-semibold ${lv.cls}`}>
                    <span aria-hidden="true" className="mr-2 text-xl">{lv.icon}</span>
                    {lv.word}
                  </div>
                  <div className="tabular mt-1 text-xs text-muted">
                    {pct(d.value * 100, 2, { sign: false })} daily σ
                  </div>
                </div>
                <div className="text-right">
                  <div className="tabular text-2xl font-semibold text-ink">{Math.round(d.percentile)}<span className="text-sm text-muted">th</span></div>
                  <div className="text-[11px] text-muted">percentile</div>
                </div>
              </div>

              <div aria-hidden="true">
                <div className="flex gap-1">
                  {LEVELS.map((l) => (
                    <div key={l.key} className={`h-1.5 flex-1 rounded-full ${l.key === d.level ? l.seg : "bg-white/10"}`} />
                  ))}
                </div>
                <div className="mt-1 flex justify-between text-[10px] uppercase tracking-wider text-muted">
                  <span>Low</span><span>Moderate</span><span>High</span>
                </div>
              </div>

              <div className="h-28" role="img" aria-label="Volatility over time">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={series} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="vol-fill" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#a78bfa" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="date" tickFormatter={shortDate} minTickGap={50} tickLine={false} axisLine={false} />
                    <YAxis tickFormatter={(v) => `${v.toFixed(0)}%`} width={32} tickLine={false} axisLine={false} />
                    <ReferenceLine y={d.thresholds.low_thresh * 100} stroke="rgba(255,255,255,0.18)" strokeDasharray="3 3" />
                    <ReferenceLine y={d.thresholds.high_thresh * 100} stroke="rgba(255,255,255,0.18)" strokeDasharray="3 3" />
                    <Tooltip content={<ChartTooltip formatter={(v) => `${v.toFixed(2)}%`} labelFormatter={longDate} />}
                      cursor={{ stroke: "rgba(255,255,255,0.25)" }} />
                    <Area dataKey="pct" name="Volatility" stroke="#a78bfa" strokeWidth={2}
                      fill="url(#vol-fill)" isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <p className="text-[11px] leading-relaxed text-muted">
                Dashed lines mark this coin's own 33rd / 66th percentile cut-offs
                ({pct(d.thresholds.low_thresh * 100, 2, { sign: false })} / {pct(d.thresholds.high_thresh * 100, 2, { sign: false })}).
              </p>
            </div>
          );
        }}
      </Async>
    </Card>
  );
}
