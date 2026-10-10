"""
volatility_analysis.py
------------------------
Phase 11 of CryptoPulse AI: classify each day into Low/Medium/High
volatility, using the Volatility_14 column already computed in Phase 4
(rolling std of daily returns).

The thresholds are derived from each coin's OWN historical distribution
(33rd/66th percentile), not hardcoded numbers - Bitcoin and a small-cap
altcoin have very different "normal" volatility, so a fixed cutoff would
misclassify one of them.
"""

import os

import pandas as pd

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
COINS = ["BTC", "ETH", "SOL"]


def classify_volatility(df, low_q=0.33, high_q=0.66):
    """
    Adds a Volatility_Level column (Low / Medium / High) based on where
    each day's Volatility_14 falls relative to this coin's own history.
    """
    df = df.copy()
    low_thresh = df["Volatility_14"].quantile(low_q)
    high_thresh = df["Volatility_14"].quantile(high_q)

    def label(v):
        if v <= low_thresh:
            return "Low"
        elif v <= high_thresh:
            return "Medium"
        else:
            return "High"

    df["Volatility_Level"] = df["Volatility_14"].apply(label)
    thresholds = {"low_thresh": low_thresh, "high_thresh": high_thresh}
    return df, thresholds


def current_status(df):
    """Returns the most recent day's volatility level + raw value - what a dashboard would show."""
    latest = df.iloc[-1]
    return {
        "date": latest["Date"],
        "volatility_value": round(latest["Volatility_14"], 5),
        "level": latest["Volatility_Level"],
    }


if __name__ == "__main__":
    print("=== CryptoPulse AI - Volatility Analysis (Phase 11) ===")

    for coin in COINS:
        path = os.path.join(DATA_DIR, f"{coin}_features.csv")
        if not os.path.exists(path):
            print(f"\n{coin}: features file not found, run features/indicators.py first.")
            continue

        df = pd.read_csv(path)
        df["Date"] = pd.to_datetime(df["Date"])

        classified, thresholds = classify_volatility(df)

        print(f"\n{coin}")
        print(f"  Low/Medium cutoff:  {thresholds['low_thresh']:.5f}")
        print(f"  Medium/High cutoff: {thresholds['high_thresh']:.5f}")
        print(f"  Distribution: {classified['Volatility_Level'].value_counts().to_dict()}")

        status = current_status(classified)
        print(f"  Most recent day ({status['date'].date()}): "
              f"{status['level']} volatility ({status['volatility_value']})")

        out_path = os.path.join(DATA_DIR, f"{coin}_volatility.csv")
        classified[["Date", "Close", "Volatility_14", "Volatility_Level"]].to_csv(out_path, index=False)
        print(f"  Saved -> {out_path}")
