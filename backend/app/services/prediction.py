"""
prediction.py - next-day forecast (Phase 15)

Live forecasts come from the RETURN models saved by ml/evaluation/backtest.py
({COIN}_{Model}_returns.joblib) plus the Phase 8 LSTM if TensorFlow is
installed. All of them predict tomorrow's % return, which is turned back
into a price as  today's_close * (1 + predicted_return).

Why not the Phase 6 price-level models? They can't extrapolate beyond the
price range seen in training - on a coin at new highs they forecast huge
false crashes. That finding is documented in the Model Arena; the dashboard
uses the models that fix it.

The "headline" model is the one with the lowest walk-forward RMSE in the
Phase 20 backtest - chosen by evidence, not hardcoded - and the response
reports honestly how it compares with the naive "tomorrow = today" baseline.
"""

import os
from functools import lru_cache

import joblib
import numpy as np
import pandas as pd

from app.config import DISCLAIMER, FORECAST_MODELS
from app.ml_bridge import add_stationary_features
from app.services.data import (
    BadRequest, DataNotReady, live_features, model_path, mtime, normalise_coin, read_csv,
)

NON_FEATURE_COLS = ["Date", "Target_NextClose"]
LSTM_LOOKBACK = 30
LSTM_RETURN_SCALE = 100.0


@lru_cache(maxsize=32)
def _load_joblib(path: str, _stamp: float):
    return joblib.load(path)


def load_return_model(coin: str, model_name: str):
    path = model_path(f"{coin}_{model_name}_returns.joblib")
    if not os.path.exists(path):
        return None
    return _load_joblib(path, mtime(path))


def stationary_frame(coin: str) -> pd.DataFrame:
    """Live features (incl. today) + the scale-free columns the return models use."""
    return add_stationary_features(live_features(coin))


_keras_store = {}


def _predict_lstm_return(coin: str, df: pd.DataFrame):
    """Predicted next-day return from the Phase 8 LSTM, or None if unavailable."""
    keras_path = model_path(f"{coin}_LSTM.keras")
    scaler_path = model_path(f"{coin}_LSTM_scaler.joblib")
    if not (os.path.exists(keras_path) and os.path.exists(scaler_path)):
        return None
    try:
        from tensorflow.keras.models import load_model as keras_load  # heavy, optional
    except ImportError:
        return None

    key = (keras_path, mtime(keras_path))
    if key not in _keras_store:
        _keras_store[key] = keras_load(keras_path)
    model = _keras_store[key]
    scaler = _load_joblib(scaler_path, mtime(scaler_path))

    cols = list(getattr(scaler, "feature_names_in_",
                        [c for c in df.columns if c not in NON_FEATURE_COLS]))
    window = df[cols].tail(LSTM_LOOKBACK)
    if len(window) < LSTM_LOOKBACK:
        return None
    x = scaler.transform(window)[np.newaxis, :, :]
    return float(model.predict(x, verbose=0).flatten()[0]) / LSTM_RETURN_SCALE


def backtest_table():
    return read_csv(model_path("backtest_results.csv"), "run ml/evaluation/backtest.py first.")


def _backtest_rmse(coin: str) -> dict:
    try:
        bt = backtest_table()
    except DataNotReady:
        return {}
    sub = bt[bt["Coin"] == coin].dropna(subset=["RMSE"])
    return dict(zip(sub["Model"], sub["RMSE"]))


def predict_returns(coin: str) -> dict:
    coin = normalise_coin(coin)
    df = stationary_frame(coin)
    latest = df.iloc[[-1]]

    returns = {}
    for name in FORECAST_MODELS:
        model = load_return_model(coin, name)
        if model is None:
            continue
        cols = list(getattr(model, "feature_names_in_"))
        returns[name] = float(model.predict(latest[cols])[0])

    lstm = _predict_lstm_return(coin, live_features(coin))
    if lstm is not None:
        returns["LSTM"] = lstm

    if not returns:
        raise DataNotReady(f"No forecasting models for {coin} - run ml/run_pipeline.py "
                           "(the backtest step saves them).")
    return {"coin": coin, "as_of": latest["Date"].iloc[0],
            "current_close": float(latest["Close"].iloc[0]), "returns": returns}


def get_prediction(coin: str, model: str | None = None) -> dict:
    result = predict_returns(coin)
    coin, returns, current = result["coin"], result["returns"], result["current_close"]
    rmse = _backtest_rmse(coin)

    if model:
        if model not in returns:
            raise BadRequest(f"Model '{model}' isn't available for {coin}. "
                               f"Available: {', '.join(returns)}")
        chosen, reason = model, "requested"
    else:
        ranked = sorted((m for m in returns if m in rmse), key=lambda m: rmse[m])
        chosen = ranked[0] if ranked else next(iter(returns))
        reason = "lowest walk-forward RMSE in the backtest" if ranked else "default"

    def entry(name, r):
        price = current * (1 + r)
        return {
            "model": name,
            "predicted_close": round(price, 4),
            "predicted_return_pct": round(r * 100, 3),
            "direction": "UP" if r > 0 else "DOWN",
            "backtest_rmse": rmse.get(name),
        }

    all_models = [entry(n, r) for n, r in returns.items()]
    ups = sum(1 for m in all_models if m["direction"] == "UP")

    naive = rmse.get("Naive")
    chosen_rmse = rmse.get(chosen)
    skill = None
    if naive and chosen_rmse:
        skill = {
            "naive_rmse": naive,
            "model_rmse": chosen_rmse,
            # positive = model beat "tomorrow = today"; negative = it didn't
            "improvement_pct": round((naive - chosen_rmse) / naive * 100, 2),
        }

    as_of = result["as_of"]
    return {
        "coin": coin,
        "as_of": as_of.strftime("%Y-%m-%d"),
        "forecast_for": (as_of + pd.Timedelta(days=1)).strftime("%Y-%m-%d"),
        "current_close": round(current, 4),
        "headline": entry(chosen, returns[chosen]),
        "selection_reason": reason,
        "all_models": all_models,
        "agreement": {"up": ups, "down": len(all_models) - ups, "total": len(all_models)},
        "skill_vs_naive": skill,
        "disclaimer": DISCLAIMER,
    }
