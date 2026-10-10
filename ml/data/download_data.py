"""
download_data.py
-----------------
Phase 2 of CryptoPulse AI: download raw OHLCV (Open, High, Low, Close, Volume)
data for the coins we're starting with - BTC, ETH, SOL.

We're using yfinance here because it gives clean daily OHLCV data for free
without needing an API key, and the ticker symbols for crypto on Yahoo Finance
are just "<COIN>-USD" (e.g. BTC-USD).

Run this file directly to (re)download the CSVs into ml/data/.
"""

import os
import sys

import pandas as pd
import yfinance as yf

# symbol on Yahoo Finance -> what we want to call it locally
COINS = {
    "BTC-USD": "BTC",
    "ETH-USD": "ETH",
    "SOL-USD": "SOL",
}

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
DAYS_OF_HISTORY = "730d"  # ~2 years, gives us enough data to train on


def download_coin(ticker_symbol, save_as, period=DAYS_OF_HISTORY):
    print(f"Downloading {ticker_symbol} ({period}) ...")
    df = yf.download(ticker_symbol, period=period, interval="1d", progress=False)

    if df.empty:
        print(f"  WARNING: got no data for {ticker_symbol}, skipping.")
        return None

    # yfinance sometimes returns a MultiIndex column when downloading a
    # single ticker with the newer version - flatten it if that happens
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)

    df = df.reset_index()
    df = df.rename(columns={
        "Date": "Date",
        "Open": "Open",
        "High": "High",
        "Low": "Low",
        "Close": "Close",
        "Volume": "Volume",
    })
    df = df[["Date", "Open", "High", "Low", "Close", "Volume"]]

    os.makedirs(DATA_DIR, exist_ok=True)
    out_path = os.path.join(DATA_DIR, f"{save_as}.csv")
    df.to_csv(out_path, index=False)
    print(f"  Saved {len(df)} rows -> {out_path}")
    return df


def download_all():
    results = {}
    for ticker, name in COINS.items():
        results[name] = download_coin(ticker, name)
    return results


if __name__ == "__main__":
    print("=== CryptoPulse AI - Data Collection (Phase 2) ===")
    downloaded = download_all()

    ok = [k for k, v in downloaded.items() if v is not None]
    if not ok:
        print("\nNothing downloaded successfully. Check your internet connection.")
        sys.exit(1)

    print(f"\nDone. Data ready for: {', '.join(ok)}")
    print("Next step: run preprocessing/clean_data.py")
