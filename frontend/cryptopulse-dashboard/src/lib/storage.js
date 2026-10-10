// Per-browser conveniences (portfolio holdings, chat history). Every access is
// wrapped: storage can be blocked (private mode) and the app must still work.
export function load(key, fallback, store = "local") {
  try {
    const s = store === "session" ? sessionStorage : localStorage;
    const v = s.getItem(key);
    return v == null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
}

export function save(key, value, store = "local") {
  try {
    const s = store === "session" ? sessionStorage : localStorage;
    s.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable - keep working in memory */
  }
}

export const PORTFOLIO_KEY = "cp-portfolio";
