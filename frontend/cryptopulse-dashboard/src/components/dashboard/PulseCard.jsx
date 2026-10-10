import { Async, CardSkeleton } from "../States";
import { Card, Gauge } from "../ui";

const NAMES = {
  trend: "Trend",
  rsi: "RSI balance",
  volatility: "Calmness",
  sentiment: "News sentiment",
  anomaly: "No anomaly",
};

function band(score) {
  if (score >= 65) return { text: "Constructive", cls: "text-good", ring: "ring-emerald-400/30 bg-emerald-400/10" };
  if (score >= 45) return { text: "Mixed", cls: "text-warn", ring: "ring-amber-400/30 bg-amber-400/10" };
  return { text: "Weak", cls: "text-bad", ring: "ring-rose-400/30 bg-rose-400/10" };
}

function barColor(s) {
  return s >= 65 ? "from-emerald-400 to-teal-300" : s >= 45 ? "from-amber-400 to-yellow-300" : "from-rose-500 to-rose-400";
}

export default function PulseCard({ q }) {
  return (
    <Card title="CryptoPulse Score" subtitle="Market-intelligence score · 0–100" icon="◉">
      <Async q={q} skeleton={<CardSkeleton lines={5} />}>
        {(d) => {
          const b = band(d.score);
          return (
            <div className="space-y-4">
              <div className="relative mx-auto max-w-[260px]">
                <Gauge value={d.score} label={`CryptoPulse score ${Math.round(d.score)} out of 100`} />
                <div className="absolute inset-x-0 bottom-0 text-center">
                  <div className="tabular text-5xl font-semibold leading-none text-ink">{Math.round(d.score)}</div>
                  <span className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${b.ring} ${b.cls}`}>
                    {b.text}
                  </span>
                </div>
              </div>

              <ul className="space-y-2.5 pt-1" aria-label="Score components">
                {d.components.map((c) => (
                  <li key={c.key}>
                    <div className="flex items-baseline justify-between text-xs">
                      <span className="text-ink2">
                        {NAMES[c.key]} <span className="text-muted">· {Math.round(c.weight * 100)}%</span>
                      </span>
                      <span className="tabular text-ink">{Math.round(c.score)}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/5">
                      <div className={`h-full rounded-full bg-gradient-to-r ${barColor(c.score)}`}
                        style={{ width: `${Math.max(c.score, 2)}%`, transition: "width 0.8s ease" }} />
                    </div>
                  </li>
                ))}
              </ul>

              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  ["Trend", `${d.labels.trend === "Up" ? "▲" : d.labels.trend === "Down" ? "▼" : "→"} ${d.labels.trend}`],
                  ["Volatility", d.labels.volatility],
                  ["Sentiment", d.labels.sentiment],
                  ["Anomaly", d.labels.anomaly],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-lg border border-line bg-black/20 px-2.5 py-2">
                    <div className="text-[10px] uppercase tracking-wider text-muted">{k}</div>
                    <div className="mt-0.5 font-medium text-ink">{v}</div>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-muted">
                {!d.sentiment_available && "No sentiment history yet, so sentiment is scored neutral (50). "}
                Project-defined score, not a buy/sell signal.
              </p>
            </div>
          );
        }}
      </Async>
    </Card>
  );
}
