export const COINS = [
  { symbol: "BTC", name: "Bitcoin" },
  { symbol: "ETH", name: "Ethereum" },
  { symbol: "SOL", name: "Solana" },
];

export const isCoin = (c) => COINS.some((x) => x.symbol === c);

// Fixed categorical order - color follows the MODEL, never its rank.
export const MODEL_COLORS = {
  Ridge: "var(--series-1)",
  LinearRegression: "var(--series-1)",
  RandomForest: "var(--series-2)",
  XGBoost: "var(--series-3)",
  LSTM: "var(--series-4)",
  Naive: "var(--muted)",
};

export const MODEL_LABELS = {
  Ridge: "Ridge (linear)",
  LinearRegression: "Linear Regression",
  RandomForest: "Random Forest",
  XGBoost: "XGBoost",
  LSTM: "LSTM",
  Naive: "Naive (tomorrow = today)",
  BuyAndHold: "Buy & hold",
};

export function usd(v, { compact = false } = {}) {
  if (v == null || Number.isNaN(v)) return "—";
  const abs = Math.abs(v);
  const digits = abs >= 1000 ? 0 : abs >= 10 ? 2 : abs >= 1 ? 3 : 4;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : digits,
    minimumFractionDigits: compact ? 0 : Math.min(digits, 2),
  }).format(v);
}

export function pct(v, digits = 2, { sign = true } = {}) {
  if (v == null || Number.isNaN(v)) return "—";
  const s = sign && v > 0 ? "+" : "";
  return `${s}${v.toFixed(digits)}%`;
}

export function num(v, digits = 2) {
  if (v == null || Number.isNaN(v)) return "—";
  return v.toLocaleString("en-US", { maximumFractionDigits: digits });
}

export function shortDate(iso) {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function longDate(iso) {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function fixed(v, digits = 1) {
  if (v == null || Number.isNaN(v)) return "—";
  return Number(v).toFixed(digits);
}
