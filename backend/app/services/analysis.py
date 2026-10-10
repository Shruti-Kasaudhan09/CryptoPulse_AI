"""
analysis.py - volatility (Phase 11), anomalies (Phase 12) and the
CryptoPulse Score (Phase 14), served to the dashboard.
"""

import pandas as pd

from app.config import DISCLAIMER
from app.ml_bridge import (
    FEATURE_COLS_FOR_ANOMALY, WEIGHTS, classify_volatility, detect_anomalies,
    score_anomaly, score_rsi, score_sentiment, score_trend, score_volatility,
)
from app.services.data import live_features, normalise_coin
from app.services.market import _clean

FRIENDLY = {
    "Return_1d": "daily price move",
    "Volume_Change": "trading volume",
    "Volatility_14": "volatility",
    "Momentum_10": "10-day momentum",
    "RSI_14": "RSI",
    "MACD_Hist": "MACD histogram",
}


# ---------------------------------------------------------------- volatility
def get_volatility(coin: str, days: int = 180) -> dict:
    coin = normalise_coin(coin)
    df, thresholds = classify_volatility(live_features(coin))
    latest = df.iloc[-1]
    window = df.tail(days)
    return {
        "coin": coin,
        "as_of": latest["Date"].strftime("%Y-%m-%d"),
        "level": latest["Volatility_Level"],
        "value": _clean(latest["Volatility_14"]),
        "percentile": _clean((df["Volatility_14"] <= latest["Volatility_14"]).mean() * 100),
        "thresholds": {k: _clean(v) for k, v in thresholds.items()},
        "distribution": df["Volatility_Level"].value_counts().to_dict(),
        "method": "Rolling 14-day std of daily returns; Low/Medium/High cut at this coin's "
                  "own 33rd/66th percentiles.",
        "series": [
            {"date": r["Date"].strftime("%Y-%m-%d"), "value": _clean(r["Volatility_14"]),
             "level": r["Volatility_Level"]}
            for _, r in window.iterrows()
        ],
    }


# ------------------------------------------------------------------ anomaly
def _anomaly_reason(df: pd.DataFrame, idx: int) -> str:
    """Names the feature that was furthest from its normal range on that day."""
    feats = df[FEATURE_COLS_FOR_ANOMALY]
    z = ((feats.iloc[idx] - feats.mean()) / feats.std()).abs()
    top = z.idxmax()
    direction = "high" if df[top].iloc[idx] > feats[top].mean() else "low"
    return f"Unusually {direction} {FRIENDLY.get(top, top)} ({z[top]:.1f}σ from normal)"


def get_anomalies(coin: str, days: int = 180, limit: int = 10) -> dict:
    coin = normalise_coin(coin)
    df, _ = detect_anomalies(live_features(coin))
    df = df.reset_index(drop=True)
    latest = df.iloc[-1]

    flagged_idx = df.index[df["Is_Anomaly"]].tolist()
    recent = []
    for i in reversed(flagged_idx[-limit:]):
        row = df.iloc[i]
        recent.append({
            "date": row["Date"].strftime("%Y-%m-%d"),
            "close": _clean(row["Close"]),
            "return_pct": _clean(row["Return_1d"] * 100),
            "score": _clean(row["Anomaly_Score"]),
            "reason": _anomaly_reason(df, i),
        })

    window = df.tail(days)
    return {
        "coin": coin,
        "as_of": latest["Date"].strftime("%Y-%m-%d"),
        "today_is_anomaly": bool(latest["Is_Anomaly"]),
        "today_reason": _anomaly_reason(df, len(df) - 1) if latest["Is_Anomaly"] else None,
        "total_flagged": int(df["Is_Anomaly"].sum()),
        "total_days": int(len(df)),
        "recent": recent,
        "note": "An anomaly means this day's combination of features is statistically unusual "
                "for this coin. It does NOT imply fraud or manipulation.",
        "series": [
            {"date": r["Date"].strftime("%Y-%m-%d"), "close": _clean(r["Close"]),
             "score": _clean(r["Anomaly_Score"]), "is_anomaly": bool(r["Is_Anomaly"])}
            for _, r in window.iterrows()
        ],
    }


# ------------------------------------------------------------ pulse score
def _trend_label(score):
    return "Up" if score >= 60 else "Down" if score <= 40 else "Sideways"


def _sentiment_label(raw):
    return "Positive" if raw > 0.1 else "Negative" if raw < -0.1 else "Neutral"


def get_pulse(coin: str, sentiment_raw: float = 0.0, sentiment_available: bool = False) -> dict:
    """
    Same formula as ml/scoring/cryptopulse_score.py, but on the live feature
    table (which includes today) and with sentiment passed in from the DB/log.
    """
    coin = normalise_coin(coin)
    df = live_features(coin)
    vol_df, _ = classify_volatility(df)
    anom_df, _ = detect_anomalies(df)
    level = vol_df["Volatility_Level"].iloc[-1]
    is_anom = bool(anom_df["Is_Anomaly"].iloc[-1])

    components = {
        "trend": score_trend(df),
        "rsi": score_rsi(df),
        "volatility": score_volatility(level),
        "sentiment": score_sentiment(sentiment_raw),
        "anomaly": score_anomaly(is_anom),
    }
    total = sum(components[k] * WEIGHTS[k] for k in WEIGHTS)

    return {
        "coin": coin,
        "as_of": df["Date"].iloc[-1].strftime("%Y-%m-%d"),
        "score": round(total, 1),
        "components": [
            {"key": k, "score": round(v, 1), "weight": WEIGHTS[k],
             "contribution": round(v * WEIGHTS[k], 1)}
            for k, v in components.items()
        ],
        "labels": {
            "trend": _trend_label(components["trend"]),
            "rsi": round(float(df["RSI_14"].iloc[-1]), 1),
            "volatility": level,
            "sentiment": _sentiment_label(sentiment_raw) if sentiment_available else "No data yet",
            "anomaly": "Detected today" if is_anom else "None detected",
        },
        "sentiment_available": sentiment_available,
        "disclaimer": "A project-defined analytical score, not a buy/sell signal. " + DISCLAIMER,
    }
