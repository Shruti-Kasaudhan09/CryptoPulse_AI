import { load } from "./storage";

// Thin API client. In dev, Vite proxies /api to FastAPI; in production
// VITE_API_URL points at the deployed backend (e.g. on Render).
const BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(status, code, detail) {
    super(detail || `Request failed (${status})`);
    this.status = status;
    this.code = code;
  }
}

export async function apiGet(path, { signal, method = "GET", body: payload } = {}) {
  let res;
  try {
    const token = load("cp-auth", null)?.token;
    const headers = {};
    if (payload) headers["Content-Type"] = "application/json";
    if (token) headers.Authorization = `Bearer ${token}`;
    res = await fetch(`${BASE}/api${path}`, {
      signal,
      method,
      headers,
      body: payload ? JSON.stringify(payload) : undefined,
    });
  } catch (err) {
    if (err.name === "AbortError") throw err;
    throw new ApiError(0, "network", "Can't reach the CryptoPulse API. Is the backend running?");
  }
  let body = null;
  try {
    body = await res.json();
  } catch {
    /* non-JSON error page */
  }
  if (!res.ok) {
    // When the FastAPI server is down, the Vite dev proxy answers with a bare
    // 500/502/504 and no JSON body - report that as "backend not running".
    if (!body && res.status >= 500) {
      throw new ApiError(0, "network", "Can't reach the CryptoPulse API. Is the backend running?");
    }
    throw new ApiError(res.status, body?.error || "http_error", body?.detail || `HTTP ${res.status}`);
  }
  return body;
}

export const api = {
  overview: (o) => apiGet("/overview", o),
  market: (coin, days, o) => apiGet(`/market/${coin}?days=${days}`, o),
  prediction: (coin, o) => apiGet(`/prediction/${coin}`, o),
  history: (coin, o) => apiGet(`/predictions/history/${coin}?limit=30`, o),
  sentiment: (o) => apiGet("/sentiment", o),
  volatility: (coin, o) => apiGet(`/volatility/${coin}?days=180`, o),
  anomaly: (coin, o) => apiGet(`/anomaly/${coin}?days=180`, o),
  explanation: (coin, model, o) =>
    apiGet(`/explanation/${coin}${model ? `?model=${model}` : ""}`, o),
  pulse: (coin, o) => apiGet(`/pulse/${coin}`, o),
  arena: (o) => apiGet("/arena", o),
  backtest: (coin, o) => apiGet(`/backtest/${coin}`, o),
  portfolio: (holdings, o) => apiGet("/portfolio", { ...o, method: "POST", body: { holdings } }),
  askStatus: (coin, o) => apiGet(`/ask/status?coin=${coin}`, o),
  ask: (payload, o) => apiGet("/ask", { ...o, method: "POST", body: payload }),
  signup: (body) => apiGet("/auth/signup", { method: "POST", body }),
  login: (body) => apiGet("/auth/login", { method: "POST", body }),
  me: (o) => apiGet("/auth/me", o),
  myPortfolio: (o) => apiGet("/me/portfolio", o),
  saveMyPortfolio: (holdings) => apiGet("/me/portfolio", { method: "PUT", body: { holdings } }),
  myChat: (o) => apiGet("/me/chat", o),
  saveMyChat: (messages) => apiGet("/me/chat", { method: "PUT", body: { messages } }),
};
