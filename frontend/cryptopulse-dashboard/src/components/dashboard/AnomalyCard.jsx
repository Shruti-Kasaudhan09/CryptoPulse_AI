import { longDate, pct, usd } from "../../lib/format";
import { Async, CardSkeleton } from "../States";
import { Card } from "../ui";

export default function AnomalyCard({ q }) {
  return (
    <Card title="Anomaly detection" subtitle="Isolation Forest on price, volume & volatility" icon="⚑">
      <Async q={q} skeleton={<CardSkeleton lines={5} />}>
        {(d) => (
          <div className="space-y-4">
            {d.today_is_anomaly ? (
              <div className="relative overflow-hidden rounded-xl border border-orange-400/30 bg-orange-500/10 p-3.5" role="status">
                <div className="flex items-center gap-2 text-sm font-semibold text-orange-300">
                  <span className="live-dot h-2 w-2 rounded-full bg-orange-400" aria-hidden="true" />
                  ⚠ Market anomaly detected today
                </div>
                <p className="mt-1 text-xs text-ink2">{d.today_reason}</p>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-500/[0.07] p-3.5 text-sm font-semibold text-good" role="status">
                <span aria-hidden="true">✓</span> No anomaly detected today
              </div>
            )}

            <div className="flex items-baseline justify-between text-xs">
              <span className="font-medium text-ink2">Recent flagged days</span>
              <span className="tabular text-muted">
                {d.total_flagged}/{d.total_days} days · {((d.total_flagged / d.total_days) * 100).toFixed(1)}%
              </span>
            </div>

            <ol className="relative space-y-3 border-l border-line pl-4">
              {d.recent.slice(0, 5).map((a) => (
                <li key={a.date} className="relative text-xs">
                  <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-[#06080d] bg-orange-400" aria-hidden="true" />
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-medium text-ink">{longDate(a.date)}</span>
                    <span className="tabular text-ink2">
                      {usd(a.close)}{" "}
                      <span className={a.return_pct >= 0 ? "text-good" : "text-bad"}>{pct(a.return_pct, 1)}</span>
                    </span>
                  </div>
                  <div className="mt-0.5 text-muted">{a.reason}</div>
                </li>
              ))}
            </ol>
            <p className="text-[11px] leading-relaxed text-muted">{d.note}</p>
          </div>
        )}
      </Async>
    </Card>
  );
}
