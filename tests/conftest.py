"""
conftest.py - shared test fixtures (Phase 21)

Tests never touch the real ml/data or ml/saved_models folders and never need
the internet: a small SYNTHETIC dataset is generated into a temp folder, the
models are trained into it, and the backend is pointed at it through the
CRYPTOPULSE_ML_DIR / DATABASE_URL environment variables.
"""

import os
import sys

import numpy as np
import pandas as pd
import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ML = os.path.join(ROOT, "ml")
for sub in ("data", "preprocessing", "features", "evaluation", "analysis", "scoring", "models"):
    p = os.path.join(ML, sub)
    if p not in sys.path:
        sys.path.insert(0, p)
BACKEND = os.path.join(ROOT, "backend")
if BACKEND not in sys.path:
    sys.path.insert(0, BACKEND)

from make_sample_data import generate_ohlcv  # noqa: E402

COINS = {"BTC": (60000.0, 0.0008, 0.028), "ETH": (3000.0, 0.0005, 0.036), "SOL": (140.0, 0.0006, 0.05)}


@pytest.fixture
def raw_df():
    return generate_ohlcv(60000.0, 0.0008, 0.028, n_days=400, seed=7, end_date="2026-06-30")


@pytest.fixture
def feature_df(raw_df):
    from clean_data import clean_dataframe
    from indicators import build_feature_dataset
    return build_feature_dataset(clean_dataframe(raw_df))


def _build_ml_dir(root):
    """Creates data/ + saved_models/ exactly as the pipeline would, but small."""
    import joblib
    from sklearn.ensemble import RandomForestRegressor
    from sklearn.linear_model import LinearRegression

    import backtest
    from clean_data import clean_dataframe
    from indicators import build_feature_dataset

    data_dir = os.path.join(root, "data")
    models_dir = os.path.join(root, "saved_models")
    os.makedirs(data_dir)
    os.makedirs(models_dir)

    old_data, old_models = backtest.DATA_DIR, backtest.SAVED_MODELS_DIR
    backtest.DATA_DIR, backtest.SAVED_MODELS_DIR = data_dir, models_dir
    arena_rows, bt_results = [], {}
    try:
        for i, (coin, (price, drift, vol)) in enumerate(COINS.items()):
            raw = generate_ohlcv(price, drift, vol, n_days=360, seed=100 + i, end_date="2026-06-30")
            raw.to_csv(os.path.join(data_dir, f"{coin}.csv"), index=False)
            feats = build_feature_dataset(clean_dataframe(raw))
            feats.to_csv(os.path.join(data_dir, f"{coin}_features.csv"), index=False)

            cols = [c for c in feats.columns if c not in ("Date", "Target_NextClose")]
            for name, model in (("LinearRegression", LinearRegression()),
                                ("RandomForest", RandomForestRegressor(n_estimators=20, max_depth=4, random_state=0))):
                model.fit(feats[cols], feats["Target_NextClose"])
                joblib.dump(model, os.path.join(models_dir, f"{coin}_{name}.joblib"))
                arena_rows.append({"Coin": coin, "Model": name, "MAE": 1.0 + i, "RMSE": 2.0 + i + (name == "RandomForest"),
                                   "MAPE (%)": 1.5, "Direction Accuracy (%)": 51.0, "Direction F1 (%)": 50.0})
            bt_results[coin] = backtest.run_for_coin(coin)
        backtest.save_summary(bt_results)
    finally:
        backtest.DATA_DIR, backtest.SAVED_MODELS_DIR = old_data, old_models

    pd.DataFrame(arena_rows).to_csv(os.path.join(models_dir, "model_arena_results.csv"), index=False)
    return root


@pytest.fixture(scope="session")
def ml_dir(tmp_path_factory):
    return _build_ml_dir(str(tmp_path_factory.mktemp("ml")))


@pytest.fixture(scope="session")
def client(ml_dir, tmp_path_factory):
    """FastAPI TestClient wired to the temp data folder and a temp SQLite DB."""
    db_path = tmp_path_factory.mktemp("db") / "test.db"
    os.environ["CRYPTOPULSE_ML_DIR"] = ml_dir
    os.environ["DATABASE_URL"] = f"sqlite:///{db_path}"
    for mod in [m for m in list(sys.modules) if m == "app" or m.startswith("app.")]:
        del sys.modules[mod]

    from fastapi.testclient import TestClient
    from app.main import app

    with TestClient(app) as c:
        yield c


@pytest.fixture
def rng():
    return np.random.default_rng(0)
