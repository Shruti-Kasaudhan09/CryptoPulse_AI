import {
  Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Async, CardSkeleton } from "../components/States";
import { Card, ChartTooltip, Legend } from "../components/ui";
import { api } from "../lib/api";
import { fixed, MODEL_COLORS, MODEL_LABELS, num, usd } from "../lib/format";
import { useApi } from "../lib/useApi";

const ORDER = ["LinearRegression", "RandomForest", "XGBoost", "LSTM"];

function pivot(rows, metric) {
  const coins = [...new Set(rows.map((r) => r.Coin))];
  return coins.map((c) => {
    const out = { coin: c };
    rows.filter((r) => r.Coin === c).forEach((r) => { out[r.Model] = r[metric]; });
    return out;
  });
}

function GroupedBars({ data, models, yFormat, refLine, label }) {
  return (
    <div className="h-64" role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2} barCategoryGap="22%">
          <CartesianGrid vertical={false} />
          <XAxis dataKey="coin" tickLine={false} />
          <YAxis tickFormatter={yFormat} width={44} tickLine={false} axisLine={false} />
          {refLine}
          <Tooltip content={<ChartTooltip formatter={yFormat} />} cursor={{ fill: "var(--raised)" }} />
          {models.map((m) => (
            <Bar key={m} dataKey={m} name={MODEL_LABELS[m]} fill={MODEL_COLORS[m]}
              radius={[4, 4, 0, 0]} isAnimationActive={false} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function ModelArena() {
  const q = useApi((o) => api.arena(o), []);

  return (
    <Async q={q} skeleton={<Card><CardSkeleton lines={6} /></Card>}>
      {(d) => {
        const models = ORDER.filter((m) => d.rows.some((r) => r.Model === m));
        const legend = models.map((m) => ({ key: m, label: MODEL_LABELS[m], color: MODEL_COLORS[m] }));
        const coins = Object.keys(d.winners);
        return (
          <div className="space-y-6">
            <Card title="Model Arena" subtitle={d.method}>
              <p className="text-sm text-ink2">
                Every model is scored on the same held-out, most-recent slice of history. The winner is
                whichever the evidence picks — including the simplest baseline if it wins.
              </p>
              <ul className="mt-3 grid gap-2 sm:grid-cols-3">
                {coins.map((c) => (
                  <li key={c} className="rounded-lg bg-raised p-3 text-sm">
                    <div className="font-semibold text-ink">{c}</div>
                    <div className="text-xs text-ink2">
                      Lowest error: <strong className="text-ink">{MODEL_LABELS[d.winners[c].lowest_rmse]}</strong>
                    </div>
                    <div className="text-xs text-ink2">
                      Best direction: <strong className="text-ink">{MODEL_LABELS[d.winners[c].best_direction]}</strong>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card title="Average % error (MAPE)" subtitle="Lower is better · % keeps coins comparable">
                <GroupedBars data={pivot(d.rows, "MAPE (%)")} models={models}
                  yFormat={(v) => `${num(v, 1)}%`} label="MAPE by coin and model" />
                <div className="mt-3"><Legend items={legend} /></div>
              </Card>
              <Card title="Direction accuracy" subtitle="Did it call UP vs DOWN right? 50% = coin flip">
                <GroupedBars data={pivot(d.rows, "Direction Accuracy (%)")} models={models}
                  yFormat={(v) => `${num(v, 0)}%`} label="Direction accuracy by coin and model"
                  refLine={<ReferenceLine y={50} stroke="var(--ink-2)" strokeDasharray="4 4" />} />
                <div className="mt-3"><Legend items={legend} /></div>
              </Card>
            </div>

            <Card title="Full results table" subtitle="Raw numbers behind the charts">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="text-xs text-muted">
                    <tr className="border-b border-line">
                      <th className="py-2 pr-3 font-medium">Coin</th>
                      <th className="py-2 pr-3 font-medium">Model</th>
                      <th className="py-2 pr-3 text-right font-medium">MAE</th>
                      <th className="py-2 pr-3 text-right font-medium">RMSE</th>
                      <th className="py-2 pr-3 text-right font-medium">MAPE</th>
                      <th className="py-2 pr-3 text-right font-medium">Direction acc.</th>
                      <th className="py-2 text-right font-medium">Direction F1</th>
                    </tr>
                  </thead>
                  <tbody className="tabular">
                    {d.rows.map((r) => {
                      const best = d.winners[r.Coin]?.lowest_rmse === r.Model;
                      return (
                        <tr key={`${r.Coin}-${r.Model}`} className="border-b border-line last:border-0">
                          <td className="py-2 pr-3 font-medium text-ink">{r.Coin}</td>
                          <td className="py-2 pr-3 text-ink2">
                            {MODEL_LABELS[r.Model] || r.Model}
                            {best && <span className="ml-2 rounded bg-raised px-1.5 py-0.5 text-xs font-semibold text-good">✓ lowest error</span>}
                          </td>
                          <td className="py-2 pr-3 text-right text-ink">{usd(r.MAE)}</td>
                          <td className="py-2 pr-3 text-right text-ink">{usd(r.RMSE)}</td>
                          <td className="py-2 pr-3 text-right text-ink">{fixed(r["MAPE (%)"], 2)}%</td>
                          <td className="py-2 pr-3 text-right text-ink">{fixed(r["Direction Accuracy (%)"], 1)}%</td>
                          <td className="py-2 text-right text-ink">{fixed(r["Direction F1 (%)"], 1)}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card title="What the arena taught us">
              <div className="space-y-2 text-sm text-ink2">
                <p>
                  Linear Regression, Random Forest and XGBoost here predict tomorrow's <em>price</em>.
                  Tree models can only output values inside the price range they saw in training, so when a
                  coin moves to new highs they systematically under-predict — which is why a plain linear
                  model often wins this arena.
                </p>
                <p>
                  That finding changed the design: the LSTM and the live dashboard models predict tomorrow's
                  <em> % return</em> from scale-free features instead, and are evaluated in the walk-forward
                  <strong className="text-ink"> Backtest</strong> against a naive "tomorrow = today" baseline.
                </p>
              </div>
            </Card>
          </div>
        );
      }}
    </Async>
  );
}
