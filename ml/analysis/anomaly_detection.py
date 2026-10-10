"""
anomaly_detection.py
----------------------
Phase 12 of CryptoPulse AI: flag days that look unusual compared to a
coin's normal trading pattern, using Isolation Forest.

Isolation Forest works by randomly splitting the data repeatedly - outliers
get isolated into their own tiny partition in far fewer splits than normal
points do, so "average splits needed to isolate this point" becomes an
anomaly score.

IMPORTANT (say this in your report): an anomaly here means "this day's
combination of price/volume/volatility features looks statistically
different from the rest of the dataset" - it does NOT mean fraud,
manipulation, or that something is "wrong". It could just as easily be
a legitimate major news event.
"""

import os

import pandas as pd
from sklearn.ensemble import IsolationForest

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
COINS = ["BTC", "ETH", "SOL"]

# what fraction of days we expect to be flagged as unusual - 5% is a
# reasonable starting point, tune it if you get too many/few anomalies
CONTAMINATION = 0.05

FEATURE_COLS_FOR_ANOMALY = [
    "Return_1d", "Volume_Change", "Volatility_14", "Momentum_10", "RSI_14", "MACD_Hist",
]


def detect_anomalies(df, feature_cols=FEATURE_COLS_FOR_ANOMALY, contamination=CONTAMINATION):
    df = df.copy()
    X = df[feature_cols]

    model = IsolationForest(contamination=contamination, random_state=42, n_estimators=200)
    df["Anomaly_Flag"] = model.fit_predict(X)  # -1 = anomaly, 1 = normal
    df["Anomaly_Score"] = model.decision_function(X)  # lower = more anomalous

    df["Is_Anomaly"] = df["Anomaly_Flag"] == -1
    return df, model


if __name__ == "__main__":
    print("=== CryptoPulse AI - Anomaly Detection (Phase 12) ===")

    for coin in COINS:
        path = os.path.join(DATA_DIR, f"{coin}_features.csv")
        if not os.path.exists(path):
            print(f"\n{coin}: features file not found, run features/indicators.py first.")
            continue

        df = pd.read_csv(path)
        df["Date"] = pd.to_datetime(df["Date"])

        result_df, model = detect_anomalies(df)
        n_anomalies = result_df["Is_Anomaly"].sum()

        print(f"\n{coin}: {n_anomalies} anomalous days out of {len(result_df)} ({n_anomalies/len(result_df)*100:.1f}%)")

        recent_anomalies = result_df[result_df["Is_Anomaly"]].tail(5)
        if len(recent_anomalies) > 0:
            print("  Most recent flagged days:")
            for _, row in recent_anomalies.iterrows():
                print(f"    {row['Date'].date()}  Close=${row['Close']:,.2f}  "
                      f"Return={row['Return_1d']*100:+.2f}%  score={row['Anomaly_Score']:.4f}")

        out_cols = ["Date", "Close", "Return_1d", "Volume_Change", "Volatility_14", "Anomaly_Score", "Is_Anomaly"]
        out_path = os.path.join(DATA_DIR, f"{coin}_anomalies.csv")
        result_df[out_cols].to_csv(out_path, index=False)
        print(f"  Saved -> {out_path}")
