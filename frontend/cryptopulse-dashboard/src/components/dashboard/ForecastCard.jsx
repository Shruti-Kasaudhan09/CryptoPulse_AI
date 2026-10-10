import { Link } from "react-router-dom";
import { longDate, MODEL_COLORS, MODEL_LABELS, pct, usd } from "../../lib/format";
import { Async, CardSkeleton } from "../States";
import { Card, Direction } from "../ui";

export default function ForecastCard({ q, coin }) {
  return (
    <Card title="Next-day forecast" subtitle="AI-predicted close for tomorrow" icon="◷">
      <Async q={q} skeleton={<CardSkeleton lines={5} />}>
        {(d) => {
          const h = d.headline;
          const up = h.direction === "UP";
          const skill = d.skill_vs_naive;
          const maxAbs = Math.max(...d.all_models.map((m) => Math.abs(m.predicted_return_pct)), 0.01);
          const upShare = (d.agreement.up / d.agreement.total) * 100;
          return (
            <div className="space-y-6">
              <div className={`relative overflow-hidden rounded-xl border p-4 ${
                up ? "border-emerald-500/20 bg-emerald-500/[0.06]" : "border-rose-500/20 bg-rose-500/[0.06]"}`}>
                <div className="text-[11px] uppercase tracking-wider text-muted">{longDate(d.forecast_for)}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="tabular text-[30px] font-semibold leading-none tracking-tight text-ink">
                    {usd(h.predicted_close)}
                  </span>
                  <Direction dir={h.direction} />
                </div>
                <div className="mt-2 text-sm text-ink2">
                  <span className={`tabular font-semibold ${up ? "text-good" : "text-bad"}`}>
                    {pct(h.predicted_return_pct, 2)}
                  </span>{" "}
                  vs today's <span className="tabular">{usd(d.current_close)}</span>
                </div>
                <div className="mt-1 text-xs text-muted">
                  by {MODEL_LABELS[h.model] || h.model} · {d.selection_reason}
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-baseline justify-between text-xs">
                  <span className="font-medium text-ink2">Model consensus</span>
                  <span className="tabular text-muted">
                    <span className="text-good">▲ {d.agreement.up}</span> · <span className="text-bad">▼ {d.agreement.down}</span>
                  </span>
                </div>
                <div className="flex h-2 gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
                  {upShare > 0 && <div className="bg-emerald-400" style={{ width: `${upShare}%` }} />}
                  {upShare < 100 && <div className="bg-rose-400" style={{ width: `${100 - upShare}%` }} />}
                </div>
                <ul className="mt-3 space-y-2">
                  {d.all_models.map((m) => {
                    const w = (Math.abs(m.predicted_return_pct) / maxAbs) * 50;
                    const pos = m.predicted_return_pct >= 0;
                    return (
                      <li key={m.model} className="grid grid-cols-[minmax(0,1fr)_88px_62px] items-center gap-3 text-sm">
                        <span className="flex min-w-0 items-center gap-2 text-ink2">
                          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: MODEL_COLORS[m.model] }} aria-hidden="true" />
                          <span className="truncate">{MODEL_LABELS[m.model] || m.model}</span>
                        </span>
                        <span className="relative h-1.5 rounded-full bg-white/5" aria-hidden="true">
                          <span className="absolute inset-y-0 left-1/2 w-px bg-white/20" />
                          <span className={`absolute inset-y-0 rounded-full ${pos ? "bg-emerald-400" : "bg-rose-400"}`}
                            style={pos ? { left: "50%", width: `${w}%` } : { right: "50%", width: `${w}%` }} />
                        </span>
                        <span className={`tabular text-right text-xs font-medium ${pos ? "text-good" : "text-bad"}`}>
                          {pos ? "▲" : "▼"} {pct(m.predicted_return_pct, 2)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {skill && (
                <div className="rounded-xl border border-line bg-black/20 p-3 text-xs leading-relaxed text-ink2">
                  <span className="font-semibold text-ink">Honesty check · </span>
                  in the walk-forward backtest this model's error was{" "}
                  <strong className={skill.improvement_pct > 0 ? "text-good" : "text-bad"}>
                    {Math.abs(skill.improvement_pct).toFixed(1)}% {skill.improvement_pct > 0 ? "lower" : "higher"}
                  </strong>{" "}
                  than simply guessing "tomorrow = today".
                </div>
              )}

              <Link
                to={`/why?coin=${coin}`}
                className="group flex items-center justify-between rounded-xl border border-sky-400/25 bg-gradient-to-r from-sky-400/10 to-violet-400/10 px-4 py-2.5 text-sm font-medium text-ink transition hover:border-sky-400/50"
              >
                Why this prediction?
                <span aria-hidden="true" className="transition group-hover:translate-x-1">→</span>
              </Link>
            </div>
          );
        }}
      </Async>
    </Card>
  );
}
