import { useState } from "react";
import {
  Area, CartesianGrid, ComposedChart, Line, ReferenceDot, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { api } from "../../lib/api";
import { COINS, longDate, num, shortDate, usd } from "../../lib/format";
import { useApi } from "../../lib/useApi";
import { Async, Skeleton } from "../States";
import { ChartTooltip, CoinBadge, Delta, Legend, Segmented, Stat } from "../ui";

const RANGES = [
  { value: 30, label: "1M" },
  { value: 90, label: "3M" },
  { value: 180, label: "6M" },
  { value: 365, label: "1Y" },
];

function compactVolume(v) {
  if (v == null) return "—";
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(v);
}

export default function PriceChart({ coin, anomalies }) {
  const [days, setDays] = useState(180);
  const q = useApi((o) => api.market(coin, days, o), [coin, days]);
  const name = COINS.find((c) => c.symbol === coin)?.name;

  return (
    <section className="glass lift rise min-w-0 overflow-hidden rounded-2xl" aria-label={`${coin} price`}>
      <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-sky-500/10 blur-3xl" />
      <Async q={q} skeleton={<div className="p-5"><Skeleton className="h-[420px]" /></div>}>
        {(d) => {
          const series = d.series.map((p) => ({ ...p, band: [p.BB_Lower, p.BB_Upper] }));
          const inRange = new Set(series.map((p) => p.date));
          const marks = (anomalies || []).filter((a) => inRange.has(a.date));
          const first = series[0]?.Close;
          const periodChange = first ? (d.latest.close / first - 1) * 100 : null;
          const rsi = d.latest.rsi;
          return (
            <>
              <div className="flex flex-wrap items-start justify-between gap-4 px-6 pt-6">
                <div className="flex items-center gap-3.5">
                  <CoinBadge coin={coin} size={48} />
                  <div>
                    <div className="flex items-baseline gap-2">
                      <h2 className="font-display text-lg font-semibold text-ink">{name}</h2>
                      <span className="text-sm text-muted">{coin}/USD</span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="tabular text-3xl font-semibold tracking-tight text-ink sm:text-[34px]">
                        {usd(d.latest.close)}
                      </span>
                      <Delta value={d.latest.change_pct} pill />
                    </div>
                    <div className="mt-1 text-xs text-muted">
                      Daily close · {longDate(d.as_of)} ·{" "}
                      <span className={periodChange >= 0 ? "text-good" : "text-bad"}>
                        {periodChange >= 0 ? "+" : ""}{periodChange?.toFixed(1)}%
                      </span>{" "}over {RANGES.find((r) => r.value === days)?.label}
                    </div>
                  </div>
                </div>
                <Segmented label="Time range" options={RANGES} value={days} onChange={setDays} />
              </div>

              <div className="mt-4 h-[300px] px-2" role="img" aria-label={`${coin} price chart, last ${days} days`}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={series} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                    <defs>
                      <linearGradient id="price-fill" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#38bdf8" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="price-line" x1="0" x2="1" y1="0" y2="0">
                        <stop offset="0%" stopColor="#38bdf8" />
                        <stop offset="100%" stopColor="#a78bfa" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="date" tickFormatter={shortDate} minTickGap={48} tickLine={false} axisLine={false} />
                    <YAxis domain={["auto", "auto"]} orientation="right" tickFormatter={(v) => usd(v, { compact: true })}
                      width={62} tickLine={false} axisLine={false} />
                    <Tooltip
                      content={<ChartTooltip formatter={(v) => (Array.isArray(v) ? `${usd(v[0])} – ${usd(v[1])}` : usd(v))}
                        labelFormatter={longDate} />}
                      cursor={{ stroke: "rgba(255,255,255,0.25)", strokeDasharray: "3 3" }}
                    />
                    <Area dataKey="band" name="Bollinger Bands" stroke="none" fill="var(--band)"
                      isAnimationActive={false} activeDot={false} />
                    <Area dataKey="Close" name="Close" stroke="url(#price-line)" strokeWidth={2.2} fill="url(#price-fill)"
                      isAnimationActive={false} activeDot={{ r: 5, strokeWidth: 3, stroke: "#06080d", fill: "#38bdf8" }} />
                    <Line dataKey="SMA_30" name="30-day average" stroke="#94a3b8" strokeOpacity={0.7} strokeWidth={1.4}
                      strokeDasharray="4 4" dot={false} isAnimationActive={false} />
                    {marks.map((a) => (
                      <ReferenceDot key={a.date} x={a.date} y={a.close} r={5}
                        fill="var(--serious)" stroke="#06080d" strokeWidth={2} />
                    ))}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              <div className="px-6">
                <Legend items={[
                  { key: "c", label: "Close", color: "#38bdf8" },
                  { key: "s", label: "30-day average", color: "#94a3b8", dashed: true },
                  { key: "b", label: "Bollinger Bands (±2σ)", color: "rgba(148,163,184,0.5)" },
                  ...(marks.length ? [{ key: "a", label: `Anomaly (${marks.length})`, color: "var(--serious)" }] : []),
                ]} />
              </div>

              <div className="mt-3 h-[88px] px-2" role="img" aria-label="RSI chart">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={series} margin={{ top: 4, right: 12, left: 4, bottom: 0 }}>
                    <defs>
                      <linearGradient id="rsi-fill" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#a78bfa" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" hide />
                    <YAxis domain={[0, 100]} ticks={[30, 70]} orientation="right" width={62} tickLine={false} axisLine={false} />
                    <ReferenceLine y={70} stroke="rgba(240,96,122,0.5)" strokeDasharray="3 3" />
                    <ReferenceLine y={30} stroke="rgba(74,222,128,0.5)" strokeDasharray="3 3" />
                    <Tooltip content={<ChartTooltip formatter={(v) => num(v, 1)} labelFormatter={longDate} />}
                      cursor={{ stroke: "rgba(255,255,255,0.25)", strokeDasharray: "3 3" }} />
                    <Area dataKey="RSI_14" name="RSI (14d)" stroke="#a78bfa" strokeWidth={1.6} fill="url(#rsi-fill)"
                      isAnimationActive={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-2 gap-3 p-6 pt-4 sm:grid-cols-4">
                <Stat label="Period high" value={usd(d.latest.high_period)} />
                <Stat label="Period low" value={usd(d.latest.low_period)} />
                <Stat label="Volume (24h)" value={compactVolume(d.latest.volume)} />
                <Stat label="RSI (14d)" value={num(rsi, 1)}
                  hint={rsi > 70 ? "Overbought zone" : rsi < 30 ? "Oversold zone" : "Neutral zone"} />
              </div>
            </>
          );
        }}
      </Async>
    </section>
  );
}
