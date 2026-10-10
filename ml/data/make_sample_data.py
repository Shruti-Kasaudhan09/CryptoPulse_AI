"""
make_sample_data.py
--------------------
Generates SYNTHETIC OHLCV data for BTC/ETH/SOL so the whole system (pipeline,
API, dashboard, tests) can be run without internet access.

THIS IS NOT REAL MARKET DATA. It's a random walk with drift, volatility
clustering and a few injected shocks. Use it only for:
  - running the tests (tests/ use a smaller version of the same generator)
  - demoing offline if Yahoo Finance is unreachable on the day

For real results, always run data/download_data.py instead - it overwrites
these files with real prices.

Usage:
    python data/make_sample_data.py
"""

import os

import numpy as np
import pandas as pd

DATA_DIR = os.path.join(os.path.dirname(__file__))

# rough starting price, daily drift, daily vol - loosely coin-like, not real
PROFILES = {
    "BTC": (60000.0, 0.0008, 0.028),
    "ETH": (3000.0, 0.0005, 0.036),
    "SOL": (140.0, 0.0006, 0.050),
}


def generate_ohlcv(start_price, drift, vol, n_days=730, seed=0, end_date=None):
    rng = np.random.default_rng(seed)
    end_date = pd.Timestamp(end_date or pd.Timestamp.today().normalize())
    dates = pd.date_range(end=end_date, periods=n_days, freq="D")

    # volatility clustering: vol itself follows a slow random walk
    vol_path = vol * np.exp(np.cumsum(rng.normal(0, 0.05, n_days)) * 0.3)
    vol_path = np.clip(vol_path, vol * 0.4, vol * 2.5)
    rets = rng.normal(drift, vol_path)

    # a few shock days so anomaly detection has something to find
    for idx in rng.choice(np.arange(60, n_days), size=8, replace=False):
        rets[idx] += rng.choice([-1, 1]) * rng.uniform(3, 5) * vol

    close = start_price * np.exp(np.cumsum(rets))
    open_ = np.concatenate([[start_price], close[:-1]]) * (1 + rng.normal(0, vol * 0.2, n_days))
    high = np.maximum(open_, close) * (1 + np.abs(rng.normal(0, vol * 0.5, n_days)))
    low = np.minimum(open_, close) * (1 - np.abs(rng.normal(0, vol * 0.5, n_days)))
    volume = np.abs(rng.lognormal(mean=20, sigma=0.4, size=n_days) * (1 + np.abs(rets) * 20))

    return pd.DataFrame({
        "Date": dates, "Open": open_, "High": high, "Low": low,
        "Close": close, "Volume": volume,
    })


if __name__ == "__main__":
    print("=== CryptoPulse AI - SYNTHETIC sample data (offline mode) ===")
    print("WARNING: these are NOT real prices. Run download_data.py for real data.\n")
    for i, (coin, (price, drift, vol)) in enumerate(PROFILES.items()):
        df = generate_ohlcv(price, drift, vol, seed=42 + i)
        path = os.path.join(DATA_DIR, f"{coin}.csv")
        df.to_csv(path, index=False)
        print(f"  {coin}: {len(df)} synthetic rows -> {path}")
    print("\nNext step: python run_pipeline.py --skip-download")
