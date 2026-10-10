"""
cryptopulse_score.py
----------------------
Phase 14 of CryptoPulse AI: combines everything from Phases 4/9/11/12 into
one 0-100 "market intelligence" number per coin, plus a plain-language
breakdown of each component.

This is a PROJECT-DEFINED score, not a trading signal - say that explicitly
whenever you present it. It's meant to demonstrate that you can combine
multiple analytical signals into one interpretable summary, which is the
whole point of this phase in the roadmap.

Components (each scored 0-100, then weighted):
  - Trend      (30%): recent momentum direction & strength
  - RSI        (20%): how overbought/oversold the coin currently is
  - Volatility (20%): lower volatility -> higher score (calmer market)
  - Sentiment  (20%): from the daily sentiment log (Phase 9/10), neutral (50) if no log exists yet
  - Anomaly    (10%): penalty if today was flagged anomalous (Phase 12)

Run this AFTER features/indicators.py and analysis/volatility_analysis.py
and analysis/anomaly_detection.py, for best results. It degrades gracefully
if some of those haven't been run yet (uses neutral defaults).
"""

import os
import sys

import pandas as pd

sys.path.append(os.path.join(os.path.dirname(__file__), "..", "analysis"))
from volatility_analysis import classify_volatility  # noqa: E402
from anomaly_detection import detect_anomalies  # noqa: E402

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
COINS = ["BTC", "ETH", "SOL"]

WEIGHTS = {"trend": 0.30, "rsi": 0.20, "volatility": 0.20, "sentiment": 0.20, "anomaly": 0.10}


def score_trend(df):
    """Normalizes recent momentum into 0-100. 50 = flat, 100 = strong uptrend, 0 = strong downtrend."""
    momentum_pct = df["Momentum_10"].iloc[-1] / df["Close"].iloc[-1] * 100
    # clip to +/-10% momentum as the extremes of the scale, then rescale to 0-100
    clipped = max(-10, min(10, momentum_pct))
    return (clipped + 10) / 20 * 100


def score_rsi(df):
    """RSI near 50 is 'balanced' (scores high); very overbought (>70) or oversold (<30) scores lower."""
    rsi = df["RSI_14"].iloc[-1]
    distance_from_mid = abs(rsi - 50)
    return max(0, 100 - distance_from_mid * 2)


def score_volatility(volatility_level):
    """Calmer market = higher score. This is a deliberate framing choice - explain it if asked."""
    return {"Low": 90, "Medium": 55, "High": 20}.get(volatility_level, 50)


def score_sentiment(sentiment_score_raw):
    """sentiment_score_raw is on a -1 to +1 scale (from Phase 9/10) -> rescale to 0-100."""
    return (sentiment_score_raw + 1) / 2 * 100


def score_anomaly(is_anomaly_today):
    return 30 if is_anomaly_today else 100


def get_latest_sentiment():
    """Reads the daily sentiment log if it exists (Phase 10), else returns neutral."""
    log_path = os.path.join(DATA_DIR, "daily_sentiment_log.csv")
    if os.path.exists(log_path):
        log_df = pd.read_csv(log_path)
        if len(log_df) > 0:
            return log_df.iloc[-1]["sentiment_score"]
    return 0.0  # neutral default if no sentiment log yet


def compute_score(coin_name):
    features_path = os.path.join(DATA_DIR, f"{coin_name}_features.csv")
    if not os.path.exists(features_path):
        raise FileNotFoundError(f"{features_path} not found - run features/indicators.py first.")

    df = pd.read_csv(features_path)
    df["Date"] = pd.to_datetime(df["Date"])

    vol_df, _ = classify_volatility(df)
    volatility_level = vol_df["Volatility_Level"].iloc[-1]

    anomaly_df, _ = detect_anomalies(df)
    is_anomaly_today = bool(anomaly_df["Is_Anomaly"].iloc[-1])

    sentiment_raw = get_latest_sentiment()

    components = {
        "trend": score_trend(df),
        "rsi": score_rsi(df),
        "volatility": score_volatility(volatility_level),
        "sentiment": score_sentiment(sentiment_raw),
        "anomaly": score_anomaly(is_anomaly_today),
    }

    final_score = sum(components[k] * WEIGHTS[k] for k in WEIGHTS)

    return {
        "coin": coin_name,
        "date": df["Date"].iloc[-1],
        "cryptopulse_score": round(final_score, 1),
        "components": {k: round(v, 1) for k, v in components.items()},
        "volatility_level": volatility_level,
        "is_anomaly_today": is_anomaly_today,
        "sentiment_raw": sentiment_raw,
    }


def print_score_card(result):
    print(f"\n{'='*50}")
    print(f"  {result['coin']}  —  CryptoPulse Score")
    print(f"{'='*50}")
    print(f"  {result['cryptopulse_score']}/100")
    print(f"  (as of {result['date'].date()})")
    print(f"\n  Trend       {result['components']['trend']}/100")
    print(f"  RSI balance {result['components']['rsi']}/100")
    print(f"  Volatility  {result['components']['volatility']}/100  ({result['volatility_level']})")
    print(f"  Sentiment   {result['components']['sentiment']}/100  (raw: {result['sentiment_raw']:+.3f})")
    print(f"  Anomaly     {result['components']['anomaly']}/100  "
          f"({'FLAGGED today' if result['is_anomaly_today'] else 'none today'})")
    print(f"\n  Note: an analytical summary of this project's models, not financial advice.")


if __name__ == "__main__":
    print("=== CryptoPulse AI - CryptoPulse Score (Phase 14) ===")

    all_results = []
    for coin in COINS:
        try:
            result = compute_score(coin)
            print_score_card(result)
            all_results.append(result)
        except FileNotFoundError as e:
            print(f"\n{coin}: {e}")

    if all_results:
        summary_df = pd.DataFrame([
            {"Coin": r["coin"], "Score": r["cryptopulse_score"], "Volatility": r["volatility_level"],
             "Anomaly Today": r["is_anomaly_today"]}
            for r in all_results
        ])
        out_path = os.path.join(os.path.dirname(__file__), "..", "saved_models", "cryptopulse_scores.csv")
        summary_df.to_csv(out_path, index=False)
        print(f"\n\nSaved summary -> {out_path}")
