"""
explanation.py - "Why this prediction?" via SHAP (Phase 13 -> Phase 18 page)

Explains the live forecasting models (the return-models from the Phase 20
backtest). For every input feature we get how much it pushed tomorrow's
predicted RETURN up or down, relative to the model's average prediction:

    predicted_return = base_value + sum(contributions)

  - RandomForest / XGBoost: shap.TreeExplainer (exact for tree ensembles)
  - Ridge: exact linear SHAP. The pipeline is StandardScaler -> Ridge, so
    contribution_i = w_i * (x_i - mean_i) / std_i, and base = intercept.
    No approximation, and no extra library call needed.

Contributions are returned both in % points of return and in dollars
(x today's close) so the page can say "RSI pulled the forecast down by $120".
"""

from functools import lru_cache

import numpy as np

from app.config import DISCLAIMER, FORECAST_MODELS
from app.ml_bridge import STATIONARY_FEATURES
from app.services.data import BadRequest, DataNotReady, model_path, mtime, normalise_coin
from app.services.prediction import _backtest_rmse, load_return_model, stationary_frame

GROUPS = {
    "Momentum & trend": ["Return_1d", "Return_7d", "Momentum_Norm", "MACD_Norm",
                         "MACD_Hist_Norm", "Close_vs_SMA7", "Close_vs_SMA30", "Close_vs_EMA14"],
    "Overbought / oversold": ["RSI_14", "BB_Position"],
    "Volatility": ["Volatility_14"],
    "Volume": ["Volume_Change"],
}

DESCRIPTIONS = {
    "Return_1d": "Today's price move",
    "Return_7d": "Price move over the last 7 days",
    "RSI_14": "RSI (14-day) - overbought/oversold",
    "Volatility_14": "14-day volatility",
    "Volume_Change": "Volume change vs yesterday",
    "Close_vs_SMA7": "Price vs its 7-day average",
    "Close_vs_SMA30": "Price vs its 30-day average",
    "Close_vs_EMA14": "Price vs its 14-day EMA",
    "BB_Position": "Position in Bollinger Bands (0 low, 1 high)",
    "MACD_Norm": "MACD line (as % of price)",
    "MACD_Hist_Norm": "MACD histogram (as % of price)",
    "Momentum_Norm": "10-day momentum (as % of price)",
}


def _group_of(feature):
    for g, feats in GROUPS.items():
        if feature in feats:
            return g
    return "Other"


@lru_cache(maxsize=16)
def _tree_explainer(path: str, _stamp: float):
    import joblib
    import shap
    return shap.TreeExplainer(joblib.load(path))


def _shap_values(coin, model_name, model, X):
    """Returns (base_value, shap_matrix) in return units for the rows in X."""
    if model_name == "Ridge":
        scaler, ridge = model[0], model[-1]
        coef = np.asarray(ridge.coef_).ravel()
        contrib = (X.values - scaler.mean_) / scaler.scale_ * coef
        return float(ridge.intercept_), contrib

    try:
        import shap  # noqa: F401
    except ImportError as e:
        raise DataNotReady("shap is not installed on the server - pip install shap") from e
    path = model_path(f"{coin}_{model_name}_returns.joblib")
    explainer = _tree_explainer(path, mtime(path))
    values = np.asarray(explainer.shap_values(X))
    return float(np.ravel(explainer.expected_value)[0]), values


def default_model(coin: str) -> str:
    """Explain the same model the dashboard headlines (lowest backtest RMSE)."""
    rmse = _backtest_rmse(coin)
    ranked = sorted((m for m in FORECAST_MODELS if m in rmse and load_return_model(coin, m)),
                    key=lambda m: rmse[m])
    return ranked[0] if ranked else "RandomForest"


def get_explanation(coin: str, model_name: str | None = None, top_n: int = 10) -> dict:
    coin = normalise_coin(coin)
    model_name = model_name or default_model(coin)
    if model_name not in FORECAST_MODELS:
        raise BadRequest(f"Explanations are available for: {', '.join(FORECAST_MODELS)}")
    model = load_return_model(coin, model_name)
    if model is None:
        raise DataNotReady(f"{coin}_{model_name}_returns.joblib not found - run ml/run_pipeline.py.")

    df = stationary_frame(coin)
    cols = list(getattr(model, "feature_names_in_", STATIONARY_FEATURES))
    X_today = df[cols].iloc[[-1]]
    current = float(df["Close"].iloc[-1])

    base, shap_today = _shap_values(coin, model_name, model, X_today)
    contrib = shap_today[0]
    pred_return = float(model.predict(X_today)[0])

    recent = df[cols].tail(120)
    _, shap_recent = _shap_values(coin, model_name, model, recent)
    global_imp = np.abs(shap_recent).mean(axis=0)

    features = sorted(
        (
            {
                "feature": f,
                "description": DESCRIPTIONS.get(f, f),
                "group": _group_of(f),
                "value": float(X_today[f].iloc[0]),
                "contribution_pct": float(c * 100),
                "contribution_usd": float(c * current),
            }
            for f, c in zip(cols, contrib)
        ),
        key=lambda d: abs(d["contribution_pct"]),
        reverse=True,
    )

    groups = {}
    for f in features:
        groups[f["group"]] = groups.get(f["group"], 0.0) + f["contribution_pct"]

    total = float(global_imp.sum()) or 1.0
    importance = sorted(
        ({"feature": f, "description": DESCRIPTIONS.get(f, f), "share_pct": float(v / total * 100)}
         for f, v in zip(cols, global_imp)),
        key=lambda d: d["share_pct"], reverse=True,
    )

    rest = features[top_n:]
    return {
        "coin": coin,
        "model": model_name,
        "available_models": [m for m in FORECAST_MODELS if load_return_model(coin, m) is not None],
        "method": "Exact linear SHAP" if model_name == "Ridge" else "SHAP TreeExplainer",
        "as_of": df["Date"].iloc[-1].strftime("%Y-%m-%d"),
        "current_close": current,
        "predicted_return_pct": pred_return * 100,
        "predicted_close": current * (1 + pred_return),
        "direction": "UP" if pred_return > 0 else "DOWN",
        "base_value_pct": base * 100,
        "check_sum_pct": (base + float(np.sum(contrib))) * 100,
        "top_features": features[:top_n],
        "other_contribution_pct": float(sum(f["contribution_pct"] for f in rest)),
        "groups": [{"group": g, "contribution_pct": v} for g, v in
                   sorted(groups.items(), key=lambda kv: -abs(kv[1]))],
        "global_importance": importance,
        "sentiment_note": "News sentiment is not a model input yet: there is no free historical "
                          "news archive to train on. The daily sentiment log is collecting that "
                          "history so it can be added as a feature later.",
        "disclaimer": DISCLAIMER,
    }
