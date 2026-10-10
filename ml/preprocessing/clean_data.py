"""
clean_data.py
-------------
Phase 3 of CryptoPulse AI: clean up the raw OHLCV CSVs before we do anything
else with them. Raw market data almost always has a few issues - missing
rows, duplicate timestamps, wrong dtypes - so we sort that out here first.

Usage:
    python clean_data.py            # cleans BTC, ETH, SOL
    from clean_data import clean_dataframe, load_and_clean
"""

import os

import pandas as pd

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
COINS = ["BTC", "ETH", "SOL"]


def clean_dataframe(df):
    """Takes a raw OHLCV dataframe and returns a cleaned version."""
    df = df.copy()

    # make sure Date is an actual datetime, not a string
    df["Date"] = pd.to_datetime(df["Date"])

    # drop exact duplicate rows if any snuck in
    before = len(df)
    df = df.drop_duplicates(subset="Date")
    if len(df) < before:
        print(f"  Dropped {before - len(df)} duplicate rows")

    # sort chronologically - this matters a LOT for time series, if the
    # rows are out of order every lag/rolling feature downstream breaks
    df = df.sort_values("Date").reset_index(drop=True)

    # forward-fill small gaps in price columns (e.g. an exchange outage day)
    price_cols = ["Open", "High", "Low", "Close"]
    missing_before = df[price_cols].isnull().sum().sum()
    if missing_before > 0:
        print(f"  Found {missing_before} missing price values, forward-filling")
        df[price_cols] = df[price_cols].ffill()

    # volume gaps -> 0 is a reasonable assumption (no trading recorded)
    df["Volume"] = df["Volume"].fillna(0)

    # drop any row that's still broken after the above (e.g. leading NaNs)
    df = df.dropna(subset=price_cols).reset_index(drop=True)

    # sanity check - High should never be below Low. If this ever happens
    # it means the data source glitched, so we just flag it instead of
    # silently trusting garbage data.
    bad_rows = df[df["High"] < df["Low"]]
    if len(bad_rows) > 0:
        print(f"  WARNING: {len(bad_rows)} rows have High < Low, dropping them")
        df = df[df["High"] >= df["Low"]].reset_index(drop=True)

    return df


def load_and_clean(coin_name):
    raw_path = os.path.join(DATA_DIR, f"{coin_name}.csv")
    if not os.path.exists(raw_path):
        raise FileNotFoundError(
            f"{raw_path} not found - run download_data.py first."
        )
    df = pd.read_csv(raw_path)
    cleaned = clean_dataframe(df)
    return cleaned


def save_cleaned(coin_name, df):
    out_path = os.path.join(DATA_DIR, f"{coin_name}_clean.csv")
    df.to_csv(out_path, index=False)
    print(f"  Saved cleaned data -> {out_path}")


if __name__ == "__main__":
    print("=== CryptoPulse AI - Data Cleaning (Phase 3) ===")
    for coin in COINS:
        print(f"\nCleaning {coin} ...")
        try:
            cleaned_df = load_and_clean(coin)
            save_cleaned(coin, cleaned_df)
            print(f"  Final shape: {cleaned_df.shape}")
        except FileNotFoundError as e:
            print(f"  {e}")

    print("\nNext step: run features/indicators.py")
