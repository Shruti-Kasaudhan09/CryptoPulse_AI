"""
indicators.py
-------------
Phase 4 of CryptoPulse AI: turn plain OHLCV data into a feature-rich dataset
by computing the technical indicators traders actually look at - SMA, EMA,
RSI, MACD, Bollinger Bands, volatility, returns, volume change and momentum.

These are all computed from scratch with pandas (no ta-lib dependency needed,
since that library is annoying to install on some systems).
"""

import os
import sys

import numpy as np
import pandas as pd

sys.path.append(os.path.join(os.path.dirname(__file__), "..", "preprocessing"))
from clean_data import load_and_clean  # noqa: E402

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
COINS = ["BTC", "ETH", "SOL"]


def sma(series, window):
    return series.rolling(window=window).mean()


def ema(series, span):
    return series.ewm(span=span, adjust=False).mean()


def rsi(series, window=14):
    """Relative Strength Index - measures overbought/oversold conditions."""
    delta = series.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)

    avg_gain = gain.rolling(window=window).mean()
    avg_loss = loss.rolling(window=window).mean()

    rs = avg_gain / avg_loss.replace(0, np.nan)
    rsi_value = 100 - (100 / (1 + rs))
    # when avg_loss is 0 (price only went up), RSI should be 100
    rsi_value = rsi_value.fillna(100)
    return rsi_value


def macd(series, fast=12, slow=26, signal=9):
    """Moving Average Convergence Divergence. Returns (macd_line, signal_line, histogram)."""
    ema_fast = ema(series, fast)
    ema_slow = ema(series, slow)
    macd_line = ema_fast - ema_slow
    signal_line = ema(macd_line, signal)
    histogram = macd_line - signal_line
    return macd_line, signal_line, histogram


def bollinger_bands(series, window=20, num_std=2):
    """Returns (upper_band, lower_band, band_width)."""
    mid = sma(series, window)
    std = series.rolling(window=window).std()
    upper = mid + num_std * std
    lower = mid - num_std * std
    width = upper - lower
    return upper, lower, width


def returns(series, periods=1):
    return series.pct_change(periods=periods)


def volatility(series, window=14):
    """Rolling standard deviation of daily returns - a simple volatility proxy."""
    daily_returns = series.pct_change()
    return daily_returns.rolling(window=window).std()


def volume_change(volume_series):
    return volume_series.pct_change()


def momentum(series, window=10):
    """Difference between current price and price `window` days ago."""
    return series - series.shift(window)


def build_feature_dataset(df, keep_latest=False):
    """
    Takes a cleaned OHLCV dataframe and returns it with all the indicator
    columns added. Rows at the start will have NaNs (not enough history yet
    for the rolling windows) so those get dropped at the end.

    keep_latest=False (training): the most recent day is dropped because it
    has no Target_NextClose yet.
    keep_latest=True (live prediction, used by the backend): the most recent
    day is KEPT with Target_NextClose = NaN, because that is exactly the day
    we want to forecast tomorrow from.
    """
    data = df.copy()
    close = data["Close"]

    data["Return_1d"] = returns(close, 1)
    data["Return_7d"] = returns(close, 7)

    data["SMA_7"] = sma(close, 7)
    data["SMA_14"] = sma(close, 14)
    data["SMA_30"] = sma(close, 30)

    data["EMA_7"] = ema(close, 7)
    data["EMA_14"] = ema(close, 14)

    data["RSI_14"] = rsi(close, 14)

    macd_line, signal_line, macd_hist = macd(close)
    data["MACD"] = macd_line
    data["MACD_Signal"] = signal_line
    data["MACD_Hist"] = macd_hist

    bb_upper, bb_lower, bb_width = bollinger_bands(close)
    data["BB_Upper"] = bb_upper
    data["BB_Lower"] = bb_lower
    data["BB_Width"] = bb_width

    data["Volatility_14"] = volatility(close, 14)
    data["Volume_Change"] = volume_change(data["Volume"])
    data["Momentum_10"] = momentum(close, 10)

    # this is what we're trying to predict: TOMORROW's closing price
    data["Target_NextClose"] = data["Close"].shift(-1)

    # drop rows where the rolling-window features couldn't be computed yet,
    # and the very last row (no target since there's no "tomorrow" for it)
    if keep_latest:
        feature_cols = [c for c in data.columns if c != "Target_NextClose"]
        data = data.dropna(subset=feature_cols).reset_index(drop=True)
    else:
        data = data.dropna().reset_index(drop=True)

    return data


def save_features(coin_name, df):
    out_path = os.path.join(DATA_DIR, f"{coin_name}_features.csv")
    df.to_csv(out_path, index=False)
    print(f"  Saved feature dataset -> {out_path}")


if __name__ == "__main__":
    print("=== CryptoPulse AI - Feature Engineering (Phase 4) ===")
    for coin in COINS:
        print(f"\nBuilding features for {coin} ...")
        try:
            clean_df = load_and_clean(coin)
            feature_df = build_feature_dataset(clean_df)
            save_features(coin, feature_df)
            print(f"  Final shape: {feature_df.shape}")
            print(f"  Columns: {list(feature_df.columns)}")
        except FileNotFoundError as e:
            print(f"  {e}")

    print("\nNext step: run models/train_models.py")
