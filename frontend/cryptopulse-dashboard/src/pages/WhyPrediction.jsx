import { useState } from "react";
import { Async, CardSkeleton } from "../components/States";
import { Card, Direction, Segmented } from "../components/ui";
import { api } from "../lib/api";
import { longDate, MODEL_LABELS, pct, usd } from "../lib/format";
import { useApi } from "../lib/useApi";

/** Diverging bar row: blue pushes the forecast UP, red pushes it DOWN.
 *  Direction is also carried by the sign and the ▲/▼ glyph, never color alone. */
function ContributionRow({ label, sub, value, max, unit, stacked = false }) {
  // longest bar spans 32% of the track on its side, leaving room for its label
  const w = max ? (Math.abs(value) / max) * 28 : 0;
  const up = value >= 0;
  const text = unit === "usd"
    ? `${up ? "+" : "−"}$${Math.abs(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `${up ? "+" : "−"}${Math.abs(value).toFixed(3)} pp`;
  return (
    <li className={`grid grid-cols-1 items-center gap-x-3 gap-y-0.5 py-1.5 ${stacked ? "" : "sm:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]"}`}
      title={`${label}: ${text}`}>
      <div className="min-w-0">
        <div className="truncate text-sm text-ink">{label}</div>
        {sub && <div className="truncate text-xs text-muted">{sub}</div>}
      </div>
      <div className="relative h-6">
        <div className="absolute inset-y-0 left-1/2 w-px bg-[var(--axis)]" aria-hidden="true" />
        <div
          className="absolute top-1 h-4 rounded"
          style={{
            left: up ? "50%" : `${50 - w}%`,
            width: `${Math.max(w, 0.6)}%`,
            background: up ? "var(--pos)" : "var(--neg)",
          }}
          aria-hidden="true"
        />
        <span
          className="tabular absolute top-0.5 whitespace-nowrap text-xs font-medium text-ink"
          style={up ? { left: `calc(${50 + w}% + 6px)` } : { right: `calc(${50 + w}% + 6px)` }}
        >
          <span aria-hidden="true" className={up ? "text-good" : "text-bad"}>{up ? "▲" : "▼"}</span> {text}
        </span>
      </div>
    </li>
  );
}

function fmtValue(f) {
  const v = f.value;
  if (f.feature === "RSI_14") return v.toFixed(1);
  if (f.feature === "BB_Position") return v.toFixed(2);
  if (f.feature === "Volume_Change") return `${(v * 100).toFixed(1)}%`;
  return `${(v * 100).toFixed(2)}%`;
}

export default function WhyPrediction({ coin }) {
  const [model, setModel] = useState(null);
  const [unit, setUnit] = useState("usd");
  const q = useApi((o) => api.explanation(coin, model, o), [coin, model]);

  return (
    <Async q={q} skeleton={<Card><CardSkeleton lines={8} /></Card>}>
      {(d) => {
        const factor = unit === "usd" ? "contribution_usd" : "contribution_pct";
        const scale = unit === "usd" ? d.current_close / 100 : 1;
        const rows = [
          ...d.top_features.map((f) => ({
            key: f.feature, label: f.description, sub: `Today: ${fmtValue(f)}`, value: f[factor],
          })),
          { key: "other", label: "All other features", sub: null, value: d.other_contribution_pct * scale },
        ];
        const max = Math.max(...rows.map((r) => Math.abs(r.value)));
        const groupMax = Math.max(...d.groups.map((g) => Math.abs(g.contribution_pct * scale)));

        return (
          <div className="space-y-6">
            <Card
              title={`Why does the model expect ${coin} to go ${d.direction === "UP" ? "up" : "down"}?`}
              subtitle={`${MODEL_LABELS[d.model] || d.model} · ${d.method} · features as of ${longDate(d.as_of)}`}
              action={
                <Segmented
                  label="Model to explain"
                  options={d.available_models.map((m) => ({ value: m, label: MODEL_LABELS[m]?.split(" (")[0] || m }))}
                  value={d.model}
                  onChange={setModel}
                />
              }
            >
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <div className="text-xs text-muted">Today's close</div>
                  <div className="tabular text-xl font-semibold text-ink">{usd(d.current_close)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted">Model's average forecast (base value)</div>
                  <div className="tabular text-xl font-semibold text-ink">{pct(d.base_value_pct, 3)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted">This forecast</div>
                  <div className="flex items-center gap-2">
                    <span className="tabular text-xl font-semibold text-ink">{usd(d.predicted_close)}</span>
                    <Direction dir={d.direction} />
                  </div>
                  <div className="tabular text-xs text-ink2">{pct(d.predicted_return_pct, 3)} expected return</div>
                </div>
              </div>
              <p className="mt-4 rounded-lg bg-raised p-3 text-sm text-ink2">
                Reading the chart: the model starts from its average forecast (
                <span className="tabular">{pct(d.base_value_pct, 3)}</span>). Each feature below pushed today's
                forecast <span className="font-medium text-good">▲ up</span> or{" "}
                <span className="font-medium text-bad">▼ down</span>. Added together they give exactly{" "}
                <span className="tabular font-medium text-ink">{pct(d.check_sum_pct, 3)}</span>.
              </p>
            </Card>

            <div className="grid gap-6 lg:grid-cols-3">
              <Card
                className="lg:col-span-2"
                title="What pushed today's forecast"
                subtitle="SHAP contribution of each feature, largest first"
                action={
                  <Segmented label="Units" value={unit} onChange={setUnit}
                    options={[{ value: "usd", label: "USD" }, { value: "pct", label: "% pts" }]} />
                }
              >
                <ul aria-label="Feature contributions">
                  {rows.map((r) => <ContributionRow key={r.key} {...r} max={max} unit={unit} />)}
                </ul>
              </Card>

              <div className="space-y-6">
                <Card title="By type of signal" subtitle="Contributions summed per feature group">
                  <ul>
                    {d.groups.map((g) => (
                      <ContributionRow key={g.group} label={g.group} value={g.contribution_pct * scale}
                        max={groupMax} unit={unit} stacked />
                    ))}
                  </ul>
                </Card>
                <Card title="What this model relies on overall" subtitle="Mean |SHAP| over the last 120 days">
                  <ul className="space-y-2">
                    {d.global_importance.slice(0, 6).map((g) => (
                      <li key={g.feature}>
                        <div className="flex justify-between gap-2 text-xs">
                          <span className="truncate text-ink2">{g.description}</span>
                          <span className="tabular text-ink">{g.share_pct.toFixed(1)}%</span>
                        </div>
                        <div className="mt-1 h-1.5 rounded-full bg-raised">
                          <div className="h-full rounded-full bg-accent"
                            style={{ width: `${(g.share_pct / d.global_importance[0].share_pct) * 100}%` }} />
                        </div>
                      </li>
                    ))}
                  </ul>
                </Card>
              </div>
            </div>

            <Card title="Where is news sentiment?">
              <p className="text-sm text-ink2">{d.sentiment_note}</p>
              <p className="mt-2 text-xs text-muted">{d.disclaimer}</p>
            </Card>
          </div>
        );
      }}
    </Async>
  );
}
