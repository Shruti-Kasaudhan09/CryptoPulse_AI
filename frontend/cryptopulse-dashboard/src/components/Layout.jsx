import { Link, NavLink, useLocation, useSearchParams } from "react-router-dom";
import { AiOrb } from "./Illustrations";
import { initials, useAuth } from "../lib/auth";
import { api, apiGet } from "../lib/api";
import { COINS, isCoin, usd } from "../lib/format";
import { useApi } from "../lib/useApi";
import { CoinBadge, Delta, Sparkline } from "./ui";

/** Selected coin lives in the URL (?coin=ETH) so every view is linkable. */
export function useCoin() {
  const [params, setParams] = useSearchParams();
  const raw = (params.get("coin") || "BTC").toUpperCase();
  const setCoin = (c) => {
    const next = new URLSearchParams(params);
    next.set("coin", c);
    setParams(next);
  };
  return { coin: raw, valid: isCoin(raw), setCoin };
}

const Icon = {
  dash: (
    <path d="M3 13h7V3H3v10Zm0 8h7v-6H3v6Zm11 0h7V11h-7v10Zm0-18v6h7V3h-7Z" />
  ),
  why: (
    <path d="M12 2a7 7 0 0 0-4 12.74V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.26A7 7 0 0 0 12 2Zm-2 19h4v1a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-1Z" />
  ),
  arena: (
    <path d="M4 20V10h3v10H4Zm6.5 0V4h3v16h-3ZM17 20v-7h3v7h-3Z" />
  ),
  backtest: (
    <path d="M13 3a9 9 0 0 0-9 9H1l4 4 4-4H6a7 7 0 1 1 2.05 4.95l-1.42 1.42A9 9 0 1 0 13 3Zm-1 5v5l4.25 2.52.77-1.28L13.5 12.2V8H12Z" />
  ),
  ask: (
    <path d="M12 2 9.5 8.5 3 11l6.5 2.5L12 20l2.5-6.5L21 11l-6.5-2.5L12 2Zm7 12-1.2 2.8L15 18l2.8 1.2L19 22l1.2-2.8L23 18l-2.8-1.2L19 14Z" />
  ),
  wallet: (
    <path d="M20 7V5a2 2 0 0 0-2-2H5a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h15a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2Zm-3 8.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3ZM5 7a1 1 0 0 1 0-2h13v2H5Z" />
  ),
};

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: Icon.dash, title: "Market overview", sub: "Forecast, market pulse, volatility, anomalies and sentiment" },
  { to: "/ask", label: "Ask AI", icon: Icon.ask, badge: "NEW", title: "Ask CryptoPulse AI", sub: "Ask anything about the market or your portfolio, answered from live model data" },
  { to: "/portfolio", label: "My Portfolio", icon: Icon.wallet, badge: "NEW", title: "My Portfolio", sub: "Value, tomorrow's outlook and risk for the coins you own", noCoins: true },
  { to: "/why", label: "Why this prediction?", icon: Icon.why, title: "Why this prediction?", sub: "SHAP explains exactly what drove today's forecast" },
  { to: "/arena", label: "Model Arena", icon: Icon.arena, title: "Model Arena", sub: "Every model scored on the same held-out history" },
  { to: "/backtest", label: "Backtest", icon: Icon.backtest, title: "Walk-forward backtest", sub: "How the models would actually have done, day by day" },
];

function NavIcon({ children }) {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0" fill="currentColor" aria-hidden="true">
      {children}
    </svg>
  );
}

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2.5" aria-label="CryptoPulse AI home">
      <span className="brand-gradient flex h-9 w-9 items-center justify-center rounded-xl shadow-[0_0_24px_-4px_var(--glow)]">
        <svg viewBox="0 0 32 32" className="h-5 w-5" aria-hidden="true">
          <path d="M4 17h6l3-8 5 15 3-7h7" fill="none" stroke="#fff" strokeWidth="2.8"
            strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <div className="leading-tight">
        <div className="font-display text-[17px] font-bold text-ink">
          CryptoPulse <span className="text-gradient">AI</span>
        </div>
        <div className="text-[11px] text-muted">Explainable market intelligence</div>
      </div>
    </Link>
  );
}

