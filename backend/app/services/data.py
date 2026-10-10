"""
data.py
--------
Loads per-coin data from ml/data/ and turns it into the "live" feature table
the rest of the backend uses. Results are cached and automatically refreshed
whenever the underlying CSV changes (e.g. after re-running the pipeline).
"""

import os
from functools import lru_cache

import pandas as pd

from app.config import DATA_DIR, MODELS_DIR, SUPPORTED_COINS
from app.ml_bridge import build_feature_dataset, clean_dataframe


class CoinNotFound(Exception):
    """Coin symbol isn't one we support."""


class BadRequest(Exception):
    """The request itself is invalid (e.g. an unknown model name)."""


class DataNotReady(Exception):
    """The pipeline hasn't produced the files this endpoint needs yet."""


def normalise_coin(coin: str) -> str:
    symbol = coin.upper().strip()
    if symbol not in SUPPORTED_COINS:
        raise CoinNotFound(
            f"'{coin}' is not supported. Available: {', '.join(SUPPORTED_COINS)}"
        )
    return symbol


def mtime(path: str) -> float:
    return os.path.getmtime(path) if os.path.exists(path) else 0.0


def data_path(name: str) -> str:
    return os.path.join(DATA_DIR, name)


def model_path(name: str) -> str:
    return os.path.join(MODELS_DIR, name)


def require(path: str, hint: str) -> str:
    if not os.path.exists(path):
        raise DataNotReady(f"{os.path.basename(path)} not found - {hint}")
    return path


@lru_cache(maxsize=16)
def _live_features_cached(coin: str, _stamp: float) -> pd.DataFrame:
    raw = pd.read_csv(data_path(f"{coin}.csv"))
    clean = clean_dataframe(raw)
    feats = build_feature_dataset(clean, keep_latest=True)
    return feats


def live_features(coin: str) -> pd.DataFrame:
    """
    Feature table INCLUDING the most recent day (whose Target_NextClose is NaN).
    This is the table predictions, volatility, anomalies and the score use.
    """
    coin = normalise_coin(coin)
    require(data_path(f"{coin}.csv"), "run ml/run_pipeline.py first.")
    df = _live_features_cached(coin, mtime(data_path(f"{coin}.csv")))
    return df.copy()


@lru_cache(maxsize=32)
def _csv_cached(path: str, _stamp: float) -> pd.DataFrame:
    return pd.read_csv(path)


def read_csv(path: str, hint: str) -> pd.DataFrame:
    require(path, hint)
    return _csv_cached(path, mtime(path)).copy()


def available_coins() -> list:
    return [c for c in SUPPORTED_COINS if os.path.exists(data_path(f"{c}.csv"))]
