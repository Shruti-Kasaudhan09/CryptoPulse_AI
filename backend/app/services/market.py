"""
market.py - price history + technical indicators for the charts (Phase 15)
"""

import math

from app.config import SUPPORTED_COINS
from app.services.data import available_coins, live_features, normalise_coin


def _clean(v):
    """JSON can't carry NaN/inf - turn them into null."""
    if v is None:
        return None
    try:
        f = float(v)
    except (TypeError, ValueError):
        return v
    return None if math.isnan(f) or math.isinf(f) else f


def records(df, cols):
    out = []
    for _, row in df.iterrows():
        rec = {"date": row["Date"].strftime("%Y-%m-%d")}
        for c in cols:
            rec[c] = _clean(row[c])
        out.append(rec)
    return out


def get_market(coin: str, days: int = 180) -> dict:
    coin = normalise_coin(coin)
    df = live_features(coin)
    latest, prev = df.iloc[-1], df.iloc[-2]
    window = df.tail(days)

    cols = ["Open", "High", "Low", "Close", "Volume", "SMA_7", "SMA_30", "EMA_14",
            "BB_Upper", "BB_Lower", "RSI_14", "MACD", "MACD_Signal", "MACD_Hist",
            "Volatility_14"]

    return {
        "coin": coin,
        "name": SUPPORTED_COINS[coin],
        "as_of": latest["Date"].strftime("%Y-%m-%d"),
        "latest": {
            "close": _clean(latest["Close"]),
            "change_pct": _clean((latest["Close"] / prev["Close"] - 1) * 100),
            "volume": _clean(latest["Volume"]),
            "rsi": _clean(latest["RSI_14"]),
            "high_period": _clean(window["High"].max()),
            "low_period": _clean(window["Low"].min()),
        },
        "series": records(window, cols),
    }


def get_overview() -> list:
    """Compact ticker row for the dashboard header: one entry per coin."""
    rows = []
    for coin in available_coins():
        df = live_features(coin)
        latest, prev = df.iloc[-1], df.iloc[-2]
        rows.append({
            "coin": coin,
            "name": SUPPORTED_COINS[coin],
            "close": _clean(latest["Close"]),
            "change_pct": _clean((latest["Close"] / prev["Close"] - 1) * 100),
            "sparkline": [_clean(v) for v in df["Close"].tail(30)],
            "as_of": latest["Date"].strftime("%Y-%m-%d"),
        })
    return rows
