import { Area, AreaChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { longDate, num, pct } from "../../lib/format";
import { Async, CardSkeleton, EmptyState } from "../States";
import { Card, ChartTooltip } from "../ui";

function Donut({ parts, size = 112, label }) {
  const r = size / 2 - 9;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="12" />
      {parts.filter((p) => p.v > 0).map((p) => {
        const len = (p.v / 100) * c;
        const el = (
          <circle key={p.key} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={p.color} strokeWidth="12"
            strokeDasharray={`${Math.max(len - 3, 0)} ${c}`} strokeDashoffset={-offset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`} strokeLinecap="butt" />
        );
        offset += len;
        return el;
      })}
    </svg>
  );
}

export default function SentimentCard({ q }) {
  return (
    <Card title="News sentiment" subtitle="FinBERT on live crypto headlines" icon="❝">
      <Async q={q} skeleton={<CardSkeleton lines={5} />}>
        {(d) => {
          if (!d.available) {
            return (
              <EmptyState title="No sentiment logged yet">
                <p>Sentiment is collected once a day from live news feeds. Start the log with:</p>
                <code className="mt-2 block rounded-lg bg-black/30 px-2 py-1.5 font-mono text-[11px] text-ink2">
                  cd ml/sentiment &amp;&amp; python log_daily_sentiment.py
                </code>
                <p className="mt-2 text-xs text-muted">Free feeds have no history, so the series builds up day by day.</p>
              </EmptyState>
            );
          }
          const l = d.latest;
          const label = l.sentiment_score > 0.1 ? "Positive" : l.sentiment_score < -0.1 ? "Negative" : "Neutral";
          const cls = label === "Positive" ? "text-good" : label === "Negative" ? "text-bad" : "text-ink";
          const parts = [
            { key: "Positive", v: l.pos_pct, color: "#38bdf8" },
            { key: "Neutral", v: l.neu_pct, color: "#64748b" },
            { key: "Negative", v: l.neg_pct, color: "#f0607a" },
          ];
          return (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="relative shrink-0">
                  <Donut parts={parts} label={`${l.pos_pct}% positive, ${l.neu_pct}% neutral, ${l.neg_pct}% negative`} />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="tabular text-lg font-semibold text-ink">{num(l.sentiment_score, 2)}</span>
                    <span className="text-[10px] text-muted">−1 … +1</span>
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className={`font-display text-2xl font-semibold ${cls}`}>{label}</div>
                  <div className="text-xs text-muted">{l.n_articles} headlines · {longDate(l.date)}</div>
                  <dl className="mt-2 space-y-1 text-xs">
                    {parts.map((p) => (
                      <div key={p.key} className="flex items-center justify-between">
                        <dt className="flex items-center gap-1.5 text-ink2">
                          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} aria-hidden="true" />
                          {p.key}
                        </dt>
                        <dd className="tabular font-medium text-ink">{pct(p.v, 0, { sign: false })}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>

              {d.history.length > 1 && (
                <div>
                  <div className="mb-1 text-[11px] uppercase tracking-wider text-muted">Score history · {d.history.length} days</div>
                  <div className="h-16" role="img" aria-label="Sentiment score history">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={d.history} margin={{ top: 4, right: 2, left: 2, bottom: 0 }}>
                        <defs>
                          <linearGradient id="sent-fill" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.3} />
                            <stop offset="100%" stopColor="#38bdf8" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="date" hide />
                        <YAxis domain={[-1, 1]} hide />
                        <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" />
                        <Tooltip content={<ChartTooltip formatter={(v) => num(v, 3)} labelFormatter={longDate} />} />
                        <Area dataKey="sentiment_score" name="Score" stroke="#38bdf8" strokeWidth={2}
                          fill="url(#sent-fill)" isAnimationActive={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {d.headlines.length > 0 && (
                <ul className="space-y-2 border-t border-line pt-3">
                  {d.headlines.slice(0, 4).map((h, i) => (
                    <li key={i} className="flex gap-2 text-xs">
                      <span className={`mt-0.5 shrink-0 rounded px-1.5 py-px text-[10px] font-semibold uppercase ${
                        h.label === "positive" ? "bg-sky-400/10 text-sky-300"
                          : h.label === "negative" ? "bg-rose-400/10 text-rose-300" : "bg-white/5 text-muted"}`}>
                        {h.label}
                      </span>
                      <a href={h.link} target="_blank" rel="noreferrer" className="line-clamp-2 text-ink2 hover:text-ink hover:underline">
                        {h.title} <span className="text-muted">· {h.source}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        }}
      </Async>
    </Card>
  );
}
