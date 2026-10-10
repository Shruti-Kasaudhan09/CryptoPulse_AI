"""
evaluation.py - Model Arena (Phase 19) and Backtest (Phase 20) data
"""

import math

from app.services.data import data_path, model_path, normalise_coin, read_csv
from app.services.market import _clean


def _rows(df):
    return [{k: _clean(v) if not isinstance(v, str) else v for k, v in r.items()}
            for r in df.to_dict(orient="records")]


def get_arena(coin: str | None = None) -> dict:
    df = read_csv(model_path("model_arena_results.csv"),
                  "run ml/models/model_arena.py first.")
    if coin:
        df = df[df["Coin"] == normalise_coin(coin)]

    winners = {}
    for c, sub in df.groupby("Coin"):
        winners[c] = {
            "lowest_rmse": sub.sort_values("RMSE").iloc[0]["Model"],
            "best_direction": sub.sort_values("Direction Accuracy (%)", ascending=False).iloc[0]["Model"],
        }

    return {
        "rows": _rows(df),
        "winners": winners,
        "method": "Single chronological split: train on the first 70% of days, test on the "
                  "last 15%. Tree models predict raw price; LSTM predicts % return.",
    }


def get_backtest(coin: str) -> dict:
    coin = normalise_coin(coin)
    summary = read_csv(model_path("backtest_results.csv"),
                       "run ml/evaluation/backtest.py first.")
    series = read_csv(data_path(f"{coin}_backtest.csv"),
                      "run ml/evaluation/backtest.py first.")

    summary = summary[summary["Coin"] == coin]
    pred_cols = [c for c in series.columns if c.startswith("Pred_")]
    eq_cols = [c for c in series.columns if c.startswith("Equity_")]

    # rolling 30-day direction accuracy per model - shows whether any skill is
    # stable over time or just a lucky stretch
    actual_up = series["Actual_NextClose"] > series["Close"]
    rolling = {}
    for c in pred_cols:
        if c == "Pred_Naive":
            continue
        hit = ((series[c] > series["Close"]) == actual_up).astype(float)
        rolling[c.replace("Pred_", "")] = hit.rolling(30).mean() * 100

    points = []
    for i, r in series.iterrows():
        p = {"date": r["Date"], "close": _clean(r["Close"]), "actual": _clean(r["Actual_NextClose"])}
        for c in pred_cols:
            p[c.replace("Pred_", "pred_")] = _clean(r[c])
        for c in eq_cols:
            p[c.replace("Equity_", "equity_")] = _clean(r[c])
        for name, s in rolling.items():
            v = s.iloc[i]
            p[f"hit30_{name}"] = None if (v is None or math.isnan(v)) else round(float(v), 1)
        points.append(p)

    models = [c.replace("Pred_", "") for c in pred_cols]
    return {
        "coin": coin,
        "start": series["Date"].iloc[0],
        "end": series["Date"].iloc[-1],
        "n_days": int(len(series)),
        "models": models,
        "summary": _rows(summary),
        "series": points,
        "method": "Walk-forward: retrain weekly on all data up to day t, predict day t+1, "
                  "never using future data. Target is next-day % return from scale-free features.",
        "equity_note": "Equity curves are ILLUSTRATIVE ONLY (long when the model predicts UP, "
                       "cash otherwise, 0.1% fee per switch). Not a trading strategy.",
    }
