import { Link } from "react-router-dom";
import { AiOrb, HeroArt, WalletArt } from "../components/Illustrations";
import { CoinBadge, Delta } from "../components/ui";
import { api } from "../lib/api";
import { initials, useAuth } from "../lib/auth";
import { usd } from "../lib/format";
import { useApi } from "../lib/useApi";

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <span className="brand-gradient flex h-10 w-10 items-center justify-center rounded-xl shadow-[0_0_24px_-4px_var(--glow)]">
        <svg viewBox="0 0 32 32" className="h-5 w-5" aria-hidden="true">
          <path d="M4 17h6l3-8 5 15 3-7h7" fill="none" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className="font-display text-lg font-bold text-ink">CryptoPulse <span className="text-gradient">AI</span></span>
    </Link>
  );
}

function Ticker() {
  const q = useApi((o) => api.overview(o), []);
  const rows = q.data || [];
  if (!rows.length) return null;
  const items = [...rows, ...rows, ...rows, ...rows];
  return (
    <div className="relative overflow-hidden border-y border-line bg-black/30 py-3" aria-label="Live prices">
      <div className="ticker-track flex w-max gap-10">
        {[...items, ...items].map((r, i) => (
          <div key={i} className="flex items-center gap-2.5 whitespace-nowrap text-sm">
            <CoinBadge coin={r.coin} size={22} />
            <span className="font-semibold text-ink">{r.coin}</span>
            <span className="tabular text-ink2">{usd(r.close)}</span>
            <Delta value={r.change_pct} />
          </div>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-[#06080d] to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-[#06080d] to-transparent" />
    </div>
  );
}

const FEATURES = [
  { icon: "◷", title: "Next-day AI forecast", text: "Linear, tree and LSTM models each predict tomorrow's move. You see who agrees and how often they've been right." },
  { icon: "✦", title: "Explains every prediction", text: "SHAP breaks each forecast into the exact push from RSI, momentum, volatility and more. No black box." },
  { icon: "⚑", title: "Risk & anomaly radar", text: "Volatility ranked against each coin's own history, plus Isolation Forest alerts for unusual trading days." },
  { icon: "❝", title: "News sentiment", text: "FinBERT reads live crypto headlines every day and turns them into a positive / negative market mood." },
  { icon: "◈", title: "Ask CryptoPulse AI", text: "Ask in English or Hindi. An AI agent answers from the project's own data and shows exactly what it used." },
  { icon: "▣", title: "My Portfolio", text: "Add the coins you own to see value, profit/loss, tomorrow's outlook and how risky your mix is." },
];

const STEPS = [
  { n: "01", title: "Collect", text: "Daily prices for Bitcoin, Ethereum and Solana, plus live crypto news." },
  { n: "02", title: "Analyse", text: "22 input features feed forecasting models, a volatility model, an anomaly detector and FinBERT." },
  { n: "03", title: "Explain", text: "Every number comes with its reason, its track record and a plain-language summary." },
];

const STATS = [
  ["3", "cryptocurrencies"],
  ["4", "model families"],
  ["22", "model input features"],
  ["8", "AI agent tools"],
  ["95+", "automated tests"],
];

export default function Landing() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen overflow-x-hidden">
      <div className="app-bg" />

      {/* nav */}
      <header className="sticky top-0 z-30 border-b border-line bg-[#06080d]/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Logo />
          <nav className="hidden items-center gap-8 text-sm text-ink2 md:flex" aria-label="Sections">
            <a href="#features" className="hover:text-ink">Features</a>
            <a href="#how" className="hover:text-ink">How it works</a>
            <a href="#assistant" className="hover:text-ink">AI assistant</a>
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            {user ? (
              <>
                <span className="hidden items-center gap-2 text-sm text-ink2 sm:flex">
                  <span className="brand-gradient flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white">{initials(user.name)}</span>
                  {user.name.split(" ")[0]}
                </span>
                <button onClick={logout} className="rounded-lg px-3 py-2 text-sm text-muted hover:text-ink">Sign out</button>
              </>
            ) : (
              <Link to="/login" className="rounded-lg px-3 py-2 text-sm font-medium text-ink2 hover:text-ink">Sign in</Link>
            )}
            <Link to="/dashboard"
              className="brand-gradient rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-[0_0_28px_-8px_var(--glow)] transition hover:brightness-110">
              Launch app
            </Link>
          </div>
        </div>
      </header>

      {/* hero */}
      <section className="relative mx-auto max-w-7xl px-5 pb-16 pt-12 sm:px-8 lg:pb-24 lg:pt-20">
        <div className="pointer-events-none absolute left-1/4 top-10 h-80 w-80 rounded-full bg-sky-500/15 blur-3xl" />
        <div className="pointer-events-none absolute right-0 top-40 h-96 w-96 rounded-full bg-violet-600/20 blur-3xl" />
        <div className="relative grid items-center gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
          <div className="rise">
            <span className="inline-flex items-center gap-2 rounded-full border border-sky-400/25 bg-sky-400/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-sky-300">
              <span className="live-dot h-1.5 w-1.5 rounded-full bg-sky-400" aria-hidden="true" />
              Explainable AI for crypto markets
            </span>
            <h1 className="font-display mt-6 text-5xl font-bold leading-[1.02] tracking-tight text-ink sm:text-6xl xl:text-7xl">
              CryptoPulse <span className="text-gradient">AI</span>
            </h1>
            <p className="font-display mt-5 text-2xl font-semibold leading-snug text-ink2 sm:text-3xl">
              Understand the crypto market,<br className="hidden sm:block" /> not just the price.
            </p>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-ink2">
              AI forecasts for Bitcoin, Ethereum and Solana — with the reasons behind every prediction, a live risk
              radar, news sentiment, an AI assistant you can ask anything, and analysis of your own portfolio.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link to="/dashboard"
                className="brand-gradient inline-flex items-center gap-2 rounded-xl px-6 py-3.5 text-base font-semibold text-white shadow-[0_14px_44px_-12px_var(--glow)] transition hover:-translate-y-0.5 hover:brightness-110">
                Launch dashboard →
              </Link>
              {!user && (
                <Link to="/signup" className="glass tilt inline-flex items-center gap-2 rounded-xl px-6 py-3.5 text-base font-semibold text-ink">
                  Create free account
                </Link>
              )}
            </div>
            <p className="mt-4 text-xs text-muted">No account needed to explore · Not financial advice</p>
          </div>
          <HeroArt className="rise mx-auto w-full max-w-[560px]" />
        </div>
      </section>

      <Ticker />

      {/* stats */}
      <section className="mx-auto max-w-7xl px-5 py-14 sm:px-8">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {STATS.map(([n, label]) => (
            <div key={label} className="glass tilt rounded-2xl px-5 py-6 text-center">
              <div className="font-display text-gradient text-4xl font-bold">{n}</div>
              <div className="mt-2 text-sm text-ink2">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* features */}
      <section id="features" className="mx-auto max-w-7xl scroll-mt-24 px-5 py-14 sm:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Features</div>
          <h2 className="font-display mt-3 text-3xl font-bold text-ink sm:text-4xl">Everything you need to read the market</h2>
          <p className="mt-4 text-ink2">Six tools that work together, each one honest about how much you can trust it.</p>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="glass lift rounded-2xl p-7">
              <div className="brand-gradient flex h-12 w-12 items-center justify-center rounded-xl text-xl text-white shadow-[0_0_24px_-6px_var(--glow)]" aria-hidden="true">
                {f.icon}
              </div>
              <h3 className="font-display mt-5 text-lg font-semibold text-ink">{f.title}</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-ink2">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* how it works */}
      <section id="how" className="mx-auto max-w-7xl scroll-mt-24 px-5 py-14 sm:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">How it works</div>
          <h2 className="font-display mt-3 text-3xl font-bold text-ink sm:text-4xl">From raw prices to clear answers</h2>
        </div>
        <div className="relative mt-12 grid gap-6 md:grid-cols-3">
          <div className="pointer-events-none absolute left-[16%] right-[16%] top-10 hidden h-px bg-gradient-to-r from-sky-400/0 via-sky-400/40 to-violet-400/0 md:block" />
          {STEPS.map((s) => (
            <div key={s.n} className="glass lift relative rounded-2xl p-7 text-center">
              <div className="tabular mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-sky-400/30 bg-[#0d1119] text-lg font-bold text-accent shadow-[0_0_30px_-8px_var(--glow)]">
                {s.n}
              </div>
              <h3 className="font-display mt-5 text-xl font-semibold text-ink">{s.title}</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-ink2">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* assistant + portfolio showcase */}
      <section id="assistant" className="mx-auto max-w-7xl scroll-mt-24 px-5 py-14 sm:px-8">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="glass lift relative overflow-hidden rounded-3xl p-8">
            <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-violet-500/20 blur-3xl" />
            <AiOrb size={84} />
            <h3 className="font-display mt-5 text-2xl font-bold text-ink">Just ask.</h3>
            <p className="mt-2.5 text-sm leading-relaxed text-ink2">
              "Why is the BTC forecast down?" · "क्या SOL अभी रिस्की है?" — the AI agent pulls real numbers from the models
              and shows its work.
            </p>
            <div className="mt-6 space-y-3 text-sm">
              <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-gradient-to-br from-sky-500 to-violet-600 px-4 py-2.5 text-white">
                Is Solana risky right now?
              </div>
              <div className="w-fit max-w-[90%] rounded-2xl rounded-tl-md border border-line bg-white/[0.04] px-4 py-3 text-ink2">
                SOL's volatility is <strong className="text-ink">High</strong>, higher than most of its past days. No anomaly today.
                <div className="mt-2 font-mono text-[11px] text-accent">get_risk(SOL)</div>
              </div>
            </div>
            <Link to="/ask" className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-accent hover:underline">Try the assistant →</Link>
          </div>
          <div className="glass lift relative overflow-hidden rounded-3xl p-8">
            <div className="pointer-events-none absolute -left-16 -bottom-16 h-56 w-56 rounded-full bg-sky-500/15 blur-3xl" />
            <WalletArt className="h-40 w-auto" />
            <h3 className="font-display mt-4 text-2xl font-bold text-ink">Your coins, analysed.</h3>
            <p className="mt-2.5 text-sm leading-relaxed text-ink2">
              Add what you hold and see its live value, profit or loss, tomorrow's outlook and your risk level —
              saved to your account so it follows you everywhere.
            </p>
            <Link to="/portfolio" className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-accent hover:underline">Analyse my portfolio →</Link>
          </div>
        </div>
      </section>

      {/* final CTA */}
      <section className="mx-auto max-w-7xl px-5 pb-20 pt-10 sm:px-8">
        <div className="glass relative overflow-hidden rounded-3xl px-8 py-14 text-center">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-sky-500/10 via-violet-500/10 to-fuchsia-500/10" />
          <h2 className="font-display relative text-3xl font-bold text-ink sm:text-4xl">Ready to see the market clearly?</h2>
          <p className="relative mt-3 text-ink2">Explore as a guest, or create an account to save your portfolio and chats.</p>
          <div className="relative mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/dashboard" className="brand-gradient rounded-xl px-6 py-3.5 font-semibold text-white shadow-[0_14px_44px_-12px_var(--glow)] transition hover:brightness-110">
              Launch dashboard
            </Link>
            {!user && <Link to="/signup" className="glass tilt rounded-xl px-6 py-3.5 font-semibold text-ink">Sign up free</Link>}
          </div>
        </div>
      </section>

      <footer className="relative border-t border-line bg-black/30">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-400/40 to-transparent" />
        <div className="mx-auto max-w-7xl px-5 pb-8 pt-14 sm:px-8">
          <div className="grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
            {/* brand */}
            <div className="col-span-2 lg:col-span-1">
              <Logo />
              <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink2">
                Explainable AI for crypto markets. Forecasts, the reasons behind them, risk and news sentiment
                for Bitcoin, Ethereum and Solana, all in one place.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {["BTC", "ETH", "SOL"].map((c) => (
                  <Link key={c} to={`/dashboard?coin=${c}`}
                    className="glass tilt flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3 text-xs font-semibold text-ink">
                    <CoinBadge coin={c} size={22} /> {c}
                  </Link>
                ))}
              </div>
            </div>

            {/* product */}
            <nav aria-label="Product">
              <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-ink">Product</h3>
              <ul className="mt-4 space-y-2.5 text-sm">
                {[["Dashboard", "/dashboard"], ["Ask CryptoPulse AI", "/ask"], ["My Portfolio", "/portfolio"],
                  ["Why this prediction?", "/why"]].map(([label, to]) => (
                  <li key={to}><Link to={to} className="text-ink2 transition hover:text-accent">{label}</Link></li>
                ))}
              </ul>
            </nav>

            {/* insights */}
            <nav aria-label="Insights">
              <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-ink">Insights</h3>
              <ul className="mt-4 space-y-2.5 text-sm">
                {[["Model Arena", "/arena"], ["Walk-forward Backtest", "/backtest"], ["Features", "#features"],
                  ["How it works", "#how"]].map(([label, to]) => (
                  <li key={label}>
                    {to.startsWith("#")
                      ? <a href={to} className="text-ink2 transition hover:text-accent">{label}</a>
                      : <Link to={to} className="text-ink2 transition hover:text-accent">{label}</Link>}
                  </li>
                ))}
              </ul>
            </nav>

            {/* powered by */}
            <div className="col-span-2 lg:col-span-1">
              <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-ink">Powered by</h3>
              <ul className="mt-4 space-y-2.5 text-sm text-ink2">
                <li><span className="text-muted">Prices ·</span> Yahoo Finance</li>
                <li><span className="text-muted">News ·</span> CoinDesk, Cointelegraph</li>
                <li><span className="text-muted">Sentiment ·</span> FinBERT</li>
                <li><span className="text-muted">Models ·</span> XGBoost, LSTM, SHAP</li>
              </ul>
              {user ? null : (
                <Link to="/signup" className="brand-gradient mt-5 inline-flex rounded-xl px-4 py-2.5 text-xs font-semibold text-white shadow-[0_0_24px_-8px_var(--glow)] transition hover:brightness-110">
                  Create free account →
                </Link>
              )}
            </div>
          </div>

          {/* bottom bar */}
          <div className="mt-12 flex flex-col gap-3 border-t border-line pt-6 text-xs text-muted lg:flex-row lg:items-center lg:justify-between lg:gap-8">
            <p className="whitespace-nowrap">© {new Date().getFullYear()} CryptoPulse AI. All rights reserved.</p>
            <p className="lg:whitespace-nowrap lg:text-right">
              <span className="text-warn">⚠</span> Forecasts are model estimates, <strong className="text-ink2">not financial advice</strong>.{" "}
              <span className="whitespace-nowrap">Crypto is volatile; invest responsibly.</span>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
