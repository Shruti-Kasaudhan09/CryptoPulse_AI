import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { WalletArt } from "../components/Illustrations";
import { CardSkeleton, ErrorState } from "../components/States";
import { Card, CoinBadge, Direction, Gauge } from "../components/ui";
import { api } from "../lib/api";
import { COINS, pct, usd } from "../lib/format";
import { useAuth } from "../lib/auth";
import { usePortfolio } from "../lib/usePortfolio";

const SAMPLE = [
  { coin: "BTC", amount: 0.05, buy_price: 60000 },
  { coin: "ETH", amount: 1.5, buy_price: 2500 },
  { coin: "SOL", amount: 12, buy_price: 140 },
];

const COIN_COLOR = { BTC: "#f7931a", ETH: "#627eea", SOL: "#14f195" };

function AllocationDonut({ holdings, total }) {
  const size = 180;
  const r = 70;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="relative mx-auto w-fit">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img"
        aria-label={holdings.map((h) => `${h.coin} ${h.weight_pct.toFixed(0)}%`).join(", ")}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="18" />
        {holdings.map((h) => {
          const len = (h.weight_pct / 100) * c;
          const el = (
            <circle key={h.coin} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={COIN_COLOR[h.coin]}
              strokeWidth="18" strokeDasharray={`${Math.max(len - 3, 0.5)} ${c}`} strokeDashoffset={-offset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: "stroke-dasharray .8s ease" }} />
          );
          offset += len;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[10px] uppercase tracking-wider text-muted">Total</span>
        <span className="tabular text-lg font-semibold text-ink">{usd(total, { compact: total >= 1e5 })}</span>
      </div>
    </div>
  );
}

function BigStat({ label, value, sub, tone }) {
  const color = tone === "up" ? "text-good" : tone === "down" ? "text-bad" : "text-ink";
  return (
    <div className="glass tilt rounded-2xl p-4">
      <div className="text-[11px] uppercase tracking-wider text-muted">{label}</div>
      <div className={`tabular mt-1.5 text-2xl font-semibold ${color}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-muted">{sub}</div>}
    </div>
  );
}

function HoldingForm({ onAdd, where }) {
  const [coin, setCoin] = useState("BTC");
  const [amount, setAmount] = useState("");
  const [buy, setBuy] = useState("");
  const [err, setErr] = useState("");

  const submit = (e) => {
    e.preventDefault();
    const a = Number(amount);
    const b = buy === "" ? null : Number(buy);
    if (!(a > 0)) return setErr("Enter how many coins you hold (more than 0).");
    if (b !== null && !(b > 0)) return setErr("Buy price must be more than 0, or leave it empty.");
    setErr("");
    onAdd({ coin, amount: a, buy_price: b });
    setAmount("");
    setBuy("");
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div>
        <div className="mb-2 text-xs font-medium text-ink2">Coin</div>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Coin">
          {COINS.map((c) => (
            <button type="button" key={c.symbol} role="radio" aria-checked={coin === c.symbol}
              onClick={() => setCoin(c.symbol)}
              className={`glass tilt flex flex-col items-center gap-1.5 rounded-xl py-3 ${
                coin === c.symbol ? "!border-sky-400/60 shadow-[0_0_24px_-8px_var(--glow)]" : ""}`}>
              <CoinBadge coin={c.symbol} size={30} />
              <span className="text-xs font-semibold text-ink">{c.symbol}</span>
            </button>
          ))}
        </div>
      </div>
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-ink2">How many {coin} do you hold?</span>
        <input type="number" step="any" min="0" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)}
          placeholder={coin === "BTC" ? "e.g. 0.05" : coin === "ETH" ? "e.g. 1.5" : "e.g. 12"}
          className="tabular w-full rounded-xl border border-line bg-black/30 px-4 py-3 text-sm text-ink placeholder:text-muted focus:border-sky-400/50 focus:outline-none" />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-ink2">
          Average buy price per coin (USD) <span className="text-muted">· optional, for profit/loss</span>
        </span>
        <input type="number" step="any" min="0" inputMode="decimal" value={buy} onChange={(e) => setBuy(e.target.value)}
          placeholder="e.g. 60000"
          className="tabular w-full rounded-xl border border-line bg-black/30 px-4 py-3 text-sm text-ink placeholder:text-muted focus:border-sky-400/50 focus:outline-none" />
      </label>
      {err && <p className="text-xs text-bad" role="alert">{err}</p>}
      <button type="submit"
        className="brand-gradient w-full rounded-xl py-3 text-sm font-semibold text-white shadow-[0_0_28px_-8px_var(--glow)] transition hover:brightness-110 active:scale-[0.99]">
        + Add to portfolio
      </button>
      <p className="text-[11px] leading-relaxed text-muted">
        {where === "account"
          ? "✓ Saved to your account, so it's available on any device."
          : <>Saved only in this browser. <Link to="/signup?next=/portfolio" className="text-accent hover:underline">Create an account</Link> to keep it on every device.</>}
      </p>
    </form>
  );
}

export default function Portfolio() {
  const { holdings, setHoldings, where } = usePortfolio();
  const { user } = useAuth();
  const [state, setState] = useState({ data: null, error: null, loading: false });

  const key = useMemo(() => JSON.stringify(holdings), [holdings]);
  useEffect(() => {
    if (!holdings.length) { setState({ data: null, error: null, loading: false }); return undefined; }
    const ctrl = new AbortController();
    setState((s) => ({ ...s, loading: true, error: null }));
    api.portfolio(holdings, { signal: ctrl.signal })
      .then((data) => setState({ data, error: null, loading: false }))
      .catch((error) => { if (error.name !== "AbortError") setState({ data: null, error, loading: false }); });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const add = (h) => setHoldings((list) => [...list, h]);
  const remove = (i) => setHoldings((list) => list.filter((_, j) => j !== i));
  const d = state.data;

  return (
    <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
      {/* left: builder */}
      <div className="space-y-6">
        <Card title="Add a holding" subtitle={user ? `Saved to ${user.name.split(" ")[0]}'s account` : "Tell CryptoPulse what you own"} icon="+">
          <HoldingForm onAdd={add} where={where} />
        </Card>
        {holdings.length > 0 && (
          <Card title="Your holdings" subtitle={`${holdings.length} entr${holdings.length === 1 ? "y" : "ies"}`} icon="≡"
            action={<button onClick={() => setHoldings([])} className="text-xs text-muted hover:text-bad">Clear all</button>}>
            <ul className="space-y-2">
              {holdings.map((h, i) => (
                <li key={i} className="flex items-center gap-3 rounded-xl border border-line bg-black/20 px-3 py-2.5">
                  <CoinBadge coin={h.coin} size={28} />
                  <div className="min-w-0 flex-1 text-sm">
                    <div className="tabular font-semibold text-ink">{h.amount} {h.coin}</div>
                    <div className="text-[11px] text-muted">{h.buy_price ? `bought at ${usd(h.buy_price)}` : "no buy price"}</div>
                  </div>
                  <button onClick={() => remove(i)} aria-label={`Remove ${h.amount} ${h.coin}`}
                    className="rounded-lg px-2 py-1 text-muted hover:bg-rose-500/10 hover:text-bad">✕</button>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      {/* right: analysis */}
      <div className="min-w-0 space-y-6">
        {!holdings.length && (
          <section className="glass rise relative overflow-hidden rounded-2xl p-8 text-center">
            <div className="pointer-events-none absolute -left-20 -top-20 h-60 w-60 rounded-full bg-violet-500/15 blur-3xl" />
            <WalletArt className="mx-auto h-48 w-auto" />
            <h2 className="font-display mt-4 text-2xl font-bold text-ink">See what the models say about <span className="text-gradient">your</span> money</h2>
            <p className="mx-auto mt-2 max-w-lg text-sm text-ink2">
              Add the coins you hold. CryptoPulse values them live, estimates tomorrow's change with its forecasting
              models, measures your risk, and explains it all in plain language.
            </p>
            <button onClick={() => setHoldings(SAMPLE)}
              className="glass tilt mt-5 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium text-ink">
              Try a sample portfolio →
            </button>
          </section>
        )}

        {holdings.length > 0 && state.loading && !d && <Card><CardSkeleton lines={6} /></Card>}
        {state.error && <ErrorState error={state.error} />}

        {d && (
          <>
            <div className="stagger grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
              <BigStat label="Portfolio value" value={usd(d.total_value)} sub={`as of ${d.as_of}`} />
              <BigStat label="Profit / loss"
                value={d.pnl_total == null ? "—" : `${d.pnl_total >= 0 ? "+" : "−"}${usd(Math.abs(d.pnl_total))}`}
                sub={d.pnl_total_pct == null ? "add buy prices to see this" : `${pct(d.pnl_total_pct, 2)} vs what you paid`}
                tone={d.pnl_total == null ? null : d.pnl_total >= 0 ? "up" : "down"} />
              <BigStat label="Expected tomorrow" value={usd(d.expected_value_tomorrow)}
                sub={`${d.expected_change >= 0 ? "▲ +" : "▼ −"}${usd(Math.abs(d.expected_change))} (${pct(d.expected_change_pct, 2)}) · model estimate`}
                tone={d.expected_change >= 0 ? "up" : "down"} />
              <BigStat label="Typical daily swing" value={`±${usd(d.risk.daily_swing)}`}
                sub="one standard deviation of recent daily moves" />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card title="Allocation" subtitle="Share of your portfolio by value" icon="◔">
                <div className="flex flex-col items-center gap-6 sm:flex-row">
                  <AllocationDonut holdings={d.holdings} total={d.total_value} />
                  <ul className="w-full flex-1 space-y-2.5">
                    {d.holdings.map((h) => (
                      <li key={h.coin} className="text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <span className="flex items-center gap-2 text-ink2">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ background: COIN_COLOR[h.coin] }} aria-hidden="true" />
                            {h.name}
                          </span>
                          <span className="tabular font-semibold text-ink">{h.weight_pct.toFixed(1)}%</span>
                        </div>
                        <div className="mt-1 h-1 rounded-full bg-white/5">
                          <div className="h-full rounded-full" style={{ width: `${h.weight_pct}%`, background: COIN_COLOR[h.coin] }} />
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </Card>

              <Card title="Portfolio risk" subtitle="Value-weighted volatility of what you hold" icon="⚠">
                <div className="relative mx-auto max-w-[240px]">
                  <Gauge value={100 - d.risk.score} label={`Risk ${d.risk.label}`} />
                  <div className="absolute inset-x-0 bottom-0 text-center">
                    <div className={`font-display text-3xl font-bold ${
                      d.risk.label === "Low" ? "text-good" : d.risk.label === "Moderate" ? "text-warn" : "text-bad"}`}>
                      {d.risk.label}
                    </div>
                    <div className="text-[11px] text-muted">risk · score {d.risk.score}/100</div>
                  </div>
                </div>
                <p className="mt-3 text-center text-xs text-muted">
                  Weighted CryptoPulse Score: <span className="tabular text-ink">{d.pulse_weighted}</span>/100
                </p>
              </Card>
            </div>

            <Card title="Coin by coin" subtitle="Live value, tomorrow's forecast and risk for each holding" icon="◈">
              <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                {d.holdings.map((h) => (
                  <div key={h.coin} className="glass tilt rounded-xl p-4">
                    <div className="flex items-center gap-3">
                      <CoinBadge coin={h.coin} size={36} />
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-ink">{h.name}</div>
                        <div className="tabular text-xs text-muted">{h.amount} × {usd(h.price)}</div>
                      </div>
                      <div className="tabular text-right font-semibold text-ink">{usd(h.value)}</div>
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg bg-black/25 px-2.5 py-2">
                        <dt className="text-muted">Tomorrow</dt>
                        <dd className="mt-0.5 flex items-center gap-1.5">
                          <Direction dir={h.forecast_direction} />
                          <span className="tabular text-ink">{pct(h.forecast_return_pct, 2)}</span>
                        </dd>
                      </div>
                      <div className="rounded-lg bg-black/25 px-2.5 py-2">
                        <dt className="text-muted">Profit / loss</dt>
                        <dd className={`tabular mt-0.5 font-medium ${h.pnl == null ? "text-muted" : h.pnl >= 0 ? "text-good" : "text-bad"}`}>
                          {h.pnl == null ? "—" : `${h.pnl >= 0 ? "+" : "−"}${usd(Math.abs(h.pnl))} (${pct(h.pnl_pct, 1)})`}
                        </dd>
                      </div>
                      <div className="rounded-lg bg-black/25 px-2.5 py-2">
                        <dt className="text-muted">Volatility</dt>
                        <dd className="mt-0.5 text-ink">{h.volatility_level}</dd>
                      </div>
                      <div className="rounded-lg bg-black/25 px-2.5 py-2">
                        <dt className="text-muted">Anomaly today</dt>
                        <dd className={`mt-0.5 ${h.anomaly_today ? "text-orange-300" : "text-ink"}`}>
                          {h.anomaly_today ? "⚠ Flagged" : "✓ None"}
                        </dd>
                      </div>
                    </dl>
                  </div>
                ))}
              </div>
            </Card>

            <Card title="What this means" subtitle="Plain-language insights from your data" icon="✦"
              action={
                <Link to={`/ask?q=${encodeURIComponent("How is my portfolio doing?")}`}
                  className="brand-gradient inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold text-white shadow-[0_0_24px_-8px_var(--glow)] transition hover:brightness-110">
                  Ask AI about my portfolio →
                </Link>
              }>
              <ul className="space-y-2.5">
                {d.insights.map((t, i) => (
                  <li key={i} className="flex gap-3 rounded-xl border border-line bg-black/20 px-3.5 py-3 text-sm text-ink2">
                    <span className="mt-0.5 text-accent" aria-hidden="true">✦</span>
                    {t}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[11px] text-muted">{d.disclaimer}</p>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
