import { api } from "../../lib/api";
import { longDate, MODEL_LABELS, usd } from "../../lib/format";
import { useApi } from "../../lib/useApi";
import { Async, EmptyState } from "../States";
import { Card, Direction } from "../ui";

/** Every forecast the API has served, scored once the real close is known. */
export default function TrackRecord({ coin, refreshKey }) {
  const q = useApi((o) => api.history(coin, o), [coin, refreshKey]);
  return (
    <Card
      icon="✓"
      title="Live track record"
      subtitle="Forecasts saved to the database, checked against what actually happened"
    >
      <Async q={q}>
        {(d) => {
          if (!d.rows.length) {
            return (
              <EmptyState title="No forecasts logged yet">
                Each forecast shown on this dashboard is stored. Come back after the next daily close to
                see whether it was right.
              </EmptyState>
            );
          }
          return (
            <>
              <p className="mb-3 text-sm text-ink2">
                {d.resolved > 0 ? (
                  <>
                    Direction hit rate so far:{" "}
                    <strong className="tabular text-ink">{d.direction_hit_rate_pct}%</strong> over {d.resolved} resolved
                    forecast{d.resolved === 1 ? "" : "s"} (50% = coin flip).
                  </>
                ) : (
                  "No forecast has resolved yet — outcomes appear after the next daily close."
                )}
              </p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-xs">
                  <thead className="text-[11px] uppercase tracking-wider text-muted">
                    <tr className="border-b border-line">
                      <th className="py-2 pr-3 font-medium">For date</th>
                      <th className="py-2 pr-3 font-medium">Model</th>
                      <th className="py-2 pr-3 text-right font-medium">Predicted</th>
                      <th className="py-2 pr-3 font-medium">Call</th>
                      <th className="py-2 pr-3 text-right font-medium">Actual</th>
                      <th className="py-2 font-medium">Result</th>
                    </tr>
                  </thead>
                  <tbody className="tabular">
                    {d.rows.map((r, i) => (
                      <tr key={i} className="border-b border-line transition last:border-0 hover:bg-white/[0.03]">
                        <td className="py-2 pr-3 text-ink">{longDate(r.target_date)}</td>
                        <td className="py-2 pr-3 text-ink2">{MODEL_LABELS[r.model] || r.model}</td>
                        <td className="py-2 pr-3 text-right text-ink">{usd(r.predicted_close)}</td>
                        <td className="py-2 pr-3"><Direction dir={r.direction} /></td>
                        <td className="py-2 pr-3 text-right text-ink">{r.actual_close ? usd(r.actual_close) : "—"}</td>
                        <td className="py-2">
                          {r.direction_correct == null ? (
                            <span className="text-muted">Pending</span>
                          ) : r.direction_correct ? (
                            <span className="font-medium text-good">✓ Correct</span>
                          ) : (
                            <span className="font-medium text-bad">✗ Wrong</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          );
        }}
      </Async>
    </Card>
  );
}