function UserCard() {
  const { user, logout } = useAuth();
  const { pathname, search } = useLocation();
  const next = encodeURIComponent(pathname + search);
  if (!user) {
    return (
      <div className="glass rounded-xl p-3.5">
        <p className="text-xs leading-relaxed text-ink2">
          You're exploring as a <span className="text-ink">guest</span>. Sign in to save your portfolio and chats.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Link to={`/login?next=${next}`} className="rounded-lg border border-line bg-white/5 py-2 text-center text-xs font-semibold text-ink hover:bg-white/10">
            Sign in
          </Link>
          <Link to={`/signup?next=${next}`} className="brand-gradient rounded-lg py-2 text-center text-xs font-semibold text-white">
            Sign up
          </Link>
        </div>
      </div>
    );
  }
  return (
    <div className="glass flex items-center gap-3 rounded-xl p-3">
      <span className="brand-gradient flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white">
        {initials(user.name)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-ink">{user.name}</div>
        <div className="truncate text-[11px] text-muted">{user.email}</div>
      </div>
      <button onClick={logout} title="Sign out" aria-label="Sign out"
        className="rounded-lg p-2 text-muted hover:bg-white/5 hover:text-bad">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
          <path d="M10 17v-3H3v-4h7V7l5 5-5 5Zm4-14h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5v-2h5V5h-5V3Z" />
        </svg>
      </button>
    </div>
  );
}

function MobileUser() {
  const { user } = useAuth();
  if (user) {
    return (
      <span className="brand-gradient flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold text-white" title={user.name}>
        {initials(user.name)}
      </span>
    );
  }
  return <Link to="/login" className="rounded-lg border border-line bg-white/5 px-3 py-1.5 text-xs font-semibold text-ink">Sign in</Link>;
}

function WelcomeBar() {
  const { user } = useAuth();
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  return (
    <div className="rise flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-sm text-muted">{greet}{user ? `, ${user.name.split(" ")[0]}` : ""} 👋</p>
        <h1 className="font-display mt-1 text-2xl font-bold text-ink sm:text-[30px]">Market overview</h1>
        <p className="mt-1.5 text-sm text-muted">Forecast, market pulse, volatility, anomalies and sentiment. Pick a coin, then swipe through the slides.</p>
      </div>
      {!user && (
        <Link to="/signup?next=/dashboard" className="glass tilt rounded-xl px-4 py-2.5 text-sm font-semibold text-ink">
          ✦ Create free account
        </Link>
      )}
    </div>
  );
}

function ApiStatus() {
  const q = useApi((o) => apiGet("/health", o), []);
  const ok = q.data?.status === "ok" && q.data?.data_ready;
  const state = q.loading ? "checking" : ok ? "online" : q.data ? "no data" : "offline";
  const color = ok ? "bg-emerald-400" : q.loading ? "bg-slate-400" : "bg-rose-400";
  return (
    <div className="flex items-center gap-2 text-xs text-ink2" role="status">
      <span className={`live-dot h-2 w-2 rounded-full ${color}`} aria-hidden="true" />
      API {state}
    </div>
  );
}

function CoinPicker() {
  const { coin, setCoin } = useCoin();
  const overview = useApi((o) => api.overview(o), []);
  const byCoin = Object.fromEntries((overview.data || []).map((r) => [r.coin, r]));

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3" role="tablist" aria-label="Select cryptocurrency">
      {COINS.map((c) => {
        const row = byCoin[c.symbol];
        const selected = coin === c.symbol;
        return (
          <button
            key={c.symbol}
            role="tab"
            aria-selected={selected}
            onClick={() => setCoin(c.symbol)}
            className={`glass tilt group flex items-center gap-3 overflow-hidden rounded-2xl px-4 py-3.5 text-left ${
              selected ? "!border-sky-400/60 shadow-[0_0_0_1px_var(--accent),0_0_32px_-8px_var(--glow)]" : ""
            }`}
          >
            <CoinBadge coin={c.symbol} size={38} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="font-display text-sm font-bold text-ink">{c.symbol}</span>
                <span className="truncate text-xs text-muted sm:hidden lg:inline">{c.name}</span>
              </div>
              {row ? (
                <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="tabular text-[15px] font-semibold text-ink">{usd(row.close)}</span>
                  <span className="text-xs"><Delta value={row.change_pct} /></span>
                </div>
              ) : overview.loading ? (
                <div className="skeleton mt-1.5 h-4 w-28" />
              ) : (
                <div className="mt-0.5 text-xs text-muted">No data</div>
              )}
            </div>
            {row && (
              <span className="block shrink-0 sm:hidden xl:block">
                <Sparkline values={row.sparkline} id={c.symbol} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default function Layout({ children }) {
  const { pathname, search } = useLocation();
  const keep = new URLSearchParams(search).get("coin");
  const suffix = keep ? `?coin=${keep}` : "";
  const page = NAV.find((n) => n.to === pathname) || NAV[0];

  const navLink = (n, compact) => (
    <NavLink
      key={n.to}
      to={`${n.to}${suffix}`}
      end
      className={({ isActive }) =>
        `flex items-center gap-3 whitespace-nowrap rounded-xl text-sm font-medium transition ${
          compact ? "px-3 py-1.5" : "px-3 py-2.5"
        } ${
          isActive
            ? "bg-gradient-to-r from-sky-400/15 to-violet-400/10 text-ink shadow-[inset_0_0_0_1px_rgba(56,189,248,0.25)]"
            : "text-muted hover:bg-white/5 hover:text-ink"
        }`
      }
    >
      <NavIcon>{n.icon}</NavIcon>
      {n.label}
      {n.badge && !compact && (
        <span className="ml-auto rounded-md bg-gradient-to-r from-sky-400 to-violet-500 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-white">
          {n.badge}
        </span>
      )}
    </NavLink>
  );

  return (
    <div className="min-h-screen">
      <div className="app-bg" />

      {/* sidebar - desktop */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-line bg-black/30 px-4 py-6 backdrop-blur-xl lg:flex">
        <div className="px-2"><Logo /></div>
        <nav className="mt-8 space-y-1.5" aria-label="Main">
          <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">Analytics</div>
          {NAV.map((n) => navLink(n, false))}
        </nav>
        <div className="mt-auto space-y-3">
          <UserCard />
          <div className="glass rounded-xl p-3">
            <ApiStatus />
            <p className="mt-2 text-[11px] leading-relaxed text-muted">
              Linear, tree &amp; LSTM models · SHAP explanations · walk-forward validated
            </p>
          </div>
          <p className="px-2 text-[11px] leading-relaxed text-muted">
            © {new Date().getFullYear()} CryptoPulse AI · Forecasts are <span className="text-ink2">not financial advice</span>.
          </p>
        </div>
      </aside>

      {/* top bar - mobile/tablet */}
      <header className="sticky top-0 z-20 border-b border-line bg-black/40 backdrop-blur-xl lg:hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <Logo />
          <div className="flex items-center gap-3">
            <span className="hidden sm:block"><ApiStatus /></span>
            <MobileUser />
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3" aria-label="Main">
          {NAV.map((n) => navLink(n, true))}
        </nav>
      </header>

      <main className="lg:pl-64">
        <div className="mx-auto max-w-[1400px] space-y-7 px-4 py-7 sm:px-6 lg:px-10 lg:py-9">
          {pathname === "/dashboard" ? (
            <WelcomeBar />
          ) : (
            <div className="rise flex flex-wrap items-end justify-between gap-2">
              <div>
                <h1 className="font-display text-2xl font-bold text-ink sm:text-[30px]">{page.title}</h1>
                <p className="mt-1.5 text-sm text-muted">{page.sub}</p>
              </div>
            </div>
          )}
          {!page.noCoins && <CoinPicker />}
          <div key={pathname} className="rise">{children}</div>
          {pathname !== "/ask" && (
            <Link to={`/ask${suffix}`} aria-label="Ask CryptoPulse AI"
              className="halo fixed bottom-5 right-5 z-30 flex items-center gap-2 rounded-full border border-sky-400/30 bg-[#0d1119]/90 py-1.5 pl-1.5 pr-4 text-sm font-semibold text-ink shadow-2xl backdrop-blur-xl transition hover:-translate-y-1 hover:border-sky-400/60">
              <AiOrb size={36} />
              <span className="hidden sm:inline">Ask AI</span>
            </Link>
          )}
          <footer className="pt-4 text-xs text-muted lg:hidden">
            © {new Date().getFullYear()} CryptoPulse AI · Forecasts and scores are model estimates, <strong className="text-ink2">not financial advice</strong>.
          </footer>
        </div>
      </main>
    </div>
  );
}
