import { useMemo, useState } from "react";
import {
  CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Async, CardSkeleton } from "../components/States";
import { Card, ChartTooltip, Legend, ModelSwatch, Segmented } from "../components/ui";
import { api } from "../lib/api";
import { fixed, longDate, MODEL_COLORS, MODEL_LABELS, num, shortDate, usd } from "../lib/format";
import { useApi } from "../lib/useApi";

const WINDOWS = [
  { value: 60, label: "60d" },
  { value: 120, label: "120d" },
  { value: 0, label: "All" },
];

function ActualVsPredicted({ d }) {
  const ml = d.models.filter((m) => m !== "Naive");
  const [model, setModel] = useState(ml[0]);
  const [win, setWin] = useState(60);
  const data = win ? d.series.slice(-win) : d.series;
  const chosen = ml.includes(model) ? model : ml[0];

  return (
    <Card
      title="Actual vs predicted next-day close"
      subtitle="Every prediction made using only data available at the time"
      action={
        <div className="flex flex-wrap justify-end gap-2">
          <Segmented label="Model" value={chosen} onChange={setModel}
            options={ml.map((m) => ({ value: m, label: MODEL_LABELS[m]?.split(" (")[0] || m }))} />
          <Segmented label="Window" value={win} onChange={setWin} options={WINDOWS} />
        </div>
      }
    >
      <div className="h-72" role="img" aria-label={`Actual versus ${chosen} predicted close`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="date" tickFormatter={shortDate} minTickGap={40} tickLine={false} />
            <YAxis domain={["auto", "auto"]} tickFormatter={(v) => usd(v, { compact: true })} width={64}
              tickLine={false} axisLine={false} />
            <Tooltip content={<ChartTooltip formatter={(v) => usd(v)} labelFormatter={(l) => `Forecast made ${longDate(l)}`} />}
              cursor={{ stroke: "var(--axis)" }} />
            <Line dataKey="actual" name="Actual next close" stroke="var(--ink)" strokeWidth={2} dot={false}
              isAnimationActive={false} />
            <Line dataKey={`pred_${chosen}`} name={MODEL_LABELS[chosen]} stroke={MODEL_COLORS[chosen]} strokeWidth={2}
              dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3">
        <Legend items={[
          { key: "a", label: "Actual next close", color: "var(--ink)" },
          { key: "p", label: MODEL_LABELS[chosen], color: MODEL_COLORS[chosen] },
        ]} />
      </div>
    </Card>
  );
}

export default function Backtest({ coin }) {
  const q = useApi((o) => api.backtest(coin, o), [coin]);

  return (
    <Async q={q} skeleton={<Card><CardSkeleton lines={6} /></Card>}>
      {(d) => <BacktestBody d={d} coin={coin} />}
    </Async>
  );
}

function BacktestBody({ d, coin }) {
  const ml = d.models.filter((m) => m !== "Naive");
  const naive = d.summary.find((r) => r.Model === "Naive");
  const bh = d.summary.find((r) => r.Model === "BuyAndHold");
  const rows = d.summary.filter((r) => r.Model !== "BuyAndHold");
  const beatNaive = rows.filter((r) => r.Model !== "Naive" && naive && r.RMSE < naive.RMSE).map((r) => r.Model);

  const legend = ml.map((m) => ({ key: m, label: MODEL_LABELS[m], color: MODEL_COLORS[m] }));
  const hitData = useMemo(() => d.series.filter((p) => ml.some((m) => p[`hit30_${m}`] != null)), [d, ml]);

  return (
    <div className="space-y-6">
      <Card title={`${coin} walk-forward backtest`}
        subtitle={`${longDate(d.start)} – ${longDate(d.end)} · ${d.n_days} trading days`}>
        <p className="text-sm text-ink2">{d.method}</p>
        <div className="mt-3 rounded-lg bg-raised p-3 text-sm">
          <span className="font-semibold text-ink">Verdict: </span>
          {beatNaive.length ? (
            <span className="text-ink2">
              {beatNaive.map((m) => MODEL_LABELS[m]).join(", ")} beat the naive "tomorrow = today" baseline
              on price error over this period.
            </span>
          ) : (
            <span className="text-ink2">
              No model beat the naive "tomorrow = today" baseline on price error. That's the common,
              honest result for daily crypto prices — look at direction accuracy for any edge.
            </span>
          )}
        </div>
      </Card>

      <Card title="Backtest results" subtitle="Naive baseline included so every number has a reference point">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead className="text-xs text-muted">
              <tr className="border-b border-line">
                <th className="py-2 pr-3 font-medium">Model</th>
                <th className="py-2 pr-3 text-right font-medium">MAE</th>
                <th className="py-2 pr-3 text-right font-medium">RMSE</th>
                <th className="py-2 pr-3 text-right font-medium">vs naive</th>
                <th className="py-2 pr-3 text-right font-medium">Direction acc.</th>
                <th className="py-2 text-right font-medium">Direction F1</th>
              </tr>
            </thead>
            <tbody className="tabular">
              {rows.map((r) => {
                const diff = naive && r.Model !== "Naive" ? ((naive.RMSE - r.RMSE) / naive.RMSE) * 100 : null;
                return (
                  <tr key={r.Model} className="border-b border-line last:border-0">
                    <td className="py-2 pr-3 text-ink2"><ModelSwatch model={r.Model} /></td>
                    <td className="py-2 pr-3 text-right text-ink">{usd(r.MAE)}</td>
                    <td className="py-2 pr-3 text-right text-ink">{usd(r.RMSE)}</td>
                    <td className={`py-2 pr-3 text-right ${diff == null ? "text-muted" : diff > 0 ? "text-good" : "text-bad"}`}>
                      {diff == null ? "baseline" : `${diff > 0 ? "▲ " : "▼ "}${Math.abs(diff).toFixed(1)}% ${diff > 0 ? "better" : "worse"}`}
                    </td>
                    <td className="py-2 pr-3 text-right text-ink">
                      {r["Direction Accuracy (%)"] == null ? "—" : `${fixed(r["Direction Accuracy (%)"], 1)}%`}
                    </td>
                    <td className="py-2 text-right text-ink">
                      {r["Direction F1 (%)"] == null ? "—" : `${fixed(r["Direction F1 (%)"], 1)}%`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <ActualVsPredicted d={d} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Is the direction skill stable?" subtitle="Rolling 30-day direction accuracy · 50% = coin flip">
          <div className="h-60" role="img" aria-label="Rolling 30-day direction accuracy">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={hitData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="date" tickFormatter={shortDate} minTickGap={40} tickLine={false} />
                <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} width={44} tickLine={false} axisLine={false} />
                <ReferenceLine y={50} stroke="var(--ink-2)" strokeDasharray="4 4" />
                <Tooltip content={<ChartTooltip formatter={(v) => `${v}%`} labelFormatter={longDate} />}
                  cursor={{ stroke: "var(--axis)" }} />
                {ml.map((m) => (
                  <Line key={m} dataKey={`hit30_${m}`} name={MODEL_LABELS[m]} stroke={MODEL_COLORS[m]}
                    strokeWidth={2} dot={false} isAnimationActive={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3"><Legend items={legend} /></div>
        </Card>

        <Card title="Illustrative equity curves" subtitle="Growth of $1 · long when model says UP, else cash, 0.1% fee">
          <div className="h-60" role="img" aria-label="Illustrative equity curves">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={d.series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="date" tickFormatter={shortDate} minTickGap={40} tickLine={false} />
                <YAxis tickFormatter={(v) => `$${v.toFixed(2)}`} width={52} tickLine={false} axisLine={false}
                  domain={["auto", "auto"]} />
                <ReferenceLine y={1} stroke="var(--axis)" />
                <Tooltip content={<ChartTooltip formatter={(v) => `$${v.toFixed(3)}`} labelFormatter={longDate} />}
                  cursor={{ stroke: "var(--axis)" }} />
                <Line dataKey="equity_BuyAndHold" name="Buy & hold" stroke="var(--ink-2)" strokeDasharray="4 4"
                  strokeWidth={1.5} dot={false} isAnimationActive={false} />
                {ml.map((m) => (
                  <Line key={m} dataKey={`equity_${m}`} name={MODEL_LABELS[m]} stroke={MODEL_COLORS[m]}
                    strokeWidth={2} dot={false} isAnimationActive={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3">
            <Legend items={[...legend, { key: "bh", label: `Buy & hold (${bh ? `$${num(bh["Illustrative Final Equity"], 2)}` : "—"})`, color: "var(--ink-2)", dashed: true }]} />
          </div>
          <p className="mt-2 text-xs text-muted">{d.equity_note}</p>
        </Card>
      </div>
    </div>
  );
}
